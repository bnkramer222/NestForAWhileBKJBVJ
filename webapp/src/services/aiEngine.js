import { env } from '../config/env.js';
import { evaluateProduct, resolveTier } from './dietaryMatrix.js';
import { logInference } from '../models/analytics.model.js';

/**
 * System of Intelligence adapter — contract v1.
 *
 * Providers speak chat-completion style JSON:
 *   groq   POST {base}/chat/completions   (OpenAI-compatible, response_format json_object)
 *   hf     POST {base}/chat/completions   (HF router, OpenAI-compatible)
 *   ollama POST {base}/api/chat           (format: "json")
 *
 * Defence in depth:
 *   1. structural validation of contractVersion / recipes / steps
 *   2. one repair turn if the model returns invalid JSON
 *   3. sanitisation: every SKU is re-checked against live stock and clinical rules
 *   4. deterministic local synthesis if the engine is unconfigured, slow, rate-limited,
 *      or still invalid after repair.
 *
 * Green/yellow/red is ALWAYS decided by src/services/dietaryMatrix.js, never by the model.
 */

export const CONTRACT_VERSION = '1.0';

const PROVIDER_DEFAULTS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  hf: { baseUrl: 'https://router.huggingface.co/v1', model: 'meta-llama/Llama-3.1-8B-Instruct' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1:8b-instruct-q4_K_M' },
};

export function getProviderConfig() {
  const provider = (env.aiProvider || (env.aiApiKey ? 'groq' : 'none')).toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    return { provider: 'none', configured: false, model: null, reason: 'no provider configured' };
  }
  const configured = provider === 'ollama' ? true : Boolean(env.aiApiKey);
  return {
    provider,
    configured,
    baseUrl: env.aiBaseUrl || defaults.baseUrl,
    apiKey: env.aiApiKey,
    model: env.aiEngineModel || defaults.model,
    timeoutMs: env.aiTimeoutMs,
    maxTokens: env.aiMaxTokens,
    temperature: env.aiTemperature,
    reason: configured ? null : 'missing AI_API_KEY',
  };
}

/* ------------------------------------------------------------------ JSON helpers */

/** Accepts fenced or chatty output and returns the first JSON object, or null. */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Structural contract checks only. Stock and clinical safety are enforced in sanitizePayload. */
export function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['response is not a JSON object'] };
  }
  if (payload.contractVersion !== CONTRACT_VERSION) {
    errors.push(`contractVersion must be "${CONTRACT_VERSION}"`);
  }
  if (!Array.isArray(payload.recipes) || payload.recipes.length === 0) {
    errors.push('recipes must be a non-empty array');
  } else {
    if (payload.recipes.length > env.aiMaxRecipes) {
      errors.push(`recipes must contain at most ${env.aiMaxRecipes} entries`);
    }
    payload.recipes.forEach((recipe, index) => {
      if (typeof recipe?.title !== 'string' || !recipe.title.trim()) {
        errors.push(`recipes[${index}].title must be a non-empty string`);
      }
      if (!Array.isArray(recipe?.steps) || recipe.steps.length === 0 || !recipe.steps.every((step) => typeof step === 'string')) {
        errors.push(`recipes[${index}].steps must be a non-empty array of strings`);
      }
      if (!Array.isArray(recipe?.uses) || !recipe.uses.every((sku) => typeof sku === 'string')) {
        errors.push(`recipes[${index}].uses must be an array of SKU strings`);
      }
    });
  }
  if (payload.missingIngredients !== undefined && !Array.isArray(payload.missingIngredients)) {
    errors.push('missingIngredients must be an array when present');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Drops any recipe or missing ingredient that references an unknown, out-of-stock,
 * or clinically restricted SKU. Location and stock values are taken from the DB,
 * never from the model.
 */
export function sanitizePayload(payload, { inventory, profile }) {
  const bySku = new Map(inventory.map((product) => [product.sku, product]));
  const check = (sku) => {
    const product = bySku.get(String(sku));
    if (!product) return { ok: false, reason: 'unknown SKU' };
    if (Number(product.on_hand) <= 0) return { ok: false, reason: 'out of stock' };
    const evaluation = evaluateProduct(product, profile);
    if (evaluation.status === 'restricted') return { ok: false, reason: 'clinically restricted' };
    return { ok: true, product, evaluation };
  };

  const dropped = [];
  const recipes = [];

  for (const recipe of payload.recipes || []) {
    const uses = [...new Set((recipe.uses || []).map(String))];
    const rejected = uses.map((sku) => ({ sku, result: check(sku) })).filter((entry) => !entry.result.ok);
    if (rejected.length) {
      dropped.push({
        title: recipe.title,
        reason: rejected.map((entry) => `${entry.sku}: ${entry.result.reason}`).join(', '),
      });
      continue;
    }
    recipes.push({
      title: String(recipe.title).slice(0, 120),
      uses,
      steps: (recipe.steps || []).slice(0, 8).map((step) => String(step).slice(0, 240)),
      clinicalFit: recipe.clinicalFit ? String(recipe.clinicalFit).slice(0, 200) : '',
    });
  }

  const missingIngredients = [];
  const seen = new Set();
  for (const item of payload.missingIngredients || []) {
    const sku = String(item?.sku || '');
    if (!sku || seen.has(sku)) continue;
    const result = check(sku);
    if (!result.ok) continue;
    seen.add(sku);
    missingIngredients.push({
      sku: result.product.sku,
      name: result.product.name,
      aisle: result.product.aisle,
      shelf: result.product.shelf,
      bin: result.product.bin,
      onHand: Number(result.product.on_hand),
    });
    if (missingIngredients.length >= 6) break;
  }

  return { recipes, missingIngredients, dropped };
}

/* ------------------------------------------------------------------ prompts */

function systemPrompt(language = 'English') {
  return [
    'You are the Epic Cure medically tailored grocery engine.',
    'Input: a client clinical profile, their cart, and live warehouse inventory with per-item clinical status.',
    'Return ONLY a JSON object with exactly this shape:',
    '{"contractVersion":"1.0","recipes":[{"title":"string","uses":["SKU"],"steps":["string"],"clinicalFit":"string"}],"missingIngredients":[{"sku":"SKU"}]}',
    'Rules:',
    `- 1 to ${env.aiMaxRecipes} recipes, 3 to 6 short steps each.`,
    '- "uses" and missingIngredients[].sku must be SKU strings copied from the inventory list.',
    '- Never use a SKU whose status is "restricted". Never invent SKUs or ingredients.',
    '- Do not add salt. Use herbs, citrus, spices, and pepper for flavour.',
    '- Favour items whose status is "approved"; use "capped" items sparingly.',
    '- No markdown fences, no prose outside the JSON object.',
    `- Write "title", "steps" and "clinicalFit" in ${language}. Keep JSON keys and SKUs exactly as given.`,
  ].join('\n');
}

function buildContext({ cart, inventory, profile }) {
  const tier = resolveTier(profile.conditions || []);
  return {
    profile: {
      tierId: tier.id,
      tierLabel: tier.label,
      conditions: tier.keys,
      allergies: profile.allergies || [],
      householdSize: profile.householdSize || 1,
    },
    cart: cart.map((item) => ({ sku: item.sku, name: item.name, quantity: item.quantity ?? 1 })),
    inventory: inventory.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category,
      aisle: product.aisle,
      shelf: product.shelf,
      bin: product.bin,
      on_hand: Number(product.on_hand || 0),
      status: evaluateProduct(product, profile).status,
    })),
  };
}

function repairMessages(raw, errors, language = 'English') {
  return [
    { role: 'system', content: systemPrompt(language) },
    {
      role: 'user',
      content: `Your previous response was rejected for: ${errors.join('; ')}.\nReturn only the corrected JSON object.\n\nPrevious response:\n${String(raw).slice(0, 4000)}`,
    },
  ];
}

/* ------------------------------------------------------------------ transport */

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function requestCompletion(config, messages) {
  const isOllama = config.provider === 'ollama';
  const url = isOllama ? `${config.baseUrl}/api/chat` : `${config.baseUrl}/chat/completions`;
  const headers = { 'content-type': 'application/json' };
  if (!isOllama && config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const body = isOllama
    ? {
        model: config.model,
        messages,
        stream: false,
        format: 'json',
        options: { temperature: config.temperature },
      }
    : {
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' },
      };

  const started = Date.now();
  let response = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, config.timeoutMs);

  // Some HF-hosted models reject response_format; retry once without it.
  if (response.status === 400 && body.response_format) {
    delete body.response_format;
    response = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, config.timeoutMs);
  }

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`engine HTTP ${response.status}: ${text.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('engine returned non-JSON HTTP body');
  }

  const content = isOllama ? data.message?.content : data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('engine response missing message content');

  return { content, latencyMs: Date.now() - started, usage: data.usage || null };
}

/* ------------------------------------------------------------------ fallback */

function localRecipes({ cart, inventory, profile }) {
  const approved = inventory
    .map((product) => ({ product, ...evaluateProduct(product, profile) }))
    .filter((entry) => entry.status !== 'restricted' && Number(entry.product.on_hand) > 0);

  const pick = (category, count) =>
    approved
      .filter((entry) => entry.product.category === category)
      .slice(0, count)
      .map((entry) => entry.product);

  const cartSkus = new Set(cart.map((item) => item.sku));
  const proteins = pick('protein', 2);
  const produce = pick('produce', 3);
  const grains = pick('grain', 2);

  const recipes = [];
  if (proteins[0] && produce[0]) {
    recipes.push({
      title: `${produce[0].name} & ${proteins[0].name}`,
      uses: [proteins[0].sku, produce[0].sku, ...(grains[0] ? [grains[0].sku] : [])],
      steps: [
        `Pat the ${proteins[0].name.toLowerCase()} dry and season with herbs instead of salt.`,
        'Sear until cooked through, then rest for 5 minutes.',
        `Sauté ${produce[0].name.toLowerCase()} in a little oil until bright and tender.`,
        grains[0] ? `Serve over cooked ${grains[0].name.toLowerCase()}.` : 'Serve with a side of fresh produce.',
      ],
      clinicalFit: 'Built only from items approved for this clinical profile.',
    });
  }
  if (produce[1] && grains[0]) {
    recipes.push({
      title: `${produce[1].name} grain bowl`,
      uses: [produce[1].sku, grains[0].sku, ...(proteins[1] ? [proteins[1].sku] : [])],
      steps: [
        `Cook ${grains[0].name.toLowerCase()} according to package directions, without added salt.`,
        `Toss ${produce[1].name.toLowerCase()} with lemon, olive oil, and pepper.`,
        proteins[1] ? `Top with ${proteins[1].name.toLowerCase()}.` : 'Finish with fresh herbs.',
      ],
      clinicalFit: 'Low-sodium base with fibre-rich whole grains.',
    });
  }
  if (produce[2] && proteins[0]) {
    recipes.push({
      title: `Sheet-pan ${produce[2].name.toLowerCase()} with ${proteins[0].name.toLowerCase()}`,
      uses: [produce[2].sku, proteins[0].sku],
      steps: [
        'Heat oven to 425°F. Toss produce with oil, pepper, and smoked paprika.',
        'Roast 20 minutes, adding the protein for the last 12 minutes.',
        'Rest, then finish with a squeeze of citrus.',
      ],
      clinicalFit: 'No added salt; spices and citrus carry the flavour.',
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

/* ------------------------------------------------------------------ public API */

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

export async function synthesizeRecipes({ sessionId = null, cart = [], inventory = [], profile = {}, language = 'English' }) {
  const normalizedProfile = { conditions: profile.conditions || [], allergies: profile.allergies || [] };
  const fallback = localRecipes({ cart, inventory, profile: normalizedProfile });
  const config = getProviderConfig();

  const finishWithFallback = async (source, errors = []) => {
    if (config.configured) {
      await logInference({
        sessionId,
        kind: 'recipe-synthesis',
        latencyMs: null,
        ok: false,
        payload: { provider: config.provider, model: config.model, errors },
      });
    }
    return {
      ...fallback,
      source,
      provider: config.provider,
      model: config.model,
      errors,
      contractVersion: CONTRACT_VERSION,
    };
  };

  if (!config.configured) {
    return finishWithFallback(config.provider === 'none' ? 'local-deterministic' : 'local-deterministic-unconfigured', [
      config.reason || 'no AI provider configured',
    ]);
  }

  const context = buildContext({ cart, inventory, profile: normalizedProfile });
  let messages = [
    { role: 'system', content: systemPrompt(language) },
    { role: 'user', content: JSON.stringify(context) },
  ];

  const maxAttempts = 1 + Math.max(0, env.aiRepairAttempts);
  let errors = [];
  let latencyMs = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await requestCompletion(config, messages);
      latencyMs = result.latencyMs;
      const parsed = extractJson(result.content);

      if (!parsed) {
        errors = ['response was not valid JSON'];
        messages = repairMessages(result.content, errors, language);
        continue;
      }

      const validation = validatePayload(parsed);
      if (!validation.ok) {
        errors = validation.errors;
        messages = repairMessages(result.content, errors, language);
        continue;
      }

      const sanitized = sanitizePayload(parsed, { inventory, profile: normalizedProfile });
      if (!sanitized.recipes.length) {
        errors = ['every recipe referenced an unknown, out-of-stock, or restricted SKU'];
        messages = repairMessages(result.content, errors, language);
        continue;
      }

      await logInference({
        sessionId,
        kind: 'recipe-synthesis',
        latencyMs,
        ok: true,
        payload: {
          provider: config.provider,
          model: config.model,
          attempts: attempt + 1,
          dropped: sanitized.dropped,
        },
      });

      return {
        recipes: sanitized.recipes,
        missingIngredients: sanitized.missingIngredients,
        source: 'open-source-engine',
        provider: config.provider,
        model: config.model,
        latencyMs,
        attempts: attempt + 1,
        contractVersion: CONTRACT_VERSION,
        droppedRecipes: sanitized.dropped,
      };
    } catch (err) {
      const rateLimited = err.status === 429 || err.name === 'AbortError';
      errors = [rateLimited ? `${config.provider} rate limit or timeout` : err.message];
      if (rateLimited) break;
    }
  }

  return finishWithFallback('local-deterministic-fallback', errors);
}
