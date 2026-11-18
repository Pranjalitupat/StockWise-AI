import mongoose from 'mongoose';
import { deriveStatus } from '../utils/helpers.js';

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const productSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 120 },
    sku: { type: String, required: [true, 'SKU is required'], trim: true, uppercase: true, maxlength: 40 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    costPrice: { type: Number, required: [true, 'Cost price is required'], min: [0, 'Cost price cannot be negative'] },
    sellingPrice: { type: Number, required: [true, 'Selling price is required'], min: [0, 'Selling price cannot be negative'] },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 0, validate: wholeNumber },
    supplier: { type: String, trim: true, maxlength: 120, default: '' },
    lowStockThreshold: { type: Number, min: [0, 'Threshold cannot be negative'], default: 10, validate: wholeNumber },
  },
  { timestamps: true }
);

productSchema.index({ user: 1, sku: 1 }, { unique: true });
productSchema.index({ user: 1, category: 1 });

productSchema.virtual('status').get(function status() {
  return deriveStatus(this);
});

productSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Product', productSchema);
