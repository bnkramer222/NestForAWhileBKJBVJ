import { Router } from 'express';

import { showKiosk, checkIn, showQueueStatus, apiQueueStatus, leaveLine } from '../controllers/kiosk.controller.js';
import {
  showShop,
  scanItem,
  getCart,
  addItem,
  setQuantity,
  removeItem,
  getRecipes,
  finishSession,
} from '../controllers/shop.controller.js';
import {
  showCheckout,
  apiScan,
  apiAdd,
  apiRemove,
  apiComplete,
} from '../controllers/checkout.controller.js';
import { showDashboard, exportCsv, setCapacity, sweepNow, endShopper, clearFloorNow } from '../controllers/dashboard.controller.js';
import { health } from '../controllers/health.controller.js';
import { showBarcodes } from '../controllers/demo.controller.js';
import { showEnroll, submitEnroll } from '../controllers/enrollment.controller.js';

const router = Router();

router.get('/', (req, res) => res.redirect('/kiosk'));
router.get('/healthz', health);
router.get('/barcodes', showBarcodes);

// Epic 1 — kiosk check-in and flow control
router.get('/kiosk', showKiosk);
router.post('/kiosk/check-in', checkIn);
router.get('/queue', showQueueStatus);
router.post('/queue/leave', leaveLine);
router.get('/api/queue/:token', apiQueueStatus);

// Epic 2 — client profile creation (US-2.1)
router.get('/enroll', showEnroll);
router.post('/enroll', submitEnroll);

// Epic 3 — client shopping companion
router.get('/shop', showShop);
router.post('/shop/exit', finishSession);

// Epic 4 — volunteer exit terminal
router.get('/checkout', showCheckout);

// Epic 5 — analytics
router.get('/dashboard', showDashboard);
router.get('/dashboard/export/:report.csv', exportCsv);
router.post('/dashboard/floor/capacity', setCapacity);
router.post('/dashboard/floor/sweep', sweepNow);
router.post('/dashboard/floor/end/:id', endShopper);
router.post('/dashboard/floor/clear', clearFloorNow);

// JSON API used by the mobile shopping companion and volunteer terminal
router.post('/api/scan', scanItem);
router.get('/api/cart', getCart);
router.post('/api/cart', addItem);
router.patch('/api/cart/:sku', setQuantity);
router.delete('/api/cart/:sku', removeItem);
router.get('/api/recipes', getRecipes);

router.post('/api/checkout/scan', apiScan);
router.post('/api/checkout/items', apiAdd);
router.post('/api/checkout/items/:sku/remove', apiRemove);
router.post('/api/checkout/complete', apiComplete);

export default router;
