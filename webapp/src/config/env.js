function flag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  pgSsl: flag(process.env.PGSSL, isProd),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-me',
  phiKey: process.env.PHI_KEY || '',
  maxFloorCapacity: Number(process.env.MAX_FLOOR_CAPACITY || 25),
  aiEngineUrl: process.env.AI_ENGINE_URL || '',
  aiEngineModel: process.env.AI_ENGINE_MODEL || 'llama3.1:8b-instruct-q4_K_M',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 6000),
};

if (isProd && env.sessionSecret === 'dev-only-change-me') {
  console.warn('[config] SESSION_SECRET is the development default — set it in the environment.');
}
if (isProd && !env.phiKey) {
  console.warn('[config] PHI_KEY is unset — PHI encryption falls back to SESSION_SECRET-derived key.');
}
