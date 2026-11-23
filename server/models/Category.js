'use strict';
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 60 },
    slug: { type: String, trim: true, required: true, unique: true, lowercase: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240, default: '' },
    image: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
