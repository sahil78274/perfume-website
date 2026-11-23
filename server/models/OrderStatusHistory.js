'use strict';
const mongoose = require('mongoose');

const orderStatusHistorySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    status: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }, // null = system
    changedByName: { type: String, trim: true, maxlength: 80, default: 'System' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

orderStatusHistorySchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('OrderStatusHistory', orderStatusHistorySchema);
