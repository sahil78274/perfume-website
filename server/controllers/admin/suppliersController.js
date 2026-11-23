'use strict';
const { Order, ORDER_STATUSES } = require('../../models/Order');
const { cleanText } = require('../../utils/validators');

const SUPPLIER_STATUSES = ['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'];

/**
 * GET /api/admin/suppliers/orders?search&supplierStatus&status&page&limit
 * Flat list of every order joined with its supplier-fulfilment details — the
 * admin's Meesho control sheet. Orders with no supplier doc yet read as
 * "Not placed" so nothing ever disappears from the pipeline.
 */
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = cleanText(req.query.search, 80);
    const supplierStatus = String(req.query.supplierStatus || '');
    const orderStatus = String(req.query.status || '');

    const pipeline = [
      {
        $lookup: { from: 'supplierdetails', localField: '_id', foreignField: 'order', as: 'supplier' }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          supplierName: { $ifNull: ['$supplier.supplierName', ''] },
          supplierProductRef: { $ifNull: ['$supplier.supplierProductRef', ''] },
          supplierOrderId: { $ifNull: ['$supplier.supplierOrderId', ''] },
          supplierPurchaseCost: { $ifNull: ['$supplier.supplierPurchaseCost', null] },
          supplierOrderDate: '$supplier.supplierOrderDate',
          trackingRef: { $ifNull: ['$supplier.trackingRef', ''] },
          supplierStatus: { $ifNull: ['$supplier.supplierStatus', 'Not placed'] },
          fulfilmentNotes: { $ifNull: ['$supplier.fulfilmentNotes', ''] }
        }
      }
    ];

    if (orderStatus && ORDER_STATUSES.includes(orderStatus)) pipeline.push({ $match: { status: orderStatus } });

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: escaped, $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { orderNumber: rx },
            { 'contact.name': rx },
            { 'contact.phone': rx },
            { supplierOrderId: rx },
            { trackingRef: rx },
            { supplierName: rx }
          ]
        }
      });
    }
    if (SUPPLIER_STATUSES.includes(supplierStatus)) pipeline.push({ $match: { supplierStatus } });

    pipeline.push({
      $facet: {
        total: [{ $count: 'count' }],
        orders: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              orderNumber: 1,
              status: 1,
              total: 1,
              itemsCount: 1,
              isGuest: 1,
              createdAt: 1,
              customerName: '$contact.name',
              phone: '$contact.phone',
              supplierName: 1,
              supplierProductRef: 1,
              supplierOrderId: 1,
              supplierPurchaseCost: 1,
              supplierOrderDate: 1,
              trackingRef: 1,
              supplierStatus: 1,
              fulfilmentNotes: 1
            }
          }
        ]
      }
    });

    const [result] = await Order.aggregate(pipeline);
    const total = result?.total?.[0]?.count || 0;
    const orders = (result?.orders || []).map((o) => ({
      ...o,
      id: String(o._id),
      supplierOrderDate: o.supplierOrderDate || null
    }));

    res.json({ orders, total, page, pages: Math.ceil(total / limit), supplierStatuses: SUPPLIER_STATUSES });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, SUPPLIER_STATUSES };
