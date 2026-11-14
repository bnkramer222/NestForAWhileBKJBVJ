import { Router } from 'express';

import { showKiosk, checkIn, showQueueStatus } from '../controllers/kiosk.controller.js';
import {
  showShop,
  scanItem,
  getCart,
  addItem,
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
import { showDashboard } from '../controllers/dashboard.controller.js';
import { health } from '../controllers/health.controller.js';
import { showEnroll, submitEnroll } from '../controllers/enrollment.controller.js';

const router = Router();

router.get('/', (req, res) => res.redirect('/kiosk'));
router.get('/healthz', health);

// Epic 1 — kiosk check-in and flow control
router.get('/kiosk', showKiosk);
router.post('/kiosk/check-in', checkIn);
router.get('/queue', showQueueStatus);

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

// JSON API used by the mobile shopping companion and volunteer terminal
router.post('/api/scan', scanItem);
router.get('/api/cart', getCart);
router.post('/api/cart', addItem);
router.delete('/api/cart/:sku', removeItem);
router.get('/api/recipes', getRecipes);

router.post('/api/checkout/scan', apiScan);
router.post('/api/checkout/items', apiAdd);
router.post('/api/checkout/items/:sku/remove', apiRemove);
router.post('/api/checkout/complete', apiComplete);

export default router;
