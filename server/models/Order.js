'use strict';
const mongoose = require('mongoose');

const ORDER_STATUSES = [
  'New Order',
  'Confirmed',
  'Supplier Order Placed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'RTO',
  'Returned'
];

const TERMINAL_STATUSES = ['Delivered', 'Cancelled', 'RTO', 'Returned'];
const NON_REVENUE_STATUSES = ['Cancelled', 'RTO', 'Returned'];

const adminNoteSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, required: true, maxlength: 1000 },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    adminName: { type: String, trim: true, maxlength: 80, default: 'Admin' },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    isGuest: { type: Boolean, default: false },

    contact: {
      name: { type: String, trim: true, required: true, maxlength: 80 },
      phone: { type: String, required: true, match: [/^[6-9]\d{9}$/, 'Invalid Indian mobile number'], index: true },
      email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' }
    },

    shippingAddress: {
      houseAndStreet: { type: String, trim: true, required: true, maxlength: 200 },
      area: { type: String, trim: true, required: true, maxlength: 120 },
      city: { type: String, trim: true, required: true, maxlength: 80 },
      state: { type: String, trim: true, required: true, maxlength: 80 },
      pincode: { type: String, required: true, match: [/^[1-9]\d{5}$/] },
      landmark: { type: String, trim: true, maxlength: 120, default: '' }
    },

    itemsSubtotal: { type: Number, required: true, min: 0 }, // merchandise only
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 }, // itemsSubtotal + shippingCharge
    itemsCount: { type: Number, required: true, min: 1 },

    status: { type: String, enum: ORDER_STATUSES, default: 'New Order', index: true },
    paymentMethod: { type: String, enum: ['COD'], default: 'COD' },
    notes: { type: String, trim: true, maxlength: 500, default: '' }, // customer-visible order notes

    /** ADMIN ONLY */
    adminNotes: { type: [adminNoteSchema], default: [] },

    idempotencyKey: { type: String, default: null }, // duplicate-submit protection
    stockRestored: { type: Boolean, default: false },
    emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ 'contact.phone': 1, createdAt: -1 });

module.exports = {
  Order: mongoose.model('Order', orderSchema),
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  NON_REVENUE_STATUSES
};
