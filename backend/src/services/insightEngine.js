import '../models/Category.js'; // registers the model used by populate('category')
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { deriveStatus, toObjectId } from '../utils/helpers.js';

/**
 * Rule-based inventory intelligence. No external APIs.
 * Inputs are the signed-in user's own products and their recorded stock-out history.
 */
const DAY = 24 * 60 * 60 * 1000;
export const RULES = {
  overstockMultiplier: 5, // overstocked when quantity > 5x the low stock threshold
  bufferMultiplier: 2, // restock target = 2x threshold (at minimum)
  coverDays: 30, // when usage is known, aim for 30 days of cover
  urgentCoverDays: 7, // High priority when stock covers <= 7 days
  slowMoverDays: 60, // no stock-out recorded for 60 days
  thinMarginPct: 10,
};
const LIST_LIMIT = 8;

// ---------- formatting helpers ----------
export const makeMoney = (currency = 'INR') => {
  const fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 });
  return (v) => fmt.format(Number.isFinite(v) ? v : 0);
};
export const fmtNum = (v) => new Intl.NumberFormat('en-IN').format(Math.round((v || 0) * 100) / 100);
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const STATUS_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' };
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const plural = (n, one, many = `${one}s`) => `${fmtNum(n)} ${n === 1 ? one : many}`;
export const limitList = (arr, mapFn, max = LIST_LIMIT) => {
  const lines = arr.slice(0, max).map(mapFn);
  if (arr.length > max) lines.push(`- ...and ${arr.length - max} more`);
  return lines;
};

// ---------- data loading (always scoped to one user) ----------
export async function loadInventory(user) {
  const uid = toObjectId(user._id);
  const now = Date.now();
  const since60 = new Date(now - RULES.slowMoverDays * DAY);
  const since30 = new Date(now - 30 * DAY);

  const [products, usage] = await Promise.all([
    Product.find({ user: user._id }).populate('category', 'name').lean(),
    StockMovement.aggregate([
      { $match: { user: uid, type: 'OUT', createdAt: { $gte: since60 } } },
      {
        $group: {
          _id: '$product',
          units30: { $sum: { $cond: [{ $gte: ['$createdAt', since30] }, '$quantity', 0] } },
          lastOut: { $max: '$createdAt' },
        },
      },
    ]),
  ]);
  const usageMap = new Map(usage.map((u) => [String(u._id), u]));
  const items = products.map((p) => toItem(p, usageMap.get(String(p._id)), now));
  return { currency: user.currency || 'INR', items };
}

export function toItem(p, usage, now = Date.now()) {
  const units30 = usage?.units30 || 0;
  const dailyUse = units30 / 30;
  return {
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    category: p.category?.name || 'Uncategorised',
    supplier: p.supplier || '',
    quantity: p.quantity,
    threshold: p.lowStockThreshold,
    cost: p.costPrice,
    price: p.sellingPrice,
    status: deriveStatus(p),
    value: p.quantity * p.costPrice,
    retail: p.quantity * p.sellingPrice,
    units30,
    dailyUse,
    daysOfCover: dailyUse > 0 ? p.quantity / dailyUse : null,
    lastOut: usage?.lastOut || null,
    ageDays: p.createdAt ? (now - new Date(p.createdAt).getTime()) / DAY : 0,
  };
}

// ---------- calculations ----------
export function computeStats(items) {
  const totalProducts = items.length;
  const out = items.filter((p) => p.status === 'out_of_stock').length;
  const low = items.filter((p) => p.status === 'low_stock').length;
  const inStock = totalProducts - out - low;
  const cost = items.reduce((s, p) => s + p.value, 0);
  const retail = items.reduce((s, p) => s + p.retail, 0);
  return {
    totalProducts,
    totalUnits: items.reduce((s, p) => s + p.quantity, 0),
    inventoryValue: Math.round(cost * 100) / 100,
    retailValue: Math.round(retail * 100) / 100,
    lowStock: low,
    outOfStock: out,
    inStock,
    healthScore: totalProducts ? Math.round(((inStock + 0.5 * low) / totalProducts) * 100) : null,
  };
}

// Stock level to aim for after reordering.
export function targetLevel(p) {
  const byThreshold = p.threshold * RULES.bufferMultiplier;
  const byUsage = p.dailyUse > 0 ? Math.ceil(p.dailyUse * RULES.coverDays) : 0;
  return Math.max(byThreshold, byUsage, 1);
}

export function isOverstocked(p) {
  return p.threshold > 0 && p.quantity > p.threshold * RULES.overstockMultiplier && p.quantity > targetLevel(p);
}

export function getOverstocked(items) {
  return items
    .filter(isOverstocked)
    .map((p) => {
      const excessUnits = p.quantity - targetLevel(p);
      return { ...p, excessUnits, excessValue: excessUnits * p.cost, times: p.quantity / p.threshold };
    })
    .sort((a, b) => b.excessValue - a.excessValue);
}

export function getSlowMovers(items) {
  return items
    .filter((p) => p.quantity > p.threshold && p.quantity > 0 && p.ageDays >= RULES.slowMoverDays && !p.lastOut && !isOverstocked(p))
    .sort((a, b) => b.value - a.value);
}

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

/** Smart restocking: reorder quantity brings stock to targetLevel(); priority reflects urgency. */
export function buildRestock(items, currency = 'INR') {
  const money = makeMoney(currency);
  const recs = [];

  items.forEach((p) => {
    const atOrBelow = p.quantity <= p.threshold;
    const runningOutFast = p.daysOfCover !== null && p.daysOfCover <= RULES.urgentCoverDays;
    if (!atOrBelow && !runningOutFast) return;

    const target = targetLevel(p);
    const qty = Math.max(target - p.quantity, 1);
    const cover = p.daysOfCover !== null ? Math.max(Math.round(p.daysOfCover * 10) / 10, 0) : null;

    let priority;
    if (p.quantity <= 0) priority = 'High';
    else if (!atOrBelow) priority = 'Medium';
    else if (runningOutFast || p.quantity <= Math.ceil(p.threshold / 2)) priority = 'High';
    else if (cover !== null && cover > 21 && p.quantity > p.threshold / 2) priority = 'Low';
    else priority = 'Medium';

    const parts = [];
    if (p.quantity <= 0) parts.push('Out of stock.');
    else if (atOrBelow) parts.push(`Stock (${fmtNum(p.quantity)}) is at or below the threshold of ${fmtNum(p.threshold)}.`);
    else parts.push(`Stock (${fmtNum(p.quantity)}) is above the threshold but selling fast.`);
    if (p.dailyUse > 0) {
      parts.push(`Recorded stock-outs average ${fmtNum(p.dailyUse)}/day over 30 days, about ${cover} days of cover.`);
    }
    parts.push(
      `Order ${fmtNum(qty)} to reach ${fmtNum(target)} units (${p.dailyUse > 0 && Math.ceil(p.dailyUse * RULES.coverDays) > p.threshold * RULES.bufferMultiplier ? `${RULES.coverDays} days of usage` : `${RULES.bufferMultiplier}x threshold`}).`
    );
    const estimatedCost = Math.round(qty * p.cost * 100) / 100;
    parts.push(`Est. cost ${money(estimatedCost)}.`);

    recs.push({
      sku: p.sku,
      productName: p.name,
      category: p.category,
      supplier: p.supplier,
      quantity: p.quantity,
      lowStockThreshold: p.threshold,
      status: p.status,
      priority,
      suggestedReorderQty: qty,
      targetLevel: target,
      dailyUse: Math.round(p.dailyUse * 100) / 100,
      daysOfCover: cover,
      estimatedCost,
      reason: parts.join(' '),
    });
  });

  recs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.quantity - b.quantity || a.productName.localeCompare(b.productName));
  const totals = {
    products: recs.length,
    units: recs.reduce((s, r) => s + r.suggestedReorderQty, 0),
    estimatedCost: Math.round(recs.reduce((s, r) => s + r.estimatedCost, 0) * 100) / 100,
  };
  return {
    recommendations: recs,
    totals,
    note: recs.length === 0 ? 'No products are at or below their low stock threshold, and none are projected to run out within a week.' : null,
  };
}

// ---------- shared narrative blocks (used by the analysis and by chat) ----------
export function categoryBreakdown(items) {
  const map = new Map();
  items.forEach((p) => {
    const c = map.get(p.category) || { category: p.category, products: 0, units: 0, value: 0 };
    c.products += 1;
    c.units += p.quantity;
    c.value += p.value;
    map.set(p.category, c);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function summaryLines(items, currency) {
  const money = makeMoney(currency);
  const s = computeStats(items);
  const lines = [
    `- You track **${plural(s.totalProducts, 'product')}** with **${plural(s.totalUnits, 'unit')}** in stock.`,
    `- Inventory value is **${money(s.inventoryValue)}** at cost (**${money(s.retailValue)}** at selling price, a potential gross margin of ${money(s.retailValue - s.inventoryValue)}).`,
    `- Stock health score: **${s.healthScore}/100**: ${s.inStock} in stock, ${s.lowStock} low, ${s.outOfStock} out of stock.`,
  ];
  const cats = categoryBreakdown(items);
  if (cats.length && s.inventoryValue > 0) {
    lines.push(`- Largest category by value: **${cats[0].category}** (${money(cats[0].value)}, ${pct(cats[0].value, s.inventoryValue)}% of total).`);
  }
  if (items.length >= 5 && s.inventoryValue > 0) {
    const top3 = [...items].sort((a, b) => b.value - a.value).slice(0, 3);
    const share = pct(top3.reduce((t, p) => t + p.value, 0), s.inventoryValue);
    lines.push(`- Your top 3 products by value (${top3.map((p) => p.name).join(', ')}) hold ${share}% of inventory value.`);
  }
  return lines;
}

export function alertLines(items) {
  const out = items.filter((p) => p.status === 'out_of_stock').sort((a, b) => a.name.localeCompare(b.name));
  const low = items.filter((p) => p.status === 'low_stock').sort((a, b) => a.quantity / (a.threshold || 1) - b.quantity / (b.threshold || 1));
  if (!out.length && !low.length) return ['- Every product is above its low stock threshold.'];
  const lines = [];
  if (out.length) {
    lines.push(`- **Out of stock (${out.length}):**`);
    lines.push(...limitList(out, (p) => `  - ${p.name} (${p.sku}) - threshold ${fmtNum(p.threshold)}`));
  }
  if (low.length) {
    lines.push(`- **Low stock (${low.length}):**`);
    lines.push(...limitList(low, (p) => `  - ${p.name} (${p.sku}) - ${fmtNum(p.quantity)} left, threshold ${fmtNum(p.threshold)}`));
  }
  return lines;
}

export function overstockLines(items, currency) {
  const money = makeMoney(currency);
  const over = getOverstocked(items);
  if (!over.length) return { lines: ['- No overstocked products found.'], over };
  const lines = limitList(
    over,
    (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} units, ${Math.round(p.times * 10) / 10}x its threshold. About ${fmtNum(p.excessUnits)} units above the suggested level (${money(p.excessValue)} at cost).`
  );
  lines.push(`- Capital tied up in excess stock: **${money(over.reduce((s, p) => s + p.excessValue, 0))}**.`);
  return { lines, over };
}

// ---------- AI Insights report ----------
export function buildAnalysis(items, currency = 'INR') {
  const money = makeMoney(currency);
  const stats = computeStats(items);
  const restock = buildRestock(items, currency);
  const { lines: overLines, over } = overstockLines(items, currency);
  const slow = getSlowMovers(items);

  const md = [];
  md.push('## Summary', ...summaryLines(items, currency));
  md.push('', '## Low and out-of-stock products', ...alertLines(items));
  md.push('', `## Overstocked products (quantity above ${RULES.overstockMultiplier}x the low stock threshold)`, ...overLines);
  if (slow.length) {
    md.push(
      '',
      `## Slow-moving stock (no stock-out recorded in ${RULES.slowMoverDays} days)`,
      ...limitList(slow, (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} units, ${money(p.value)} at cost`),
      `- Total value sitting idle: **${money(slow.reduce((s, p) => s + p.value, 0))}**.`
    );
  }

  const tips = [];
  if (restock.recommendations.length) {
    const high = restock.recommendations.filter((r) => r.priority === 'High').length;
    tips.push(
      `- **Restock ${plural(restock.totals.products, 'product')}** (${high} high priority), about ${fmtNum(restock.totals.units)} units for roughly ${money(restock.totals.estimatedCost)}. See Smart Restocking Recommendations below for quantities.`
    );
  }
  if (over.length) tips.push(`- **Pause purchasing** for ${over.slice(0, 3).map((p) => p.name).join(', ')}${over.length > 3 ? ' and others' : ''} until stock falls toward the suggested level.`);
  if (slow.length) tips.push(`- **Review slow movers**: consider a promotion, bundle or supplier return for ${slow.slice(0, 3).map((p) => p.name).join(', ')}.`);

  const belowCost = items.filter((p) => p.price < p.cost);
  if (belowCost.length) tips.push(`- **Fix pricing**: ${belowCost.slice(0, 4).map((p) => p.name).join(', ')}${belowCost.length > 4 ? ' and others' : ''} ${belowCost.length === 1 ? 'sells' : 'sell'} below cost.`);
  const thin = items.filter((p) => p.price >= p.cost && p.price > 0 && ((p.price - p.cost) / p.price) * 100 < RULES.thinMarginPct);
  if (thin.length) tips.push(`- **Thin margins** (under ${RULES.thinMarginPct}%): ${thin.slice(0, 4).map((p) => p.name).join(', ')}${thin.length > 4 ? ' and others' : ''}.`);

  const needSupplier = restock.recommendations.filter((r) => !r.supplier);
  if (needSupplier.length) tips.push(`- **Add supplier details** for ${needSupplier.slice(0, 4).map((r) => r.productName).join(', ')} so reorders are faster.`);
  const zeroThreshold = items.filter((p) => p.threshold === 0 && p.status !== 'out_of_stock');
  if (zeroThreshold.length) tips.push(`- **Set low stock thresholds**: ${plural(zeroThreshold.length, 'product')} have a threshold of 0, so you only get alerted at zero stock.`);
  if (stats.totalProducts > 0 && items.every((p) => p.units30 === 0)) {
    tips.push('- **Record stock-outs** for sales and usage. With 30 days of history, restock quantities switch from threshold-based to usage-based.');
  }
  if (!tips.length) tips.push('- No urgent actions. Stock levels, margins and thresholds all look healthy.');
  md.push('', '## Suggested improvements', ...tips);

  return { analysis: md.join('\n'), stats };
}
