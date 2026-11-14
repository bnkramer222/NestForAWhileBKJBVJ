import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { ah } from '../lib/asyncHandler.js';

export const health = ah(async (req, res) => {
  const database = await db.health();
  const ok = database.ok;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'epic-cure-mtg',
    version: '0.1.0',
    env: env.nodeEnv,
    database,
    aiEngine: env.aiEngineUrl ? 'configured' : 'local-deterministic-fallback',
    timestamp: new Date().toISOString(),
  });
});
