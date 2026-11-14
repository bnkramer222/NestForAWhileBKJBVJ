import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from '../config/db.js';
import { encrypt, hashToken } from '../lib/crypto.js';
import { resolveTier } from '../services/dietaryMatrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const personas = [
  {
    token: 'MTG-1001',
    name: 'Maria Alvarez',
    householdSize: 4,
    conditions: ['E11.9', 'I10'],
    allergies: [],
    note: 'Diabetes + hypertension. Two children at home.',
    // Synthetic demo readings for the outcomes dashboard (baseline, 3 months, today).
    biometrics: [
      { daysAgo: 180, a1c_pct: 8.4, systolic: 148, diastolic: 92, weight_lbs: 182 },
      { daysAgo: 90, a1c_pct: 7.9, systolic: 141, diastolic: 89, weight_lbs: 179 },
      { daysAgo: 0, a1c_pct: 7.5, systolic: 136, diastolic: 86, weight_lbs: 176 },
    ],
  },
  {
    token: 'MTG-1002',
    name: 'James Okafor',
    householdSize: 3,
    conditions: ['N18.30', 'I10'],
    allergies: [],
    note: 'CKD stage 3 + hypertension. Lives with spouse and mother.',
    // Synthetic demo readings for the outcomes dashboard (baseline, 3 months, today).
    biometrics: [
      { daysAgo: 180, egfr: 48, systolic: 152, diastolic: 94 },
      { daysAgo: 90, egfr: 49, systolic: 146, diastolic: 90 },
      { daysAgo: 0, egfr: 50, systolic: 140, diastolic: 88 },
    ],
  },
  {
    token: 'MTG-1003',
    name: 'Aisha Rahman',
    householdSize: 5,
    conditions: ['E11.9', 'N18.30', 'I10'],
    allergies: ['dairy'],
    note: 'Triple chronicity + dairy allergy. Highest-risk household.',
    // Synthetic demo readings for the outcomes dashboard (baseline, 3 months, today).
    biometrics: [
      { daysAgo: 180, a1c_pct: 9.1, egfr: 41, systolic: 156, diastolic: 96 },
      { daysAgo: 90, a1c_pct: 8.6, egfr: 41, systolic: 150, diastolic: 93 },
      { daysAgo: 0, a1c_pct: 8.2, egfr: 42, systolic: 144, diastolic: 90 },
    ],
  },
  {
    token: 'MTG-1004',
    name: 'Robert Chen',
    householdSize: 2,
    conditions: ['I50.9', 'I10', 'E11.9'],
    allergies: [],
    note: 'Heart failure + hypertension + diabetes. Low-sodium priority.',
    // Synthetic demo readings for the outcomes dashboard (baseline, 3 months, today).
    biometrics: [
      { daysAgo: 180, a1c_pct: 7.6, systolic: 142, diastolic: 88, weight_lbs: 214 },
      { daysAgo: 90, a1c_pct: 7.4, systolic: 136, diastolic: 84, weight_lbs: 209 },
      { daysAgo: 0, a1c_pct: 7.1, systolic: 132, diastolic: 82, weight_lbs: 205 },
    ],
  },
  {
    token: 'MTG-1005',
    name: 'Lena Brooks',
    householdSize: 6,
    conditions: ['I10'],
    allergies: ['gluten'],
    note: 'Hypertension only, gluten allergy, large household.',
    // Synthetic demo readings for the outcomes dashboard (baseline, 3 months, today).
    biometrics: [
      { daysAgo: 180, systolic: 138, diastolic: 88 },
      { daysAgo: 90, systolic: 136, diastolic: 87 },
      { daysAgo: 0, systolic: 139, diastolic: 88 },
    ],
  },
];

async function run() {
  if (!db.enabled) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }

  const sql = await fs.readFile(path.join(root, 'db/seed.sql'), 'utf8');
  console.log('[seed] applying reference data (db/seed.sql)');
  await pool.query(sql);
  if (process.env.MAX_FLOOR_CAPACITY) {
    await pool.query('UPDATE floor_state SET max_floor_capacity = $1 WHERE id = 1', [Number(process.env.MAX_FLOOR_CAPACITY)]);
    console.log(`[seed] floor capacity set to ${process.env.MAX_FLOOR_CAPACITY} (MAX_FLOOR_CAPACITY)`);
  }

  console.log('[seed] inserting personas with encrypted names');
  for (const persona of personas) {
    const inserted = await pool.query(
      `INSERT INTO clients (client_token_hash, full_name_enc, household_size, enrollment_status, enrollment_expires_on)
       VALUES ($1, $2, $3, 'active', now() + interval '12 months')
       ON CONFLICT (client_token_hash) DO NOTHING
       RETURNING id`,
      [hashToken(persona.token), encrypt(persona.name), persona.householdSize],
    );

    let clientId = inserted.rows[0]?.id;
    if (!clientId) {
      const existing = await pool.query('SELECT id FROM clients WHERE client_token_hash = $1', [
        hashToken(persona.token),
      ]);
      clientId = existing.rows[0]?.id;
    }
    if (!clientId) continue;

    const tier = resolveTier(persona.conditions);
    await pool.query('UPDATE clients SET dietary_tier_id = $2 WHERE id = $1', [clientId, tier.id]);

    for (const code of persona.conditions) {
      await pool.query(
        'INSERT INTO client_conditions (client_id, condition_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [clientId, code],
      );
    }
    for (const allergen of persona.allergies) {
      await pool.query(
        'INSERT INTO client_allergies (client_id, allergen) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [clientId, allergen],
      );
    }

    // Re-seeding replaces this persona's readings so the trend data stays consistent.
    await pool.query('DELETE FROM client_biometrics WHERE client_id = $1', [clientId]);
    for (const reading of persona.biometrics || []) {
      await pool.query(
        `INSERT INTO client_biometrics (client_id, measured_on, a1c_pct, systolic, diastolic, egfr, weight_lbs)
         VALUES ($1, CURRENT_DATE - $2::int, $3, $4, $5, $6, $7)`,
        [
          clientId,
          reading.daysAgo,
          reading.a1c_pct ?? null,
          reading.systolic ?? null,
          reading.diastolic ?? null,
          reading.egfr ?? null,
          reading.weight_lbs ?? null,
        ],
      );
    }
  }

  const counts = await pool.query(
    `SELECT (SELECT COUNT(*) FROM products)::int AS products,
            (SELECT COUNT(*) FROM clients)::int  AS clients,
            (SELECT COUNT(*) FROM dietary_rules)::int AS rules,
            (SELECT COUNT(*) FROM client_biometrics)::int AS biometric_readings`,
  );

  console.log('[seed] done:', counts.rows[0]);
  console.log('[seed] demo tokens:', personas.map((p) => p.token).join(', '));
  await pool.end();
}

run().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
