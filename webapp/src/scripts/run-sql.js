import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node src/scripts/run-sql.js <file.sql>');
  process.exit(1);
}

const sql = await fs.readFile(path.resolve(root, file), 'utf8');

try {
  await pool.query(sql);
  console.log('[sql] applied', file);
} catch (err) {
  console.error('[sql] failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
