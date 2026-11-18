import { Router } from 'express';
import { exportMovements, exportProducts, getSummary } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/summary', getSummary);
router.get('/export/products', exportProducts);
router.get('/export/movements', exportMovements);
export default router;
