'use strict';
const mongoose = require('mongoose');
const { Order } = require('../models/Order');

/** Admin endpoints accept either a Mongo ObjectId or a human order number (SC-XXXXXX-XXXX). */
async function findOrderByParam(param) {
  const raw = String(param || '').trim();
  if (mongoose.isValidObjectId(raw)) return Order.findById(raw);
  const orderNumber = raw.toUpperCase();
  if (!/^SC-\d{6}-\d{4}$/.test(orderNumber)) return null;
  return Order.findOne({ orderNumber });
}

module.exports = { findOrderByParam };
