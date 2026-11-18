import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Category name is required'], trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    color: { type: String, match: [/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #7c3aed'], default: '#7c3aed' },
  },
  { timestamps: true }
);

// A user cannot have two categories with the same name (case-insensitive).
categorySchema.index({ user: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Category', categorySchema);
