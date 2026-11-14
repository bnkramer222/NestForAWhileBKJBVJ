import 'dotenv/config';
import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { brand } from './src/config/brand.js';
import { db } from './src/config/db.js';
import { getProviderConfig } from './src/services/aiEngine.js';
import * as sessionModel from './src/models/session.model.js';

const app = createApp();

const server = app.listen(env.port, () => {
  const ai = getProviderConfig();
  console.log(`[boot] ${brand.name} listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[boot] database: ${db.enabled ? 'configured' : 'NOT configured (set DATABASE_URL)'}`);
  console.log(
    `[boot] AI engine: ${ai.configured ? `${ai.provider} · ${ai.model}` : `local fallback (${ai.reason || 'not configured'})`}`,
  );
});

// Every minute: release floor slots / places in line held by people who walked away, and admit
// the next households. (Checkouts and exits admit immediately; this catches the rest.)
const sweep = setInterval(async () => {
  if (!db.enabled) return;
  try {
    const result = await sessionModel.sweepFloor();
    if (result.expired || result.admitted) console.log('[floor] sweep', result);
  } catch (err) {
    console.warn('[floor] sweep failed', err.message);
  }
}, 60_000);
sweep.unref();

async function shutdown(signal) {
  console.log(`[shutdown] ${signal} received`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
