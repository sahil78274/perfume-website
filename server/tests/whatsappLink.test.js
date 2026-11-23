'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Order, ORDER_STATUSES } = require('../models/Order');

test('new orders default to Pending Confirmation while legacy statuses remain valid', () => {
  assert.equal(new Order().status, 'Pending Confirmation');
  for (const status of ['Pending Confirmation', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']) {
    assert.ok(ORDER_STATUSES.includes(status), `${status} must be accepted`);
  }
  for (const status of ['New Order', 'Supplier Order Placed', 'Out for Delivery', 'RTO', 'Returned']) {
    assert.ok(ORDER_STATUSES.includes(status), `legacy status ${status} must remain accepted`);
  }
});

test('WhatsApp Click-to-Chat normalizes Indian numbers and never duplicates +91', async () => {
  const { normalizeWhatsAppPhone } = await import('../../client/src/utils/whatsapp.js');
  assert.equal(normalizeWhatsAppPhone('9876543210'), '919876543210');
  assert.equal(normalizeWhatsAppPhone('+91 98765-43210'), '919876543210');
  assert.equal(normalizeWhatsAppPhone('0091 (98765) 43210'), '919876543210');
  assert.equal(normalizeWhatsAppPhone('919876543210'), '919876543210');
  assert.equal(normalizeWhatsAppPhone('1234567890'), '');
  assert.equal(normalizeWhatsAppPhone('987654321'), '');
});

test('WhatsApp link pre-fills the requested personal COD message and only opens a draft', async () => {
  const { buildWhatsAppOrderMessage, buildWhatsAppOrderUrl } = await import('../../client/src/utils/whatsapp.js');
  const order = {
    name: 'Asha Sharma',
    phone: '+91 98765 43210',
    orderNumber: 'SC-261123-0001',
    items: [{ name: 'Amber Oud', qty: 2 }, { name: 'Rose Mist', qty: 1 }],
    total: 1498
  };
  const expected = 'Hello Asha Sharma!\n\nThank you for ordering from SCENTORA.\n\nYour order details:\nOrder ID: SC-261123-0001\nProducts: Amber Oud × 2, Rose Mist × 1\nTotal Amount: ₹1,498\nPayment: Cash on Delivery\n\nPlease confirm whether you want to proceed with this order.\n\nThank you,\nTeam SCENTORA';
  assert.equal(buildWhatsAppOrderMessage(order), expected);
  const link = new URL(buildWhatsAppOrderUrl(order));
  assert.equal(link.origin + link.pathname, 'https://wa.me/919876543210');
  assert.equal(link.searchParams.get('text'), expected);
  assert.equal(buildWhatsAppOrderUrl({ ...order, phone: '123' }), '');
});
