'use strict';
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { isAllowedOrigin } = require('../utils/origins');
const User = require('../models/User');
const Admin = require('../models/Admin');

const CUSTOMER_COOKIE = 'scentora_token';
const ADMIN_COOKIE = 'scentora_admin_token';

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: config.isProduction ? 'none' : 'lax',
  secure: config.cookieSecure,
  path: '/'
});

function customerCookieOptions() {
  return { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 };
}

function adminCookieOptions() {
  return { ...baseCookieOptions(), maxAge: 12 * 60 * 60 * 1000 };
}

function signToken(payload, ttl) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ttl });
}

function setCustomerCookie(res, user) {
  const token = signToken({ sub: String(user._id), role: 'customer', name: user.name }, config.jwtCustomerTtl);
  res.cookie(CUSTOMER_COOKIE, token, customerCookieOptions());
}

function setAdminCookie(res, admin) {
  const token = signToken({ sub: String(admin._id), role: 'admin', name: admin.name }, config.jwtAdminTtl);
  res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
}

function clearCustomerCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE, { ...baseCookieOptions() });
}
function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE, { ...baseCookieOptions() });
}

function readToken(req, cookieName) {
  const token = req.cookies ? req.cookies[cookieName] : null;
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

/** Require a logged-in, active customer. Attaches req.customer (fresh DB check). */
async function customerAuth(req, res, next) {
  try {
    const payload = readToken(req, CUSTOMER_COOKIE);
    if (!payload || payload.role !== 'customer') {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || !user.isActive) {
      clearCustomerCookie(res);
      return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' });
    }
    req.customer = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attach req.customer when a valid customer cookie exists; never rejects. */
async function optionalCustomer(req, res, next) {
  try {
    const payload = readToken(req, CUSTOMER_COOKIE);
    if (payload && payload.role === 'customer') {
      const user = await User.findById(payload.sub).select('-passwordHash');
      if (user && user.isActive) req.customer = user;
    }
  } catch { /* ignore */ }
  next();
}

/** Require a logged-in, active admin. Attaches req.admin. */
async function adminAuth(req, res, next) {
  try {
    const payload = readToken(req, ADMIN_COOKIE);
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    const admin = await Admin.findById(payload.sub).select('-passwordHash');
    if (!admin || !admin.isActive) {
      clearAdminCookie(res);
      return res.status(401).json({ error: 'Admin session is no longer valid.' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

/** Defense-in-depth CSRF hardening for mutating requests that carry cookies. */
function originCheck(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const origin = req.get('Origin');
  if (!origin) return next(); // non-browser clients / same-origin curl
  if (isAllowedOrigin(origin)) return next();
  return res.status(403).json({ error: 'Cross-origin request rejected.' });
}

module.exports = {
  CUSTOMER_COOKIE,
  ADMIN_COOKIE,
  setCustomerCookie,
  setAdminCookie,
  clearCustomerCookie,
  clearAdminCookie,
  customerAuth,
  optionalCustomer,
  adminAuth,
  originCheck
};
