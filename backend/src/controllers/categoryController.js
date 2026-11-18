import Category from '../models/Category.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { pick, toObjectId } from '../utils/helpers.js';

const FIELDS = ['name', 'description', 'color'];

export const listCategories = asyncHandler(async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find({ user: req.user._id }).sort({ name: 1 }).lean(),
    Product.aggregate([{ $match: { user: toObjectId(req.user._id) } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ success: true, items: categories.map((c) => ({ ...c, productCount: countMap.get(String(c._id)) || 0 })) });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...pick(req.body, FIELDS), user: req.user._id });
  res.status(201).json({ success: true, item: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) throw new ApiError(404, 'Category not found');
  Object.assign(category, pick(req.body, FIELDS));
  await category.save();
  res.json({ success: true, item: category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) throw new ApiError(404, 'Category not found');
  const inUse = await Product.countDocuments({ user: req.user._id, category: category._id });
  if (inUse > 0) throw new ApiError(409, `Cannot delete: ${inUse} product(s) use this category. Move or delete them first.`);
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});
