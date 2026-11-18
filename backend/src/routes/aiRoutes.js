import { Router } from 'express';
import { analysis, chatAssistant, restock, status } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/status', status);
router.post('/analysis', analysis);
router.post('/restock', restock);
router.post('/chat', chatAssistant);
export default router;
