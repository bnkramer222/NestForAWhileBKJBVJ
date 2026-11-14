import { db } from '../config/db.js';
import { encrypt, decrypt, hashToken } from '../lib/crypto.js';

const COLUMNS = `
  c.id,
  c.client_token_hash,
  c.full_name_enc,
  c.household_size,
  c.enrollment_status,
  c.enrollment_expires_on,
  COALESCE(array_agg(DISTINCT cc.condition_code) FILTER (WHERE cc.condition_code IS NOT NULL), '{}') AS conditions,
  COALESCE(array_agg(DISTINCT ca.allergen) FILTER (WHERE ca.allergen IS NOT NULL), '{}') AS allergies
`;

function toProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: decrypt(row.full_name_enc),
    householdSize: row.household_size,
    enrollmentStatus: row.enrollment_status,
    enrollmentExpiresOn: row.enrollment_expires_on,
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

export async function create({ token, name, householdSize, conditions = [], allergies = [], enrollmentStatus = 'active' }) {
  return db.tx(async (client) => {
    const inserted = await client.query(
      `INSERT INTO clients (client_token_hash, full_name_enc, household_size, enrollment_status, enrollment_expires_on)
       VALUES ($1, $2, $3, $4, now() + interval '12 months')
       RETURNING id`,
      [hashToken(token), encrypt(name), householdSize, enrollmentStatus],
    );
    const { id } = inserted.rows[0];
    for (const code of conditions) {
      await client.query(
        `INSERT INTO client_conditions (client_id, condition_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, code],
      );
    }
    for (const allergen of allergies) {
      await client.query(
        `INSERT INTO client_allergies (client_id, allergen) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, allergen],
      );
    }
    return id;
  });
}

export async function updateMedicalProfile(id, { name, householdSize, conditions = [], allergies = [] }) {
  return db.tx(async (client) => {
    await client.query(
      `UPDATE clients
          SET full_name_enc = COALESCE($2, full_name_enc),
              household_size = COALESCE($3, household_size),
              updated_at = now()
        WHERE id = $1`,
      [id, name ? encrypt(name) : null, householdSize ?? null],
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
