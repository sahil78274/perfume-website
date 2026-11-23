'use strict';
const mongoose = require('mongoose');
const { Order, NON_REVENUE_STATUSES } = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const SupplierDetails = require('../../models/SupplierDetails');
const { Expense } = require('../../models/Expense');
const Product = require('../../models/Product');
const User = require('../../models/User');
const StoreSettings = require('../../models/StoreSettings');
const { round2 } = require('../../utils/pricing');
const { cleanText } = require('../../utils/validators');

function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const err = new Error('Invalid date range.'); err.status = 400; throw err;
  }
  const end = new Date(to); end.setHours(23, 59, 59, 999);
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  if (start > end) { const err = new Error('"from" must be before "to".'); err.status = 400; throw err; }
  return { start, end };
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildDailySeries(start, end, orders) {
  const map = new Map();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    map.set(dayKey(d), { date: dayKey(d), orders: 0, sales: 0, deliveredRevenue: 0 });
  }
  for (const o of orders) {
    const key = dayKey(o.createdAt);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (!NON_REVENUE_STATUSES.includes(o.status)) bucket.sales = round2(bucket.sales + o.total);
    if (o.status === 'Delivered') bucket.deliveredRevenue = round2(bucket.deliveredRevenue + o.total);
  }
  return [...map.values()];
}

/** GET /api/admin/dashboard?from&to */
async function dashboard(req, res, next) {
  try {
    const { start, end } = parseRange(req.query);
    const createdAt = { $gte: start, $lte: end };
    const settings = await StoreSettings.getSettings();

    const [
      statusCounts,
      revenueAgg,
      deliveredAgg,
      pendingCodAgg,
      ordersInRange,
      totalCustomers,
      lowStockProducts,
      outOfStock,
      expensesInRange,
      recentOrders
    ] = await Promise.all([
      Order.aggregate([{ $match: { createdAt } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt, status: { $nin: NON_REVENUE_STATUSES } } },
        { $group: { _id: null, sales: { $sum: '$total' }, orders: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { createdAt, status: 'Delivered' } },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { createdAt, status: { $in: ['Pending Confirmation', 'New Order', 'Confirmed', 'Processing', 'Supplier Order Placed', 'Shipped', 'Out for Delivery'] } } },
        { $group: { _id: null, value: { $sum: '$total' }, orders: { $sum: 1 } } }
      ]),
      Order.find({ createdAt }).select('_id total itemsSubtotal status createdAt').lean(),
      User.countDocuments({}),
      Product.find({ status: 'active', $or: [{ stock: { $lte: settings.lowStockThreshold } }, { lowStockThreshold: { $ne: null } }] })
        .select('name slug stock sku lowStockThreshold').sort({ stock: 1 }).lean(),
      Product.countDocuments({ status: 'active', stock: 0 }),
      Expense.aggregate([{ $match: { expenseDate: createdAt } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Order.find({}).sort({ createdAt: -1 }).limit(8).select('orderNumber contact.name contact.phone total status createdAt isGuest').lean()
    ]);

    // Profit estimate: best-known product cost per order (supplier entry, else item snapshot)
    const orderIds = ordersInRange.map((o) => o._id);
    const [supplierCosts, itemCosts] = await Promise.all([
      SupplierDetails.aggregate([
        { $match: { order: { $in: orderIds }, supplierPurchaseCost: { $ne: null } } },
        { $group: { _id: '$order', cost: { $sum: '$supplierPurchaseCost' } } }
      ]),
      OrderItem.aggregate([
        { $match: { order: { $in: orderIds }, supplierCost: { $ne: null } } },
        { $group: { _id: '$order', cost: { $sum: { $multiply: ['$supplierCost', '$qty'] } } } }
      ])
    ]);
    const supplierCostMap = new Map(supplierCosts.map((s) => [String(s._id), s.cost]));
    const itemCostMap = new Map(itemCosts.map((s) => [String(s._id), s.cost]));

    const orderExpenses = await Expense.aggregate([
      { $match: { order: { $in: orderIds } } },
      { $group: { _id: '$order', total: { $sum: '$amount' } } }
    ]);
    const orderExpenseMap = new Map(orderExpenses.map((e) => [String(e._id), e.total]));

    // Orders whose merchandise has at least one cost data point are counted; others flagged unknown.
    let estimatedProfit = 0, deliveredProfit = 0, knownCostOrders = 0, unknownCostOrders = 0;
    for (const o of ordersInRange) {
      if (NON_REVENUE_STATUSES.includes(o.status)) continue;
      const id = String(o._id);
      const cost = supplierCostMap.has(id) ? supplierCostMap.get(id) : itemCostMap.get(id);
      if (cost === undefined) { unknownCostOrders += 1; continue; }
      knownCostOrders += 1;
      const margin = round2(o.itemsSubtotal - cost - (orderExpenseMap.get(id) || 0));
      estimatedProfit = round2(estimatedProfit + margin);
      if (o.status === 'Delivered') deliveredProfit = round2(deliveredProfit + margin);
    }

    const statusMap = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
    const totalOrders = statusCounts.reduce((a, s) => a + s.count, 0);
    const trueLowStock = lowStockProducts
      .filter((p) => p.stock <= (p.lowStockThreshold !== null && p.lowStockThreshold !== undefined ? p.lowStockThreshold : settings.lowStockThreshold))
      .slice(0, 10);
    const series = buildDailySeries(start, end, ordersInRange);

    res.json({
      range: { from: dayKey(start), to: dayKey(end) },
      stats: {
        totalOrders,
        pendingConfirmationOrders: statusMap['Pending Confirmation'] || 0,
        newOrders: statusMap['New Order'] || 0,
        confirmedOrders: statusMap['Confirmed'] || 0,
        supplierPlacedOrders: statusMap['Supplier Order Placed'] || 0,
        shippedOrders: (statusMap['Shipped'] || 0) + (statusMap['Out for Delivery'] || 0),
        deliveredOrders: statusMap['Delivered'] || 0,
        cancelledOrders: statusMap['Cancelled'] || 0,
        rtoOrders: statusMap['RTO'] || 0,
        returnedOrders: statusMap['Returned'] || 0,
        totalSales: round2(revenueAgg[0]?.sales || 0),
        deliveredRevenue: round2(deliveredAgg[0]?.revenue || 0),
        pendingCodValue: round2(pendingCodAgg[0]?.value || 0),
        pendingCodOrders: pendingCodAgg[0]?.orders || 0,
        estimatedProfit,
        deliveredProfit,
        knownCostOrders,
        unknownCostOrders,
        totalCustomers,
        lowStockCount: trueLowStock.length,
        outOfStockCount: outOfStock,
        expensesInRange: round2(expensesInRange[0]?.total || 0)
      },
      statusDistribution: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      series,
      lowStockProducts: trueLowStock.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, sku: p.sku, stock: p.stock })),
      recentOrders: recentOrders.map((o) => ({
        orderNumber: o.orderNumber, name: o.contact?.name, phone: o.contact?.phone,
        total: o.total, status: o.status || 'New Order', isGuest: o.isGuest, createdAt: o.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, parseRange };
