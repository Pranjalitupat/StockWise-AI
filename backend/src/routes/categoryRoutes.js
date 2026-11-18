import { Router } from 'express';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.route('/').get(listCategories).post(createCategory);
router.route('/:id').put(updateCategory).delete(deleteCategory);
export default router;
