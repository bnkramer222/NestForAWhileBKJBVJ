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

/* ------------------------------------------------------------------ US-5.2 audit exports */

export async function getGrantLedger() {
  const { rows } = await db.query(
    `SELECT month, funder, grant_code, category, evaluated_status, units, weight_lbs
       FROM analytics_grant_ledger
      ORDER BY month DESC, funder, category, evaluated_status`,
  );
  return rows;
}

export async function getConditionDistribution() {
  const { rows } = await db.query(
    `SELECT month, condition_key, category, units, weight_lbs
       FROM analytics_condition_distribution
      ORDER BY month DESC, condition_key, category`,
  );
  return rows;
}

/* ------------------------------------------------------------------ US-5.1 outcome trends */

/** Which biometric markers matter for each condition group. */
export const OUTCOME_MARKERS = {
  diabetes: [{ key: 'a1c_pct', label: 'HbA1c (%)', better: 'lower' }],
  hypertension: [
    { key: 'systolic', label: 'Systolic BP (mmHg)', better: 'lower' },
    { key: 'diastolic', label: 'Diastolic BP (mmHg)', better: 'lower' },
  ],
  ckd: [{ key: 'egfr', label: 'eGFR (mL/min)', better: 'higher' }],
  heart_failure: [{ key: 'weight_lbs', label: 'Body weight (lb)', better: 'lower' }],
};

/**
 * Groups smaller than this are suppressed (re-identification guard). Set to 1 for the 5-persona
 * demo dataset; a production deployment should raise it (CMS small-cell policy uses 11).
 */
export const MIN_COHORT = Number(process.env.ANALYTICS_MIN_COHORT || 1);

/**
 * Population-level biometric trends at program markers (baseline, 3 months, 6 months).
 * Each client's readings are bucketed by days since their own first reading, averaged per
 * client first, then averaged across the condition group. Only aggregates leave the query.
 */
export async function getOutcomeTrends() {
  const { rows } = await db.query(
    `WITH r AS (
       SELECT b.*, b.measured_on - MIN(b.measured_on) OVER (PARTITION BY b.client_id) AS days
         FROM client_biometrics b
     ),
     bucketed AS (
       SELECT client_id, a1c_pct, systolic, diastolic, egfr, weight_lbs,
              CASE WHEN days <= 45 THEN 0 WHEN days <= 135 THEN 3 WHEN days <= 225 THEN 6 END AS marker_month
         FROM r
     ),
     per_client AS (
       SELECT client_id, marker_month,
              AVG(a1c_pct) AS a1c_pct, AVG(systolic) AS systolic, AVG(diastolic) AS diastolic,
              AVG(egfr) AS egfr, AVG(weight_lbs) AS weight_lbs
         FROM bucketed
        WHERE marker_month IS NOT NULL
        GROUP BY 1, 2
     ),
     groups AS (
       SELECT DISTINCT c.client_id, cat.condition_key
         FROM client_conditions c
         JOIN condition_catalog cat ON cat.code = c.condition_code
     )
     SELECT g.condition_key, pc.marker_month,
            COUNT(DISTINCT pc.client_id)::int AS clients,
            ROUND(AVG(pc.a1c_pct), 2)    AS a1c_pct,
            ROUND(AVG(pc.systolic), 1)   AS systolic,
            ROUND(AVG(pc.diastolic), 1)  AS diastolic,
            ROUND(AVG(pc.egfr), 1)       AS egfr,
            ROUND(AVG(pc.weight_lbs), 1) AS weight_lbs
       FROM per_client pc
       JOIN groups g ON g.client_id = pc.client_id
      GROUP BY 1, 2
      ORDER BY 1, 2`,
  );

  // Reshape into one row per condition × marker with baseline / 3-mo / 6-mo values and deltas.
  const trends = [];
  for (const [conditionKey, markers] of Object.entries(OUTCOME_MARKERS)) {
    const byMonth = Object.fromEntries(
      rows.filter((row) => row.condition_key === conditionKey).map((row) => [row.marker_month, row]),
    );
    if (!byMonth[0]) continue;
    for (const marker of markers) {
      const value = (month) => (byMonth[month]?.[marker.key] == null ? null : Number(byMonth[month][marker.key]));
      const baseline = value(0);
      if (baseline === null) continue;
      const m3 = value(3);
      const m6 = value(6);
      const delta = (v) => (v === null ? null : Number((v - baseline).toFixed(2)));
      const latest = m6 ?? m3;
      trends.push({
        condition: conditionKey,
        marker: marker.label,
        better: marker.better,
        clients: byMonth[0].clients,
        baseline,
        month3: m3,
        month6: m6,
        delta3: delta(m3),
        delta6: delta(m6),
        trend:
          latest === null || latest === baseline
            ? 'flat'
            : (marker.better === 'lower') === latest < baseline
              ? 'improving'
              : 'worsening',
      });
    }
  }
  return trends.filter((row) => row.clients >= MIN_COHORT);
}

export async function addBiometricReading(clientId, reading) {
  const fields = ['a1c_pct', 'systolic', 'diastolic', 'egfr', 'weight_lbs'];
  if (!fields.some((field) => reading[field] !== null && reading[field] !== undefined)) return null;
  const { rows } = await db.query(
    `INSERT INTO client_biometrics (client_id, measured_on, a1c_pct, systolic, diastolic, egfr, weight_lbs)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      clientId,
      reading.measuredOn || null,
      reading.a1c_pct ?? null,
      reading.systolic ?? null,
      reading.diastolic ?? null,
      reading.egfr ?? null,
      reading.weight_lbs ?? null,
    ],
  );
  return rows[0];
}
