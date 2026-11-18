import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshots keep history readable even after a product is deleted.
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ user: 1, createdAt: -1 });
stockMovementSchema.index({ user: 1, product: 1, createdAt: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);
