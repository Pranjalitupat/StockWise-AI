import StockMovement from '../models/StockMovement.js';
import { escapeRegex } from '../utils/helpers.js';
import {
  STATUS_LABEL, alertLines, buildRestock, categoryBreakdown, computeStats, fmtDate, fmtNum, getOverstocked,
  getSlowMovers, limitList, makeMoney, overstockLines, summaryLines, targetLevel,
} from './insightEngine.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (text, term) => new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}($|[^a-z0-9])`).test(text);

const STOPWORDS = new Set(
  ('the a an of for and or to in on at is are was do does did you your my me i it its this that these those which what how much many have has had got any ' +
    'there tell about details detail info information show give list price cost quantity stock stocks units unit item items product products left remaining ' +
    'available current currently supplier vendor margin profit value low out total inventory restock reorder please can could would should will with from by ' +
    'much more less than').split(' ')
);
const LOOKUP_CUE = /\b(price|cost|quantity|how many|how much|do i have|tell me about|details?|info|supplier of|left|available|margin|show me|stock of|status of|about)\b/;

const CAPABILITIES = [
  '- "Which products are running low?" or "Which products are out of stock?"',
  '- "What is my total inventory value?" or "What are my most valuable products?"',
  '- "Which products should I restock?" (with suggested quantities)',
  '- "Which products are overstocked?" or "Show slow-moving stock"',
  '- "Summarize my inventory"',
  '- Ask about one product by name or SKU, e.g. "How many Widget A do I have?"',
  '- Ask about a category or supplier by name, "recent stock movements", "profit margin", or "how many products do I have?"',
];

/** Loads the latest movements for the chat "recent activity" question. Scoped to one user. */
export async function loadRecentMovements(userId, limit = 8) {
  return StockMovement.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
}

// ---------- entity matching ----------
function findProducts(msg, items) {
  const hits = items.filter((p) => {
    const name = norm(p.name);
    return (name.length >= 2 && msg.includes(name)) || hasWord(msg, p.sku.toLowerCase());
  });
  // If "Widget" and "Widget Pro" both match, keep the more specific (longer) name.
  const names = hits.map((p) => norm(p.name));
  const specific = hits.filter((p, i) => !names.some((n, j) => j !== i && n.length > names[i].length && n.includes(names[i])));
  if (specific.length) return specific.slice(0, 3);

  if (!LOOKUP_CUE.test(msg)) return [];
  const tokens = msg.split(' ').filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (!tokens.length) return [];
  return items
    .filter((p) => {
      const nameTokens = norm(p.name).split(' ');
      return tokens.every((t) => nameTokens.some((nt) => nt.startsWith(t)));
    })
    .slice(0, 3);
}

const findByField = (msg, items, field) => {
  const values = [...new Set(items.map((p) => p[field]).filter((v) => v && v.length >= 3))];
  return values.filter((v) => hasWord(msg, norm(v))).sort((a, b) => b.length - a.length)[0] || null;
};

// ---------- answer builders ----------
function productDetail(p, currency, restockMap) {
  const money = makeMoney(currency);
  const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
  const lines = [
    `**${p.name}** (${p.sku}) - ${p.category}`,
    `- Stock: **${fmtNum(p.quantity)} units** - ${STATUS_LABEL[p.status]} (low stock threshold ${fmtNum(p.threshold)})`,
    `- Cost ${money(p.cost)}, selling price ${money(p.price)}${margin !== null ? `, margin ${margin}%` : ''}`,
    `- Stock value: ${money(p.value)} at cost`,
    `- Supplier: ${p.supplier || 'not set'}`,
  ];
  if (p.dailyUse > 0) lines.push(`- Recorded stock-outs: ${fmtNum(p.units30)} units in 30 days (about ${fmtNum(p.dailyUse)}/day), roughly ${fmtNum(Math.round(p.daysOfCover))} days of cover`);
  else lines.push('- No stock-out recorded in the last 30 days');
  if (p.lastOut) lines.push(`- Last stock-out: ${fmtDate(p.lastOut)}`);

  const rec = restockMap.get(p.id);
  if (rec) lines.push(`- **Recommendation:** order ${fmtNum(rec.suggestedReorderQty)} units to reach ${fmtNum(rec.targetLevel)} (${rec.priority} priority, est. ${money(rec.estimatedCost)})`);
  else if (getOverstocked([p]).length) lines.push(`- **Recommendation:** overstocked. Hold off on reordering; suggested level is about ${fmtNum(targetLevel(p))} units.`);
  else lines.push('- **Recommendation:** stock level is healthy, no action needed.');
  return lines.join('\n');
}

const restockMapOf = (items, currency) => new Map(buildRestock(items, currency).recommendations.map((r) => [items.find((p) => p.sku === r.sku)?.id, r]));

function answerLow(items, currency) {
  const low = items.filter((p) => p.status === 'low_stock').sort((a, b) => a.quantity / (a.threshold || 1) - b.quantity / (b.threshold || 1));
  const outCount = items.filter((p) => p.status === 'out_of_stock').length;
  if (!low.length) return `No products are currently low on stock.${outCount ? ` However, **${outCount}** ${outCount === 1 ? 'product is' : 'products are'} out of stock. Ask "Which products are out of stock?" for details.` : ' Everything is above its threshold.'}`;
  const out = [`**${low.length} ${low.length === 1 ? 'product is' : 'products are'} running low:**`];
  out.push(...limitList(low, (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} left, threshold ${fmtNum(p.threshold)}, short by ${fmtNum(p.threshold - p.quantity)} units`));
  if (outCount) out.push('', `Also **${outCount}** out of stock. Ask "Which products should I restock?" for suggested order quantities.`);
  else out.push('', 'Ask "Which products should I restock?" for suggested order quantities.');
  return out.join('\n');
}

function answerOut(items) {
  const out = items.filter((p) => p.status === 'out_of_stock').sort((a, b) => a.name.localeCompare(b.name));
  if (!out.length) return 'Good news: no products are out of stock right now.';
  return [`**${out.length} ${out.length === 1 ? 'product is' : 'products are'} out of stock:**`, ...limitList(out, (p) => `- ${p.name} (${p.sku})${p.supplier ? ` - supplier: ${p.supplier}` : ''}`), '', 'Ask "Which products should I restock?" for suggested order quantities.'].join('\n');
}

function answerRestock(items, currency) {
  const money = makeMoney(currency);
  const { recommendations: recs, totals } = buildRestock(items, currency);
  if (!recs.length) return 'Nothing needs restocking right now. No product is at or below its threshold, and none is projected to run out within a week.';
  const lines = [`**Restock ${recs.length} ${recs.length === 1 ? 'product' : 'products'}** (${fmtNum(totals.units)} units, about ${money(totals.estimatedCost)}):`];
  lines.push(...limitList(recs, (r) => `- **${r.priority}**: ${r.productName} (${r.sku}) - have ${fmtNum(r.quantity)}, order **${fmtNum(r.suggestedReorderQty)}** to reach ${fmtNum(r.targetLevel)}${r.supplier ? ` from ${r.supplier}` : ''}`, 10));
  lines.push('', 'Quantities aim for twice the low stock threshold, or 30 days of usage when stock-outs have been recorded.');
  return lines.join('\n');
}

function answerValue(items, currency) {
  const money = makeMoney(currency);
  const s = computeStats(items);
  const lines = [
    `Your total inventory value is **${money(s.inventoryValue)}** at cost price, across ${fmtNum(s.totalUnits)} units in ${fmtNum(s.totalProducts)} products.`,
    `- At selling prices the stock is worth ${money(s.retailValue)}, a potential gross margin of ${money(s.retailValue - s.inventoryValue)}.`,
  ];
  const cats = categoryBreakdown(items).slice(0, 5);
  if (cats.length > 1 && s.inventoryValue > 0) {
    lines.push('', '**By category:**', ...cats.map((c) => `- ${c.category}: ${money(c.value)} (${Math.round((c.value / s.inventoryValue) * 100)}%)`));
  }
  return lines.join('\n');
}

function answerTopValue(items, currency) {
  const money = makeMoney(currency);
  const top = [...items].sort((a, b) => b.value - a.value).slice(0, 5);
  return ['**Your most valuable products by stock value (cost):**', ...top.map((p, i) => `- ${i + 1}. ${p.name} (${p.sku}): ${money(p.value)} - ${fmtNum(p.quantity)} units at ${money(p.cost)}`)].join('\n');
}

function answerMargin(items, currency) {
  const money = makeMoney(currency);
  const s = computeStats(items);
  const marginPct = s.retailValue > 0 ? Math.round(((s.retailValue - s.inventoryValue) / s.retailValue) * 100) : 0;
  const lines = [`Potential gross margin on current stock is **${money(s.retailValue - s.inventoryValue)}** (${marginPct}% of retail value).`];
  const below = items.filter((p) => p.price < p.cost);
  const best = items.filter((p) => p.price > 0).sort((a, b) => (b.price - b.cost) / b.price - (a.price - a.cost) / a.price).slice(0, 3);
  if (best.length) lines.push(`- Best margins: ${best.map((p) => `${p.name} (${Math.round(((p.price - p.cost) / p.price) * 100)}%)`).join(', ')}`);
  if (below.length) lines.push(`- **Selling below cost:** ${below.slice(0, 5).map((p) => p.name).join(', ')}${below.length > 5 ? ` and ${below.length - 5} more` : ''}`);
  return lines.join('\n');
}

function answerCount(items) {
  const s = computeStats(items);
  const cats = new Set(items.map((p) => p.category)).size;
  return `You have **${fmtNum(s.totalProducts)} products** in ${cats} ${cats === 1 ? 'category' : 'categories'}, with **${fmtNum(s.totalUnits)} units** in total. ${s.inStock} in stock, ${s.lowStock} low, ${s.outOfStock} out of stock.`;
}

function answerRecent(recent) {
  if (!recent.length) return 'No stock movements have been recorded yet. Use the Inventory page to record stock in, stock out or adjustments.';
  const label = { IN: 'Stock in', OUT: 'Stock out', ADJUSTMENT: 'Adjustment' };
  return ['**Most recent stock movements:**', ...recent.map((m) => `- ${fmtDate(m.createdAt)}: ${label[m.type]} ${fmtNum(m.quantity)} of ${m.productName} (${fmtNum(m.previousQuantity)} → ${fmtNum(m.newQuantity)})${m.reason ? ` - ${m.reason}` : ''}`)].join('\n');
}

function answerCategory(name, items, currency) {
  const money = makeMoney(currency);
  const list = items.filter((p) => p.category === name);
  const s = computeStats(list);
  return [
    `**${name}:** ${list.length} ${list.length === 1 ? 'product' : 'products'}, ${fmtNum(s.totalUnits)} units, worth ${money(s.inventoryValue)} at cost.`,
    `- ${s.inStock} in stock, ${s.lowStock} low, ${s.outOfStock} out of stock`,
    ...limitList([...list].sort((a, b) => b.value - a.value), (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} units - ${STATUS_LABEL[p.status]}`),
  ].join('\n');
}

function answerSupplier(name, items) {
  const list = items.filter((p) => p.supplier === name);
  const need = list.filter((p) => p.status !== 'in_stock').length;
  return [
    `**${name}** supplies ${list.length} ${list.length === 1 ? 'product' : 'products'}${need ? `, ${need} of which need attention` : ''}:`,
    ...limitList(list, (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} units - ${STATUS_LABEL[p.status]}`),
  ].join('\n');
}

function answerCategories(items, currency) {
  const money = makeMoney(currency);
  return ['**Categories by stock value:**', ...limitList(categoryBreakdown(items), (c) => `- ${c.category}: ${c.products} products, ${fmtNum(c.units)} units, ${money(c.value)}`, 12)].join('\n');
}

function answerSuppliers(items) {
  const map = new Map();
  items.forEach((p) => {
    const key = p.supplier || 'No supplier set';
    const e = map.get(key) || { products: 0, attention: 0 };
    e.products += 1;
    if (p.status !== 'in_stock') e.attention += 1;
    map.set(key, e);
  });
  return ['**Suppliers:**', ...limitList([...map.entries()].sort((a, b) => b[1].attention - a[1].attention), ([name, e]) => `- ${name}: ${e.products} products${e.attention ? `, ${e.attention} low or out of stock` : ''}`, 12)].join('\n');
}

function answerSummary(items, currency) {
  const rec = buildRestock(items, currency);
  const lines = ['**Inventory summary**', ...summaryLines(items, currency), '', '**Needs attention:**', ...alertLines(items)];
  if (rec.recommendations.length) lines.push('', `Recommended: restock ${rec.recommendations.length} ${rec.recommendations.length === 1 ? 'product' : 'products'} (about ${makeMoney(currency)(rec.totals.estimatedCost)}). Ask "Which products should I restock?" for details.`);
  return lines.join('\n');
}

// ---------- router ----------
export function answerQuestion(message, items, currency = 'INR', recent = []) {
  const msg = norm(message);

  if (/^(hi|hello|hey|hii|good (morning|afternoon|evening))\b/.test(msg) || /\b(help|what can you (do|answer)|how do you work)\b/.test(msg)) {
    return { intent: 'help', reply: `Hi! I answer questions from your live inventory data. Try:\n${CAPABILITIES.join('\n')}` };
  }
  if (items.length === 0) {
    return { intent: 'empty', reply: 'Your inventory is empty, so there is nothing to analyse yet. Add a category and some products first, then ask me again.' };
  }

  const products = findProducts(msg, items);
  if (products.length) {
    const map = restockMapOf(items, currency);
    return { intent: 'product', reply: products.map((p) => productDetail(p, currency, map)).join('\n\n') };
  }
  const category = findByField(msg, items, 'category');
  if (category) return { intent: 'category', reply: answerCategory(category, items, currency) };
  const supplier = findByField(msg, items, 'supplier');
  if (supplier) return { intent: 'supplier', reply: answerSupplier(supplier, items) };

  const rules = [
    ['top-value', /(most|highest|top|biggest|largest|best).*(valu|expensive|worth)|expensive/, () => answerTopValue(items, currency)],
    ['restock', /restock|re-?order|replenish|order more|what should i (buy|order|purchase)|need to (buy|order)/, () => answerRestock(items, currency)],
    ['out-of-stock', /out of stock|stock-?out|zero stock|no stock|sold out|unavailable/, () => answerOut(items)],
    ['low-stock', /\blow\b|low.?stock|running (low|short|out)|(will|about to|going to) run out|almost (out|gone)|below|threshold|shortage|critical/, () => answerLow(items, currency)],
    ['overstock', /overstock|over-stock|excess|surplus|too much|too many|dead stock|slow.?mov|idle|not selling/, () => {
      const over = overstockLines(items, currency).lines;
      const slow = getSlowMovers(items);
      const out = ['**Overstocked products:**', ...over];
      if (slow.length) out.push('', '**Slow-moving (no stock-out in 60 days):**', ...limitList(slow, (p) => `- ${p.name} (${p.sku}): ${fmtNum(p.quantity)} units, ${makeMoney(currency)(p.value)}`));
      return out.join('\n');
    }],
    ['margin', /profit|margin|markup/, () => answerMargin(items, currency)],
    ['value', /\bvalue\b|valuation|worth|how much.*(inventory|stock)|total cost|asset/, () => answerValue(items, currency)],
    ['count', /how many (products|items|skus|units|categories)|number of (products|items|units)|total (products|items|units|stock)/, () => answerCount(items)],
    ['recent', /recent|latest|history|movement|activity|last (stock|change|update)|what changed/, () => answerRecent(recent)],
    ['summary', /summar|overview|status|report|health|how (is|are).*(inventory|stock|things)|big picture/, () => answerSummary(items, currency)],
    ['categories', /categor/, () => answerCategories(items, currency)],
    ['suppliers', /supplier|vendor/, () => answerSuppliers(items)],
  ];
  const hit = rules.find(([, rx]) => rx.test(msg));
  if (hit) return { intent: hit[0], reply: hit[2]() };

  return {
    intent: 'unknown',
    reply: `I could not match that to your inventory data, and I don't guess. I can help with questions like:\n${CAPABILITIES.join('\n')}`,
  };
}
