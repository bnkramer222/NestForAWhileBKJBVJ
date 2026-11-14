import { db } from '../config/db.js';

const WITH_STOCK = `
  SELECT p.*, COALESCE(s.on_hand, 0) AS on_hand, COALESCE(s.min_threshold, 0) AS min_threshold
    FROM products p
    LEFT JOIN shelf_stock s ON s.sku = p.sku
`;

export async function findBySku(sku) {
  const { rows } = await db.query(`${WITH_STOCK} WHERE p.sku = $1 AND p.is_active`, [sku]);
  return rows[0] || null;
}

export async function listInStock({ limit = 200, category = null } = {}) {
  const params = [limit];
  let categoryFilter = '';
  if (category) {
    params.push(category);
    categoryFilter = `AND p.category = $2`;
  }
  const { rows } = await db.query(
    `${WITH_STOCK}
      WHERE p.is_active AND COALESCE(s.on_hand, 0) > 0 ${categoryFilter}
      ORDER BY p.category, p.name
      LIMIT $1`,
    params,
  );
  return rows;
}

/** Items below their replenishment threshold, ordered for an aisle-sequenced route. */
export async function listNeedsReplenishment() {
  const { rows } = await db.query(
    `SELECT p.sku, p.name, p.category, p.aisle, p.shelf, p.bin,
            s.on_hand, s.min_threshold
       FROM shelf_stock s
       JOIN products p ON p.sku = s.sku
      WHERE s.on_hand <= s.min_threshold AND p.is_active
      ORDER BY p.aisle, p.shelf, p.bin`,
  );
  return rows;
}

export async function listExpiringLots(days = 7) {
  const { rows } = await db.query(
    `SELECT l.id, l.sku, p.name, l.lot_code, l.quantity_remaining, l.expires_on,
            (l.expires_on - CURRENT_DATE) AS days_left
       FROM inventory_lots l
       JOIN products p ON p.sku = l.sku
      WHERE l.quantity_remaining > 0
        AND l.expires_on IS NOT NULL
        AND l.expires_on <= CURRENT_DATE + $1::int
      ORDER BY l.expires_on, p.aisle, p.shelf`,
    [days],
  );
  return rows;
}
