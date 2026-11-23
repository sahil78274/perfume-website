'use strict';
const mongoose = require('mongoose');
const { Order, ORDER_STATUSES } = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const OrderStatusHistory = require('../../models/OrderStatusHistory');
const SupplierDetails = require('../../models/SupplierDetails');
const { Expense } = require('../../models/Expense');
const Product = require('../../models/Product');
const { findOrderByParam } = require('../../utils/orderParam');
const { adminOrder } = require('../../utils/serializers');
const { orderProfit } = require('../../services/profitService');
const { restoreStock } = require('../../services/orderService');
const { toCsv, cleanText, isValidPhone, normalizePhone } = require('../../utils/validators');

const STOCK_RESTORING = ['Cancelled', 'RTO', 'Returned'];

function buildFilter(query) {
  const filter = {};
  const search = cleanText(query.search, 80);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phone = normalizePhone(search);
    const or = [
      { orderNumber: { $regex: escaped, $options: 'i' } },
      { 'contact.name': { $regex: escaped, $options: 'i' } }
    ];
    if (/^\d{5,10}$/.test(phone)) or.push({ 'contact.phone': { $regex: '^' + phone } });
    filter.$or = or;
  }
  const status = cleanText(query.status, 40);
  if (status && ORDER_STATUSES.includes(status)) filter.status = status;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    if (!filter.createdAt.$gte && !filter.createdAt.$lte) delete filter.createdAt;
  }
  return filter;
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = buildFilter(req.query);
    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    const orderIds = orders.map((order) => order._id);
    const orderItems = orderIds.length
      ? await OrderItem.find({ order: { $in: orderIds } }).select('order name qty').lean()
      : [];
    const itemsByOrder = orderItems.reduce((grouped, item) => {
      const key = String(item.order);
      (grouped[key] ||= []).push({ name: item.name, qty: item.qty });
      return grouped;
    }, {});
    res.json({
      orders: orders.map((o) => ({
        id: String(o._id),
        orderNumber: o.orderNumber,
        isGuest: o.isGuest,
        name: o.contact.name,
        phone: o.contact.phone,
        email: o.contact.email || '',
        total: o.total,
        itemsCount: o.itemsCount,
        items: itemsByOrder[String(o._id)] || [],
        status: o.status || 'New Order',
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
}

async function resolveOrderItemImages(items) {
  const missingProductIds = [...new Set(
    items.filter((item) => !item.image && item.product).map((item) => String(item.product))
  )];
  if (!missingProductIds.length) return items;

  const products = await Product.find({ _id: { $in: missingProductIds } }).select('images').lean();
  const imageByProduct = new Map(products.map((product) => [
    String(product._id),
    product.images?.[0]?.url || ''
  ]));
  return items.map((item) => {
    const plain = typeof item.toObject === 'function' ? item.toObject() : item;
    return {
      ...plain,
      image: plain.image || imageByProduct.get(String(plain.product)) || ''
    };
  });
}

async function detail(req, res, next) {
  try {
    const order = await findOrderByParam(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const [items, history, supplier, expenses] = await Promise.all([
      OrderItem.find({ order: order._id }).select('+sku'),
      OrderStatusHistory.find({ order: order._id }).sort({ createdAt: 1 }),
      SupplierDetails.findOne({ order: order._id }),
      Expense.find({ order: order._id }).sort({ expenseDate: -1 })
    ]);
    const [itemsWithImages, profit] = await Promise.all([
      resolveOrderItemImages(items),
      orderProfit(order, items)
    ]);
    res.json({ order: adminOrder(order, itemsWithImages, history, supplier, expenses, profit) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/orders/:id/status { status, note } */
async function updateStatus(req, res, next) {
  try {
    const status = cleanText(req.body.status, 40);
    const note = cleanText(req.body.note, 500);
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid order status.' });

    const order = await findOrderByParam(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.status === status) return res.status(400).json({ error: `Order is already "${status}".` });

    const enteringRestoring = STOCK_RESTORING.includes(status) && !STOCK_RESTORING.includes(order.status);
    const leavingRestoring = !STOCK_RESTORING.includes(status) && STOCK_RESTORING.includes(order.status);

    if (enteringRestoring) {
      await restoreStock(order);
    } else if (leavingRestoring && order.stockRestored) {
      // Reinstating an order that had its stock returned: re-decrement, blocking on insufficient stock
      const items = await OrderItem.find({ order: order._id });
      for (const item of items) {
        if (!item.product) continue;
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.qty } },
          { $inc: { stock: -item.qty } },
          { new: true }
        );
        if (!updated) {
          return res.status(409).json({
            error: `Cannot move back to "${status}": insufficient stock for "${item.name}". Adjust stock or keep the order ${order.status}.`
          });
        }
      }
      order.stockRestored = false;
    }

    order.status = status;
    if (status === 'Delivered') order.deliveredAt = new Date();
    if (status === 'Cancelled') order.cancelledAt = new Date();
    await order.save();

    await OrderStatusHistory.create({
      order: order._id,
      status,
      note,
      changedBy: req.admin._id,
      changedByName: req.admin.name
    });

    const [items, history, supplier, expenses] = await Promise.all([
      OrderItem.find({ order: order._id }).select('+sku'),
      OrderStatusHistory.find({ order: order._id }).sort({ createdAt: 1 }),
      SupplierDetails.findOne({ order: order._id }),
      Expense.find({ order: order._id }).sort({ expenseDate: -1 })
    ]);
    const [itemsWithImages, profit] = await Promise.all([
      resolveOrderItemImages(items),
      orderProfit(order, items)
    ]);
    res.json({ order: adminOrder(order, itemsWithImages, history, supplier, expenses, profit) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/orders/:id/supplier — upsert manual supplier fulfilment details (admin-only). */
async function updateSupplier(req, res, next) {
  try {
    const order = await findOrderByParam(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const b = req.body || {};
    /* Partial-update semantics: only fields present in the body are written,
       so a bare { supplierStatus } PATCH never wipes the other details. */
    const data = {};
    if (b.supplierName !== undefined) data.supplierName = cleanText(b.supplierName, 120);
    if (b.supplierProductRef !== undefined) data.supplierProductRef = cleanText(b.supplierProductRef, 160);
    if (b.supplierOrderId !== undefined) data.supplierOrderId = cleanText(b.supplierOrderId, 120);
    if (b.trackingRef !== undefined) data.trackingRef = cleanText(b.trackingRef, 160);
    if (b.fulfilmentNotes !== undefined) data.fulfilmentNotes = cleanText(b.fulfilmentNotes, 2000);
    if (b.supplierPurchaseCost !== undefined && b.supplierPurchaseCost !== null && b.supplierPurchaseCost !== '') {
      const cost = Number(b.supplierPurchaseCost);
      if (!Number.isFinite(cost) || cost < 0 || cost > 100000000) {
        return res.status(400).json({ error: 'Supplier purchase cost must be a valid non-negative number.' });
      }
      data.supplierPurchaseCost = Math.round(cost * 100) / 100;
    } else if (b.supplierPurchaseCost === '' || b.supplierPurchaseCost === null) {
      data.supplierPurchaseCost = null;
    }
    if (b.supplierOrderDate !== undefined) {
      const d = b.supplierOrderDate ? new Date(b.supplierOrderDate) : null;
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid supplier order date.' });
      data.supplierOrderDate = d;
    }
    const allowedSupplierStatuses = ['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'];
    if (b.supplierStatus !== undefined) {
      if (!allowedSupplierStatuses.includes(b.supplierStatus)) return res.status(400).json({ error: 'Invalid supplier status.' });
      data.supplierStatus = b.supplierStatus;
    }

    const supplier = await SupplierDetails.findOneAndUpdate(
      { order: order._id },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ supplier });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/orders/:id/notes { text } */
async function addNote(req, res, next) {
  try {
    const text = cleanText(req.body.text, 1000);
    if (!text || text.length < 2) return res.status(400).json({ error: 'Note is too short.' });
    const order = await findOrderByParam(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    order.adminNotes.push({ text, admin: req.admin._id, adminName: req.admin.name, createdAt: new Date() });
    await order.save();
    res.status(201).json({ adminNotes: order.adminNotes.map((n) => ({ id: String(n._id), text: n.text, adminName: n.adminName, createdAt: n.createdAt })) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/orders/:id/notes/:noteId */
async function deleteNote(req, res, next) {
  try {
    const order = await findOrderByParam(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const note = order.adminNotes.id(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    note.deleteOne();
    await order.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/orders/export.csv?<same filters as list> */
async function exportCsv(req, res, next) {
  try {
    const filter = buildFilter(req.query);
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    const ids = orders.map((o) => o._id);
    const [allItems, suppliers, expenses] = await Promise.all([
      OrderItem.find({ order: { $in: ids } }).lean(),
      SupplierDetails.find({ order: { $in: ids } }).lean(),
      Expense.find({ order: { $in: ids } }).lean()
    ]);
    const itemsByOrder = new Map();
    for (const item of allItems) {
      const key = String(item.order);
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key).push(item);
    }
    const supplierByOrder = new Map(suppliers.map((s) => [String(s.order), s]));
    const expenseByOrder = new Map();
    for (const e of expenses) {
      const key = String(e.order);
      expenseByOrder.set(key, (expenseByOrder.get(key) || 0) + Number(e.amount || 0));
    }

    const headers = [
      'Order ID', 'Date', 'Status', 'Payment', 'Customer', 'Phone', 'Email',
      'House & Street', 'Area', 'City', 'State', 'PIN', 'Landmark',
      'Items', 'Qty', 'Subtotal (INR)', 'Shipping (INR)', 'Total (INR)',
      'Customer Notes', 'Supplier', 'Supplier Order ID', 'Supplier Cost (INR)', 'Supplier Status', 'Recorded Expenses (INR)'
    ];
    const rows = orders.map((o) => {
      const items = itemsByOrder.get(String(o._id)) || [];
      const supplier = supplierByOrder.get(String(o._id));
      return [
        o.orderNumber,
        new Date(o.createdAt).toISOString(),
        o.status,
        o.paymentMethod,
        o.contact.name,
        o.contact.phone,
        o.contact.email || '',
        o.shippingAddress.houseAndStreet,
        o.shippingAddress.area,
        o.shippingAddress.city,
        o.shippingAddress.state,
        o.shippingAddress.pincode,
        o.shippingAddress.landmark || '',
        items.map((i) => `${i.name} x${i.qty}`).join('; '),
        items.reduce((a, i) => a + i.qty, 0),
        o.itemsSubtotal,
        o.shippingCharge,
        o.total,
        o.notes || '',
        supplier ? supplier.supplierName : '',
        supplier ? supplier.supplierOrderId : '',
        supplier && supplier.supplierPurchaseCost !== null && supplier.supplierPurchaseCost !== undefined ? supplier.supplierPurchaseCost : '',
        supplier ? supplier.supplierStatus : '',
        (expenseByOrder.get(String(o._id)) || 0).toFixed(2)
      ];
    });
    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="scentora-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, updateStatus, updateSupplier, addNote, deleteNote, exportCsv, buildFilter, resolveOrderItemImages, STOCK_RESTORING };
