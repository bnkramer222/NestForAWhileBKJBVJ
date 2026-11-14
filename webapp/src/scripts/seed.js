import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from '../config/db.js';
import { encrypt, hashToken } from '../lib/crypto.js';

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
  },
  {
    token: 'MTG-1002',
    name: 'James Okafor',
    householdSize: 3,
    conditions: ['N18.30', 'I10'],
    allergies: [],
    note: 'CKD stage 3 + hypertension. Lives with spouse and mother.',
  },
  {
    token: 'MTG-1003',
    name: 'Aisha Rahman',
    householdSize: 5,
    conditions: ['E11.9', 'N18.30', 'I10'],
    allergies: ['dairy'],
    note: 'Triple chronicity + dairy allergy. Highest-risk household.',
  },
  {
    token: 'MTG-1004',
    name: 'Robert Chen',
    householdSize: 2,
    conditions: ['I50.9', 'I10', 'E11.9'],
    allergies: [],
    note: 'Heart failure + hypertension + diabetes. Low-sodium priority.',
  },
  {
    token: 'MTG-1005',
    name: 'Lena Brooks',
    householdSize: 6,
    conditions: ['I10'],
    allergies: ['gluten'],
    note: 'Hypertension only, gluten allergy, large household.',
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
  }

  const counts = await pool.query(
    `SELECT (SELECT COUNT(*) FROM products)::int AS products,
            (SELECT COUNT(*) FROM clients)::int  AS clients,
            (SELECT COUNT(*) FROM dietary_rules)::int AS rules`,
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
