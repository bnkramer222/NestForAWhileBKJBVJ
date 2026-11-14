import crypto from 'node:crypto';
import { env } from '../config/env.js';

const KEY = crypto
  .createHash('sha256')
  .update(env.phiKey || env.sessionSecret || 'epic-cure-dev')
  .digest();

/**
 * AES-256-GCM envelope: [12-byte IV][16-byte auth tag][ciphertext].
 * Used for PHI columns (client names, identifiers) so the DB never stores plaintext.
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(payload) {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const body = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return '[unreadable — PHI_KEY mismatch]';
  }
}

/** Deterministic lookup hash for identifiers (never store the raw token). */
export function hashToken(token) {
  return crypto.createHmac('sha256', KEY).update(String(token).trim().toUpperCase()).digest('hex');
}
