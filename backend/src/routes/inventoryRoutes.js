import { Router } from 'express';
import { adjustStock, listMovements, stockIn, stockOut } from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/movements', listMovements);
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
router.post('/adjust', adjustStock);
export default router;
