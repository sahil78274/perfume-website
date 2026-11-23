'use strict';
const express = require('express');
const mongoose = require('mongoose');
const productController = require('../controllers/productController');
const settingsController = require('../controllers/admin/settingsController');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(apiLimiter);

router.get('/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  res.status(200).json({
    ok: true,
    service: 'scentora-api',
    db: dbState,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString()
  });
});

router.get('/settings', settingsController.getPublic);
router.get('/categories', productController.listCategoriesPublic);
router.get('/products', productController.listPublic);
router.get('/products/:slug', productController.getPublicBySlug);

module.exports = router;
