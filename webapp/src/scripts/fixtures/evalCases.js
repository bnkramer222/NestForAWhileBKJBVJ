/**
 * Offline fixtures for the AI evaluation run (src/scripts/eval-ai.js).
 * Deliberately includes high-sodium, high-potassium, allergen, and out-of-stock items
 * so sanitiser behaviour is exercised without a database.
 */

const item = (overrides) => ({
  sku: 'X',
  name: 'Item',
  category: 'produce',
  aisle: 'A',
  shelf: '1',
  bin: 'B01',
  on_hand: 20,
  sodium_mg: 20,
  potassium_mg: 150,
  phosphorus_mg: 40,
  sugar_g: 2,
  sat_fat_g: 0.5,
  tags: [],
  allergens: [],
  ...overrides,
});

export const evalInventory = [
  item({ sku: 'V001', name: 'Baby spinach', bin: 'B02', potassium_mg: 558 }),
  item({ sku: 'V002', name: 'Zucchini', bin: 'B09', potassium_mg: 324 }),
  item({ sku: 'V003', name: 'Carrots', bin: 'B05', potassium_mg: 195 }),
  item({ sku: 'V004', name: 'Bananas', bin: 'B01', potassium_mg: 422, sugar_g: 14.4, tags: ['high_glycemic'] }),
  item({ sku: 'V005', name: 'Blueberries', bin: 'B17', sugar_g: 10 }),
  item({ sku: 'P001', name: 'Chicken breast', category: 'protein', aisle: 'B', bin: 'B01' }),
  item({ sku: 'P002', name: 'Salmon fillet', category: 'protein', aisle: 'B', bin: 'B03', allergens: ['fish'] }),
  item({ sku: 'P003', name: 'Black beans', category: 'protein', aisle: 'B', bin: 'B07', sodium_mg: 300 }),
  item({ sku: 'P004', name: 'Canned tuna', category: 'protein', aisle: 'B', bin: 'B06', sodium_mg: 320, allergens: ['fish'] }),
  item({ sku: 'D001', name: 'Plain Greek yogurt', category: 'dairy', aisle: 'C', bin: 'B01', allergens: ['dairy'] }),
  item({ sku: 'G001', name: 'Brown rice', category: 'grain', aisle: 'D', bin: 'B01', sugar_g: 0.7 }),
  item({ sku: 'G002', name: 'Quinoa', category: 'grain', aisle: 'D', bin: 'B05' }),
  item({ sku: 'G003', name: 'Whole wheat bread', category: 'grain', aisle: 'D', bin: 'B02', allergens: ['wheat', 'gluten'] }),
  item({ sku: 'X001', name: 'Instant ramen', category: 'pantry', aisle: 'E', bin: 'B02', sodium_mg: 1600, tags: ['high_sodium', 'high_glycemic'] }),
  item({ sku: 'X002', name: 'Canned soup', category: 'pantry', aisle: 'E', bin: 'B01', sodium_mg: 890, sugar_g: 20, tags: ['added_sugar'] }),
  item({ sku: 'X003', name: 'Cheddar', category: 'dairy', aisle: 'C', bin: 'B03', sat_fat_g: 6, allergens: ['dairy'], tags: ['high_phosphorus'] }),
  item({ sku: 'X004', name: 'Sold-out oats', category: 'grain', aisle: 'D', bin: 'B14', on_hand: 0 }),
  item({ sku: 'X005', name: 'Frozen berries', bin: 'B26', sugar_g: 10 }),
];

export const evalCases = [
  {
    name: 'diabetes + hypertension, empty cart',
    profile: { conditions: ['E11.9', 'I10'], allergies: [], householdSize: 4 },
    cart: [],
  },
  {
    name: 'CKD stage 3 (potassium and phosphorus limits)',
    profile: { conditions: ['N18.30'], allergies: [], householdSize: 2 },
    cart: [{ sku: 'V003', name: 'Carrots', quantity: 1 }],
  },
  {
    name: 'triple chronicity + dairy allergy',
    profile: { conditions: ['E11.9', 'N18.30', 'I10'], allergies: ['dairy'], householdSize: 5 },
    cart: [{ sku: 'P001', name: 'Chicken breast', quantity: 2 }],
  },
  {
    name: 'heart failure, strict sodium',
    profile: { conditions: ['I50.9'], allergies: [], householdSize: 2 },
    cart: [{ sku: 'G001', name: 'Brown rice', quantity: 1 }],
  },
  {
    name: 'gluten allergy + hypertension',
    profile: { conditions: ['I10'], allergies: ['gluten'], householdSize: 6 },
    cart: [{ sku: 'V002', name: 'Zucchini', quantity: 3 }],
  },
  {
    name: 'standard tier, no conditions',
    profile: { conditions: [], allergies: [], householdSize: 1 },
    cart: [],
  },
];
