'use strict';
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: 'Home' },
    fullName: { type: String, trim: true, required: true, maxlength: 80 },
    phone: { type: String, required: true, match: [/^[6-9]\d{9}$/, 'Invalid Indian mobile number'] },
    houseAndStreet: { type: String, trim: true, required: true, maxlength: 200 },
    area: { type: String, trim: true, required: true, maxlength: 120 },
    city: { type: String, trim: true, required: true, maxlength: 80 },
    state: { type: String, trim: true, required: true, maxlength: 80 },
    pincode: { type: String, required: true, match: [/^[1-9]\d{5}$/, 'Invalid 6-digit PIN code'] },
    landmark: { type: String, trim: true, maxlength: 120, default: '' },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, index: true, match: [/^[6-9]\d{9}$/, 'Invalid Indian mobile number'] },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, unique: true, sparse: true, default: undefined },
    passwordHash: { type: String, required: true },
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Address' }],
    promoConsent: { type: Boolean, default: false },
    promoConsentAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
