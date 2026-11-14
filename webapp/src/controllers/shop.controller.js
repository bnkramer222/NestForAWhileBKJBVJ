import * as clientModel from '../models/client.model.js';
import * as productModel from '../models/product.model.js';
import * as sessionModel from '../models/session.model.js';
import { buildRecommendations } from '../services/dietaryMatrix.js';
import { evaluateItem, synthesizeRecipes } from '../services/aiEngine.js';
import { ah } from '../lib/asyncHandler.js';
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

  return { shopping, sessionRow, client };
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
  const cart = await sessionModel.getCart(ctx.shopping.id);

  res.render('shop', {
    title: 'Shop',
    bodyClass: 'shop',
    client: ctx.client,
    tier: recommendations.tier,
    needs: recommendations.needs,
    recommendations: recommendations.items,
    cart,
    sessionToken: ctx.shopping.token,
  });
});

export const scanItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('No active shopping session. Check in again.');

  const sku = String(req.body.sku || '').trim().toUpperCase();
  if (!sku) throw badRequest('Provide a SKU or barcode.');

  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(`No warehouse item matches SKU ${sku}.`);

  const item = evaluateItem({ product, profile: ctx.client });
  res.json({ item, sessionToken: ctx.shopping.token });
});

export const getCart = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('No active shopping session.');
  res.json({ cart: await sessionModel.getCart(ctx.shopping.id) });
});

export const addItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('No active shopping session.');

  const sku = String(req.body.sku || '').trim().toUpperCase();
  const quantity = Math.max(1, Number(req.body.quantity || 1));
  if (!sku) throw badRequest('Provide a SKU.');

  const product = await productModel.findBySku(sku);
  if (!product) throw badRequest(`No warehouse item matches SKU ${sku}.`);
  if (Number(product.on_hand) < quantity) {
    throw conflict(`${product.name} is out of stock on the floor. Ask a volunteer about the next delivery.`);
  }

  const item = evaluateItem({ product, profile: ctx.client });
  if (item.status === 'restricted') {
    throw conflict(`${product.name} is restricted for this clinical profile.`, { item });
  }

  await sessionModel.addCartItem({
    sessionId: ctx.shopping.id,
    sku: product.sku,
    quantity,
    evaluatedStatus: item.status,
  });

  res.status(201).json({ added: item, cart: await sessionModel.getCart(ctx.shopping.id) });
});

export const removeItem = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('No active shopping session.');
  const sku = String(req.params.sku || '').trim().toUpperCase();
  const removed = await sessionModel.removeCartItem(ctx.shopping.id, sku);
  if (!removed) throw badRequest('That item is not in the cart.');
  res.json({ cart: await sessionModel.getCart(ctx.shopping.id) });
});

export const getRecipes = ah(async (req, res) => {
  const ctx = await loadContext(req);
  if (!ctx) throw unauthorized('No active shopping session.');

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
