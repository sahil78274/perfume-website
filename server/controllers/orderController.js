'use strict';
const mongoose = require('mongoose');
const { Order, ORDER_STATUSES, TERMINAL_STATUSES, NON_REVENUE_STATUSES } = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const SupplierDetails = require('../models/SupplierDetails');
const { placeOrder, restoreStock } = require('../services/orderService');
const { customerOrder, trackingOrder } = require('../utils/serializers');
const { normalizePhone, normalizePincode, isValidPhone, isValidPincode, isValidEmail, cleanText, cleanMultiline } = require('../utils/validators');

const CANCELLABLE = ['Pending Confirmation', 'New Order', 'Confirmed'];

async function loadCustomerOrderView(order) {
  const [items, history] = await Promise.all([
    OrderItem.find({ order: order._id }),
    OrderStatusHistory.find({ order: order._id }).sort({ createdAt: 1 })
  ]);
  return customerOrder(order, items, history);
}

/**
 * POST /api/orders — place a COD order (guest or logged-in customer).
 * Totals are always recomputed server-side from the DB.
 */
async function create(req, res, next) {
  try {
    const body = req.body || {};
    const contact = {
      name: cleanText(body.name, 80),
      phone: normalizePhone(body.phone),
      email: cleanText(body.email, 254).toLowerCase()
    };
    const shippingAddress = {
      houseAndStreet: cleanText(body.houseAndStreet || body.house, 200),
      area: cleanText(body.area, 120),
      city: cleanText(body.city, 80),
      state: cleanText(body.state, 80),
      pincode: normalizePincode(body.pincode),
      landmark: cleanText(body.landmark, 120)
    };
    const notes = cleanMultiline(body.notes, 500);
    const idempotencyKey = cleanText(body.idempotencyKey, 80) || null;

    const problems = [];
    if (!contact.name || contact.name.length < 2) problems.push('Please enter your full name.');
    if (!isValidPhone(contact.phone)) problems.push('Please enter a valid Indian 10-digit mobile number.');
    if (contact.email && !isValidEmail(contact.email)) problems.push('Please enter a valid email address (or leave it blank).');
    for (const [key, label] of [['houseAndStreet', 'House number and street'], ['area', 'Area / locality'], ['city', 'City'], ['state', 'State']]) {
      if (!shippingAddress[key] || shippingAddress[key].length < 2) problems.push(`${label} is required.`);
    }
    if (!isValidPincode(shippingAddress.pincode)) problems.push('Please enter a valid 6-digit PIN code.');

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) problems.push('Your cart is empty.');
    if (rawItems.length > 30) problems.push('Too many distinct items in one order.');
    const items = [];
    for (const raw of rawItems) {
      const productId = String(raw.productId || raw.id || '');
      const qty = Math.floor(Number(raw.qty));
      if (!mongoose.isValidObjectId(productId)) {
        problems.push('Invalid product in cart.');
        continue;
      }
      if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
        problems.push('Each item quantity must be between 1 and 20.');
        continue;
      }
      items.push({ productId, qty });
    }
    if (problems.length) return res.status(400).json({ error: problems[0], errors: problems });

    const { order, items: orderItems, duplicate } = await placeOrder({
      customer: req.customer || null,
      input: { contact, shippingAddress, notes, items, idempotencyKey }
    });

    res.status(duplicate ? 200 : 201).json({
      duplicate,
      order: {
        orderNumber: order.orderNumber,
        total: order.total,
        itemsSubtotal: order.itemsSubtotal,
        shippingCharge: order.shippingCharge,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt
      },
      message: duplicate
        ? 'This order was already placed. We kept your original order — no duplicate was created.'
        : 'Order placed successfully. Awaiting manual order confirmation.'
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/orders/track — list a customer's orders using their normalized Indian mobile number. */
async function track(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const phone = normalizePhone(req.body && req.body.phone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
    }

    // Checkout stores normalized numbers; exact matching uses the indexed phone field.
    const orders = await Order.find({ 'contact.phone': phone })
      .select('orderNumber status paymentMethod total createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) return res.json({ orders: [] });

    const orderIds = orders.map((order) => order._id);
    const [items, history, suppliers] = await Promise.all([
      OrderItem.find({ order: { $in: orderIds } }).select('order name image qty').lean(),
      OrderStatusHistory.find({ order: { $in: orderIds } })
        .select('order status createdAt')
        .sort({ createdAt: 1 })
        .lean(),
      SupplierDetails.find({ order: { $in: orderIds } }).select('order trackingRef').lean()
    ]);

    const groupByOrder = (rows) => rows.reduce((groups, row) => {
      const key = String(row.order);
      (groups[key] ||= []).push(row);
      return groups;
    }, {});
    const itemsByOrder = groupByOrder(items);
    const historyByOrder = groupByOrder(history);
    const trackingByOrder = new Map(suppliers.map((supplier) => [String(supplier.order), supplier.trackingRef]));

    res.json({
      orders: orders.map((order) => trackingOrder(
        order,
        itemsByOrder[String(order._id)] || [],
        historyByOrder[String(order._id)] || [],
        trackingByOrder.get(String(order._id)) || ''
      ))
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/account/orders — own orders only. */
async function myOrders(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const baseFilter = { $or: [{ user: req.customer._id }, { 'contact.phone': req.customer.phone }] };
    const [total, orders] = await Promise.all([
      Order.countDocuments(baseFilter),
      Order.find(baseFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
    ]);
    const out = [];
    for (const order of orders) {
      const items = await OrderItem.find({ order: order._id }).select('name image qty unitPrice lineTotal');
      out.push({
        orderNumber: order.orderNumber,
        status: order.status || 'New Order',
        total: order.total,
        itemsCount: order.itemsCount,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        items: items.map((i) => ({ name: i.name, image: i.image, qty: i.qty }))
      });
    }
    res.json({ orders: out, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/account/orders/:orderNumber — own orders only (404 otherwise). */
async function myOrder(req, res, next) {
  try {
    const orderNumber = cleanText(req.params.orderNumber, 40).toUpperCase();
    const order = await Order.findOne({
      orderNumber,
      $or: [{ user: req.customer._id }, { 'contact.phone': req.customer.phone }]
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order: await loadCustomerOrderView(order) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/account/orders/:orderNumber/cancel — only before fulfilment starts. */
async function cancel(req, res, next) {
  try {
    const orderNumber = cleanText(req.params.orderNumber, 40).toUpperCase();
    const order = await Order.findOne({
      orderNumber,
      $or: [{ user: req.customer._id }, { 'contact.phone': req.customer.phone }]
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!CANCELLABLE.includes(order.status)) {
      return res.status(409).json({ error: `This order can no longer be cancelled (current status: ${order.status}). Please contact support.` });
    }
    order.status = 'Cancelled';
    order.cancelledAt = new Date();
    await order.save();
    await restoreStock(order);
    await OrderStatusHistory.create({
      order: order._id,
      status: 'Cancelled',
      note: 'Cancelled by customer.',
      changedBy: null,
      changedByName: 'Customer'
    });
    res.json({ ok: true, order: await loadCustomerOrderView(order) });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, track, myOrders, myOrder, cancel, CANCELLABLE, NON_REVENUE_STATUSES, TERMINAL_STATUSES, ORDER_STATUSES };
