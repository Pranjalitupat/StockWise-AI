import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { getCategoryBreakdown, getInventoryStats, round } from '../services/inventoryService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toCsv } from '../utils/csv.js';
import { deriveStatus, toObjectId } from '../utils/helpers.js';

const STATUS_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' };

export const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [stats, categories, topValue, movement30] = await Promise.all([
    getInventoryStats(userId),
    getCategoryBreakdown(userId),
    Product.aggregate([
      { $match: { user: toObjectId(userId) } },
      { $addFields: { stockValue: { $multiply: ['$quantity', '$costPrice'] } } },
      { $sort: { stockValue: -1 } },
      { $limit: 10 },
      { $project: { name: 1, sku: 1, quantity: 1, costPrice: 1, stockValue: { $round: ['$stockValue', 2] } } },
    ]),
    StockMovement.aggregate([
      { $match: { user: toObjectId(userId), createdAt: { $gte: since } } },
      { $group: { _id: '$type', count: { $sum: 1 }, units: { $sum: '$quantity' } } },
    ]),
  ]);
  res.json({
    success: true,
    stats,
    potentialProfit: round(stats.retailValue - stats.inventoryValue),
    statusBreakdown: [
      { key: 'in_stock', label: STATUS_LABEL.in_stock, value: stats.inStock },
      { key: 'low_stock', label: STATUS_LABEL.low_stock, value: stats.lowStock },
      { key: 'out_of_stock', label: STATUS_LABEL.out_of_stock, value: stats.outOfStock },
    ],
    categories,
    topValue,
    movementLast30Days: movement30.map((m) => ({ type: m._id, count: m.count, units: m.units })),
  });
});

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export const exportProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user._id }).populate('category', 'name').sort({ name: 1 }).lean();
  const rows = products.map((p) => [
    p.name, p.sku, p.category?.name || '', p.supplier, p.quantity, p.lowStockThreshold,
    STATUS_LABEL[deriveStatus(p)], p.costPrice, p.sellingPrice, round(p.quantity * p.costPrice), p.description,
  ]);
  sendCsv(
    res,
    'stockwise-products.csv',
    toCsv(['Name', 'SKU', 'Category', 'Supplier', 'Quantity', 'Low Stock Threshold', 'Status', 'Cost Price', 'Selling Price', 'Stock Value (Cost)', 'Description'], rows)
  );
});

export const exportMovements = asyncHandler(async (req, res) => {
  const items = await StockMovement.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5000).lean();
  const rows = items.map((m) => [m.createdAt, m.productName, m.sku, m.type, m.quantity, m.previousQuantity, m.newQuantity, m.reason]);
  sendCsv(res, 'stockwise-movements.csv', toCsv(['Date', 'Product', 'SKU', 'Type', 'Units', 'Previous Quantity', 'New Quantity', 'Reason'], rows));
});
