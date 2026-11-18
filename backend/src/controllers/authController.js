import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { pick } from '../utils/helpers.js';

const signToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
const send = (res, status, user) => res.status(status).json({ success: true, token: signToken(user._id), user });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, businessName } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  const user = await User.create({ name, email, password, businessName });
  send(res, 201, user);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(String(password)))) throw new ApiError(401, 'Invalid email or password');
  send(res, 200, user);
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = pick(req.body, ['name', 'businessName', 'currency', 'defaultLowStockThreshold']);
  Object.assign(req.user, updates);
  await req.user.save();
  res.json({ success: true, user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Current and new password are required');
  if (String(newPassword).length < 8) throw new ApiError(400, 'New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(String(currentPassword)))) throw new ApiError(401, 'Current password is incorrect');
  user.password = String(newPassword);
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});
