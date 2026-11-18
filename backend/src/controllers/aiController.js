import { ENGINE_NAME, analyzeInventory, chat, isAiConfigured, recommendRestock } from '../services/aiService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const status = asyncHandler(async (_req, res) => {
  res.json({ success: true, configured: isAiConfigured(), engine: ENGINE_NAME });
});

export const analysis = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await analyzeInventory(req.user)) });
});

export const restock = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await recommendRestock(req.user)) });
});

export const chatAssistant = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) throw new ApiError(400, 'Message is required');
  if (message.length > 1000) throw new ApiError(400, 'Message must be 1000 characters or fewer');
  res.json({ success: true, ...(await chat(req.user, message.trim())) });
});
