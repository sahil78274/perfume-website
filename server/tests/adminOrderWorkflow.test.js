'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Order } = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const SupplierDetails = require('../models/SupplierDetails');
const { Expense } = require('../models/Expense');
const ordersController = require('../controllers/admin/ordersController');
const { createApp } = require('../app');

const fakeQuery = (result) => ({
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => result,
  then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
});

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test('admin order list supplies saved customer and line items for Click-to-Chat drafts', async () => {
  const originals = { count: Order.countDocuments, find: Order.find, items: OrderItem.find };
  const order = {
    _id: 'o-1', orderNumber: 'SC-261123-0001', isGuest: true,
    contact: { name: 'Asha Sharma', phone: '9876543210', email: '' },
    total: 1498, itemsCount: 3, status: 'Pending Confirmation', paymentMethod: 'COD',
    createdAt: new Date('2026-11-23T12:00:00Z')
  };
  try {
    Order.countDocuments = async () => 1;
    Order.find = () => fakeQuery([order]);
    OrderItem.find = (filter) => {
      assert.deepEqual(filter, { order: { $in: ['o-1'] } });
      return { select(fields) { assert.equal(fields, 'order name qty'); return this; }, lean: async () => [
        { order: 'o-1', name: 'Amber Oud', qty: 2 },
        { order: 'o-1', name: 'Rose Mist', qty: 1 }
      ] };
    };
    const res = responseRecorder();
    await ordersController.list({ query: {} }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.orders[0].phone, '9876543210');
    assert.deepEqual(res.body.orders[0].items, [
      { name: 'Amber Oud', qty: 2 },
      { name: 'Rose Mist', qty: 1 }
    ]);
  } finally {
    Order.countDocuments = originals.count;
    Order.find = originals.find;
    OrderItem.find = originals.items;
  }
});

test('admin can persist workflow transitions and each status change creates history', async () => {
  const originals = {
    orderFindOne: Order.findOne,
    itemFind: OrderItem.find,
    historyFind: OrderStatusHistory.find,
    historyCreate: OrderStatusHistory.create,
    supplierFindOne: SupplierDetails.findOne,
    expenseFind: Expense.find
  };
  const history = [];
  const order = {
    _id: 'order-id',
    orderNumber: 'SC-261123-0001',
    isGuest: true,
    contact: { name: 'Sample Customer', phone: '9876543210', email: '' },
    shippingAddress: {},
    total: 500,
    itemsSubtotal: 500,
    shippingCharge: 0,
    itemsCount: 1,
    status: 'Pending Confirmation',
    paymentMethod: 'COD',
    stockRestored: false,
    adminNotes: [],
    save: async function save() { this.saveCount = (this.saveCount || 0) + 1; }
  };
  try {
    Order.findOne = async () => order;
    OrderItem.find = () => fakeQuery([]);
    OrderStatusHistory.find = () => fakeQuery(history);
    OrderStatusHistory.create = async (entry) => { history.push({ ...entry, _id: `h${history.length + 1}`, createdAt: new Date() }); };
    SupplierDetails.findOne = async () => null;
    Expense.find = () => fakeQuery([]);

    for (const status of ['Confirmed', 'Cancelled']) {
      const res = responseRecorder();
      await ordersController.updateStatus({
        body: { status, note: `manual ${status}` },
        params: { id: order.orderNumber },
        admin: { _id: 'admin-id', name: 'Store Admin' }
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.order.status, status);
      assert.equal(order.status, status);
    }
    assert.deepEqual(history.map((entry) => entry.status), ['Confirmed', 'Cancelled']);
    assert.deepEqual(history.map((entry) => entry.changedByName), ['Store Admin', 'Store Admin']);
    assert.equal(order.cancelledAt instanceof Date, true);
    assert.ok(order.saveCount >= 3, 'status and cancellation stock state are saved');
    // A fresh lookup sees the same persisted status in this database-mocked controller test.
    assert.equal((await Order.findOne({ orderNumber: order.orderNumber })).status, 'Cancelled');
  } finally {
    Order.findOne = originals.orderFindOne;
    OrderItem.find = originals.itemFind;
    OrderStatusHistory.find = originals.historyFind;
    OrderStatusHistory.create = originals.historyCreate;
    SupplierDetails.findOne = originals.supplierFindOne;
    Expense.find = originals.expenseFind;
  }
});

test('admin order API requires an authenticated admin before returning contact data', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/orders`);
    assert.equal(response.status, 401);
    const data = await response.json();
    assert.match(data.error, /Admin authentication required/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
