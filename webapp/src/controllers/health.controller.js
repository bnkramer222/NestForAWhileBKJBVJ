import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { getProviderConfig } from '../services/aiEngine.js';
import { ah } from '../lib/asyncHandler.js';

export const health = ah(async (req, res) => {
  const database = await db.health();
  const ai = getProviderConfig();
  const ok = database.ok;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'epic-cure-mtg',
    version: '0.1.0',
    env: env.nodeEnv,
    database,
    aiEngine: {
      provider: ai.provider,
      model: ai.model,
      configured: ai.configured,
      reason: ai.reason || undefined,
    },
    timestamp: new Date().toISOString(),
  });
});
