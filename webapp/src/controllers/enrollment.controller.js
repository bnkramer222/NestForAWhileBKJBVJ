import * as clientModel from '../models/client.model.js';
import * as analyticsModel from '../models/analytics.model.js';
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
    error,
    values: {
      name: values.name || '',
      householdSize: Number(values.householdSize || 2),
      conditions: values.conditions || [],
      allergies: values.allergies || '',
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
    allergies: String(req.body.allergies || '').trim(),
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

  const allergies = values.allergies
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (allergies.length > 10 || allergies.some((entry) => entry.length > 30)) {
    return renderForm(res, { conditions, error: 'List up to 10 allergies, comma separated.', values, status: 400 });
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
    title: 'Enrollment complete',
    bodyClass: 'enroll',
    token: enrollment.token,
    tokenQr: await QRCode.toDataURL(enrollment.token, { margin: 1, width: 180 }),
    name: values.name,
    householdSize: values.householdSize,
    tier,
    conditions,
    selectedConditions: values.conditions,
    allergies,
  });
});
