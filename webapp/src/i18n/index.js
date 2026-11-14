import en from './en.js';
import es from './es.js';
import fr from './fr.js';
import ht from './ht.js';
import zh from './zh.js';

/**
 * Shopper-facing language support. Pick a language with ?lang=xx on any page (remembered in a
 * cookie for a year), the switcher in the header, or the browser's language. Staff screens
 * (checkout terminal, dashboard, demo codes) stay in English.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', aiName: 'English' },
  { code: 'es', label: 'Español', aiName: 'Spanish' },
  { code: 'fr', label: 'Français', aiName: 'French' },
  { code: 'ht', label: 'Kreyòl ayisyen', aiName: 'Haitian Creole' },
  { code: 'zh', label: '中文', aiName: 'Simplified Chinese' },
];

const DICTS = { en, es, fr, ht, zh };
const CODES = new Set(LANGUAGES.map((l) => l.code));

export const isLanguage = (code) => CODES.has(String(code || '').toLowerCase());

export function translator(lang) {
  const dict = DICTS[lang] || en;
  return function t(key, vars = {}) {
    const template = dict[key] ?? en[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
  };
}

function cookieLang(req) {
  const match = /(?:^|;\s*)lang=([a-z]{2})/.exec(req.headers.cookie || '');
  return match && isLanguage(match[1]) ? match[1] : null;
}

function acceptLang(req) {
  for (const part of String(req.headers['accept-language'] || '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLanguage(code)) return code;
  }
  return null;
}

export function setLanguageCookie(res, lang) {
  if (isLanguage(lang)) res.cookie('lang', lang, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax', httpOnly: false });
}

/** Strings the browser script needs (keys starting with "js."). */
function clientStrings(t) {
  return Object.fromEntries(Object.keys(en).filter((k) => k.startsWith('js.')).map((k) => [k.slice(3), t(k)]));
}

export function i18nMiddleware(req, res, next) {
  let lang = null;
  if (isLanguage(req.query.lang)) {
    lang = String(req.query.lang).toLowerCase();
    setLanguageCookie(res, lang);
  }
  lang = lang || cookieLang(req) || acceptLang(req) || 'en';

  const t = translator(lang);
  req.lang = lang;
  req.t = t;
  res.locals.lang = lang;
  res.locals.t = t;
  res.locals.languages = LANGUAGES;
  res.locals.clientStrings = JSON.stringify(clientStrings(t));
  res.locals.langUrl = (code) => {
    const params = new URLSearchParams(req.query);
    params.set('lang', code);
    return `${req.path}?${params.toString()}`;
  };
  next();
}

export const languageName = (code) => (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).aiName;

/* ---------- clinical text helpers (shopper view) ---------- */

/** Plan name and note built from the shopper's condition groups, e.g. "Diabetes · Blood pressure". */
export function planText(tier, t) {
  const keys = tier.keys && tier.keys.length ? tier.keys : [];
  if (!keys.length) return { label: t('plan.standard'), notes: t('plan.standard.note') };
  return {
    label: keys.map((key) => t(`plan.${key}`)).join(' · '),
    notes: keys.map((key) => t(`plan.${key}.note`)).join(' '),
  };
}

/** Translate rule explanations using the rule ids that produced them. */
export function localizeReasons(item, t, allergenLabelFor) {
  if (!item || !Array.isArray(item.ruleIds)) return item;
  const reasons = item.ruleIds.map((id, index) => {
    if (id.startsWith('allergen:')) return t('rule.allergen', { allergen: allergenLabelFor(id.slice(9)).toLowerCase() });
    const key = `rule.${id}`;
    const text = t(key);
    return text === key ? item.reasons[index] : text;
  });
  return { ...item, reasons };
}
