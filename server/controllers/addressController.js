'use strict';
const Address = require('../models/Address');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { normalizePhone, normalizePincode } = require('../utils/validators');

function publicAddress(a) {
  return {
    id: String(a._id),
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    houseAndStreet: a.houseAndStreet,
    area: a.area,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    landmark: a.landmark || '',
    isDefault: Boolean(a.isDefault)
  };
}

function readAddressBody(req) {
  return {
    label: String(req.body.label || 'Home').trim().slice(0, 40) || 'Home',
    fullName: String(req.body.fullName || '').trim().slice(0, 80),
    phone: normalizePhone(req.body.phone),
    houseAndStreet: String(req.body.houseAndStreet || '').trim().slice(0, 200),
    area: String(req.body.area || '').trim().slice(0, 120),
    city: String(req.body.city || '').trim().slice(0, 80),
    state: String(req.body.state || '').trim().slice(0, 80),
    pincode: normalizePincode(req.body.pincode),
    landmark: String(req.body.landmark || '').trim().slice(0, 120),
    isDefault: Boolean(req.body.isDefault)
  };
}

async function syncAddressRefs(userId, ids) {
  await User.findByIdAndUpdate(userId, { addresses: ids });
}

async function list(req, res, next) {
  try {
    const addresses = await Address.find({ user: req.customer._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ addresses: addresses.map(publicAddress) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
    const data = readAddressBody(req);
    if (!data.fullName || data.fullName.length < 2) return res.status(400).json({ error: 'Please enter the recipient name.' });

    const count = await Address.countDocuments({ user: req.customer._id });
    if (count >= 10) return res.status(400).json({ error: 'You can save at most 10 addresses.' });

    const makeDefault = data.isDefault || count === 0;
    const address = await Address.create({ ...data, user: req.customer._id, isDefault: makeDefault });
    if (makeDefault) {
      await Address.updateMany({ user: req.customer._id, _id: { $ne: address._id } }, { isDefault: false });
    }
    await syncAddressRefs(req.customer._id, (await Address.find({ user: req.customer._id }).select('_id')).map((a) => a._id));
    res.status(201).json({ address: publicAddress(address) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
    const address = await Address.findOne({ _id: req.params.id, user: req.customer._id });
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    const data = readAddressBody(req);
    if (!data.fullName || data.fullName.length < 2) return res.status(400).json({ error: 'Please enter the recipient name.' });

    Object.assign(address, data);
    await address.save();
    if (data.isDefault) {
      address.isDefault = true;
      await address.save();
      await Address.updateMany({ user: req.customer._id, _id: { $ne: address._id } }, { isDefault: false });
    }
    res.json({ address: publicAddress(address) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.customer._id });
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    await syncAddressRefs(req.customer._id, (await Address.find({ user: req.customer._id }).select('_id')).map((a) => a._id));
    // keep a default selected if one existed
    if (address.isDefault) {
      const first = await Address.findOne({ user: req.customer._id }).sort({ createdAt: 1 });
      if (first) {
        first.isDefault = true;
        await first.save();
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function setDefault(req, res, next) {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.customer._id });
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    address.isDefault = true;
    await address.save();
    await Address.updateMany({ user: req.customer._id, _id: { $ne: address._id } }, { isDefault: false });
    res.json({ address: publicAddress(address) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, setDefault };
