import { env } from '../config/env.js';
import { evaluateProduct, resolveTier } from './dietaryMatrix.js';
import { logInference } from '../models/analytics.model.js';

/**
 * System of Intelligence adapter.
 *
 * Contract v1 (see docs/AI-CONTRACT.md):
 *   POST AI_ENGINE_URL  { contractVersion, model, task, context }
 *   → { contractVersion, status?, reasons?, recipes?, missingIngredients? }
 *
 * Rules engine output is authoritative for green/yellow/red. The model may only
 * explain or synthesize recipes. Until AI_ENGINE_URL is configured (Ollama or a
 * free HF Space), a deterministic local synthesizer keeps the loop closed.
 */

export const CONTRACT_VERSION = '1.0';

function buildProfileContext(profile) {
  const tier = resolveTier(profile.conditions || []);
  return {
    tierId: tier.id,
    tierLabel: tier.label,
    conditions: tier.keys,
    allergies: profile.allergies || [],
    householdSize: profile.householdSize || 1,
  };
}

export function evaluateItem({ product, profile }) {
  const result = evaluateProduct(product, {
    conditions: profile.conditions || [],
    allergies: profile.allergies || [],
  });
  return {
    contractVersion: CONTRACT_VERSION,
    sku: product.sku,
    name: product.name,
    status: result.status,
    reasons: result.reasons,
    ruleIds: result.ruleIds,
    capServings: result.capServings,
    source: 'clinical-rules',
    aisle: product.aisle,
    shelf: product.shelf,
    bin: product.bin,
    onHand: Number(product.on_hand || 0),
  };
}

function localRecipes({ cart, inventory, profile }) {
  const approved = inventory
    .map((product) => ({ product, ...evaluateProduct(product, profile) }))
    .filter((entry) => entry.status !== 'restricted');

  const pick = (category, count, excludeSkus) =>
    approved
      .filter((entry) => entry.product.category === category && !excludeSkus.has(entry.product.sku))
      .slice(0, count)
      .map((entry) => entry.product);

  const cartSkus = new Set(cart.map((item) => item.sku));
  const proteins = pick('protein', 2, new Set());
  const produce = pick('produce', 3, new Set());
  const grains = pick('grain', 2, new Set());

  const recipes = [];
  if (proteins[0] && produce[0]) {
    recipes.push({
      title: `${produce[0].name} & ${proteins[0].name}`,
      uses: [proteins[0].sku, produce[0].sku, ...(grains[0] ? [grains[0].sku] : [])],
      steps: [
        `Pat the ${proteins[0].name.toLowerCase()} dry and season with herbs instead of salt.`,
        `Sear until cooked through, then rest for 5 minutes.`,
        `Sauté ${produce[0].name.toLowerCase()} in a little oil until bright and tender.`,
        grains[0] ? `Serve over cooked ${grains[0].name.toLowerCase()}.` : 'Serve with a side of fresh produce.',
      ],
      clinicalFit: 'Built from items approved for this clinical profile.',
    });
  }
  if (produce[1] && grains[0]) {
    recipes.push({
      title: `${produce[1].name} grain bowl`,
      uses: [produce[1].sku, grains[0].sku, ...(proteins[1] ? [proteins[1].sku] : [])],
      steps: [
        `Cook ${grains[0].name.toLowerCase()} according to package directions, without added salt.`,
        `Toss ${produce[1].name.toLowerCase()} with lemon, olive oil, and pepper.`,
        proteins[1] ? `Top with ${proteins[1].name.toLowerCase()}.` : 'Finish with a handful of fresh herbs.',
      ],
      clinicalFit: 'Low-sodium base with fiber-rich whole grains.',
    });
  }
  if (produce[2] && proteins[0]) {
    recipes.push({
      title: `Sheet-pan ${produce[2].name.toLowerCase()} with ${proteins[0].name.toLowerCase()}`,
      uses: [produce[2].sku, proteins[0].sku],
      steps: [
        'Heat oven to 425°F. Toss produce with oil, pepper, and smoked paprika.',
        'Roast 20 minutes, adding protein for the last 12 minutes.',
        'Rest, then plate with a squeeze of citrus.',
      ],
      clinicalFit: 'No added salt; relies on spices and citrus for flavor.',
    });
  }

  const missingIngredients = [...proteins, ...produce, ...grains]
    .filter((product) => !cartSkus.has(product.sku))
    .slice(0, 4)
    .map((product) => ({
      sku: product.sku,
      name: product.name,
      aisle: product.aisle,
      shelf: product.shelf,
      bin: product.bin,
      onHand: Number(product.on_hand || 0),
    }));

  return { recipes, missingIngredients };
}

async function callRemote(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(env.aiEngineUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`engine HTTP ${response.status}`);
    const data = await response.json();
    return { data, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function validRecipes(candidate) {
  return (
    candidate &&
    Array.isArray(candidate.recipes) &&
    candidate.recipes.every((recipe) => typeof recipe.title === 'string' && Array.isArray(recipe.steps))
  );
}

export async function synthesizeRecipes({ sessionId = null, cart = [], inventory = [], profile = {} }) {
  const fallback = localRecipes({ cart: cart.map((i) => i.sku ?? i), inventory, profile: { conditions: profile.conditions || [], allergies: profile.allergies || [] } });

  if (!env.aiEngineUrl) {
    return { ...fallback, source: 'local-deterministic', contractVersion: CONTRACT_VERSION };
  }

  const context = {
    contractVersion: CONTRACT_VERSION,
    model: env.aiEngineModel,
    task: 'recipe-synthesis',
    context: {
      profile: buildProfileContext(profile),
      cart: cart.map((item) => ({ sku: item.sku, name: item.name, quantity: item.quantity ?? 1 })),
      inventory: inventory.map((product) => ({
        sku: product.sku,
        name: product.name,
        category: product.category,
        aisle: product.aisle,
        shelf: product.shelf,
        bin: product.bin,
        on_hand: Number(product.on_hand || 0),
      })),
    },
  };

  try {
    const { data, latencyMs } = await callRemote(context);
    await logInference({ sessionId, kind: 'recipe-synthesis', latencyMs, ok: validRecipes(data), payload: { model: env.aiEngineModel } });
    if (validRecipes(data)) {
      return {
        recipes: data.recipes,
        missingIngredients: Array.isArray(data.missingIngredients) ? data.missingIngredients : fallback.missingIngredients,
        source: 'open-source-engine',
        latencyMs,
        contractVersion: CONTRACT_VERSION,
      };
    }
    console.warn('[ai] engine returned an invalid shape; using deterministic fallback');
  } catch (err) {
    console.warn('[ai] engine unavailable, deterministic fallback:', err.message);
    await logInference({ sessionId, kind: 'recipe-synthesis', latencyMs: env.aiTimeoutMs, ok: false, payload: { error: err.message } });
  }

  return { ...fallback, source: 'local-deterministic-fallback', contractVersion: CONTRACT_VERSION };
}
