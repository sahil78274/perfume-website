'use strict';
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    name: { type: String, required: true, maxlength: 140 }, // snapshot
    image: { type: String, default: '' }, // snapshot
    sku: { type: String, default: '', select: false }, // internal — admin only
    qty: { type: Number, required: true, min: 1, max: 99 },
    unitPrice: { type: Number, required: true, min: 0 }, // selling price at purchase time
    lineTotal: { type: Number, required: true, min: 0 },
    supplierCost: { type: Number, default: null } // per-unit supplier cost snapshot — ADMIN ONLY
  },
  { timestamps: true }
);

orderItemSchema.index({ order: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
