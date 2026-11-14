-- Epic Cure MTG — reference seed data (no PHI).
-- Run via `npm run db:seed` (personas with encrypted names are inserted by src/scripts/seed.js).

BEGIN;

INSERT INTO floor_state (id, active_floor_shoppers, max_floor_capacity)
VALUES (1, 0, 25)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- ICD-10 catalog
INSERT INTO condition_catalog (code, name, condition_key) VALUES
  ('E11.9', 'Type 2 diabetes mellitus without complications', 'diabetes'),
  ('E11.65','Type 2 diabetes mellitus with hyperglycemia',    'diabetes'),
  ('I10',   'Essential (primary) hypertension',               'hypertension'),
  ('N18.30','Chronic kidney disease, stage 3 unspecified',    'ckd'),
  ('N18.4', 'Chronic kidney disease, stage 4',                'ckd'),
  ('I50.9', 'Heart failure, unspecified',                     'heart_failure')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- dietary tiers
INSERT INTO dietary_tiers (id, label, coefficients, notes) VALUES
  ('standard', 'Standard nutrition', '{"produce":3,"protein":2,"dairy":1.5,"grain":2}', 'Balanced household basket.'),
  ('diabetes', 'Diabetes-aware (low glycemic)', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":1.5}', 'Low-glycemic produce, lean protein, whole grains.'),
  ('hypertension', 'DASH / blood-pressure aware', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":2}', 'Sodium limit per serving.'),
  ('ckd', 'Renal-aware (CKD)', '{"produce":2.5,"protein":2.5,"dairy":1,"grain":2}', 'Restrict sodium, potassium, phosphorus.'),
  ('heart_failure', 'Cardiac-aware', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":2}', 'Strict sodium restriction.'),
  ('ckd+diabetes', 'Renal + diabetes', '{"produce":2.5,"protein":2.5,"dairy":1,"grain":1.5}', 'Low glycemic AND renal-safe.'),
  ('ckd+hypertension', 'Renal + hypertension', '{"produce":2.5,"protein":2.5,"dairy":1,"grain":2}', 'Low sodium without potassium load.'),
  ('diabetes+hypertension', 'Diabetes + hypertension', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":1.5}', 'Low glycemic and low sodium.'),
  ('ckd+diabetes+hypertension', 'Triple chronicity', '{"produce":2.5,"protein":2.5,"dairy":1,"grain":1.5}', 'Highest-risk profile.'),
  ('diabetes+heart_failure', 'Diabetes + cardiac', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":1.5}', 'Low sodium, low glycemic.'),
  ('diabetes+heart_failure+hypertension', 'Diabetes + cardiac + hypertension', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":1.5}', 'Strict sodium, low glycemic, lean protein.'),
  ('heart_failure+hypertension', 'Cardiac + hypertension', '{"produce":4,"protein":2.5,"dairy":1.5,"grain":2}', 'Strict sodium restriction.'),
  ('composite', 'Composite clinical profile', '{"produce":3,"protein":2.5,"dairy":1,"grain":1.5}', 'Apply every active restriction.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- clinical rules mirror
INSERT INTO dietary_rules (id, condition_key, item_tag, nutrient, operator, threshold, status, cap_servings, rationale) VALUES
  ('dm-glycemic-tag',    'diabetes',     'high_glycemic', NULL,          NULL,  NULL, 'capped',     1, 'High-glycemic item — limit to one serving per visit (diabetes).'),
  ('dm-added-sugar',     'diabetes',     'added_sugar',   NULL,          NULL,  NULL, 'capped',     1, 'Added sugar — keep to a single serving (diabetes).'),
  ('dm-sugar-load',      'diabetes',     NULL,            'sugar_g',     '>',   15,   'capped',     1, 'More than 15 g sugar per serving (diabetes).'),
  ('htn-sodium',         'hypertension', NULL,            'sodium_mg',   '>',   600,  'capped',     1, 'High sodium per serving — cap at one (DASH pattern).'),
  ('htn-sodium-severe',  'hypertension', NULL,            'sodium_mg',   '>',   900,  'restricted', NULL, 'Very high sodium (>900 mg/serving) — restricted for hypertension.'),
  ('ckd-sodium',         'ckd',          NULL,            'sodium_mg',   '>',   600,  'restricted', NULL, 'High sodium — restricted in chronic kidney disease.'),
  ('ckd-potassium',      'ckd',          NULL,            'potassium_mg','>',   350,  'restricted', NULL, 'High potassium — restricted in chronic kidney disease.'),
  ('ckd-phosphorus',     'ckd',          NULL,            'phosphorus_mg','>',  300,  'restricted', NULL, 'High phosphorus — restricted in chronic kidney disease.'),
  ('ckd-protein-tag',    'ckd',          'high_phosphorus', NULL,        NULL,  NULL, 'restricted', NULL, 'Processed high-phosphorus item — restricted in CKD.'),
  ('hf-sodium',          'heart_failure',NULL,            'sodium_mg',   '>',   400,  'restricted', NULL, 'Sodium above cardiac limit — restricted in heart failure.'),
  ('hf-satfat',          'heart_failure',NULL,            'sat_fat_g',   '>',   5,    'capped',     1, 'High saturated fat — cap at one serving (cardiac).'),
  ('all-sodium-extreme', '*',            NULL,            'sodium_mg',   '>',   1200, 'capped',     1, 'Extremely high sodium — one serving maximum for any client.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- grants
INSERT INTO grants (id, funder, grant_code, period_start, period_end) VALUES
  ('G-FIM-2026',   'HHS Food is Medicine',            'FIM-2026-041', '2026-01-01', '2026-12-31'),
  ('G-SJC-2026',   'St. Johns County Community Fund', 'SJC-2026-118', '2026-03-01', '2027-02-28'),
  ('G-EPIC-2026',  'Epic Cure General Fund',          'EC-GEN-2026',  '2026-01-01', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- product catalog (107 items)
INSERT INTO products
  (sku, name, brand, category, aisle, shelf, bin, serving_size_g, calories, protein_g, carbs_g, fiber_g, sugar_g, fat_g, sat_fat_g, sodium_mg, potassium_mg, phosphorus_mg, glycemic_index, allergens, tags)
VALUES
  ('100101','Bananas',              'Local',       'produce','A','1','B01',118,105,1.3,27,3.1,14.4,0.4,0.1,1,422,26,62,'{}','{high_glycemic}'),
  ('100102','Baby spinach',         'Fresh Farms', 'produce','A','1','B02',100,23,2.9,3.6,2.2,0.4,0.4,0.1,79,558,49,15,'{}','{}'),
  ('100103','Sweet potatoes',       'Local',       'produce','A','2','B03',130,112,2,26,3.9,5.4,0.1,0,72,337,47,63,'{}','{high_glycemic}'),
  ('100104','Apples',               'Local',       'produce','A','2','B04',182,95,0.5,25,4.4,19,0.3,0,2,195,20,36,'{}','{}'),
  ('100105','Carrots',              'Local',       'produce','A','3','B05',61,25,0.6,6,1.7,2.9,0.1,0,69,195,20,39,'{}','{}'),
  ('100106','Broccoli crowns',      'Fresh Farms', 'produce','A','3','B06',91,31,2.5,6,2.4,1.5,0.3,0,33,288,66,15,'{}','{}'),
  ('100107','Tomatoes on the vine', 'Local',       'produce','A','4','B07',123,22,1.1,4.8,1.5,3.2,0.2,0,5,292,24,30,'{}','{}'),
  ('100108','Oranges',              'Local',       'produce','A','4','B08',131,62,1.2,15.4,3.1,12.2,0.2,0,0,237,18,43,'{}','{}'),
  ('100109','Zucchini',             'Local',       'produce','A','5','B09',124,21,1.5,3.9,1.2,2.9,0.4,0.1,10,324,38,15,'{}','{}'),
  ('100110','Curly kale',           'Fresh Farms', 'produce','A','5','B10',67,33,2.9,5.7,0.9,1.1,0.6,0.1,29,329,28,15,'{}','{}'),

  ('100201','Boneless chicken breast','Rescue Lot', 'protein','B','1','B01',100,165,31,0,0,0,3.6,1,74,256,220,0,'{}','{}'),
  ('100202','Large eggs',           'Sunrise',      'protein','B','1','B02',50,72,6.3,0.4,0,0.2,4.8,1.6,71,69,99,0,'{eggs}','{}'),
  ('100203','Atlantic salmon fillet','Rescue Lot',  'protein','B','2','B03',100,208,20,0,0,0,13,3.1,59,363,200,0,'{fish}','{}'),
  ('100204','Ground turkey 93%',    'Rescue Lot',   'protein','B','2','B04',112,170,22,0,0,0,9,2.5,78,250,200,0,'{}','{}'),
  ('100205','Firm tofu',            'Green Block',  'protein','B','3','B05',85,80,8,2,1,0.5,4.5,0.6,10,150,100,15,'{soy}','{}'),
  ('100206','Canned tuna in water', 'Ocean Catch',  'protein','B','3','B06',85,100,22,0,0,0,0.7,0.2,320,200,150,0,'{fish}','{}'),
  ('100207','Canned black beans',   'Pantry Co',    'protein','B','4','B07',130,130,8,23,8,1,0.5,0.1,300,400,130,30,'{}','{}'),
  ('100208','Cooked lentils',       'Pantry Co',    'protein','B','4','B08',100,116,9,20,8,1.8,0.4,0.1,2,369,180,30,'{}','{}'),

  ('100301','Plain Greek yogurt',   'Valley Dairy', 'dairy','C','1','B01',170,100,17,6,0,4,0.7,0.5,60,240,180,0,'{dairy}','{}'),
  ('100302','1% milk',              'Valley Dairy', 'dairy','C','1','B02',240,100,8,12,0,12,2.4,1.5,105,380,230,0,'{dairy}','{}'),
  ('100303','Cheddar cheese block', 'Valley Dairy', 'dairy','C','2','B03',28,115,6.5,0.9,0,0.1,9.5,6,180,28,130,0,'{dairy}','{high_phosphorus}'),
  ('100304','Low-fat cottage cheese','Valley Dairy','dairy','C','2','B04',113,90,12,5,0,4,2.5,1.5,350,130,160,0,'{dairy}','{}'),

  ('100401','Brown rice, cooked',   'Pantry Co',    'grain','D','1','B01',195,215,5,45,3.5,0.7,1.8,0.4,10,154,150,50,'{}','{}'),
  ('100402','Whole wheat bread',    'Baker Rescue', 'grain','D','1','B02',43,110,5,20,3,3,1.5,0.3,150,100,90,55,'{wheat,gluten}','{}'),
  ('100403','Rolled oats',          'Pantry Co',    'grain','D','2','B03',40,150,5,27,4,1,3,0.5,0,150,170,55,'{gluten}','{}'),
  ('100404','Whole wheat pasta',    'Pantry Co',    'grain','D','2','B04',56,200,7,41,6,2,1,0.2,5,220,160,45,'{wheat,gluten}','{}'),
  ('100405','Quinoa, cooked',       'Pantry Co',    'grain','D','3','B05',185,222,8,39,5,1.6,3.6,0.4,13,318,281,53,'{}','{}'),

  ('100501','Canned tomato soup',   'Pantry Co',    'pantry','E','1','B01',245,160,3,33,2,20,4,1,890,450,120,60,'{}','{added_sugar,high_sodium}'),
  ('100502','Instant ramen',        'Quick Bowl',   'pantry','E','1','B02',85,380,8,54,2,2,14,7,1600,200,110,70,'{wheat,gluten}','{high_sodium,high_glycemic}'),
  ('100503','Creamy peanut butter', 'Pantry Co',    'pantry','E','2','B03',32,190,8,7,2,3,16,3,140,200,150,14,'{peanuts}','{added_sugar}'),
  ('100504','Corn flakes cereal',   'Sunrise',      'pantry','E','2','B04',40,150,2,36,1,12,0.2,0,200,60,30,80,'{gluten}','{added_sugar,high_glycemic}'),
  ('100505','Canned corn',          'Pantry Co',    'pantry','E','3','B05',125,90,3,20,2,5,1,0.2,300,220,70,55,'{}','{}'),
  ('100506','Low-sodium vegetable broth','Pantry Co','pantry','E','3','B06',240,15,0,2,0,1,0.5,0.1,140,30,10,0,'{}','{}'),

  -- produce aisle A (continued)
  ('100111','Bell peppers',          'Local',       'produce','A','6','B11',119,31,1,6,2.1,4.2,0.3,0,4,251,26,15,'{}','{}'),
  ('100112','Cucumbers',             'Local',       'produce','A','6','B12',104,16,0.7,3.8,0.5,1.7,0.1,0,2,147,24,15,'{}','{}'),
  ('100113','Green beans',           'Fresh Farms', 'produce','A','7','B13',100,31,1.8,7,2.7,3.3,0.2,0,45,209,38,15,'{}','{}'),
  ('100114','Green cabbage',         'Local',       'produce','A','7','B14',89,22,1.1,5.2,2.2,2.8,0.1,0,16,170,26,15,'{}','{}'),
  ('100115','Cauliflower',           'Fresh Farms', 'produce','A','8','B15',107,25,1.9,5,2,1.9,0.3,0,30,299,44,15,'{}','{}'),
  ('100116','Romaine lettuce',       'Fresh Farms', 'produce','A','8','B16',47,8,0.6,1.5,1,0.6,0.1,0,4,116,14,15,'{}','{}'),
  ('100117','Blueberries',           'Rescue Lot',  'produce','A','9','B17',148,84,1.1,21,3.6,14.7,0.5,0,1,114,18,53,'{}','{}'),
  ('100118','Strawberries',          'Rescue Lot',  'produce','A','9','B18',152,49,1,11.7,3,7.4,0.5,0,2,233,36,40,'{}','{}'),
  ('100119','Avocados',              'Rescue Lot',  'produce','A','10','B19',150,240,3,12.8,10,1.3,22,3.1,10,727,78,15,'{}','{}'),
  ('100120','Sweet corn',            'Local',       'produce','A','10','B20',90,90,3.3,19,2.4,6.2,1.5,0.2,15,270,89,55,'{}','{}'),
  ('100121','Butternut squash',      'Local',       'produce','A','11','B21',140,63,1.4,16,2.8,3,0.1,0,6,493,33,51,'{}','{}'),
  ('100122','White mushrooms',       'Fresh Farms', 'produce','A','11','B22',70,22,2.2,4.6,1.4,1.2,0.2,0,2,223,61,15,'{}','{}'),
  ('100123','Beets',                 'Local',       'produce','A','12','B23',136,58,2.2,13,3.8,9.2,0.2,0,106,442,22,64,'{}','{}'),
  ('100124','Asparagus',             'Fresh Farms', 'produce','A','12','B24',134,27,3,5.2,2.8,2.5,0.2,0,3,271,70,15,'{}','{}'),
  ('100125','Red potatoes',          'Local',       'produce','A','13','B25',148,116,3,26,2.1,1.9,0.1,0,8,512,68,78,'{}','{high_glycemic}'),
  ('100126','Frozen mixed berries',  'Rescue Lot',  'produce','A','13','B26',140,70,1,17,4,10,0.4,0,2,130,20,40,'{}','{}'),

  -- protein aisle B (continued)
  ('100209','Pork loin',             'Rescue Lot',  'protein','B','5','B09',100,143,26,0,0,0,3.5,1.2,59,370,210,0,'{}','{}'),
  ('100210','Deli turkey breast',    'Rescue Lot',  'protein','B','5','B10',56,60,12,1,0,1,1.5,0.5,480,200,120,0,'{}','{high_sodium}'),
  ('100211','Ground beef 90/10',     'Rescue Lot',  'protein','B','6','B11',100,176,20,0,0,0,10,4,66,270,180,0,'{}','{}'),
  ('100212','Beef sirloin',          'Rescue Lot',  'protein','B','6','B12',100,180,27,0,0,0,7,2.5,55,330,210,0,'{}','{}'),
  ('100213','Canned salmon',         'Ocean Catch', 'protein','B','7','B13',85,120,17,0,0,0,5,1,380,300,240,0,'{fish}','{high_sodium}'),
  ('100214','Shrimp',                'Ocean Catch', 'protein','B','7','B14',100,99,24,0.2,0,0,0.3,0.1,111,259,201,0,'{shellfish}','{}'),
  ('100215','Cod fillet',            'Ocean Catch', 'protein','B','8','B15',100,82,18,0,0,0,0.7,0.1,54,413,203,0,'{fish}','{}'),
  ('100216','Sardines in water',     'Ocean Catch', 'protein','B','8','B16',85,130,15,0,0,0,7,1.5,280,300,350,0,'{fish}','{high_phosphorus}'),
  ('100217','Chicken thighs',        'Rescue Lot',  'protein','B','9','B17',100,209,26,0,0,0,11,3,88,220,180,0,'{}','{}'),
  ('100218','Turkey sausage',        'Rescue Lot',  'protein','B','9','B18',68,130,9,2,0,1,9,2.5,480,230,150,0,'{}','{high_sodium}'),
  ('100219','Tempeh',                'Green Block', 'protein','B','10','B19',84,160,15,8,5,3,9,1.5,10,350,180,0,'{soy}','{}'),
  ('100220','Edamame',               'Green Block', 'protein','B','10','B20',155,188,18,14,8,3,8,1,9,676,260,0,'{soy}','{}'),
  ('100221','Canned chickpeas',      'Pantry Co',   'protein','B','11','B21',130,140,7,22,6,4,2.5,0.2,280,300,150,0,'{}','{}'),
  ('100222','Canned kidney beans',   'Pantry Co',   'protein','B','11','B22',130,120,8,21,7,1,0.5,0.1,300,400,160,0,'{}','{}'),
  ('100223','Canned chicken',        'Pantry Co',   'protein','B','12','B23',56,70,13,0,0,0,1.5,0.4,400,150,100,0,'{}','{high_sodium}'),
  ('100224','Frozen white fish',     'Ocean Catch', 'protein','B','12','B24',100,90,18,0,0,0,1,0.2,60,300,200,0,'{fish}','{}'),
  ('100225','Ground chicken',        'Rescue Lot',  'protein','B','13','B25',100,189,20,0,0,0,11,3,70,280,190,0,'{}','{}'),
  ('100226','Liquid egg whites',     'Sunrise',     'protein','B','13','B26',46,25,5,0.7,0,0.4,0,0,55,80,20,0,'{eggs}','{}'),

  -- dairy aisle C (continued)
  ('100305','Skim milk',             'Valley Dairy','dairy','C','3','B05',240,83,8,12,0,12,0.2,0.1,103,382,247,0,'{dairy}','{}'),
  ('100306','Unsweetened almond milk','Green Block', 'dairy','C','3','B06',240,30,1,1,0,0,2.5,0.2,170,180,20,0,'{tree_nuts}','{}'),
  ('100307','Swiss cheese',          'Valley Dairy','dairy','C','4','B07',28,111,8,0.4,0,0.1,8.8,5.5,54,32,160,0,'{dairy}','{}'),
  ('100308','Part-skim mozzarella',  'Valley Dairy','dairy','C','4','B08',28,85,6,1,0,0.3,6.3,3.7,175,27,160,0,'{dairy}','{}'),
  ('100309','Feta cheese',           'Valley Dairy','dairy','C','5','B09',28,75,4,1.2,0,1,6,4.2,320,18,96,0,'{dairy}','{high_sodium}'),
  ('100310','Plain kefir',           'Valley Dairy','dairy','C','5','B10',240,110,9,12,0,12,2.5,1.5,105,380,230,0,'{dairy}','{}'),
  ('100311','String cheese',         'Valley Dairy','dairy','C','6','B11',28,80,6,1,0,0,6,3.7,200,24,150,0,'{dairy}','{}'),
  ('100312','Butter',                'Valley Dairy','dairy','C','6','B12',14,102,0.1,0,0,0,11.5,7.3,2,3,3,0,'{dairy}','{}'),
  ('100313','Sour cream',            'Valley Dairy','dairy','C','7','B13',30,60,1,1.2,0,1,5.6,3.5,15,40,30,0,'{dairy}','{}'),
  ('100314','Plain whole-milk yogurt','Valley Dairy','dairy','C','7','B14',245,149,8.5,11.4,0,11.4,8,5.2,113,380,240,0,'{dairy}','{}'),

  -- grain aisle D (continued)
  ('100406','White rice, cooked',    'Pantry Co',   'grain','D','4','B06',186,205,4.3,45,0.6,0.1,0.4,0.1,2,55,68,72,'{}','{high_glycemic}'),
  ('100407','Corn tortillas',        'Baker Rescue','grain','D','4','B07',26,52,1.4,10.7,1.5,0.3,0.7,0.1,11,40,50,52,'{}','{}'),
  ('100408','Flour tortillas',       'Baker Rescue','grain','D','5','B08',35,140,4,24,1,1,4,1,350,60,70,60,'{wheat,gluten}','{high_glycemic}'),
  ('100409','White sandwich bread',  'Baker Rescue','grain','D','5','B09',28,75,2.6,14,0.8,1.4,1,0.2,140,40,30,75,'{wheat,gluten}','{high_glycemic}'),
  ('100410','Pearl barley, cooked',  'Pantry Co',   'grain','D','6','B10',157,193,3.5,44,6,0.4,0.7,0.1,5,146,85,25,'{gluten}','{}'),
  ('100411','Bulgur, cooked',        'Pantry Co',   'grain','D','6','B11',182,151,5.6,34,8.2,0.2,0.4,0.1,9,124,73,48,'{gluten}','{}'),
  ('100412','Buckwheat, cooked',     'Pantry Co',   'grain','D','7','B12',168,155,5.7,33,4.5,1.5,1,0.2,7,148,70,45,'{}','{}'),
  ('100413','Whole grain crackers',  'Pantry Co',   'grain','D','7','B13',16,70,2,10,2,1,2.5,0.4,150,50,40,60,'{wheat,gluten}','{}'),
  ('100414','Instant oats, plain',   'Pantry Co',   'grain','D','8','B14',28,100,4,19,3,0,2,0.4,75,130,100,55,'{gluten}','{}'),
  ('100415','Whole wheat English muffin','Baker Rescue','grain','D','8','B15',57,134,5,27,3,2,1,0.2,260,100,80,55,'{wheat,gluten}','{}'),
  ('100416','Brown rice pasta',      'Pantry Co',   'grain','D','9','B16',56,190,4,40,4,1,1.5,0.3,5,180,120,45,'{}','{}'),
  ('100417','Granola',               'Sunrise',     'grain','D','9','B17',50,220,5,32,4,8,8,1.5,60,180,120,60,'{gluten}','{added_sugar}'),

  -- pantry aisle E (continued)
  ('100507','Diced tomatoes, no salt','Pantry Co',  'pantry','E','4','B07',121,30,1.4,7,1.5,4,0.2,0,20,300,30,15,'{}','{}'),
  ('100508','Canned green beans',    'Pantry Co',   'pantry','E','4','B08',125,25,1.2,5,1.8,1.5,0.1,0,300,130,30,15,'{}','{high_sodium}'),
  ('100509','Canned peaches in juice','Pantry Co',  'pantry','E','5','B09',120,60,0.6,15,1.5,13,0.1,0,10,120,10,55,'{}','{added_sugar}'),
  ('100510','Applesauce, unsweetened','Pantry Co',  'pantry','E','5','B10',113,50,0.2,13,1.6,11,0,0,5,90,8,40,'{}','{}'),
  ('100511','Canned pineapple in juice','Pantry Co','pantry','E','6','B11',120,60,0.5,15,1.4,13,0.1,0,10,120,10,55,'{}','{added_sugar}'),
  ('100512','Pasta sauce, no salt',  'Pantry Co',   'pantry','E','6','B12',125,50,2,8,2,5,1.5,0.2,30,300,40,45,'{}','{}'),
  ('100513','Salsa',                 'Pantry Co',   'pantry','E','7','B13',32,10,0.5,2,0.5,1.5,0,0,250,100,20,15,'{}','{high_sodium}'),
  ('100514','Vegetable oil',         'Pantry Co',   'pantry','E','7','B14',14,120,0,0,0,0,14,2,0,0,0,0,'{}','{}'),
  ('100515','Olive oil',             'Pantry Co',   'pantry','E','8','B15',14,119,0,0,0,0,13.5,1.9,0,0,0,0,'{}','{}'),
  ('100516','Honey',                 'Pantry Co',   'pantry','E','8','B16',21,64,0,17,0,17,0,0,1,11,1,58,'{}','{added_sugar,high_glycemic}'),
  ('100517','White sugar',           'Pantry Co',   'pantry','E','9','B17',4,16,0,4,0,4,0,0,0,0,0,65,'{}','{added_sugar,high_glycemic}'),
  ('100518','Dry lentils',           'Pantry Co',   'pantry','E','9','B18',100,352,25,63,11,2,1,0.2,6,955,451,30,'{}','{high_phosphorus}'),
  ('100519','Dry black beans',       'Pantry Co',   'pantry','E','10','B19',100,341,22,62,15,2,1.4,0.4,5,1483,352,30,'{}','{high_phosphorus}'),
  ('100520','Peanut butter, no sugar','Pantry Co',  'pantry','E','10','B20',32,188,8,6,2,1,16,3,140,200,150,14,'{peanuts}','{}'),
  ('100521','Almonds',               'Pantry Co',   'pantry','E','11','B21',28,164,6,6,3.5,1.2,14,1.1,0,208,137,15,'{tree_nuts}','{}'),
  ('100522','Walnuts',               'Pantry Co',   'pantry','E','11','B22',28,185,4.3,3.9,1.9,0.7,18.5,1.7,0.6,125,98,15,'{tree_nuts}','{}'),
  ('100523','Canned pumpkin',        'Pantry Co',   'pantry','E','12','B23',122,42,1.4,10,3.6,4,0.4,0.1,5,340,40,65,'{}','{}'),
  ('100524','Tomato paste',          'Pantry Co',   'pantry','E','12','B24',33,27,1.4,6,1.3,4,0.2,0,20,340,40,45,'{}','{}')
ON CONFLICT (sku) DO NOTHING;

-- ---------------------------------------------------------------- shelf stock
INSERT INTO shelf_stock (sku, on_hand, min_threshold)
SELECT p.sku,
       CASE p.sku
         WHEN '100102' THEN 3
         WHEN '100203' THEN 4
         WHEN '100301' THEN 6
         WHEN '100403' THEN 2
         WHEN '100501' THEN 8
         ELSE 24
       END,
       CASE p.sku
         WHEN '100102' THEN 10
         WHEN '100203' THEN 8
         WHEN '100301' THEN 10
         WHEN '100403' THEN 8
         ELSE 5
       END
  FROM products p
ON CONFLICT (sku) DO NOTHING;

-- ---------------------------------------------------------------- FIFO lots
INSERT INTO inventory_lots (sku, lot_code, quantity_remaining, received_on, expires_on, grant_id) VALUES
  ('100101','LOT-BAN-1110', 40, CURRENT_DATE - 2, CURRENT_DATE + 4,  'G-FIM-2026'),
  ('100102','LOT-SPN-1113',  8, CURRENT_DATE - 1, CURRENT_DATE + 2,  'G-SJC-2026'),
  ('100103','LOT-SWP-1110', 30, CURRENT_DATE - 3, CURRENT_DATE + 10, 'G-FIM-2026'),
  ('100201','LOT-CHK-1112', 25, CURRENT_DATE - 2, CURRENT_DATE + 3,  'G-FIM-2026'),
  ('100203','LOT-SLM-1113',  6, CURRENT_DATE - 1, CURRENT_DATE + 2,  'G-SJC-2026'),
  ('100301','LOT-YGT-1111', 18, CURRENT_DATE - 3, CURRENT_DATE + 6,  'G-FIM-2026'),
  ('100401','LOT-RIC-1105', 50, CURRENT_DATE - 9, CURRENT_DATE + 90, 'G-SJC-2026'),
  ('100403','LOT-OAT-1102', 20, CURRENT_DATE - 12, CURRENT_DATE + 120,'G-SJC-2026'),
  ('100501','LOT-SOU-1108', 15, CURRENT_DATE - 6, CURRENT_DATE + 5,  'G-EPIC-2026'),
  ('100502','LOT-RAM-1101', 60, CURRENT_DATE - 13, CURRENT_DATE + 180,'G-EPIC-2026')
ON CONFLICT (sku, lot_code) DO NOTHING;

COMMIT;
