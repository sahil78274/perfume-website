'use strict';
const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

addressSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model('Address', addressSchema);
