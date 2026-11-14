import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { encrypt, decrypt, hashToken } from '../lib/crypto.js';

const COLUMNS = `
  c.id,
  c.client_token_hash,
  c.full_name_enc,
  c.preferred_name_enc,
  c.preferred_lang,
  c.household_size,
  c.enrollment_status,
  c.enrollment_expires_on,
  c.dietary_tier_id,
  COALESCE(array_agg(DISTINCT cc.condition_code) FILTER (WHERE cc.condition_code IS NOT NULL), '{}') AS conditions,
  COALESCE(array_agg(DISTINCT ca.allergen) FILTER (WHERE ca.allergen IS NOT NULL), '{}') AS allergies
`;

function toProfile(row) {
  if (!row) return null;
  const name = decrypt(row.full_name_enc);
  const preferredName = row.preferred_name_enc ? decrypt(row.preferred_name_enc) : null;
  return {
    id: row.id,
    name,
    preferredName,
    // What we call them in greetings: their chosen name, else their first name.
    greetingName: preferredName || String(name || '').split(' ')[0] || '',
    preferredLang: row.preferred_lang || null,
    householdSize: row.household_size,
    enrollmentStatus: row.enrollment_status,
    enrollmentExpiresOn: row.enrollment_expires_on,
    tierId: row.dietary_tier_id,
    conditions: row.conditions || [],
    allergies: row.allergies || [],
  };
}

export async function findByToken(rawToken) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
       FROM clients c
       LEFT JOIN client_conditions cc ON cc.client_id = c.id
       LEFT JOIN client_allergies ca ON ca.client_id = c.id
      WHERE c.client_token_hash = $1
      GROUP BY c.id`,
    [hashToken(rawToken)],
  );
  return toProfile(rows[0]);
}

export async function findById(id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
       FROM clients c
       LEFT JOIN client_conditions cc ON cc.client_id = c.id
       LEFT JOIN client_allergies ca ON ca.client_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [id],
  );
  return toProfile(rows[0]);
}

export async function listConditions() {
  const { rows } = await db.query(
    'SELECT code, name, condition_key FROM condition_catalog ORDER BY condition_key, code',
  );
  return rows;
}

function newToken() {
  return `MTG-${crypto.randomInt(100000, 1000000)}`;
}

/**
 * Creates an MTG enrollment: encrypted PHI, linked conditions/allergies, tier bound at
 * write time, and a one-time display token (only its HMAC is stored).
 */
export async function createEnrollment({
  name,
  preferredName = null,
  preferredLang = null,
  householdSize,
  conditions = [],
  allergies = [],
  dietaryTierId = 'standard',
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = newToken();
    try {
      const id = await db.tx(async (client) => {
        const inserted = await client.query(
          `INSERT INTO clients (client_token_hash, full_name_enc, preferred_name_enc, preferred_lang, household_size, enrollment_status, enrollment_expires_on, dietary_tier_id)
           VALUES ($1, $2, $3, $4, $5, 'active', now() + interval '12 months', $6)
           RETURNING id`,
          [hashToken(token), encrypt(name), preferredName ? encrypt(preferredName) : null, preferredLang, householdSize, dietaryTierId],
        );
        const clientId = inserted.rows[0].id;

        for (const code of conditions) {
          await client.query(
            'INSERT INTO client_conditions (client_id, condition_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [clientId, code],
          );
        }
        for (const allergen of allergies) {
          await client.query(
            'INSERT INTO client_allergies (client_id, allergen) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [clientId, allergen],
          );
        }
        return clientId;
      });
      return { id, token };
    } catch (err) {
      if (err.code === '23505') continue; // token collision — retry with a new token
      throw err;
    }
  }
  throw new Error('Could not allocate a unique enrollment token');
}

export async function updateMedicalProfile(id, { name, householdSize, conditions = [], allergies = [], dietaryTierId }) {
  return db.tx(async (client) => {
    await client.query(
      `UPDATE clients
          SET full_name_enc = COALESCE($2, full_name_enc),
              household_size = COALESCE($3, household_size),
              dietary_tier_id = COALESCE($4, dietary_tier_id),
              updated_at = now()
        WHERE id = $1`,
      [id, name ? encrypt(name) : null, householdSize ?? null, dietaryTierId ?? null],
    );
    if (conditions.length) {
      await client.query('DELETE FROM client_conditions WHERE client_id = $1', [id]);
      for (const code of conditions) {
        await client.query(
          'INSERT INTO client_conditions (client_id, condition_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, code],
        );
      }
    }
    if (allergies.length) {
      await client.query('DELETE FROM client_allergies WHERE client_id = $1', [id]);
      for (const allergen of allergies) {
        await client.query(
          'INSERT INTO client_allergies (client_id, allergen) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, allergen],
        );
      }
    }
  });
}

export async function listAll(limit = 50) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
       FROM clients c
       LEFT JOIN client_conditions cc ON cc.client_id = c.id
       LEFT JOIN client_allergies ca ON ca.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map(toProfile);
}
