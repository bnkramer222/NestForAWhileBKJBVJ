import * as clientModel from '../models/client.model.js';
import * as productModel from '../models/product.model.js';
import * as sessionModel from '../models/session.model.js';
import { evaluateItem } from '../services/aiEngine.js';
import { ah } from '../lib/asyncHandler.js';
import { allergenLabel } from '../lib/allergens.js';
import { badRequest, notFound } from '../lib/httpError.js';

async function loadByToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) return null;
  const session = await sessionModel.getSessionByToken(token);
  if (!session) return null;
  await sessionModel.touchSession(session.id); // at the exit terminal — don't expire mid-checkout
  const client = await clientModel.findById(session.client_id);
  return { session, client };
}

export const showCheckout = ah(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const ctx = token ? await loadByToken(token) : null;
  const error = token && !ctx ? 'That session token is not recognized.' : null;

  const cart = ctx ? await sessionModel.getCart(ctx.session.id) : [];
  const completed = ctx?.session.status === 'completed';

  res.render('checkout', {
    title: 'Exit terminal',
    bodyClass: 'checkout',
    token,
    error,
    cart,
    completed,
    clientName: ctx?.client?.name || null,
    sessionStatus: ctx?.session?.status || null,
    tierLabel: ctx?.client ? ctx.client.conditions.join(', ') : null,
    allergyLabels: ctx?.client ? (ctx.client.allergies || []).map(allergenLabel) : [],
  });
});

export const apiScan = ah(async (req, res) => {
  const { token, sku } = req.body;
  const ctx = await loadByToken(token);
  if (!ctx) throw notFound('Session token not recognized.');

  const product = await productModel.findBySku(String(sku || '').trim().toUpperCase());
  if (!product) throw badRequest(`No item with SKU ${sku}.`);

  res.json({ item: evaluateItem({ product, profile: ctx.client }) });
});

export const apiAdd = ah(async (req, res) => {
  const { token, sku } = req.body;
  const ctx = await loadByToken(token);
  if (!ctx) throw notFound('Session token not recognized.');
  if (ctx.session.status !== 'active') throw badRequest('This session is not active.');

  const product = await productModel.findBySku(String(sku || '').trim().toUpperCase());
  if (!product) throw badRequest(`No item with SKU ${sku}.`);

  const item = evaluateItem({ product, profile: ctx.client });
  await sessionModel.addCartItem({
    sessionId: ctx.session.id,
    sku: product.sku,
    quantity: 1,
    evaluatedStatus: item.status,
  });

  res.status(201).json({ item, cart: await sessionModel.getCart(ctx.session.id) });
});

export const apiRemove = ah(async (req, res) => {
  const { token } = req.body;
  const ctx = await loadByToken(token);
  if (!ctx) throw notFound('Session token not recognized.');

  await sessionModel.removeCartItem(ctx.session.id, String(req.params.sku || '').toUpperCase());
  res.json({ cart: await sessionModel.getCart(ctx.session.id) });
});

export const apiComplete = ah(async (req, res) => {
  const { token, actedBy } = req.body;
  const ctx = await loadByToken(token);
  if (!ctx) throw notFound('Session token not recognized.');

  const receipt = await sessionModel.completeCheckout(ctx.session.id, actedBy || 'volunteer');
  // A floor slot just opened — let the next queued household in automatically.
  const admitted = await sessionModel.admitFromQueue();
  res.json({ receipt, admittedFromQueue: admitted.length });
});
