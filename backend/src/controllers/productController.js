import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { recordInitialStock } from '../services/inventoryService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escapeRegex, parsePagination, pick, statusFilter } from '../utils/helpers.js';

const BASE_FIELDS = ['name', 'sku', 'category', 'description', 'costPrice', 'sellingPrice', 'supplier', 'lowStockThreshold'];
const SORTABLE = ['name', 'sku', 'quantity', 'costPrice', 'sellingPrice', 'createdAt'];

async function assertCategoryOwned(userId, categoryId) {
  if (categoryId === undefined) return;
  const exists = await Category.exists({ _id: categoryId, user: userId });
  if (!exists) throw new ApiError(400, 'Selected category does not exist');
}

export const listProducts = asyncHandler(async (req, res) => {
  const { search, category, status, sort = '-createdAt' } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { user: req.user._id };
  if (category) filter.category = category;
  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { supplier: rx }];
  }
  Object.assign(filter, statusFilter(status));

  const sortField = String(sort).replace(/^-/, '');
  const sortSpec = { [SORTABLE.includes(sortField) ? sortField : 'createdAt']: String(sort).startsWith('-') ? -1 : 1 };

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name color').sort(sortSpec).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

export const getProduct = asyncHandler(async (req, res) => {
  const item = await Product.findOne({ _id: req.params.id, user: req.user._id }).populate('category', 'name color');
  if (!item) throw new ApiError(404, 'Product not found');
  res.json({ success: true, item });
});

export const createProduct = asyncHandler(async (req, res) => {
  await assertCategoryOwned(req.user._id, req.body.category);
  const product = await Product.create({
    ...pick(req.body, [...BASE_FIELDS, 'quantity']),
    user: req.user._id,
  });
  await recordInitialStock(product);
  await product.populate('category', 'name color');
  res.status(201).json({ success: true, item: product });
});

// Quantity is intentionally not editable here: stock changes go through /inventory so history stays accurate.
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found');
  await assertCategoryOwned(req.user._id, req.body.category);
  Object.assign(product, pick(req.body, BASE_FIELDS));
  await product.save();
  await product.populate('category', 'name color');
  res.json({ success: true, item: product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found');
  // Movement history is kept (it stores product name and SKU snapshots).
  res.json({ success: true, message: 'Product deleted' });
});
