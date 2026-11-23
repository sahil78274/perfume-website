'use strict';
const mongoose = require('mongoose');
const { Expense, EXPENSE_TYPES } = require('../../models/Expense');
const { Order } = require('../../models/Order');
const { findOrderByParam } = require('../../utils/orderParam');
const { cleanText } = require('../../utils/validators');

function publicExpense(e) {
  return {
    id: String(e._id),
    type: e.type,
    amount: e.amount,
    note: e.note,
    expenseDate: e.expenseDate,
    order: e.order ? String(e.order) : null,
    orderNumber: e.orderNumber || null
  };
}

/** GET /api/admin/expenses?from&to&type&page&limit — store-wide expense ledger */
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = {};
    if (req.query.type && EXPENSE_TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.from || req.query.to) {
      filter.expenseDate = {};
      if (req.query.from) { const d = new Date(req.query.from); if (!Number.isNaN(d.getTime())) filter.expenseDate.$gte = d; }
      if (req.query.to) { const d = new Date(req.query.to); if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); filter.expenseDate.$lte = d; } }
      if (!filter.expenseDate.$gte && !filter.expenseDate.$lte) delete filter.expenseDate;
    }
    const [total, expenses, sumAgg] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter).sort({ expenseDate: -1 }).skip((page - 1) * limit).limit(limit).populate('order', 'orderNumber').lean(),
      Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);
    res.json({
      expenses: expenses.map((e) => ({ ...publicExpense(e), orderNumber: e.order?.orderNumber || null })),
      totalAmount: Math.round((sumAgg[0]?.total || 0) * 100) / 100,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/expenses { type, amount, note, expenseDate, orderNumber? } */
async function create(req, res, next) {
  try {
    const type = cleanText(req.body.type, 20);
    if (!EXPENSE_TYPES.includes(type)) return res.status(400).json({ error: `Type must be one of: ${EXPENSE_TYPES.join(', ')}.` });
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      return res.status(400).json({ error: 'Amount must be a valid non-negative number.' });
    }
    let order = null;
    const orderNumber = cleanText(req.body.orderNumber, 40).toUpperCase();
    if (orderNumber) {
      const found = await Order.findOne({ orderNumber }).select('_id');
      if (!found) return res.status(404).json({ error: `No order found with ID ${orderNumber}.` });
      order = found._id;
    }
    let expenseDate = new Date();
    if (req.body.expenseDate) {
      const d = new Date(req.body.expenseDate);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid expense date.' });
      expenseDate = d;
    }
    const expense = await Expense.create({
      type,
      amount,
      note: cleanText(req.body.note, 400),
      expenseDate,
      createdBy: req.admin._id,
      order
    });
    res.status(201).json({ expense: publicExpense(expense) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/expenses/:id */
async function remove(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid expense id.' });
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Expense not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/orders/:id/expenses */
async function forOrder(req, res, next) {
  try {
    const order = await findOrderByParam(req.params.id).select('_id');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const expenses = await Expense.find({ order: order._id }).sort({ expenseDate: -1 }).lean();
    res.json({ expenses: expenses.map(publicExpense) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/orders/:id/expenses { type, amount, note } */
async function createForOrder(req, res, next) {
  try {
    const order = await findOrderByParam(req.params.id).select('_id');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const type = cleanText(req.body.type, 20);
    if (!EXPENSE_TYPES.includes(type)) return res.status(400).json({ error: `Type must be one of: ${EXPENSE_TYPES.join(', ')}.` });
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      return res.status(400).json({ error: 'Amount must be a valid non-negative number.' });
    }
    const expense = await Expense.create({
      type,
      amount,
      note: cleanText(req.body.note, 400),
      expenseDate: new Date(),
      createdBy: req.admin._id,
      order: order._id
    });
    res.status(201).json({ expense: publicExpense(expense) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove, forOrder, createForOrder };
