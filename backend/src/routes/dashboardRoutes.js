import { Router } from 'express';
import { getAlerts, getDashboard } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getDashboard);
router.get('/alerts', getAlerts);
export default router;
