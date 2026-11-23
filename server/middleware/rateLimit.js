'use strict';
const rateLimit = require('express-rate-limit');

const json = (message) => ({ error: message });

const skipInTest = (req) => process.env.NODE_ENV === 'test';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: json('Too many requests. Please slow down and try again shortly.')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: json('Too many attempts. Please wait 15 minutes and try again.')
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: json('Too many admin login attempts. Please wait 15 minutes and try again.')
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: json('Too many orders placed from this device. Please try again later or contact support.')
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  message: json('Too many tracking attempts. Please wait 15 minutes and try again.')
});

module.exports = { apiLimiter, authLimiter, adminLoginLimiter, orderLimiter, trackLimiter };
