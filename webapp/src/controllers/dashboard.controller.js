import * as analyticsModel from '../models/analytics.model.js';
import * as productModel from '../models/product.model.js';
import { ah } from '../lib/asyncHandler.js';

export const showDashboard = ah(async (req, res) => {
  const [summary, distribution, grants, replenishment, expiring] = await Promise.all([
    analyticsModel.getProgramSummary(),
    analyticsModel.getDistributionByCategory(),
    analyticsModel.getGrantAttribution(),
    productModel.listNeedsReplenishment(),
    productModel.listExpiringLots(7),
  ]);

  res.render('dashboard', {
    title: 'Program dashboard',
    bodyClass: 'dashboard',
    summary,
    distribution,
    grants,
    replenishment,
    expiring,
  });
});
