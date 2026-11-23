'use strict';
const mongoose = require('mongoose');

const EXPENSE_TYPES = ['shipping', 'cod', 'advertising', 'rto', 'other'];

const expenseSchema = new mongoose.Schema(
  {
    type: { type: String, enum: EXPENSE_TYPES, required: true, index: true },
    amount: { type: Number, required: true, min: 0, max: 100000000 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true }, // null = store-level expense
    note: { type: String, trim: true, maxlength: 400, default: '' },
    expenseDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
  },
  { timestamps: true }
);

module.exports = { Expense: mongoose.model('Expense', expenseSchema), EXPENSE_TYPES };
