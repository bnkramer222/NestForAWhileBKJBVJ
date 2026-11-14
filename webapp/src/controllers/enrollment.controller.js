import * as clientModel from '../models/client.model.js';
import * as analyticsModel from '../models/analytics.model.js';
import { ALLERGENS, normalizeAllergen, allergenLabel } from '../lib/allergens.js';
import { resolveTier } from '../services/dietaryMatrix.js';
import QRCode from 'qrcode';
import { ah } from '../lib/asyncHandler.js';

// [field, min, max] — matches the CHECK constraints on client_biometrics.
const BIOMETRIC_FIELDS = [
  ['a1c_pct', 3, 20],
  ['systolic', 60, 260],
  ['diastolic', 30, 160],
  ['egfr', 1, 150],
  ['weight_lbs', 40, 700],
];

function parseBiometrics(body) {
  const reading = {};
  for (const [field, min, max] of BIOMETRIC_FIELDS) {
    const raw = String(body[field] ?? '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      return { error: `Check the ${field.replace('_pct', '').replace('_', ' ')} reading — expected ${min} to ${max}.` };
    }
    reading[field] = value;
  }
  return { reading };
}

function renderForm(res, { conditions, error = null, values = {}, status = 200 }) {
  return res.status(status).render('enroll', {
    title: 'Sign up',
    bodyClass: 'enroll',
    conditions,
    allergenOptions: ALLERGENS,
    error,
    values: {
      name: values.name || '',
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
  renderForm(res, { conditions });
});

export const submitEnroll = ah(async (req, res) => {
  const conditions = await clientModel.listConditions();

  const values = {
    name: String(req.body.name || '').trim(),
    householdSize: Number(req.body.household_size || 0),
    conditions: [].concat(req.body.conditions || []).map(String),
    allergies: [].concat(req.body.allergies || []).map(String),
    allergiesOther: String(req.body.allergies_other || '').trim(),
    ...Object.fromEntries(BIOMETRIC_FIELDS.map(([field]) => [field, String(req.body[field] ?? '').trim()])),
  };

  if (values.name.length < 2 || values.name.length > 80) {
    return renderForm(res, { conditions, error: 'Enter a name between 2 and 80 characters.', values, status: 400 });
  }
  if (!Number.isInteger(values.householdSize) || values.householdSize < 1 || values.householdSize > 12) {
    return renderForm(res, { conditions, error: 'Household size must be a whole number from 1 to 12.', values, status: 400 });
  }

  const knownCodes = new Set(conditions.map((condition) => condition.code));
  if (values.conditions.some((code) => !knownCodes.has(code))) {
    return renderForm(res, { conditions, error: 'One of the selected conditions is not in the clinical catalog.', values, status: 400 });
  }

  // Checked boxes + anything typed under "Something else", normalized to the catalog vocabulary
  // (e.g. "milk" -> dairy, "peanut" -> peanuts) so every allergy actually matches product flags.
  const typed = values.allergiesOther.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (typed.length > 5 || typed.some((entry) => entry.length > 30)) {
    return renderForm(res, { conditions, error: 'Please list up to 5 other allergies, separated by commas.', values, status: 400 });
  }
  const allergies = [...new Set([...values.allergies, ...typed].map(normalizeAllergen).filter(Boolean))];
  if (allergies.length > 15) {
    return renderForm(res, { conditions, error: 'Please choose up to 15 allergies.', values, status: 400 });
  }

  const biometrics = parseBiometrics(req.body);
  if (biometrics.error) {
    return renderForm(res, { conditions, error: biometrics.error, values, status: 400 });
  }

  const tier = resolveTier(values.conditions);
  const enrollment = await clientModel.createEnrollment({
    name: values.name,
    householdSize: values.householdSize,
    conditions: values.conditions,
    allergies,
    dietaryTierId: tier.id,
  });

  await analyticsModel.addBiometricReading(enrollment.id, biometrics.reading);

  res.status(201).render('enroll-success', {
    title: 'All set',
    bodyClass: 'enroll',
    token: enrollment.token,
    tokenQr: await QRCode.toDataURL(enrollment.token, { margin: 1, width: 180 }),
    name: values.name,
    householdSize: values.householdSize,
    tier,
    conditions,
    selectedConditions: values.conditions,
    allergies: allergies.map(allergenLabel),
  });
});
