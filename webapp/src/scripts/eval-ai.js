import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { synthesizeRecipes, getProviderConfig, CONTRACT_VERSION } from '../services/aiEngine.js';
import { evaluateProduct } from '../services/dietaryMatrix.js';
import { evalCases, evalInventory } from './fixtures/evalCases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'docs/evaluation');

const bySku = new Map(evalInventory.map((product) => [product.sku, product]));

function inspectSku(sku, profile) {
  const product = bySku.get(sku);
  if (!product) return 'unknown SKU';
  if (Number(product.on_hand) <= 0) return 'out of stock';
  if (evaluateProduct(product, profile).status === 'restricted') return 'clinically restricted';
  return null;
}

async function main() {
  const config = getProviderConfig();
  console.log(`[eval] provider=${config.provider} model=${config.model} configured=${config.configured}`);

  const results = [];
  for (const testCase of evalCases) {
    const started = performance.now();
    const result = await synthesizeRecipes({
      cart: testCase.cart,
      inventory: evalInventory,
      profile: testCase.profile,
    });
    const latencyMs = Math.round(performance.now() - started);

    const violations = [];
    if (result.contractVersion !== CONTRACT_VERSION) violations.push('contractVersion mismatch');
    if (!Array.isArray(result.recipes) || result.recipes.length === 0) violations.push('no recipes returned');

    for (const recipe of result.recipes || []) {
      for (const sku of recipe.uses || []) {
        const problem = inspectSku(sku, testCase.profile);
        if (problem) violations.push(`recipe "${recipe.title}" uses ${sku}: ${problem}`);
      }
      if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) violations.push(`recipe "${recipe.title}" has no steps`);
    }

    for (const item of result.missingIngredients || []) {
      const problem = inspectSku(item.sku, testCase.profile);
      if (problem) violations.push(`missing ingredient ${item.sku}: ${problem}`);
    }

    results.push({
      name: testCase.name,
      source: result.source,
      provider: result.provider,
      latencyMs,
      attempts: result.attempts ?? null,
      recipeCount: (result.recipes || []).length,
      missingCount: (result.missingIngredients || []).length,
      dropped: result.droppedRecipes || [],
      errors: result.errors || [],
      violations,
    });
  }

  const passed = results.filter((entry) => entry.violations.length === 0).length;
  const latencies = results.map((entry) => entry.latencyMs).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] : 0;
  const sources = results.reduce((acc, entry) => {
    acc[entry.source] = (acc[entry.source] || 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    contractVersion: CONTRACT_VERSION,
    provider: { name: config.provider, model: config.model, configured: config.configured },
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: Number((passed / results.length).toFixed(3)),
    p95LatencyMs: p95,
    sources,
    invariants: [
      'contractVersion === 1.0',
      'at least one recipe per case',
      'no recipe uses an unknown, out-of-stock, or clinically restricted SKU',
      'no missing ingredient references an unknown, out-of-stock, or restricted SKU',
      'every recipe has at least one step',
    ],
    results,
  };

  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `ai-eval-${stamp}.json`);
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'ai-eval-latest.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[eval] ${passed}/${results.length} cases passed · p95 ${p95} ms · sources ${JSON.stringify(sources)}`);
  for (const entry of results) {
    const flag = entry.violations.length ? 'FAIL' : 'ok  ';
    console.log(`  ${flag} ${entry.name} (${entry.latencyMs} ms, ${entry.source}, ${entry.recipeCount} recipes)`);
    for (const violation of entry.violations) console.log(`       - ${violation}`);
  }
  console.log(`[eval] report written to ${path.relative(root, file)}`);

  if (passed !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[eval] crashed:', err);
  process.exitCode = 1;
});
