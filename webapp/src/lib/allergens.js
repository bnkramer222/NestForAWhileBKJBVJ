/**
 * The allergen vocabulary used by the product catalog, plus the words people actually type.
 * Sign-up stores only canonical keys, so a choice always matches the product allergen flags.
 */
export const ALLERGENS = [
  { key: 'dairy', label: 'Milk / dairy', icon: '🥛' },
  { key: 'eggs', label: 'Eggs', icon: '🥚' },
  { key: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { key: 'tree_nuts', label: 'Tree nuts', icon: '🌰' },
  { key: 'wheat', label: 'Wheat', icon: '🌾' },
  { key: 'gluten', label: 'Gluten (celiac)', icon: '🍞' },
  { key: 'soy', label: 'Soy', icon: '🫘' },
  { key: 'fish', label: 'Fish', icon: '🐟' },
  { key: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { key: 'sesame', label: 'Sesame', icon: '⚪' },
];

const KEYS = new Set(ALLERGENS.map((a) => a.key));

const SYNONYMS = {
  milk: 'dairy', lactose: 'dairy', cheese: 'dairy', dairy: 'dairy',
  egg: 'eggs', eggs: 'eggs',
  peanut: 'peanuts', peanuts: 'peanuts',
  nut: 'tree_nuts', nuts: 'tree_nuts', 'tree nut': 'tree_nuts', 'tree nuts': 'tree_nuts', almond: 'tree_nuts', almonds: 'tree_nuts', walnut: 'tree_nuts', walnuts: 'tree_nuts', cashew: 'tree_nuts', pecan: 'tree_nuts',
  wheat: 'wheat',
  gluten: 'gluten', celiac: 'gluten', coeliac: 'gluten',
  soy: 'soy', soya: 'soy', soybean: 'soy', soybeans: 'soy',
  fish: 'fish', salmon: 'fish', tuna: 'fish', cod: 'fish',
  shellfish: 'shellfish', shrimp: 'shellfish', crab: 'shellfish', lobster: 'shellfish', prawn: 'shellfish', prawns: 'shellfish',
  sesame: 'sesame',
};

/** "Peanut ", "MILK", "tree nuts" -> canonical key; anything unknown is kept as typed (lower-case). */
export function normalizeAllergen(text) {
  const clean = String(text || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  if (!clean) return null;
  if (KEYS.has(clean.replace(/ /g, '_'))) return clean.replace(/ /g, '_');
  return SYNONYMS[clean] || clean;
}

/** Gluten avoidance also excludes wheat products (wheat contains gluten). */
const IMPLIES = { gluten: ['gluten', 'wheat'] };

export function allergyMatches(clientAllergy, productAllergen) {
  const client = normalizeAllergen(clientAllergy);
  const product = normalizeAllergen(productAllergen);
  if (!client || !product) return false;
  return (IMPLIES[client] || [client]).includes(product);
}

export function allergenLabel(key) {
  const found = ALLERGENS.find((a) => a.key === key);
  return found ? found.label : String(key).replace(/_/g, ' ');
}
