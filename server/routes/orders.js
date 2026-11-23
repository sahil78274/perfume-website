'use strict';
const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { optionalCustomer } = require('../middleware/auth');
const { orderLimiter, trackLimiter } = require('../middleware/rateLimit');
const { handleValidation } = require('../middleware/errors');

const router = express.Router();

// Place a COD order — guest checkout supported (optional customer cookie)
router.post(
  '/',
  orderLimiter,
  optionalCustomer,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your full name.'),
    body('phone').notEmpty().withMessage('Mobile number is required.'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Please enter a valid email address.'),
    body('houseAndStreet').trim().isLength({ min: 2, max: 200 }).withMessage('House number and street are required.'),
    body('area').trim().isLength({ min: 2, max: 120 }).withMessage('Area / locality is required.'),
    body('city').trim().isLength({ min: 2, max: 80 }).withMessage('City is required.'),
    body('state').trim().isLength({ min: 2, max: 80 }).withMessage('State is required.'),
    body('pincode').trim().matches(/^[1-9]\d{5}$/).withMessage('Enter a valid 6-digit PIN code.'),
    body('landmark').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
    body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('items').isArray({ min: 1, max: 30 }).withMessage('Your cart is empty.'),
    body('items.*.productId').isMongoId().withMessage('Invalid product in cart.'),
    body('items.*.qty').isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20.'),
    body('idempotencyKey').optional({ checkFalsy: true }).trim().isLength({ max: 80 })
  ],
  handleValidation,
  orderController.create
);

// Order tracking — phone number only; response is restricted to customer-safe tracking fields.
router.post(
  '/track',
  trackLimiter,
  [
    body('phone').isString().trim().isLength({ min: 10, max: 16 }).withMessage('Enter a valid 10-digit Indian mobile number.')
  ],
  handleValidation,
  orderController.track
);

module.exports = router;
