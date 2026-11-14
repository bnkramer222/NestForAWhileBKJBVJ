import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../src/config/env.js';
import {
  extractJson,
  validatePayload,
  sanitizePayload,
  requestCompletion,
  synthesizeRecipes,
  getProviderConfig,
  CONTRACT_VERSION,
} from '../src/services/aiEngine.js';

const inventory = [
  {
    sku: 'P1', name: 'Chicken breast', category: 'protein', aisle: 'B', shelf: '1', bin: 'B01',
    on_hand: 10, sodium_mg: 70, potassium_mg: 250, phosphorus_mg: 200, sugar_g: 0, sat_fat_g: 1,
    tags: [], allergens: [],
  },
  {
    sku: 'V1', name: 'Spinach', category: 'produce', aisle: 'A', shelf: '1', bin: 'B02',
    on_hand: 12, sodium_mg: 79, potassium_mg: 558, phosphorus_mg: 49, sugar_g: 0.4, sat_fat_g: 0.1,
    tags: [], allergens: [],
  },
  {
    sku: 'R1', name: 'Instant ramen', category: 'pantry', aisle: 'E', shelf: '1', bin: 'B03',
    on_hand: 20, sodium_mg: 1600, potassium_mg: 200, phosphorus_mg: 110, sugar_g: 2, sat_fat_g: 7,
    tags: ['high_sodium'], allergens: ['wheat'],
  },
  {
    sku: 'OOS', name: 'Sold-out oats', category: 'grain', aisle: 'D', shelf: '2', bin: 'B04',
    on_hand: 0, sodium_mg: 0, potassium_mg: 150, phosphorus_mg: 100, sugar_g: 1, sat_fat_g: 0.5,
    tags: [], allergens: [],
  },
];

const profile = { conditions: ['I10'], allergies: [], householdSize: 3 };

const validPayload = {
  contractVersion: CONTRACT_VERSION,
  recipes: [{ title: 'Chicken & spinach', uses: ['P1', 'V1'], steps: ['Season.', 'Sear.', 'Serve.'], clinicalFit: 'Low sodium.' }],
  missingIngredients: [{ sku: 'V1' }, { sku: 'R1' }, { sku: 'OOS' }],
};

const originals = {
  provider: env.aiProvider,
  apiKey: env.aiApiKey,
  baseUrl: env.aiBaseUrl,
  model: env.aiEngineModel,
  repair: env.aiRepairAttempts,
};

function resetEnv() {
  env.aiProvider = originals.provider;
  env.aiApiKey = originals.apiKey;
  env.aiBaseUrl = originals.baseUrl;
  env.aiEngineModel = originals.model;
  env.aiRepairAttempts = originals.repair;
}

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return handler(url, JSON.parse(options.body), calls.length);
  };
  return calls;
}

function completion(content, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof content === 'string' ? content : JSON.stringify(content)),
  };
}

test.afterEach(() => {
  resetEnv();
  delete globalThis.fetch;
});

test('extractJson handles fenced and chatty output', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Here you go: {"b":2} — enjoy'), { b: 2 });
  assert.equal(extractJson('not json at all'), null);
});

test('validatePayload enforces contractVersion and recipe shape', () => {
  assert.equal(validatePayload(validPayload).ok, true);
  assert.equal(validatePayload({ ...validPayload, contractVersion: '0.9' }).ok, false);
  assert.equal(validatePayload({ ...validPayload, recipes: [] }).ok, false);
  assert.equal(validatePayload({ contractVersion: CONTRACT_VERSION, recipes: [{ title: 'x', uses: [], steps: [] }] }).ok, false);
});

test('sanitizePayload drops restricted, out-of-stock, and unknown SKUs', () => {
  const result = sanitizePayload(validPayload, { inventory, profile });
  assert.equal(result.recipes.length, 1);
  assert.deepEqual(result.missingIngredients.map((item) => item.sku), ['V1']);
  assert.equal(result.missingIngredients[0].onHand, 12);
});

test('sanitizePayload rejects a recipe that references a restricted SKU', () => {
  const payload = {
    contractVersion: CONTRACT_VERSION,
    recipes: [{ title: 'Ramen bowl', uses: ['R1'], steps: ['Boil.'], clinicalFit: 'n/a' }],
  };
  const result = sanitizePayload(payload, { inventory, profile });
  assert.equal(result.recipes.length, 0);
  assert.match(result.dropped[0].reason, /clinically restricted/);
});

test('unconfigured provider returns the deterministic local synthesis', async () => {
  env.aiProvider = 'none';
  const result = await synthesizeRecipes({ inventory, cart: [], profile });
  assert.equal(result.source, 'local-deterministic');
  assert.ok(result.recipes.length >= 1);
  const used = result.recipes.flatMap((recipe) => recipe.uses);
  assert.ok(used.every((sku) => !['R1', 'OOS'].includes(sku)));
});

test('groq adapter sends OpenAI-style request with JSON mode and sanitises output', async () => {
  env.aiProvider = 'groq';
  env.aiApiKey = 'test-key';
  env.aiBaseUrl = 'https://api.groq.test/v1';
  env.aiEngineModel = 'test-model';

  const calls = stubFetch(() => completion({ choices: [{ message: { content: JSON.stringify(validPayload) } }] }));
  const result = await synthesizeRecipes({ inventory, cart: [], profile });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.groq.test/v1/chat/completions');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-key');
  assert.equal(calls[0].body.model, 'test-model');
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.equal(calls[0].body.messages[0].role, 'system');

  assert.equal(result.source, 'open-source-engine');
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.missingIngredients.map((item) => item.sku), ['V1']);
});

test('ollama adapter uses /api/chat with format json', async () => {
  env.aiProvider = 'ollama';
  env.aiBaseUrl = 'http://127.0.0.1:11434';
  env.aiEngineModel = 'llama-test';

  const calls = stubFetch(() => completion({ message: { content: JSON.stringify(validPayload) } }));
  const result = await synthesizeRecipes({ inventory, cart: [], profile });

  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(calls[0].body.format, 'json');
  assert.equal(result.source, 'open-source-engine');
});

test('invalid first response triggers exactly one repair turn', async () => {
  env.aiProvider = 'groq';
  env.aiApiKey = 'k';
  env.aiBaseUrl = 'https://api.groq.test/v1';
  env.aiRepairAttempts = 1;

  const calls = stubFetch((url, body, count) =>
    count === 1
      ? completion({ choices: [{ message: { content: JSON.stringify({ ...validPayload, contractVersion: '0.9' }) } }] })
      : completion({ choices: [{ message: { content: JSON.stringify(validPayload) } }] }),
  );

  const result = await synthesizeRecipes({ inventory, cart: [], profile });
  assert.equal(calls.length, 2);
  assert.match(calls[1].body.messages[1].content, /rejected/);
  assert.equal(result.attempts, 2);
  assert.equal(result.source, 'open-source-engine');
});

test('repair exhaustion falls back instead of throwing', async () => {
  env.aiProvider = 'groq';
  env.aiApiKey = 'k';
  env.aiBaseUrl = 'https://api.groq.test/v1';
  env.aiRepairAttempts = 1;

  stubFetch(() => completion({ choices: [{ message: { content: 'still not json' } }] }));
  const result = await synthesizeRecipes({ inventory, cart: [], profile });
  assert.equal(result.source, 'local-deterministic-fallback');
  assert.ok(result.errors.length > 0);
});

test('rate limit (429) falls back immediately without retrying', async () => {
  env.aiProvider = 'groq';
  env.aiApiKey = 'k';
  env.aiBaseUrl = 'https://api.groq.test/v1';

  const calls = stubFetch(() => completion('rate limited', 429));
  const result = await synthesizeRecipes({ inventory, cart: [], profile });
  assert.equal(calls.length, 1);
  assert.equal(result.source, 'local-deterministic-fallback');
  assert.match(result.errors[0], /rate limit/);
});

test('provider config defaults to groq when only an API key is present', () => {
  env.aiProvider = '';
  env.aiApiKey = 'key-only';
  const config = getProviderConfig();
  assert.equal(config.provider, 'groq');
  assert.equal(config.configured, true);
});

test('requestCompletion reports HTTP failures with status', async () => {
  const config = { provider: 'groq', configured: true, baseUrl: 'https://api.groq.test/v1', apiKey: 'k', model: 'm', timeoutMs: 1000, maxTokens: 100, temperature: 0.2 };
  stubFetch(() => completion('boom', 500));
  await assert.rejects(() => requestCompletion(config, []), /engine HTTP 500/);
});
