import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

pool?.on('error', (err) => console.error('[db] idle client error', err.message));

export const db = {
  enabled: Boolean(pool),

  async query(text, params = []) {
    if (!pool) throw new Error('DATABASE_URL is not configured');
    return pool.query(text, params);
  },

  /** Run fn inside a single transaction. Rolls back on any throw. */
  async tx(fn) {
    if (!pool) throw new Error('DATABASE_URL is not configured');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[db] rollback failed', rollbackErr.message);
      }
      throw err;
    } finally {
      client.release();
    }
  },

  async health() {
    if (!pool) return { ok: false, reason: 'DATABASE_URL not configured' };
    try {
      const started = Date.now();
      await pool.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  },

  async close() {
    await pool?.end();
  },
};

export { pool };
