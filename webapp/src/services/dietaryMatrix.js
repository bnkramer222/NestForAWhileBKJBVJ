/**
 * Clinical dietary matrix — the deterministic System of Record rules engine.
 * The LLM layer may explain or personalize, but it can NEVER downgrade a
 * restriction decided here. Mirrored in db/seed.sql for audit/reporting.
 *
 * Thresholds are per-serving and derived from public dietary guidance
 * (DASH, NKF renal guidelines, ADA carbohydrate guidance). Informational only.
 */

const CONDITION_PREFIXES = {
  E11: 'diabetes',
  E10: 'diabetes',
  I10: 'hypertension',
  I11: 'hypertension',
  N18: 'ckd',
  I50: 'heart_failure',
};

export function conditionKey(icd10Code) {
  return CONDITION_PREFIXES[String(icd10Code).slice(0, 3)] || 'other';
}

export function conditionKeys(conditions = []) {
  return [...new Set(conditions.map(conditionKey))].filter((key) => key !== 'other').sort();
}

const TIERS = {
  standard: {
    label: 'Standard nutrition',
    coefficients: { produce: 3, protein: 2, dairy: 1.5, grain: 2 },
    notes: 'Balanced household basket with no active clinical restriction.',
  },
  diabetes: {
    label: 'Diabetes-aware (low glycemic)',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 1.5 },
    notes: 'Favor low-glycemic produce, lean protein, whole grains; cap high-glycemic items.',
  },
  hypertension: {
    label: 'DASH / blood-pressure aware',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 2 },
    notes: 'Sodium limit per serving; emphasize potassium-rich produce unless CKD is present.',
  },
  ckd: {
    label: 'Renal-aware (CKD)',
    coefficients: { produce: 2.5, protein: 2.5, dairy: 1, grain: 2 },
    notes: 'Restrict high-sodium, high-potassium, and high-phosphorus items.',
  },
  heart_failure: {
    label: 'Cardiac-aware',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 2 },
    notes: 'Strict sodium restriction, lean protein, limit saturated fat.',
  },
  'ckd+diabetes': {
    label: 'Renal + diabetes',
    coefficients: { produce: 2.5, protein: 2.5, dairy: 1, grain: 1.5 },
    notes: 'Low glycemic AND renal-safe: the tightest produce basket.',
  },
  'ckd+hypertension': {
    label: 'Renal + hypertension',
    coefficients: { produce: 2.5, protein: 2.5, dairy: 1, grain: 2 },
    notes: 'Low sodium without loading potassium.',
  },
  'diabetes+hypertension': {
    label: 'Diabetes + hypertension',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 1.5 },
    notes: 'Low glycemic and low sodium.',
  },
  'ckd+diabetes+hypertension': {
    label: 'Triple chronicity (renal + diabetes + hypertension)',
    coefficients: { produce: 2.5, protein: 2.5, dairy: 1, grain: 1.5 },
    notes: 'Highest-risk profile: renal-safe produce, low sodium, low glycemic load.',
  },
  'diabetes+heart_failure': {
    label: 'Diabetes + cardiac',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 1.5 },
    notes: 'Low sodium, low glycemic, lean protein.',
  },
  'diabetes+heart_failure+hypertension': {
    label: 'Diabetes + cardiac + hypertension',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 1.5 },
    notes: 'Strict sodium, low glycemic, lean protein.',
  },
  'heart_failure+hypertension': {
    label: 'Cardiac + hypertension',
    coefficients: { produce: 4, protein: 2.5, dairy: 1.5, grain: 2 },
    notes: 'Strict sodium restriction.',
  },
  composite: {
    label: 'Composite clinical profile',
    coefficients: { produce: 3, protein: 2.5, dairy: 1, grain: 1.5 },
    notes: 'Multiple conditions: apply every active restriction simultaneously.',
  },
};

export function resolveTier(conditions = []) {
  const keys = conditionKeys(conditions);
  const requestedId = keys.length ? keys.join('+') : 'standard';
  const tier = TIERS[requestedId];
  if (tier) return { id: requestedId, keys, ...tier };
  // Unknown combination: bind the canonical composite tier so the FK stays valid.
  return { id: 'composite', keys, ...TIERS.composite };
}

export function tierById(id) {
  return TIERS[id] || TIERS.composite;
}

/**
 * Rule shape:
 *   condition  — clinical key that activates the rule
 *   test       — { tag } or { nutrient, op, value }
 *   status     — approved | capped | restricted
 */
const RULES = [
  // Diabetes — glycemic control
  { id: 'dm-glycemic-tag', condition: 'diabetes', test: { tag: 'high_glycemic' }, status: 'capped', capServings: 1, rationale: 'High-glycemic item — limit to one serving per visit (diabetes).' },
  { id: 'dm-added-sugar', condition: 'diabetes', test: { tag: 'added_sugar' }, status: 'capped', capServings: 1, rationale: 'Added sugar — keep to a single serving (diabetes).' },
  { id: 'dm-sugar-load', condition: 'diabetes', test: { nutrient: 'sugar_g', op: '>', value: 15 }, status: 'capped', capServings: 1, rationale: 'More than 15 g sugar per serving (diabetes).' },

  // Hypertension — sodium
  { id: 'htn-sodium', condition: 'hypertension', test: { nutrient: 'sodium_mg', op: '>', value: 600 }, status: 'capped', capServings: 1, rationale: 'High sodium per serving — cap at one (DASH pattern).' },
  { id: 'htn-sodium-severe', condition: 'hypertension', test: { nutrient: 'sodium_mg', op: '>', value: 900 }, status: 'restricted', rationale: 'Very high sodium (>900 mg/serving) — restricted for hypertension.' },

  // CKD — renal load
  { id: 'ckd-sodium', condition: 'ckd', test: { nutrient: 'sodium_mg', op: '>', value: 600 }, status: 'restricted', rationale: 'High sodium — restricted in chronic kidney disease.' },
  { id: 'ckd-potassium', condition: 'ckd', test: { nutrient: 'potassium_mg', op: '>', value: 350 }, status: 'restricted', rationale: 'High potassium — restricted in chronic kidney disease.' },
  { id: 'ckd-phosphorus', condition: 'ckd', test: { nutrient: 'phosphorus_mg', op: '>', value: 300 }, status: 'restricted', rationale: 'High phosphorus — restricted in chronic kidney disease.' },
  { id: 'ckd-protein-tag', condition: 'ckd', test: { tag: 'high_phosphorus' }, status: 'restricted', rationale: 'Processed high-phosphorus item — restricted in CKD.' },

  // Heart failure — strict sodium and saturated fat
  { id: 'hf-sodium', condition: 'heart_failure', test: { nutrient: 'sodium_mg', op: '>', value: 400 }, status: 'restricted', rationale: 'Sodium above cardiac limit — restricted in heart failure.' },
  { id: 'hf-satfat', condition: 'heart_failure', test: { nutrient: 'sat_fat_g', op: '>', value: 5 }, status: 'capped', capServings: 1, rationale: 'High saturated fat — cap at one serving (cardiac).' },

  // Universal guardrails
  { id: 'all-sodium-extreme', condition: '*', test: { nutrient: 'sodium_mg', op: '>', value: 1200 }, status: 'capped', capServings: 1, rationale: 'Extremely high sodium — one serving maximum for any client.' },
];

const STATUS_RANK = { approved: 0, capped: 1, restricted: 2 };

function ruleMatches(rule, product) {
  if (rule.test.tag) return Array.isArray(product.tags) && product.tags.includes(rule.test.tag);
  const actual = Number(product[rule.test.nutrient]);
  if (Number.isNaN(actual)) return false;
  switch (rule.test.op) {
    case '>': return actual > rule.test.value;
    case '>=': return actual >= rule.test.value;
    case '<': return actual < rule.test.value;
    case '<=': return actual <= rule.test.value;
    default: return false;
  }
}

/**
 * @returns {{status:'approved'|'capped'|'restricted', reasons:string[], ruleIds:string[], capServings:number|null}}
 */
export function evaluateProduct(product, { conditions = [], allergies = [] } = {}) {
  const keys = new Set(conditionKeys(conditions));
  let status = 'approved';
  let capServings = null;
  const reasons = [];
  const ruleIds = [];

  for (const rule of RULES) {
    const active = rule.condition === '*' || keys.has(rule.condition);
    if (!active || !ruleMatches(rule, product)) continue;
    ruleIds.push(rule.id);
    reasons.push(rule.rationale);
    if (STATUS_RANK[rule.status] > STATUS_RANK[status]) status = rule.status;
    if (rule.status === 'capped') {
      capServings = capServings === null ? rule.capServings ?? 1 : Math.min(capServings, rule.capServings ?? 1);
    }
  }

  for (const allergen of product.allergens || []) {
    if (allergies.some((a) => String(a).toLowerCase() === String(allergen).toLowerCase())) {
      status = 'restricted';
      reasons.push(`Allergen on client profile: ${allergen}.`);
      ruleIds.push(`allergen:${allergen}`);
    }
  }

  return { status, reasons, ruleIds, capServings };
}

/** Grocery needs = tier coefficient (lb/person/visit) × household size. */
export function computeDailyNeeds(tier, householdSize) {
  const needs = {};
  for (const [category, coefficient] of Object.entries(tier.coefficients)) {
    needs[category] = Number((coefficient * householdSize).toFixed(1));
  }
  return needs;
}

/** Pick the best in-stock staples per category for this clinical profile. */
export function buildRecommendations({ products, conditions = [], allergies = [], householdSize = 1, limitPerCategory = 4 }) {
  const tier = resolveTier(conditions);
  const evaluated = products
    .filter((product) => Number(product.on_hand) > 0)
    .map((product) => ({ product, ...evaluateProduct(product, { conditions, allergies }) }));

  const byCategory = new Map();
  for (const entry of evaluated) {
    if (entry.status === 'restricted') continue;
    const list = byCategory.get(entry.product.category) || [];
    list.push(entry);
    byCategory.set(entry.product.category, list);
  }

  const score = (entry) => {
    const p = entry.product;
    let value = Number(p.fiber_g || 0) * 2 + Number(p.protein_g || 0);
    value -= Number(p.sodium_mg || 0) / 100;
    value -= Number(p.sugar_g || 0) / 2;
    if (entry.status === 'capped') value -= 5;
    return value;
  };

  const needs = computeDailyNeeds(tier, householdSize);
  const items = [];
  for (const [category, entries] of byCategory) {
    entries.sort((a, b) => score(b) - score(a));
    for (const entry of entries.slice(0, limitPerCategory)) {
      items.push({
        sku: entry.product.sku,
        name: entry.product.name,
        category,
        aisle: entry.product.aisle,
        shelf: entry.product.shelf,
        bin: entry.product.bin,
        onHand: Number(entry.product.on_hand),
        status: entry.status,
        reasons: entry.reasons,
        targetPounds: needs[category] ?? null,
      });
    }
  }

  return { tier, needs, items };
}
