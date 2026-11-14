import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import { LANGUAGES, translator, planText, localizeReasons } from '../src/i18n/index.js';

const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort();

for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
  test(`${code}: every English string is translated with the same placeholders`, async () => {
    const dict = (await import(`../src/i18n/${code}.js`)).default;
    for (const key of Object.keys(en)) {
      assert.ok(key in dict, `${code} is missing "${key}"`);
      assert.deepEqual(placeholders(dict[key]), placeholders(en[key]), `${code} "${key}" placeholders differ`);
    }
  });
}

test('translator fills placeholders and falls back to English, then the key', () => {
  const t = translator('es');
  assert.equal(t('shop.h1', { name: 'Ana' }), '¡Hola, Ana! Tómate tu tiempo.');
  assert.equal(translator('xx')('nav.kiosk'), 'Kiosk');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('plan names come from the condition groups', () => {
  const t = translator('en');
  assert.equal(planText({ keys: ['diabetes', 'hypertension'] }, t).label, 'Blood sugar · Blood pressure');
  assert.equal(planText({ keys: [] }, t).label, 'Everyday healthy eating');
});

test('rule explanations are translated by rule id', () => {
  const item = { ruleIds: ['ckd-potassium', 'allergen:dairy'], reasons: ['High potassium', 'Allergen'] };
  const out = localizeReasons(item, translator('fr'), () => 'lait');
  assert.equal(out.reasons[0], 'Riche en potassium — fatigue les reins.');
  assert.match(out.reasons[1], /lait/);
});
