'use strict';
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { setCustomerCookie, clearCustomerCookie } = require('../middleware/auth');
const { normalizePhone, passwordProblem } = require('../utils/validators');

function publicUser(u) {
  return {
    id: String(u._id),
    name: u.name,
    phone: u.phone,
    email: u.email || '',
    promoConsent: Boolean(u.promoConsent),
    createdAt: u.createdAt
  };
}

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
    }
    const name = String(req.body.name || '').trim();
    const phone = normalizePhone(req.body.phone);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const promoConsent = Boolean(req.body.promoConsent);

    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ error: pwProblem });

    const existing = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
    if (existing) {
      const field = existing.phone === phone ? 'mobile number' : 'email';
      return res.status(409).json({ error: `An account with this ${field} already exists. Please log in instead.` });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      phone,
      email: email || undefined,
      passwordHash,
      promoConsent,
      promoConsentAt: promoConsent ? new Date() : null
    });
    setCustomerCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'An account with these details already exists.' });
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || '');
    if (!phone || !password) return res.status(400).json({ error: 'Mobile number and password are required.' });

    const user = await User.findOne({ phone });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) {
      return res.status(401).json({ error: 'Invalid mobile number or password.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact support.' });
    }
    user.lastLoginAt = new Date();
    await user.save();
    setCustomerCookie(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  clearCustomerCookie(res);
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: publicUser(req.customer) });
}

async function updateProfile(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!name || name.length < 2) return res.status(400).json({ error: 'Please provide your full name.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    const user = req.customer;
    if (email && email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ error: 'That email is linked to another account.' });
    }
    user.name = name;
    user.email = email || undefined;
    if (typeof req.body.promoConsent === 'boolean') {
      if (req.body.promoConsent && !user.promoConsent) user.promoConsentAt = new Date();
      if (!req.body.promoConsent) user.promoConsentAt = null;
      user.promoConsent = req.body.promoConsent;
    }
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'That email is linked to another account.' });
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const current = String(req.body.currentPassword || '');
    const nextPassword = String(req.body.newPassword || '');
    const user = await User.findById(req.customer._id);
    const ok = user && (await bcrypt.compare(current, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Your current password is incorrect.' });
    const pwProblem = passwordProblem(nextPassword);
    if (pwProblem) return res.status(400).json({ error: pwProblem });
    if (await bcrypt.compare(nextPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'New password must be different from the current password.' });
    }
    user.passwordHash = await bcrypt.hash(nextPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, me, updateProfile, changePassword, publicUser };
