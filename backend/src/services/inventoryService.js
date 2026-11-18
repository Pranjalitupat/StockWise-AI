import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import ApiError from '../utils/ApiError.js';
import { toObjectId, statusFilter } from '../utils/helpers.js';

/**
 * Applies a stock change atomically (single findOneAndUpdate), so quantity can never go negative
 * even with concurrent requests, then records a StockMovement with previous/new quantity.
 */
export async function changeStock({ userId, productId, type, quantity, newQuantity, reason }) {
  const filter = { _id: productId, user: userId };
  let update;
  if (type === 'IN') update = { $inc: { quantity } };
  else if (type === 'OUT') {
    filter.quantity = { $gte: quantity };
    update = { $inc: { quantity: -quantity } };
  } else update = { $set: { quantity: newQuantity } };

  // new:false returns the document as it was BEFORE the update -> reliable "previous quantity".
  const before = await Product.findOneAndUpdate(filter, update, { new: false });
  if (!before) {
    const exists = await Product.exists({ _id: productId, user: userId });
    if (!exists) throw new ApiError(404, 'Product not found');
    throw new ApiError(400, 'Insufficient stock: this would make the quantity negative');
  }

  const previousQuantity = before.quantity;
  const updatedQuantity =
    type === 'IN' ? previousQuantity + quantity : type === 'OUT' ? previousQuantity - quantity : newQuantity;

  const movement = await StockMovement.create({
    user: userId,
    product: before._id,
    productName: before.name,
    sku: before.sku,
    type,
    quantity: type === 'ADJUSTMENT' ? Math.abs(updatedQuantity - previousQuantity) : quantity,
    previousQuantity,
    newQuantity: updatedQuantity,
    reason: reason || '',
  });

  const product = await Product.findById(before._id).populate('category', 'name color');
  return { product, movement };
}

export async function recordInitialStock(product) {
  if (product.quantity > 0) {
    await StockMovement.create({
      user: product.user,
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'IN',
      quantity: product.quantity,
      previousQuantity: 0,
      newQuantity: product.quantity,
      reason: 'Initial stock',
    });
  }
}

export async function getInventoryStats(userId) {
  const uid = toObjectId(userId);
  const [row] = await Product.aggregate([
    { $match: { user: uid } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        inventoryValue: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
        retailValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$quantity', 0] }, 1, 0] } },
        lowStock: {
          $sum: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$lowStockThreshold'] }] }, 1, 0] },
        },
      },
    },
  ]);
  const s = row || {};
  const totalProducts = s.totalProducts || 0;
  const outOfStock = s.outOfStock || 0;
  const lowStock = s.lowStock || 0;
  return {
    totalProducts,
    totalUnits: s.totalUnits || 0,
    inventoryValue: round(s.inventoryValue),
    retailValue: round(s.retailValue),
    lowStock,
    outOfStock,
    inStock: totalProducts - outOfStock - lowStock,
  };
}

export async function getCategoryBreakdown(userId) {
  return Product.aggregate([
    { $match: { user: toObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        products: { $sum: 1 },
        units: { $sum: '$quantity' },
        value: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    {
      $project: {
        _id: 0,
        category: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Uncategorised'] },
        color: { $ifNull: [{ $arrayElemAt: ['$cat.color', 0] }, '#94a3b8'] },
        products: 1,
        units: 1,
        value: { $round: ['$value', 2] },
      },
    },
    { $sort: { value: -1 } },
  ]);
}

export async function getAttentionProducts(userId, limit = 50) {
  const base = { user: userId };
  const select = 'name sku quantity lowStockThreshold supplier';
  const [outOfStock, lowStock] = await Promise.all([
    Product.find({ ...base, ...statusFilter('out_of_stock') }).select(select).sort({ name: 1 }).limit(limit),
    Product.find({ ...base, ...statusFilter('low_stock') }).select(select).sort({ quantity: 1 }).limit(limit),
  ]);
  return { outOfStock, lowStock };
}

export const round = (n) => Math.round((n || 0) * 100) / 100;
