import { db } from '../config/db.js';

/**
 * Analytics queries are de-identified: no client ids, names, tokens, or dates of birth
 * leave this layer. Views in db/schema.sql enforce the same shape.
 */

export async function getProgramSummary() {
  const { rows } = await db.query(
    `SELECT
        (SELECT COUNT(*)::int FROM clients)                              AS clients,
        (SELECT COUNT(*)::int FROM shopping_sessions WHERE status = 'active') AS active_sessions,
        (SELECT COUNT(*)::int FROM shopping_sessions WHERE status = 'queue_waiting') AS queued,
        (SELECT COALESCE(SUM(total_weight_lbs), 0) FROM checkout_transactions)       AS pounds_distributed,
        (SELECT COUNT(*)::int FROM checkout_transactions)               AS checkouts,
        (SELECT COALESCE(SUM(quantity), 0)::int FROM cart_items
          WHERE evaluated_status = 'restricted')                        AS restricted_in_carts,
        (SELECT COUNT(*)::int FROM inventory_lots
          WHERE quantity_remaining > 0 AND expires_on <= CURRENT_DATE + 7) AS expiring_lots`,
  );
  return rows[0];
}

export async function getDistributionByCategory() {
  const { rows } = await db.query('SELECT * FROM analytics_distribution ORDER BY month DESC, category');
  return rows;
}

export async function getGrantAttribution() {
  const { rows } = await db.query(
    `SELECT COALESCE(g.funder, 'Unattributed') AS funder,
            COALESCE(SUM(cl.weight_lbs), 0)::numeric(10,2) AS pounds
       FROM checkout_lines cl
       LEFT JOIN grants g ON g.id = cl.grant_id
      GROUP BY 1
      ORDER BY 2 DESC`,
  );
  return rows;
}

export async function logInference({ sessionId = null, kind, latencyMs, ok, payload = {} }) {
  try {
    await db.query(
      `INSERT INTO ai_inference_log (session_id, kind, latency_ms, ok, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, kind, latencyMs, ok, JSON.stringify(payload)],
    );
  } catch (err) {
    console.warn('[ai] could not log inference', err.message);
  }
}
