'use strict';
const mongoose = require('mongoose');
const User = require('../../models/User');
const Address = require('../../models/Address');
const { Order } = require('../../models/Order');
const { cleanText, normalizePhone } = require('../../utils/validators');
const { round2: r2 } = require('../../utils/pricing');

const CANCELLED_RTO = ['Cancelled', 'RTO', 'Returned'];

function emptyStats() {
  return { totalOrders: 0, deliveredOrders: 0, cancelledRtoOrders: 0, deliveredSpend: 0, lastOrderAt: null };
}

async function statsForIds(userIds, phones) {
  const statsByUser = new Map(userIds.map((id) => [String(id), emptyStats()]));
  const ids = userIds.filter(Boolean);
  const orders = await Order.find({
    $or: [
      ...(ids.length ? [{ user: { $in: ids } }] : []),
      ...(phones.length ? [{ 'contact.phone': { $in: phones } }] : [])
    ]
  })
    .select('user contact.phone status total createdAt')
    .lean();

  const phoneToUserKey = new Map(); // phone -> stats key to attribute
  // attribute primarily by user id, fall back to phone
  const userPhones = new Map();
  const users = await User.find({ _id: { $in: ids } }).select('phone').lean();
  for (const u of users) userPhones.set(String(u._id), u.phone);

  const byPhone = new Map(phones.map((p) => [p, null]));
  for (const [uid, phone] of userPhones) byPhone.set(phone, uid);

  for (const o of orders) {
    const keys = new Set();
    if (o.user && statsByUser.has(String(o.user))) keys.add(String(o.user));
    const phoneKey = byPhone.get(o.contact.phone);
    if (phoneKey) keys.add(phoneKey);
    for (const key of keys) {
      const s = statsByUser.get(key);
      s.totalOrders += 1;
      if (o.status === 'Delivered') {
        s.deliveredOrders += 1;
        s.deliveredSpend = r2(s.deliveredSpend + o.total);
      }
      if (CANCELLED_RTO.includes(o.status)) s.cancelledRtoOrders += 1;
      if (!s.lastOrderAt || o.createdAt > s.lastOrderAt) s.lastOrderAt = o.createdAt;
    }
  }
  // merge duplicate attribution (order matched by both user & phone counted once) — keys are a Set per order ✓
  return statsByUser;
}

/** GET /api/admin/customers?search&page&limit&sort */
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    const search = cleanText(req.query.search, 80);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phone = normalizePhone(search);
      const or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
      if (/^\d{3,10}$/.test(phone)) or.push({ phone: { $regex: '^' + phone } });
      filter.$or = or;
    }
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    const ids = users.map((u) => u._id);
    const phones = users.map((u) => u.phone);
    const stats = await statsForIds(ids, phones);
    res.json({
      customers: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        phone: u.phone,
        email: u.email || '',
        promoConsent: Boolean(u.promoConsent),
        registeredAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        ...(stats.get(String(u._id)) || emptyStats())
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/customers/:id */
async function detail(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid customer id.' });
    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ error: 'Customer not found.' });
    const addresses = await Address.find({ user: user._id }).sort({ isDefault: -1, createdAt: -1 }).lean();
    const orders = await Order.find({
      $or: [{ user: user._id }, { 'contact.phone': user.phone }]
    }).sort({ createdAt: -1 }).limit(50).select('orderNumber status total itemsCount createdAt paymentMethod').lean();
    const stats = (await statsForIds([user._id], [user.phone])).get(String(user._id)) || emptyStats();
    res.json({
      customer: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        promoConsent: Boolean(user.promoConsent),
        promoConsentAt: user.promoConsentAt,
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        addresses: addresses.map((a) => ({
          id: String(a._id), label: a.label, fullName: a.fullName, phone: a.phone,
          houseAndStreet: a.houseAndStreet, area: a.area, city: a.city, state: a.state,
          pincode: a.pincode, landmark: a.landmark || '', isDefault: a.isDefault
        })),
        stats,
        orders: orders.map((o) => ({
          id: String(o._id), orderNumber: o.orderNumber, status: o.status,
          total: o.total, itemsCount: o.itemsCount, paymentMethod: o.paymentMethod, createdAt: o.createdAt
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail };
