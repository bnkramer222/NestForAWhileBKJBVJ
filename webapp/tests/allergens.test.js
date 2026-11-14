import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAllergen, allergyMatches, allergenLabel } from '../src/lib/allergens.js';
import { evaluateProduct } from '../src/services/dietaryMatrix.js';

test('everyday words map to catalog allergen keys', () => {
  assert.equal(normalizeAllergen('Milk'), 'dairy');
  assert.equal(normalizeAllergen(' peanut '), 'peanuts');
  assert.equal(normalizeAllergen('tree nuts'), 'tree_nuts');
  assert.equal(normalizeAllergen('Shrimp'), 'shellfish');
  assert.equal(normalizeAllergen('egg'), 'eggs');
  assert.equal(normalizeAllergen('strawberries'), 'strawberries'); // unknown kept as typed
  assert.equal(normalizeAllergen('   '), null);
});

test('gluten avoidance also excludes wheat; wheat does not imply gluten', () => {
  assert.ok(allergyMatches('gluten', 'wheat'));
  assert.ok(allergyMatches('celiac', 'gluten'));
  assert.ok(!allergyMatches('wheat', 'gluten'));
});

test('a typed synonym still flags the product as not a good fit', () => {
  const yogurt = { sku: 'X', name: 'Yogurt', category: 'dairy', allergens: ['dairy'], tags: [] };
  const result = evaluateProduct(yogurt, { conditions: [], allergies: ['milk'] });
  assert.equal(result.status, 'restricted');
  assert.match(result.reasons[0], /milk \/ dairy/i);
});

test('labels are human readable', () => {
  assert.equal(allergenLabel('tree_nuts'), 'Tree nuts');
  assert.equal(allergenLabel('strawberries'), 'strawberries');
});
