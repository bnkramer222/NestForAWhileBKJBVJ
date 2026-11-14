import * as clientModel from '../models/client.model.js';
import * as productModel from '../models/product.model.js';
import * as sessionModel from '../models/session.model.js';
import { buildRecommendations } from '../services/dietaryMatrix.js';
import { evaluateItem, synthesizeRecipes } from '../services/aiEngine.js';
import QRCode from 'qrcode';
import { ah } from '../lib/asyncHandler.js';
import { statusCopy, categoryCopy } from '../lib/shopperCopy.js';
import { allergenLabel } from '../lib/allergens.js';
import { planText, localizeReasons, languageName } from '../i18n/index.js';

/** Allergen name in the shopper's language (falls back to the English label). */
const allergenName = (t) => (key) => {
  const text = t(`allergen.${key}`);
  return text === `allergen.${key}` ? allergenLabel(key) : text;
};

/** Evaluate an item for this shopper and translate its explanations. */
const evaluateFor = (req, product, profile) =>
  localizeReasons(evaluateItem({ product, profile }), req.t, allergenName(req.t));
import { badRequest, conflict, unauthorized } from '../lib/httpError.js';

async function loadContext(req) {
  const shopping = req.session.shopping;
  if (!shopping) return null;

  const sessionRow = await sessionModel.getSessionSummary(shopping.id);
  if (!sessionRow || sessionRow.status !== 'active') {
    delete req.session.shopping;
    return null;
  }

  const client = await clientModel.findById(shopping.clientId);
  if (!client) return null;

  await sessionModel.touchSession(shopping.id); // still shopping — keep the floor slot

  return { shopping, sessionRow, client };
}

/** Attach each cart line's current clinical evaluation (for friendly labels and serving hints). */
async function enrichCart(req, sessionId, profile) {
  const cart = await sessionModel.getCart(sessionId);
  const products = await productModel.findManyBySkus(cart.map((line) => line.sku));
  const bySku = new Map(products.map((product) => [product.sku, product]));
  return cart.map((line) => {
    const product = bySku.get(line.sku);
    const evaluation = product ? evaluateFor(req, product, profile) : null;
    const capServings = evaluation?.capServings ?? null;
    return {
      ...line,
      status: evaluation?.status || line.evaluated_status,
      reasons: evaluation?.reasons || [],
      capServings,
      overCap: line.evaluated_status === 'capped' && capServings !== null && line.quantity > capServings,
      onHand: Number(product?.on_hand ?? 0),
    };
  });
}

function catalogFor(req, inventory, profile) {
  const labels = categoryCopy(req.t);
  const groups = new Map();
  for (const product of inventory) {
    const item = evaluateFor(req, product, profile);
    const list = groups.get(product.category) || [];
    list.push({ ...item, category: product.category });
    groups.set(product.category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    label: labels[category] || category,
    items,
  }));
}

export const showShop = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) return res.redirect(303, '/kiosk');

  const inventory = await productModel.listInStock({ limit: 250 });
  const recommendations = buildRecommendations({
    products: inventory,
    conditions: ctx.client.conditions,
    allergies: ctx.client.allergies,
    householdSize: ctx.client.householdSize,
  });
  const cart = await enrichCart(req, ctx.shopping.id, ctx.client);
  // Exit pass: the volunteer terminal scans this QR (or types the token) to load the cart.
  const exitQr = await QRCode.toDataURL(ctx.shopping.token, { margin: 1, width: 220 });
  res.render('shop', {
    title: req.t('shop.title'),
    bodyClass: 'shop',
    shopper: ctx.client,
    firstName: ctx.client.greetingName,
    allergyLabels: (ctx.client.allergies || []).map(allergenName(req.t)),
    plan: planText(recommendations.tier, req.t),
    tier: recommendations.tier,
    needs: recommendations.needs,
    recommendations: recommendations.items,
    catalog: catalogFor(req, inventory, ctx.client),
    statusCopy: statusCopy(req.t),
    categoryCopy: categoryCopy(req.t),
    cart,
    sessionToken: ctx.shopping.token,
    exitQr,
  });
});

export const scanItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));

  const sku = String(req.body.sku || '').trim().toUpperCase();
  if (!sku) throw badRequest(req.t('msg.enterNumber'));

  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(req.t('msg.notFound', { sku }));

  const item = evaluateFor(req, product, ctx.client);
  const quantityInCart = await sessionModel.getCartQuantity(ctx.shopping.id, product.sku);
  res.json({ item, quantityInCart, sessionToken: ctx.shopping.token });
});

export const getCart = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));
  res.json({ cart: await enrichCart(req, ctx.shopping.id, ctx.client) });
});

/**
 * Shared by "add" and "set quantity". Not-recommended (restricted) items are allowed once the
 * shopper confirms — client choice — and are still caught by the checkout hard stop (US-4.1).
 */
async function changeQuantity(req, ctx, { sku, quantity, confirmed }) {
  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(req.t('msg.notFound', { sku }));

  if (quantity <= 0) {
    await sessionModel.removeCartItem(ctx.shopping.id, product.sku);
    return { notice: null };
  }
  if (Number(product.on_hand) < quantity) {
    throw conflict(
      Number(product.on_hand) > 0
        ? req.t('msg.onlyLeft', { n: product.on_hand, name: product.name })
        : req.t('msg.ranOut', { name: product.name }),
    );
  }

  const item = evaluateFor(req, product, ctx.client);
  if (item.status === 'restricted' && !confirmed) {
    throw conflict(req.t('msg.confirm'), { code: 'CONFIRM_RESTRICTED', item });
  }

  await sessionModel.setCartQuantity({
    sessionId: ctx.shopping.id,
    sku: product.sku,
    quantity,
    evaluatedStatus: item.status,
  });

  let notice = null;
  if (item.status === 'restricted') {
    notice = req.t('msg.restrictedInCart', { name: product.name });
  } else if (item.status === 'capped' && item.capServings !== null && quantity > item.capServings) {
    notice = req.t('msg.overCap', { n: item.capServings, name: product.name });
  }
  return { item, notice };
}

export const addItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));

  const sku = String(req.body.sku || '').trim().toUpperCase();
  if (!sku) throw badRequest(req.t('msg.chooseItem'));
  const step = Math.min(20, Math.max(1, Number(req.body.quantity || 1)));
  const current = await sessionModel.getCartQuantity(ctx.shopping.id, sku);

  const result = await changeQuantity(req, ctx, { sku, quantity: current + step, confirmed: req.body.confirm === true });
  res.status(201).json({ added: result.item, notice: result.notice, cart: await enrichCart(req, ctx.shopping.id, ctx.client) });
});

export const setQuantity = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));

  const sku = String(req.params.sku || '').trim().toUpperCase();
  const quantity = Math.floor(Number(req.body.quantity));
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 20) throw badRequest(req.t('msg.qtyRange'));

  const result = await changeQuantity(req, ctx, { sku, quantity, confirmed: req.body.confirm === true });
  res.json({ notice: result.notice, cart: await enrichCart(req, ctx.shopping.id, ctx.client) });
});

export const removeItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));
  const sku = String(req.params.sku || '').trim().toUpperCase();
  await sessionModel.removeCartItem(ctx.shopping.id, sku);
  res.json({ cart: await enrichCart(req, ctx.shopping.id, ctx.client) });
});

export const getRecipes = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized(req.t('msg.sessionEnded'));

  const [cart, inventory] = await Promise.all([
    sessionModel.getCart(ctx.shopping.id),
    productModel.listInStock({ limit: 250 }),
  ]);

  const result = await synthesizeRecipes({
    sessionId: ctx.shopping.id,
    cart,
    inventory,
    profile: ctx.client,
    language: languageName(req.lang),
  });

  res.json(result);
});

export const finishSession = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) return res.redirect(303, '/kiosk');
  await sessionModel.abandonSession(ctx.shopping.id);
  delete req.session.shopping;
  res.redirect(303, '/kiosk');
});
