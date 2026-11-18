import ApiError from '../utils/ApiError.js';
import { answerQuestion, loadRecentMovements } from './chatEngine.js';
import { buildAnalysis, buildRestock, loadInventory } from './insightEngine.js';

/**
 * "AI" features powered by a rule-based, data-driven engine. It needs no API keys, billing or
 * external services. Every function reads only the signed-in user's own products and movements.
 */
export const ENGINE_NAME = 'rule-based';
export const isAiConfigured = () => true;

export async function analyzeInventory(user) {
  const { items, currency } = await loadInventory(user);
  if (items.length === 0) throw new ApiError(400, 'Add some products first. There is no inventory to analyse yet.');
  return buildAnalysis(items, currency);
}

export async function recommendRestock(user) {
  const { items, currency } = await loadInventory(user);
  return buildRestock(items, currency);
}

export async function chat(user, message) {
  const [{ items, currency }, recent] = await Promise.all([loadInventory(user), loadRecentMovements(user._id)]);
  const { reply, intent } = answerQuestion(message, items, currency, recent);
  return { reply, intent };
}
