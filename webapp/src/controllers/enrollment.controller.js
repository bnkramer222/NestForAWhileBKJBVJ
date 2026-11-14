import * as clientModel from '../models/client.model.js';
import { resolveTier } from '../services/dietaryMatrix.js';
import { ah } from '../lib/asyncHandler.js';

function renderForm(res, { conditions, error = null, values = {}, status = 200 }) {
  return res.status(status).render('enroll', {
    title: 'Enroll',
    bodyClass: 'enroll',
    conditions,
    error,
    values: {
      name: values.name || '',
      householdSize: Number(values.householdSize || 2),
      conditions: values.conditions || [],
      allergies: values.allergies || '',
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

  const tier = resolveTier(values.conditions);
  const enrollment = await clientModel.createEnrollment({
    name: values.name,
    householdSize: values.householdSize,
    conditions: values.conditions,
    allergies,
    dietaryTierId: tier.id,
  });

  res.status(201).render('enroll-success', {
    title: 'Enrollment complete',
    bodyClass: 'enroll',
    token: enrollment.token,
    name: values.name,
    householdSize: values.householdSize,
    tier,
    conditions,
    selectedConditions: values.conditions,
    allergies,
  });
});
