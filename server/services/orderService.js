'use strict';
const mongoose = require('mongoose');
const { Order } = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const Product = require('../models/Product');
const Counter = require('../models/Counter');
const StoreSettings = require('../models/StoreSettings');
const { round2 } = require('../utils/pricing');
const { sendOrderConfirmation } = require('../utils/email');

/** Generate a human-friendly unique order number: SC-YYMMDD-0001 (date-scoped counter). */
async function generateOrderNumber(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const seq = await Counter.next(`orders-${date.getFullYear()}${mm}${dd}`);
  return `SC-${yy}${mm}${dd}-${String(seq).padStart(4, '0')}`;
}

/**
 * Place a COD order.
 * - Idempotent on client-supplied idempotencyKey (retries return the original order).
 * - Prices/totals are ALWAYS recomputed from the database, never from the request body.
 * - Stock is decremented atomically per line; any failure rolls back all decrements.
 * Returns { order, items, duplicate }.
 */
async function placeOrder({ customer, input }) {
  const idempotencyKey = input.idempotencyKey || null;

  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) {
      const items = await OrderItem.find({ order: existing._id });
      return { order: existing, items, duplicate: true };
    }
  }

  // 1. Load products from DB (never trust client prices)
  const productIds = input.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).select('+supplierCost name slug sku price images stock status');
  const byId = new Map(products.map((p) => [String(p._id), p]));

  for (const line of input.items) {
    const p = byId.get(String(line.productId));
    if (!p) {
      const err = new Error('One of the products in your cart no longer exists.');
      err.status = 400;
      err.code = 'PRODUCT_NOT_FOUND';
      throw err;
    }
    if (p.status !== 'active') {
      const err = new Error(`"${p.name}" is currently unavailable.`);
      err.status = 409;
      err.code = 'PRODUCT_UNAVAILABLE';
      throw err;
    }
  }

  // 2. Atomic stock decrement per line; roll back on any failure
  const decremented = [];
  try {
    for (const line of input.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: line.productId, status: 'active', stock: { $gte: line.qty } },
        { $inc: { stock: -line.qty } },
        { new: true }
      );
      if (!updated) {
        const p = byId.get(String(line.productId));
        const err = new Error(`Insufficient stock for "${p ? p.name : 'a product'}". Please reduce the quantity.`);
        err.status = 409;
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }
      decremented.push({ productId: line.productId, qty: line.qty, product: updated });
    }
  } catch (err) {
    await rollbackStock(decremented);
    throw err;
  }

  // 3. Server-side totals
  const settings = await StoreSettings.getSettings();
  const lines = input.items.map((line) => {
    const p = byId.get(String(line.productId));
    const unitPrice = round2(p.price);
    return {
      product: p,
      qty: line.qty,
      unitPrice,
      lineTotal: round2(unitPrice * line.qty)
    };
  });
  const itemsSubtotal = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
  const shippingCharge = round2(
    settings.freeShippingAbove !== null && settings.freeShippingAbove !== undefined && itemsSubtotal >= settings.freeShippingAbove
      ? 0
      : Number(settings.shippingCharge || 0)
  );
  const total = round2(itemsSubtotal + shippingCharge);
  const itemsCount = lines.reduce((a, l) => a + l.qty, 0);

  // 4. Create order + items + history (with duplicate-key recovery for idempotency races)
  let order;
  try {
    order = await createOrderWithRetry({
      customer, input, lines, itemsSubtotal, shippingCharge, total, itemsCount, idempotencyKey
    });
  } catch (err) {
    await rollbackStock(decremented);
    if (err && err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey });
      if (existing) {
        const items = await OrderItem.find({ order: existing._id });
        return { order: existing, items, duplicate: true };
      }
    }
    throw err;
  }

  // 5. Confirmation email (best effort)
  try {
    const itemsForEmail = lines.map((l) => ({ name: l.product.name, qty: l.qty, lineTotal: l.lineTotal }));
    const emailStatus = await sendOrderConfirmation({ ...order.toObject(), items: itemsForEmail });
    order.emailStatus = emailStatus;
    await order.save();
  } catch (err) {
    console.error('[order] email step failed:', err.message);
  }

  const items = await OrderItem.find({ order: order._id });
  return { order, items, duplicate: false };
}

async function createOrderWithRetry(args, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const orderNumber = await generateOrderNumber();
    try {
      const { customer, input, lines, itemsSubtotal, shippingCharge, total, itemsCount, idempotencyKey } = args;
      const order = await Order.create({
        orderNumber,
        user: customer ? customer._id : null,
        isGuest: !customer,
        contact: {
          name: input.contact.name,
          phone: input.contact.phone,
          email: input.contact.email || ''
        },
        shippingAddress: input.shippingAddress,
        itemsSubtotal,
        shippingCharge,
        total,
        itemsCount,
        status: 'Pending Confirmation',
        paymentMethod: 'COD',
        notes: input.notes || '',
        idempotencyKey,
        emailStatus: 'pending'
      });
      await OrderItem.insertMany(
        lines.map((l) => ({
          order: order._id,
          product: l.product._id,
          name: l.product.name,
          // Snapshot the product photo with the order item so later catalog edits cannot change order history.
          image: (l.product.images || []).find((image) => image && image.url)?.url || '',
          sku: l.product.sku || '',
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          supplierCost: l.product.supplierCost ?? null
        }))
      );
      await OrderStatusHistory.create({
        order: order._id,
        status: 'Pending Confirmation',
        note: 'COD order placed; awaiting manual customer confirmation.',
        changedBy: null,
        changedByName: 'System'
      });
      return order;
    } catch (err) {
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNumber && i < attempts - 1) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique order number. Please try again.');
}

async function rollbackStock(decremented) {
  await Promise.allSettled(
    decremented.map(({ productId, qty }) =>
      Product.updateOne({ _id: productId }, { $inc: { stock: qty } })
    )
  );
}

/** Restore stock once (guarded by order.stockRestored) — used by cancel/RTO/Returned flows. */
async function restoreStock(order) {
  if (order.stockRestored) return false;
  const items = await OrderItem.find({ order: order._id });
  for (const item of items) {
    if (item.product) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } });
    }
  }
  order.stockRestored = true;
  await order.save();
  return true;
}

module.exports = { placeOrder, restoreStock, generateOrderNumber };
