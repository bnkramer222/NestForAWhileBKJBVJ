import * as analyticsModel from '../models/analytics.model.js';
import * as productModel from '../models/product.model.js';
import * as sessionModel from '../models/session.model.js';
import { ah } from '../lib/asyncHandler.js';
import { sendCsv } from '../lib/csv.js';
import { badRequest } from '../lib/httpError.js';

export const showDashboard = ah(async (req, res) => {
  await sessionModel.sweepFloor(); // show an up-to-date floor
  const [summary, distribution, grants, replenishment, expiring, outcomes, floor, queue] = await Promise.all([
    analyticsModel.getProgramSummary(),
    analyticsModel.getDistributionByCategory(),
    analyticsModel.getGrantAttribution(),
    productModel.listNeedsReplenishment(),
    productModel.listExpiringLots(7),
    analyticsModel.getOutcomeTrends(),
    sessionModel.getFloorState(),
    sessionModel.listQueue(),
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
    floor,
    queue,
    flash: req.query.msg ? String(req.query.msg).slice(0, 160) : null,
  });
});

/** Manager control: set Max_Floor_Capacity (lower it to 1 to demo the waiting line). */
export const setCapacity = ah(async (req, res) => {
  const max = Math.floor(Number(req.body.max_floor_capacity));
  if (!Number.isFinite(max) || max < 1 || max > 500) throw badRequest('Capacity must be a whole number from 1 to 500.');
  const { admitted } = await sessionModel.setFloorCapacity(max);
  const msg = `Floor capacity set to ${max}.` + (admitted ? ` ${admitted} household(s) admitted from the line.` : '');
  res.redirect(303, '/dashboard?msg=' + encodeURIComponent(msg) + '#floor');
});

export const sweepNow = ah(async (req, res) => {
  const { expired, admitted } = await sessionModel.sweepFloor();
  res.redirect(303, '/dashboard?msg=' + encodeURIComponent(`Released ${expired} inactive session(s), admitted ${admitted}.`) + '#floor');
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
