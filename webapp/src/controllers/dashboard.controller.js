import * as analyticsModel from '../models/analytics.model.js';
import * as productModel from '../models/product.model.js';
import { ah } from '../lib/asyncHandler.js';
import { sendCsv } from '../lib/csv.js';
import { badRequest } from '../lib/httpError.js';

export const showDashboard = ah(async (req, res) => {
  const [summary, distribution, grants, replenishment, expiring, outcomes] = await Promise.all([
    analyticsModel.getProgramSummary(),
    analyticsModel.getDistributionByCategory(),
    analyticsModel.getGrantAttribution(),
    productModel.listNeedsReplenishment(),
    productModel.listExpiringLots(7),
    analyticsModel.getOutcomeTrends(),
  ]);

  res.render('dashboard', {
    title: 'Program dashboard',
    bodyClass: 'dashboard',
    summary,
    distribution,
    grants,
    replenishment,
    expiring,
    outcomes,
  });
});

const today = () => new Date().toISOString().slice(0, 10);

/** De-identified CSV exports for funders and auditors (US-5.1 / US-5.2). */
const EXPORTS = {
  grants: {
    load: analyticsModel.getGrantLedger,
    columns: [
      { key: 'month', label: 'month' },
      { key: 'funder', label: 'funder' },
      { key: 'grant_code', label: 'grant_code' },
      { key: 'category', label: 'food_category' },
      { key: 'evaluated_status', label: 'clinical_status' },
      { key: 'units', label: 'units' },
      { key: 'weight_lbs', label: 'weight_lbs' },
    ],
  },
  conditions: {
    load: analyticsModel.getConditionDistribution,
    columns: [
      { key: 'month', label: 'month' },
      { key: 'condition_key', label: 'condition_group' },
      { key: 'category', label: 'food_category' },
      { key: 'units', label: 'units' },
      { key: 'weight_lbs', label: 'weight_lbs' },
    ],
  },
  outcomes: {
    load: analyticsModel.getOutcomeTrends,
    columns: [
      { key: 'condition', label: 'condition_group' },
      { key: 'marker', label: 'marker' },
      { key: 'clients', label: 'clients_in_cohort' },
      { key: 'baseline', label: 'baseline_avg' },
      { key: 'month3', label: 'month3_avg' },
      { key: 'month6', label: 'month6_avg' },
      { key: 'delta3', label: 'delta_3mo' },
      { key: 'delta6', label: 'delta_6mo' },
      { key: 'better', label: 'better_direction' },
      { key: 'trend', label: 'trend' },
    ],
  },
};

export const exportCsv = ah(async (req, res) => {
  const report = EXPORTS[req.params.report];
  if (!report) throw badRequest('Unknown report. Use grants, conditions, or outcomes.');
  const rows = await report.load();
  sendCsv(res, `epic-cure-mtg-${req.params.report}-${today()}.csv`, report.columns, rows);
});
