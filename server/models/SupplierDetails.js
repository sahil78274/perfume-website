'use strict';
const mongoose = require('mongoose');

const supplierDetailsSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    supplierName: { type: String, trim: true, maxlength: 120, default: '' },
    supplierProductRef: { type: String, trim: true, maxlength: 160, default: '' },
    supplierOrderId: { type: String, trim: true, maxlength: 120, default: '' },
    supplierPurchaseCost: { type: Number, min: 0, default: null }, // total cost paid to supplier — ADMIN ONLY
    supplierOrderDate: { type: Date, default: null },
    trackingRef: { type: String, trim: true, maxlength: 160, default: '' },
    fulfilmentNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    supplierStatus: {
      type: String,
      enum: ['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'],
      default: 'Not placed'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupplierDetails', supplierDetailsSchema);
