import mongoose from 'mongoose';
import ApiError from './ApiError.js';

export const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});
}

export function parsePagination(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function requirePositiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `${label} must be a whole number greater than 0`);
  return n;
}

// Status is derived from quantity and threshold, so MongoDB filters use $expr instead of a stored field.
export function statusFilter(status) {
  switch (status) {
    case 'out_of_stock':
      return { quantity: { $lte: 0 } };
    case 'low_stock':
      return { $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockThreshold'] }] } };
    case 'in_stock':
      return { $expr: { $gt: ['$quantity', '$lowStockThreshold'] } };
    default:
      return {};
  }
}

export function deriveStatus(p) {
  if (p.quantity <= 0) return 'out_of_stock';
  if (p.quantity <= p.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
