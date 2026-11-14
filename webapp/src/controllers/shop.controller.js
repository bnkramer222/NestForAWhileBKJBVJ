import * as clientModel from '../models/client.model.js';
import * as productModel from '../models/product.model.js';
import * as sessionModel from '../models/session.model.js';
import { buildRecommendations } from '../services/dietaryMatrix.js';
import { evaluateItem, synthesizeRecipes } from '../services/aiEngine.js';
import QRCode from 'qrcode';
import { ah } from '../lib/asyncHandler.js';
import { STATUS_COPY, CATEGORY_COPY } from '../lib/shopperCopy.js';
import { allergenLabel } from '../lib/allergens.js';
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
async function enrichCart(sessionId, profile) {
  const cart = await sessionModel.getCart(sessionId);
  const products = await productModel.findManyBySkus(cart.map((line) => line.sku));
  const bySku = new Map(products.map((product) => [product.sku, product]));
  return cart.map((line) => {
    const product = bySku.get(line.sku);
    const evaluation = product ? evaluateItem({ product, profile }) : null;
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

function catalogFor(inventory, profile) {
  const groups = new Map();
  for (const product of inventory) {
    const item = evaluateItem({ product, profile });
    const list = groups.get(product.category) || [];
    list.push({ ...item, category: product.category });
    groups.set(product.category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    label: CATEGORY_COPY[category] || category,
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
  const cart = await enrichCart(ctx.shopping.id, ctx.client);
  // Exit pass: the volunteer terminal scans this QR (or types the token) to load the cart.
  const exitQr = await QRCode.toDataURL(ctx.shopping.token, { margin: 1, width: 220 });
  res.render('shop', {
    title: 'Shop',
    bodyClass: 'shop',
    shopper: ctx.client,
    firstName: String(ctx.client.name || '').split(' ')[0] || 'there',
    allergyLabels: (ctx.client.allergies || []).map(allergenLabel),
    tier: recommendations.tier,
    needs: recommendations.needs,
    recommendations: recommendations.items,
    catalog: catalogFor(inventory, ctx.client),
    statusCopy: STATUS_COPY,
    categoryCopy: CATEGORY_COPY,
    cart,
    sessionToken: ctx.shopping.token,
    exitQr,
  });
});

export const scanItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');

  const sku = String(req.body.sku || '').trim().toUpperCase();
  if (!sku) throw badRequest('Type the number under the barcode, or scan it with the camera.');

  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(`We couldn't find item ${sku}. Try typing the number under the barcode, or ask a volunteer.`);

  const item = evaluateItem({ product, profile: ctx.client });
  const quantityInCart = await sessionModel.getCartQuantity(ctx.shopping.id, product.sku);
  res.json({ item, quantityInCart, sessionToken: ctx.shopping.token });
});

export const getCart = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');
  res.json({ cart: await enrichCart(ctx.shopping.id, ctx.client) });
});

/**
 * Shared by "add" and "set quantity". Not-recommended (restricted) items are allowed once the
 * shopper confirms — client choice — and are still caught by the checkout hard stop (US-4.1).
 */
async function changeQuantity(ctx, { sku, quantity, confirmed }) {
  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(`We couldn't find item ${sku}.`);

  if (quantity <= 0) {
    await sessionModel.removeCartItem(ctx.shopping.id, product.sku);
    return { notice: null };
  }
  if (Number(product.on_hand) < quantity) {
    throw conflict(
      Number(product.on_hand) > 0
        ? `Only ${product.on_hand} of ${product.name} left on the shelf right now.`
        : `${product.name} just ran out. A volunteer can tell you when more is coming.`,
    );
  }

  const item = evaluateItem({ product, profile: ctx.client });
  if (item.status === 'restricted' && !confirmed) {
    throw conflict('Please confirm before adding this item.', { code: 'CONFIRM_RESTRICTED', item });
  }

  await sessionModel.setCartQuantity({
    sessionId: ctx.shopping.id,
    sku: product.sku,
    quantity,
    evaluatedStatus: item.status,
  });

  let notice = null;
  if (item.status === 'restricted') {
    notice = `${product.name} is in your cart. A volunteer will check it with you at the exit.`;
  } else if (item.status === 'capped' && item.capServings !== null && quantity > item.capServings) {
    notice = `Heads up: we suggest about ${item.capServings} serving${item.capServings === 1 ? '' : 's'} of ${product.name}. It's your choice.`;
  }
  return { item, notice };
}

export const addItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');

  const sku = String(req.body.sku || '').trim().toUpperCase();
  if (!sku) throw badRequest('Choose an item first.');
  const step = Math.min(20, Math.max(1, Number(req.body.quantity || 1)));
  const current = await sessionModel.getCartQuantity(ctx.shopping.id, sku);

  const result = await changeQuantity(ctx, { sku, quantity: current + step, confirmed: req.body.confirm === true });
  res.status(201).json({ added: result.item, notice: result.notice, cart: await enrichCart(ctx.shopping.id, ctx.client) });
});

export const setQuantity = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');

  const sku = String(req.params.sku || '').trim().toUpperCase();
  const quantity = Math.floor(Number(req.body.quantity));
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 20) throw badRequest('Quantity must be between 0 and 20.');

  const result = await changeQuantity(ctx, { sku, quantity, confirmed: req.body.confirm === true });
  res.json({ notice: result.notice, cart: await enrichCart(ctx.shopping.id, ctx.client) });
});

export const removeItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');
  const sku = String(req.params.sku || '').trim().toUpperCase();
  await sessionModel.removeCartItem(ctx.shopping.id, sku);
  res.json({ cart: await enrichCart(ctx.shopping.id, ctx.client) });
});

export const getRecipes = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('Your shopping session has ended. Please check in again at the kiosk.');

  const [cart, inventory] = await Promise.all([
    sessionModel.getCart(ctx.shopping.id),
    productModel.listInStock({ limit: 250 }),
  ]);

  const result = await synthesizeRecipes({
    sessionId: ctx.shopping.id,
    cart,
    inventory,
    profile: ctx.client,
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
