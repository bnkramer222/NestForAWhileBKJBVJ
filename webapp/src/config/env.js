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
  // Minutes of silence before a floor slot / place in line is released. An open shop page sends a
  // heartbeat every 2 minutes and the waiting page polls every 5 seconds, so only people who
  // actually left (closed the page, walked out without checking out) hit these limits.
  shoppingTimeoutMin: Number(process.env.SHOPPING_TIMEOUT_MIN || 20),
  queueTimeoutMin: Number(process.env.QUEUE_TIMEOUT_MIN || 10),

  // System of Intelligence. provider: groq | hf | ollama | none
  aiProvider: (process.env.AI_PROVIDER || '').toLowerCase(),
  aiApiKey:
    process.env.AI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HF_TOKEN ||
    '',
  aiBaseUrl: process.env.AI_BASE_URL || '',
  aiEngineModel: process.env.AI_MODEL || process.env.AI_ENGINE_MODEL || '',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 6000),
  aiMaxTokens: Number(process.env.AI_MAX_TOKENS || 900),
  aiTemperature: Number(process.env.AI_TEMPERATURE || 0.2),
  aiRepairAttempts: Number(process.env.AI_REPAIR_ATTEMPTS || 1),
  aiMaxRecipes: Number(process.env.AI_MAX_RECIPES || 3),
};

if (isProd && env.sessionSecret === 'dev-only-change-me') {
  console.warn('[config] SESSION_SECRET is the development default — set it in the environment.');
}
if (isProd && !env.phiKey) {
  console.warn('[config] PHI_KEY is unset — PHI encryption falls back to SESSION_SECRET-derived key.');
}
if (isProd && ['groq', 'hf'].includes(env.aiProvider) && !env.aiApiKey) {
  console.warn(`[config] AI_PROVIDER=${env.aiProvider} but no API key found — engine calls will fall back.`);
}
