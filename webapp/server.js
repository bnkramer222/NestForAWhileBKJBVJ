import 'dotenv/config';
import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { db } from './src/config/db.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[boot] Epic Cure MTG listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[boot] database: ${db.enabled ? 'configured' : 'NOT configured (set DATABASE_URL)'}`);
  console.log(`[boot] AI engine: ${env.aiEngineUrl ? env.aiEngineUrl : 'local rules fallback'}`);
});

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
