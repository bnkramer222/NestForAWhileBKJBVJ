import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';

/* ==================================================================== floor & queue
 * Every floor/queue change runs inside one transaction holding a Postgres advisory lock, so
 * concurrent check-ins and checkouts are serialized. Active_Floor_Shoppers is re-derived from
 * the real active sessions on every change (it can never drift), and the waiting line is FIFO.
 */
const FLOOR_LOCK_KEY = 724100;

const newSessionToken = () => `ses_${crypto.randomBytes(12).toString('base64url')}`;

function withFloorLock(fn) {
  return db.tx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [FLOOR_LOCK_KEY]);
    return fn(client);
  });
}

async function syncFloor(client) {
  const { rows } = await client.query(
    `UPDATE floor_state
        SET active_floor_shoppers = (SELECT COUNT(*) FROM shopping_sessions WHERE status = 'active')
      WHERE id = 1
      RETURNING active_floor_shoppers AS active, max_floor_capacity AS max`,
  );
  if (!rows[0]) throw new Error('floor_state singleton row missing — run db:seed');
  return rows[0];
}

/** Release slots / places held by people who walked away (no activity past the timeout). */
async function expireStale(client) {
  const { rowCount } = await client.query(
    `UPDATE shopping_sessions
        SET status = 'abandoned', ended_at = now()
      WHERE (status = 'active' AND last_seen_at < now() - make_interval(mins => $1))
         OR (status = 'queue_waiting' AND last_seen_at < now() - make_interval(mins => $2))`,
    [env.shoppingTimeoutMin, env.queueTimeoutMin],
  );
  return rowCount;
}

/** Fill every free slot from the front of the line. */
async function admitWaiting(client) {
  const admitted = [];
  let floor = await syncFloor(client);
  while (floor.active < floor.max) {
    const { rows } = await client.query(
      `UPDATE shopping_sessions
          SET status = 'active', queue_position = NULL, started_at = now(), last_seen_at = now()
        WHERE id = (SELECT id FROM shopping_sessions WHERE status = 'queue_waiting' ORDER BY started_at, id LIMIT 1)
        RETURNING id, session_token, client_id`,
    );
    if (!rows[0]) break;
    admitted.push(rows[0]);
    floor = await syncFloor(client);
  }
  return admitted;
}

/**
 * Kiosk check-in (Use Case: Initialize Shopping Session). Reuses an open session if the client
 * already has one; otherwise activates a new session when there is room and nobody is waiting,
 * or places the client at the back of the line. Returns the session row.
 */
export async function checkInToFloor({ clientId, dietaryTierId }) {
  return withFloorLock(async (client) => {
    await expireStale(client);
    await admitWaiting(client);

    const open = await client.query(
      `SELECT id, session_token, status FROM shopping_sessions
        WHERE client_id = $1 AND status IN ('active', 'queue_waiting')
        ORDER BY started_at DESC LIMIT 1`,
      [clientId],
    );
    if (open.rows[0]) {
      await client.query('UPDATE shopping_sessions SET last_seen_at = now() WHERE id = $1', [open.rows[0].id]);
      return open.rows[0];
    }

    const floor = await syncFloor(client);
    const waiting = await client.query(`SELECT COUNT(*)::int AS n FROM shopping_sessions WHERE status = 'queue_waiting'`);
    const status = floor.active < floor.max && waiting.rows[0].n === 0 ? 'active' : 'queue_waiting';

    const { rows } = await client.query(
      `INSERT INTO shopping_sessions (client_id, session_token, status, dietary_tier_id, queue_position, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, session_token, status`,
      [clientId, newSessionToken(), status, dietaryTierId, status === 'queue_waiting' ? waiting.rows[0].n + 1 : null],
    );
    await syncFloor(client);
    return rows[0];
  });
}

/** Called after every checkout / exit, and by the periodic sweep. */
export async function admitFromQueue() {
  return withFloorLock(async (client) => {
    await expireStale(client);
    return admitWaiting(client);
  });
}

export async function sweepFloor() {
  return withFloorLock(async (client) => {
    const expired = await expireStale(client);
    const admitted = await admitWaiting(client);
    return { expired, admitted: admitted.length };
  });
}

export async function abandonSession(sessionId) {
  return withFloorLock(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE shopping_sessions SET status = 'abandoned', ended_at = now()
        WHERE id = $1 AND status IN ('active', 'queue_waiting')`,
      [sessionId],
    );
    await admitWaiting(client);
    return rowCount > 0;
  });
}

/** "Leave the line" from the waiting page. */
export async function leaveQueue(token) {
  return withFloorLock(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE shopping_sessions SET status = 'abandoned', ended_at = now()
        WHERE session_token = $1 AND status = 'queue_waiting'`,
      [token],
    );
    return rowCount > 0;
  });
}

/** Manager control: change capacity; raising it admits people from the line immediately. */
export async function setFloorCapacity(max) {
  return withFloorLock(async (client) => {
    await client.query('UPDATE floor_state SET max_floor_capacity = $1 WHERE id = 1', [max]);
    const admitted = await admitWaiting(client);
    return { admitted: admitted.length };
  });
}

/** Heartbeat: any page/API activity keeps the session's slot or place in line. */
export async function touchSession(sessionId) {
  await db.query(
    `UPDATE shopping_sessions SET last_seen_at = now() WHERE id = $1 AND status IN ('active', 'queue_waiting')`,
    [sessionId],
  );
}

export async function getFloorState() {
  const { rows } = await db.query(
    `SELECT f.active_floor_shoppers AS active, f.max_floor_capacity AS max,
            (SELECT COUNT(*)::int FROM shopping_sessions WHERE status = 'queue_waiting') AS queued
       FROM floor_state f WHERE f.id = 1`,
  );
  if (!rows[0]) throw new Error('floor_state singleton row missing — run db:seed');
  return { ...rows[0], atCapacity: rows[0].active >= rows[0].max };
}

/** The line, front first — no names or tokens (shown on the staff dashboard). */
export async function listQueue() {
  const { rows } = await db.query(
    `SELECT ROW_NUMBER() OVER (ORDER BY s.started_at, s.id)::int AS position,
            c.household_size,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM now() - s.started_at) / 60))::int AS waiting_min
       FROM shopping_sessions s
       JOIN clients c ON c.id = s.client_id
      WHERE s.status = 'queue_waiting'
      ORDER BY s.started_at, s.id`,
  );
  return rows;
}





export async function getSessionByToken(token) {
  const { rows } = await db.query(
    `SELECT s.*, c.household_size, c.full_name_enc
       FROM shopping_sessions s
       JOIN clients c ON c.id = s.client_id
      WHERE s.session_token = $1`,
    [token],
  );
  return rows[0] || null;
}


/** Live place in line (1 = next in), recomputed every refresh so it shrinks as others are admitted. */
export async function getLivePosition(token) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS position
       FROM shopping_sessions q
      WHERE q.status = 'queue_waiting'
        AND (q.started_at, q.id) <= (SELECT started_at, id FROM shopping_sessions WHERE session_token = $1)`,
    [token],
  );
  return rows[0]?.position ?? 0;
}

export async function getSessionSummary(sessionId) {
  const { rows } = await db.query(
    `SELECT s.id, s.session_token, s.status, s.dietary_tier_id, s.started_at,
            c.household_size
       FROM shopping_sessions s
       JOIN clients c ON c.id = s.client_id
      WHERE s.id = $1`,
    [sessionId],
  );
  return rows[0] || null;
}

export async function getCart(sessionId) {
  const { rows } = await db.query(
    `SELECT ci.sku, ci.quantity, ci.evaluated_status, ci.added_at,
            p.name, p.category, p.aisle, p.shelf, p.bin, p.serving_size_g
       FROM cart_items ci
       JOIN products p ON p.sku = ci.sku
      WHERE ci.session_id = $1
      ORDER BY ci.added_at`,
    [sessionId],
  );
  return rows;
}

export async function addCartItem({ sessionId, sku, quantity = 1, evaluatedStatus = 'approved' }) {
  const { rows } = await db.query(
    `INSERT INTO cart_items (session_id, sku, quantity, evaluated_status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, sku)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING sku, quantity, evaluated_status`,
    [sessionId, sku, quantity, evaluatedStatus],
  );
  return rows[0];
}

/** Set an exact quantity (the shopper's +/- buttons). Re-evaluated status is stored with it. */
export async function setCartQuantity({ sessionId, sku, quantity, evaluatedStatus }) {
  const { rows } = await db.query(
    `INSERT INTO cart_items (session_id, sku, quantity, evaluated_status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, sku)
     DO UPDATE SET quantity = EXCLUDED.quantity, evaluated_status = EXCLUDED.evaluated_status
     RETURNING sku, quantity, evaluated_status`,
    [sessionId, sku, quantity, evaluatedStatus],
  );
  return rows[0];
}

export async function getCartQuantity(sessionId, sku) {
  const { rows } = await db.query('SELECT quantity FROM cart_items WHERE session_id = $1 AND sku = $2', [
    sessionId,
    sku,
  ]);
  return rows[0]?.quantity ?? 0;
}

export async function removeCartItem(sessionId, sku) {
  const { rowCount } = await db.query('DELETE FROM cart_items WHERE session_id = $1 AND sku = $2', [
    sessionId,
    sku,
  ]);
  return rowCount > 0;
}

async function consumeFifoLots(client, sku, quantity) {
  let remaining = quantity;
  let firstGrantId = null;
  const { rows } = await client.query(
    `SELECT id, quantity_remaining, grant_id
       FROM inventory_lots
      WHERE sku = $1 AND quantity_remaining > 0
      ORDER BY expires_on NULLS LAST, received_on
      FOR UPDATE`,
    [sku],
  );
  for (const lot of rows) {
    if (remaining <= 0) break;
    if (!firstGrantId) firstGrantId = lot.grant_id;
    const take = Math.min(remaining, lot.quantity_remaining);
    await client.query('UPDATE inventory_lots SET quantity_remaining = quantity_remaining - $2 WHERE id = $1', [
      lot.id,
      take,
    ]);
    remaining -= take;
  }
  return firstGrantId;
}

/**
 * Atomic checkout: verifies hard stops, decrements shelf + FIFO lots, writes the ledger,
 * closes the session, and frees a floor slot. Any failure rolls the whole thing back.
 */
export async function completeCheckout(sessionId, actedBy = 'volunteer') {
  return db.tx(async (client) => {
    const session = await client.query('SELECT * FROM shopping_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    if (!session.rows[0]) throw notFound('Shopping session not found');
    if (session.rows[0].status !== 'active') throw conflict('This session is not active.');

    const items = await client.query(
      `SELECT ci.sku, ci.quantity, ci.evaluated_status, p.name, p.serving_size_g, p.category
         FROM cart_items ci
         JOIN products p ON p.sku = ci.sku
        WHERE ci.session_id = $1
        ORDER BY ci.added_at`,
      [sessionId],
    );
    if (!items.rowCount) throw badRequest('Cart is empty — nothing to check out.');

    const restricted = items.rows.filter((item) => item.evaluated_status === 'restricted');
    if (restricted.length) {
      throw conflict('Clinical hard stop: restricted items must be removed before checkout.', {
        code: 'RESTRICTED_ITEM',
        items: restricted.map((item) => ({ sku: item.sku, name: item.name })),
      });
    }

    let totalWeight = 0;
    const grantBySku = new Map();
    for (const item of items.rows) {
      const updated = await client.query(
        `UPDATE shelf_stock
            SET on_hand = on_hand - $2, updated_at = now()
          WHERE sku = $1 AND on_hand >= $2
          RETURNING on_hand`,
        [item.sku, item.quantity],
      );
      if (!updated.rowCount) {
        throw conflict(`Stock conflict on ${item.name}: another cart took the last unit.`, {
          code: 'STOCK_CONFLICT',
          sku: item.sku,
        });
      }
      grantBySku.set(item.sku, await consumeFifoLots(client, item.sku, item.quantity));
      totalWeight += (Number(item.serving_size_g) * item.quantity) / 453.592;
    }

    const tx = await client.query(
      `INSERT INTO checkout_transactions (session_id, acted_by, total_weight_lbs, item_count)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [sessionId, actedBy, totalWeight.toFixed(3), items.rows.length],
    );

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO checkout_lines (transaction_id, sku, quantity, weight_lbs, evaluated_status, grant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tx.rows[0].id,
          item.sku,
          item.quantity,
          ((Number(item.serving_size_g) * item.quantity) / 453.592).toFixed(3),
          item.evaluated_status,
          grantBySku.get(item.sku) || null,
        ],
      );
    }

    await client.query(`UPDATE shopping_sessions SET status = 'completed', ended_at = now() WHERE id = $1`, [
      sessionId,
    ]);
    await client.query(
      `UPDATE floor_state SET active_floor_shoppers = GREATEST(active_floor_shoppers - 1, 0) WHERE id = 1`,
    );

    return {
      transactionId: tx.rows[0].id,
      createdAt: tx.rows[0].created_at,
      itemCount: items.rows.length,
      totalWeightLbs: Number(totalWeight.toFixed(3)),
      lines: items.rows,
    };
  });
}





