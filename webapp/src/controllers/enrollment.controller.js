import * as clientModel from '../models/client.model.js';
import * as analyticsModel from '../models/analytics.model.js';
import { ALLERGENS, normalizeAllergen, allergenLabel } from '../lib/allergens.js';
import { resolveTier } from '../services/dietaryMatrix.js';
import QRCode from 'qrcode';
import { ah } from '../lib/asyncHandler.js';
import { isLanguage, planText, setLanguageCookie, translator } from '../i18n/index.js';

// [field, min, max, label key] — ranges match the CHECK constraints on client_biometrics.
const BIOMETRIC_FIELDS = [
  ['a1c_pct', 3, 20, 'enroll.a1c'],
  ['systolic', 60, 260, 'enroll.systolic'],
  ['diastolic', 30, 160, 'enroll.diastolic'],
  ['egfr', 1, 150, 'enroll.egfr'],
  ['weight_lbs', 40, 700, 'enroll.weight'],
];

function parseBiometrics(body, t) {
  const reading = {};
  for (const [field, min, max, labelKey] of BIOMETRIC_FIELDS) {
    const raw = String(body[field] ?? '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      return { error: t('enroll.err.reading', { field: t(labelKey), min, max }) };
    }
    reading[field] = value;
  }
  return { reading };
}

function renderForm(req, res, { conditions, error = null, values = {}, status = 200 }) {
  return res.status(status).render('enroll', {
    title: req.t('enroll.title'),
    bodyClass: 'enroll',
    conditions,
    allergenOptions: ALLERGENS,
    error,
    values: {
      name: values.name || '',
      preferredName: values.preferredName || '',
      preferredLang: isLanguage(values.preferredLang) ? values.preferredLang : req.lang,
      householdSize: Number(values.householdSize || 2),
      conditions: values.conditions || [],
      allergies: values.allergies || [],
      allergiesOther: values.allergiesOther || '',
      ...Object.fromEntries(BIOMETRIC_FIELDS.map(([field]) => [field, values[field] ?? ''])),
    },
  });
}

export const showEnroll = ah(async (req, res) => {
  const conditions = await clientModel.listConditions();
  // ?name=Maria pre-fills the name (e.g. a volunteer's link or a kiosk shortcut); ?lang=xx sets the language.
  const name = String(req.query.name || '').trim().slice(0, 80);
  renderForm(req, res, { conditions, values: { name, preferredName: name.split(' ')[0] || '' } });
});

export const submitEnroll = ah(async (req, res) => {
  const conditions = await clientModel.listConditions();

  const values = {
    name: String(req.body.name || '').trim(),
    preferredName: String(req.body.preferred_name || '').trim(),
    preferredLang: String(req.body.preferred_lang || '').trim().toLowerCase(),
    householdSize: Number(req.body.household_size || 0),
    conditions: [].concat(req.body.conditions || []).map(String),
    allergies: [].concat(req.body.allergies || []).map(String),
    allergiesOther: String(req.body.allergies_other || '').trim(),
    ...Object.fromEntries(BIOMETRIC_FIELDS.map(([field]) => [field, String(req.body[field] ?? '').trim()])),
  };

  if (values.name.length < 2 || values.name.length > 80) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.name'), values, status: 400 });
  }
  if (values.preferredName.length > 40) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.preferred'), values, status: 400 });
  }
  if (!Number.isInteger(values.householdSize) || values.householdSize < 1 || values.householdSize > 12) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.household'), values, status: 400 });
  }

  const knownCodes = new Set(conditions.map((condition) => condition.code));
  if (values.conditions.some((code) => !knownCodes.has(code))) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.condition'), values, status: 400 });
  }

  // Checked boxes + anything typed under "Something else", normalized to the catalog vocabulary
  // (e.g. "milk" -> dairy, "peanut" -> peanuts) so every allergy actually matches product flags.
  const typed = values.allergiesOther.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (typed.length > 5 || typed.some((entry) => entry.length > 30)) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.other'), values, status: 400 });
  }
  const allergies = [...new Set([...values.allergies, ...typed].map(normalizeAllergen).filter(Boolean))];
  if (allergies.length > 15) {
    return renderForm(req, res, { conditions, error: req.t('enroll.err.tooMany'), values, status: 400 });
  }

  const biometrics = parseBiometrics(req.body, req.t);
  if (biometrics.error) {
    return renderForm(req, res, { conditions, error: biometrics.error, values, status: 400 });
  }

  const tier = resolveTier(values.conditions);
  const preferredLang = isLanguage(values.preferredLang) ? values.preferredLang : req.lang;
  const enrollment = await clientModel.createEnrollment({
    name: values.name,
    preferredName: values.preferredName || null,
    preferredLang,
    householdSize: values.householdSize,
    conditions: values.conditions,
    allergies,
    dietaryTierId: tier.id,
  });

  await analyticsModel.addBiometricReading(enrollment.id, biometrics.reading);

  // Show the rest of the visit in the language they chose.
  setLanguageCookie(res, preferredLang);
  const t = translator(preferredLang);

  res.status(201).render('enroll-success', {
    title: t('done.title'),
    bodyClass: 'enroll',
    t,
    lang: preferredLang,
    token: enrollment.token,
    tokenQr: await QRCode.toDataURL(enrollment.token, { margin: 1, width: 180 }),
    name: values.preferredName || values.name.split(' ')[0],
    householdSize: values.householdSize,
    plan: planText(tier, t),
    conditionNames: values.conditions.map((code) => t(`cond.${code}`)),
    allergies: allergies.map((key) => (t(`allergen.${key}`) === `allergen.${key}` ? allergenLabel(key) : t(`allergen.${key}`))),
  });
});
