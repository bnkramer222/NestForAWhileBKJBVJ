import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProduct,
  resolveTier,
  computeDailyNeeds,
  buildRecommendations,
  conditionKeys,
} from '../src/services/dietaryMatrix.js';

const product = (overrides = {}) => ({
  sku: 'T-001',
  name: 'Test item',
  category: 'produce',
  aisle: 'A',
  shelf: '1',
  bin: 'B01',
  serving_size_g: 100,
  calories: 100,
  protein_g: 5,
  carbs_g: 10,
  fiber_g: 3,
  sugar_g: 2,
  fat_g: 1,
  sat_fat_g: 0.5,
  sodium_mg: 20,
  potassium_mg: 150,
  phosphorus_mg: 40,
  tags: [],
  allergens: [],
  on_hand: 10,
  ...overrides,
});

test('banana is capped for diabetes (high glycemic)', () => {
  const result = evaluateProduct(product({ tags: ['high_glycemic'], sugar_g: 14.4 }), {
    conditions: ['E11.9'],
  });
  assert.equal(result.status, 'capped');
  assert.equal(result.capServings, 1);
  assert.ok(result.ruleIds.includes('dm-glycemic-tag'));
});

test('banana is restricted for CKD (potassium > 350 mg)', () => {
  const result = evaluateProduct(product({ potassium_mg: 422 }), { conditions: ['N18.30'] });
  assert.equal(result.status, 'restricted');
  assert.ok(result.ruleIds.includes('ckd-potassium'));
});

test('ramen is restricted for hypertension (sodium > 900 mg)', () => {
  const result = evaluateProduct(product({ sodium_mg: 1600, tags: ['high_sodium'] }), {
    conditions: ['I10'],
  });
  assert.equal(result.status, 'restricted');
  assert.ok(result.ruleIds.includes('htn-sodium-severe'));
});

test('allergen on the profile forces restricted regardless of nutrients', () => {
  const result = evaluateProduct(product({ allergens: ['dairy'], category: 'dairy' }), {
    conditions: ['I10'],
    allergies: ['dairy'],
  });
  assert.equal(result.status, 'restricted');
  assert.ok(result.ruleIds.includes('allergen:dairy'));
});

test('restricted beats capped when multiple rules fire', () => {
  const result = evaluateProduct(
    product({ sodium_mg: 950, tags: ['high_glycemic'], sugar_g: 20, potassium_mg: 500 }),
    { conditions: ['E11.9', 'N18.30', 'I10'] },
  );
  assert.equal(result.status, 'restricted');
});

test('unrestricted produce is approved for hypertension', () => {
  const result = evaluateProduct(product({ name: 'Zucchini', potassium_mg: 324, sodium_mg: 10 }), {
    conditions: ['I10'],
  });
  assert.equal(result.status, 'approved');
  assert.equal(result.reasons.length, 0);
});

test('ICD-10 codes map to clinical keys', () => {
  assert.deepEqual(conditionKeys(['E11.9', 'I10', 'N18.30', 'I50.9']), [
    'ckd',
    'diabetes',
    'heart_failure',
    'hypertension',
  ]);
});

test('known combinations resolve to a canonical tier id', () => {
  assert.equal(resolveTier(['E11.9', 'I10']).id, 'diabetes+hypertension');
  assert.equal(resolveTier(['N18.30', 'E11.9', 'I10']).id, 'ckd+diabetes+hypertension');
  assert.equal(resolveTier([]).id, 'standard');
});

test('unknown combinations fall back to the composite tier id', () => {
  assert.equal(resolveTier(['I50.9', 'N18.30']).id, 'composite');
});

test('daily needs scale with household size', () => {
  const tier = resolveTier(['E11.9']);
  assert.deepEqual(computeDailyNeeds(tier, 4), { produce: 16, protein: 10, dairy: 6, grain: 6 });
});

test('recommendations exclude restricted items and keep capped ones', () => {
  const products = [
    product({ sku: 'A', name: 'Banana', tags: ['high_glycemic'], potassium_mg: 422 }),
    product({ sku: 'B', name: 'Spinach', potassium_mg: 558 }),
    product({ sku: 'C', name: 'Carrots', potassium_mg: 195 }),
  ];
  const { items } = buildRecommendations({ products, conditions: ['N18.30'], householdSize: 2 });
  const skus = items.map((item) => item.sku);
  assert.ok(skus.includes('C'));
  assert.ok(!skus.includes('A'));
  assert.ok(!skus.includes('B'));
});
