'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const addressController = require('../controllers/addressController');
const orderController = require('../controllers/orderController');
const { customerAuth } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errors');

const router = express.Router();
router.use(customerAuth); // everything below requires an account

const addressValidation = [
  body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Recipient name is required.'),
  body('phone').notEmpty().withMessage('Phone number is required.'),
  body('houseAndStreet').trim().isLength({ min: 2, max: 200 }).withMessage('House number and street are required.'),
  body('area').trim().isLength({ min: 2, max: 120 }).withMessage('Area / locality is required.'),
  body('city').trim().isLength({ min: 2, max: 80 }).withMessage('City is required.'),
  body('state').trim().isLength({ min: 2, max: 80 }).withMessage('State is required.'),
  body('pincode').trim().matches(/^[1-9]\d{5}$/).withMessage('Enter a valid 6-digit PIN code.'),
  body('label').optional().trim().isLength({ max: 40 }),
  body('landmark').optional().trim().isLength({ max: 120 }),
  body('isDefault').optional().isBoolean()
];

router.get('/addresses', addressController.list);
router.post('/addresses', addressValidation, handleValidation, addressController.create);
router.patch('/addresses/:id', [param('id').isMongoId().withMessage('Invalid address id.'), ...addressValidation], handleValidation, addressController.update);
router.delete('/addresses/:id', [param('id').isMongoId().withMessage('Invalid address id.')], handleValidation, addressController.remove);
router.post('/addresses/:id/default', [param('id').isMongoId().withMessage('Invalid address id.')], handleValidation, addressController.setDefault);

router.get('/orders', orderController.myOrders);
router.get('/orders/:orderNumber', orderController.myOrder);
router.post('/orders/:orderNumber/cancel', orderController.cancel);

module.exports = router;
