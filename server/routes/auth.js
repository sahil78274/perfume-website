'use strict';
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { customerAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { handleValidation } = require('../middleware/errors');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your full name.'),
    body('phone').notEmpty().withMessage('Mobile number is required.'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Please enter a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.'),
    body('promoConsent').optional().isBoolean().withMessage('Invalid consent value.')
  ],
  handleValidation,
  authController.register
);

router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', customerAuth, authController.me);

router.patch(
  '/me',
  customerAuth,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your full name.'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Please enter a valid email address.'),
    body('promoConsent').optional().isBoolean()
  ],
  handleValidation,
  authController.updateProfile
);

router.post(
  '/change-password',
  customerAuth,
  authLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').notEmpty().withMessage('New password is required.')
  ],
  handleValidation,
  authController.changePassword
);

module.exports = router;
