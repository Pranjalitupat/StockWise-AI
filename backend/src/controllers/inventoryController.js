import StockMovement from '../models/StockMovement.js';
import { changeStock } from '../services/inventoryService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { parsePagination, requirePositiveInt } from '../utils/helpers.js';

function handler(type) {
  return asyncHandler(async (req, res) => {
    const { productId, quantity, newQuantity, reason } = req.body;
    if (!productId) throw new ApiError(400, 'Product is required');
    const params = { userId: req.user._id, productId, type, reason: reason ? String(reason).slice(0, 200) : '' };

    if (type === 'ADJUSTMENT') {
      const n = Number(newQuantity);
      if (newQuantity === '' || newQuantity === undefined || !Number.isInteger(n) || n < 0) {
        throw new ApiError(400, 'New quantity must be a whole number, 0 or greater');
      }
      if (!params.reason.trim()) throw new ApiError(400, 'A reason is required for stock adjustments');
      params.newQuantity = n;
    } else {
      params.quantity = requirePositiveInt(quantity, 'Quantity');
    }

    const result = await changeStock(params);
    res.status(201).json({ success: true, ...result });
  });
}

export const stockIn = handler('IN');
export const stockOut = handler('OUT');
export const adjustStock = handler('ADJUSTMENT');

export const listMovements = asyncHandler(async (req, res) => {
  const { type, product } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user._id };
  if (['IN', 'OUT', 'ADJUSTMENT'].includes(type)) filter.type = type;
  if (product) filter.product = product;
  const [items, total] = await Promise.all([
    StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});
