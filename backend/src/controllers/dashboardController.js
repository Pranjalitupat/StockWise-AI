import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { getAttentionProducts, getCategoryBreakdown, getInventoryStats } from '../services/inventoryService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toObjectId } from '../utils/helpers.js';

async function monthlyMovement(userId, months = 6) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await StockMovement.aggregate([
    { $match: { user: toObjectId(userId), createdAt: { $gte: start } } },
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, type: '$type' }, units: { $sum: '$quantity' } } },
  ]);
  const series = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const find = (type) => rows.find((r) => r._id.y === d.getUTCFullYear() && r._id.m === d.getUTCMonth() + 1 && r._id.type === type)?.units || 0;
    series.push({
      month: d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      stockIn: find('IN'),
      stockOut: find('OUT'),
      adjustments: find('ADJUSTMENT'),
    });
  }
  return series;
}

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [stats, categoryChart, monthly, recentActivity, attention] = await Promise.all([
    getInventoryStats(userId),
    getCategoryBreakdown(userId),
    monthlyMovement(userId),
    StockMovement.find({ user: userId }).sort({ createdAt: -1 }).limit(8),
    getAttentionProducts(userId, 8),
  ]);
  res.json({ success: true, stats, categoryChart, monthlyMovement: monthly, recentActivity, lowStock: attention.lowStock, outOfStock: attention.outOfStock });
});

export const getAlerts = asyncHandler(async (req, res) => {
  const { outOfStock, lowStock } = await getAttentionProducts(req.user._id, 10);
  const stats = await getInventoryStats(req.user._id);
  res.json({ success: true, outOfStock, lowStock, counts: { outOfStock: stats.outOfStock, lowStock: stats.lowStock } });
});
