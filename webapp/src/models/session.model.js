import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';

const newToken = () => `ses_${crypto.randomBytes(12).toString('base64url')}`;

export async function getFloorState() {
  const { rows } = await db.query('SELECT active_floor_shoppers, max_floor_capacity FROM floor_state WHERE id = 1');
  if (!rows[0]) throw new Error('floor_state singleton row missing — run db:seed');
  return {
    active: rows[0].active_floor_shoppers,
    max: rows[0].max_floor_capacity,
    atCapacity: rows[0].active_floor_shoppers >= rows[0].max_floor_capacity,
  };
}

/** Atomically claim a floor slot. Returns null when the floor is at capacity. */
export async function claimFloorSlot() {
  const { rows } = await db.query(
    `UPDATE floor_state
        SET active_floor_shoppers = active_floor_shoppers + 1
      WHERE id = 1
        AND active_floor_shoppers < max_floor_capacity
      RETURNING active_floor_shoppers, max_floor_capacity`,
  );
  return rows[0] || null;
}

export async function releaseFloorSlot() {
  await db.query(
    `UPDATE floor_state SET active_floor_shoppers = GREATEST(active_floor_shoppers - 1, 0) WHERE id = 1`,
  );
}

export async function createSession({ clientId, dietaryTierId }) {
  const token = newToken();
  const { rows } = await db.query(
    `INSERT INTO shopping_sessions (client_id, session_token, status, dietary_tier_id)
     VALUES ($1, $2, 'active', $3)
     RETURNING id, session_token, started_at, dietary_tier_id`,
    [clientId, token, dietaryTierId],
  );
  return rows[0];
}

export async function enqueue(clientId) {
  const { rows } = await db.query(
    `INSERT INTO shopping_sessions (client_id, session_token, status, queue_position)
     VALUES ($1, $2, 'queue_waiting',
             (SELECT COUNT(*) + 1 FROM shopping_sessions WHERE status = 'queue_waiting'))
     RETURNING id, session_token, queue_position`,
    [clientId, newToken()],
  );
  return rows[0];
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

export async function getQueuedPosition(clientId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS ahead
       FROM shopping_sessions
      WHERE status = 'queue_waiting'
        AND started_at <= (SELECT started_at FROM shopping_sessions WHERE client_id = $1 AND status = 'queue_waiting' ORDER BY started_at DESC LIMIT 1)`,
    [clientId],
  );
  return rows[0]?.ahead ?? 0;
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

export async function abandonSession(sessionId) {
  const { rowCount } = await db.query(
    `UPDATE shopping_sessions SET status = 'abandoned', ended_at = now() WHERE id = $1 AND status = 'active'`,
    [sessionId],
  );
  if (rowCount) await releaseFloorSlot();
  return rowCount > 0;
}

export async function promoteNextFromQueue() {
  const { rows } = await db.query(
    `UPDATE shopping_sessions
        SET status = 'active', queue_position = NULL, started_at = now()
      WHERE id = (
        SELECT id FROM shopping_sessions
         WHERE status = 'queue_waiting'
         ORDER BY queue_position NULLS LAST, started_at
         LIMIT 1
      )
      RETURNING id, session_token`,
  );
  return rows[0] || null;
}
