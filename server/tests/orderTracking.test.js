'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Order } = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const SupplierDetails = require('../models/SupplierDetails');
const Product = require('../models/Product');
const adminOrdersController = require('../controllers/admin/ordersController');
const { adminOrder } = require('../utils/serializers');
const controller = require('../controllers/orderController');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('tracking validates phone, normalizes +91, returns all matching orders through a safe serializer', async () => {
  const original = {
    orderFind: Order.find,
    itemFind: OrderItem.find,
    historyFind: OrderStatusHistory.find,
    supplierFind: SupplierDetails.find
  };
  let filter;
  let itemQuery;
  let historyQuery;
  let supplierQuery;
  const orderRows = [
    { _id: 'new-order', orderNumber: 'SC-261123-0002', status: 'Shipped', paymentMethod: 'COD', total: 899, createdAt: new Date('2026-11-23T10:00:00Z'), contact: { phone: '9876543210' }, shippingAddress: { houseAndStreet: 'private address' }, adminNotes: [{ text: 'private note' }] },
    { _id: 'old-order', orderNumber: 'SC-261122-0001', status: 'Delivered', paymentMethod: 'COD', total: 399, createdAt: new Date('2026-11-22T10:00:00Z') }
  ];
  try {
    Order.find = (query) => {
      filter = query;
      return {
        select(fields) { assert.equal(fields, 'orderNumber status paymentMethod total createdAt'); return this; },
        sort(spec) { assert.deepEqual(spec, { createdAt: -1 }); return this; },
        lean: async () => orderRows
      };
    };
    OrderItem.find = (query) => {
      itemQuery = query;
      return { select(fields) { assert.equal(fields, 'order name image qty'); return this; }, lean: async () => [
        { order: 'new-order', name: 'Amber Oud', image: '/images/products/amber.jpg', qty: 2, supplierCost: 10 },
        { order: 'old-order', name: 'Rose Mist', image: '/images/products/rose.jpg', qty: 1 }
      ] };
    };
    OrderStatusHistory.find = (query) => {
      historyQuery = query;
      return { select(fields) { assert.equal(fields, 'order status createdAt'); return this; }, sort(spec) { assert.deepEqual(spec, { createdAt: 1 }); return this; }, lean: async () => [
        { order: 'new-order', status: 'New Order', createdAt: new Date('2026-11-23T09:00:00Z'), note: 'internal note', changedByName: 'Admin' },
        { order: 'new-order', status: 'Shipped', createdAt: new Date('2026-11-23T10:00:00Z') }
      ] };
    };
    SupplierDetails.find = (query) => {
      supplierQuery = query;
      return { select(fields) { assert.equal(fields, 'order trackingRef'); return this; }, lean: async () => [
        { order: 'new-order', trackingRef: 'TRACK-123', supplierPurchaseCost: 999, fulfilmentNotes: 'internal supplier note' }
      ] };
    };

    const res = responseRecorder();
    await controller.track({ body: { phone: '+91 9876543210' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.deepEqual(filter, { 'contact.phone': '9876543210' });
    assert.deepEqual(itemQuery, { order: { $in: ['new-order', 'old-order'] } });
    assert.deepEqual(historyQuery, itemQuery);
    assert.deepEqual(supplierQuery, itemQuery);
    assert.equal(res.body.orders.length, 2);
    assert.equal(res.body.orders[0].orderNumber, 'SC-261123-0002');
    assert.equal(res.body.orders[0].items[0].qty, 2);
    assert.deepEqual(res.body.orders[0].timeline.map((step) => step.status), ['New Order', 'Shipped']);
    assert.deepEqual(res.body.orders[0].trackingInfo, { reference: 'TRACK-123' });
    for (const order of res.body.orders) {
      assert.deepEqual(Object.keys(order).sort(), ['createdAt', 'items', 'orderNumber', 'paymentMethod', 'status', 'timeline', 'total', 'trackingInfo'].sort());
      assert.equal('contact' in order, false);
      assert.equal('shippingAddress' in order, false);
      assert.equal('adminNotes' in order, false);
      assert.equal('supplierPurchaseCost' in order, false);
      assert.equal('notes' in (order.timeline[0] || {}), false);
    }
  } finally {
    Order.find = original.orderFind;
    OrderItem.find = original.itemFind;
    OrderStatusHistory.find = original.historyFind;
    SupplierDetails.find = original.supplierFind;
  }
});

test('tracking rejects invalid mobile numbers before querying orders', async () => {
  const originalFind = Order.find;
  Order.find = () => { throw new Error('database should not be queried for invalid phone'); };
  try {
    const res = responseRecorder();
    await controller.track({ body: { phone: '1234567890' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /10-digit/);
  } finally {
    Order.find = originalFind;
  }
});

test('tracking returns an empty orders array for a valid number with no matches', async () => {
  const originalFind = Order.find;
  Order.find = () => ({ select() { return this; }, sort() { return this; }, lean: async () => [] });
  try {
    const res = responseRecorder();
    await controller.track({ body: { phone: '9876543210' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { orders: [] });
  } finally {
    Order.find = originalFind;
  }
});

test('admin order items expose saved photos and fall back to live product photos for legacy one- and multi-item orders', async () => {
  const originalFind = Product.find;
  const savedImage = '/images/orders/photo-at-purchase.jpg';
  Product.find = (filter) => {
    assert.deepEqual(filter._id.$in, [...new Set(filter._id.$in)]);
    assert.ok(filter._id.$in.every((id) => ['legacy-one', 'legacy-two'].includes(id)));
    return {
      select(fields) { assert.equal(fields, 'images'); return this; },
      lean: async () => [
        { _id: 'legacy-one', images: [{ url: 'https://cdn.example.com/one.jpg' }] },
        { _id: 'legacy-two', images: [{ url: '/images/products/two.jpg' }, { url: '/images/products/two-alt.jpg' }] }
      ]
    };
  };
  try {
    const base = (product, image, name, _id) => ({
      _id, product, image, name, qty: 1, unitPrice: 199, lineTotal: 199, supplierCost: null
    });
    const oneItem = await adminOrdersController.resolveOrderItemImages([
      base('legacy-one', '', 'Single fragrance', 'item-1')
    ]);
    assert.equal(oneItem.length, 1);
    assert.equal(oneItem[0].image, 'https://cdn.example.com/one.jpg');

    const multipleItems = await adminOrdersController.resolveOrderItemImages([
      base('saved', savedImage, 'Snapshot fragrance', 'item-2'),
      base('legacy-one', '', 'Legacy fragrance one', 'item-3'),
      base('legacy-two', '', 'Legacy fragrance two', 'item-4'),
      base(null, '', 'Deleted product', 'item-5')
    ]);
    const order = {
      _id: 'order-2', orderNumber: 'SC-261123-0002', contact: {}, shippingAddress: {},
      total: 796, status: 'New Order', paymentMethod: 'COD', itemsCount: 4
    };
    const response = adminOrder(order, multipleItems, [], null, [], null);
    assert.equal(response.items.length, 4);
    assert.deepEqual(response.items.map((item) => item.image), [
      savedImage,
      'https://cdn.example.com/one.jpg',
      '/images/products/two.jpg',
      ''
    ]);
    assert.deepEqual(response.items.map((item) => item.qty), [1, 1, 1, 1]);
    assert.deepEqual(response.items.map((item) => item.unitPrice), [199, 199, 199, 199]);
  } finally {
    Product.find = originalFind;
  }
});
