'use strict';
const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' }, // Cloudinary public_id; '' for repo-static images
    alt: { type: String, trim: true, maxlength: 160, default: '' }
  },
  { _id: true }
);

const specSchema = new mongoose.Schema(
  { label: { type: String, trim: true, maxlength: 60 }, value: { type: String, trim: true, maxlength: 200 } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 140 },
    slug: { type: String, trim: true, required: true, unique: true, lowercase: true, index: true, maxlength: 160 },
    sku: { type: String, trim: true, required: true, unique: true, maxlength: 60 },
    shortDescription: { type: String, trim: true, maxlength: 240, default: '' },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    /** Optional second-level label within a category (e.g. "Trousers" under "Men's Fashion"). */
    subcategory: { type: String, trim: true, maxlength: 60, default: '' },
    price: { type: Number, required: true, min: 0, max: 100000000 },
    compareAtPrice: { type: Number, min: 0, default: null },
    /** ADMIN ONLY — never serialized to public API consumers */
    supplierCost: { type: Number, min: 0, default: null, select: false },
    images: { type: [productImageSchema], validate: [(v) => Array.isArray(v) && v.length <= 12, 'Max 12 images per product'] },
    stock: { type: Number, required: true, min: 0, max: 1000000, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    featured: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    specs: { type: [specSchema], default: [] },
    lowStockThreshold: { type: Number, min: 0, default: null } // null → use store setting
  },
  { timestamps: true }
);

productSchema.index({ status: 1, featured: -1, createdAt: -1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
