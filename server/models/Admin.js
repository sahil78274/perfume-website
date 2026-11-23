'use strict';
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true, index: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin'], default: 'admin' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
