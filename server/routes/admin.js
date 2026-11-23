'use strict';
const express = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');

const { adminAuth } = require('../middleware/auth');
const { adminLoginLimiter } = require('../middleware/rateLimit');
const { handleValidation } = require('../middleware/errors');

const authController = require('../controllers/admin/authController');
const dashboardController = require('../controllers/admin/dashboardController');
const ordersController = require('../controllers/admin/ordersController');
const customersController = require('../controllers/admin/customersController');
const settingsController = require('../controllers/admin/settingsController');
const inventoryController = require('../controllers/admin/inventoryController');
const suppliersController = require('../controllers/admin/suppliersController');
const expensesController = require('../controllers/admin/expensesController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

/** Wrap multer so file errors become clean 400/413 responses instead of 500s. */
function uploadImages(req, res, next) {
  upload.array('images', 8)(req, res, (err) => {
    if (!err) return next();
    const isTooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(isTooBig ? 413 : 400).json({ error: isTooBig ? 'Each image must be at most 5 MB.' : (err.message || 'Image upload failed.') });
  });
}

/* ---- Admin authentication (public, but rate-limited) ---- */
router.post('/auth/login', adminLoginLimiter, authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', adminAuth, authController.me);
router.post('/auth/change-password', adminAuth, adminLoginLimiter, settingsController.changePassword);

/* ---- Everything below requires an admin ---- */
router.use(adminAuth);

/* Dashboard */
router.get('/dashboard', dashboardController.dashboard);

/* Orders — CSV export BEFORE /orders/:id so "export.csv" is not treated as an id */
router.get('/orders/export.csv', ordersController.exportCsv);
router.get('/orders', ordersController.list);
router.get('/orders/:id', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.')], handleValidation, ordersController.detail);
router.patch('/orders/:id/status', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.'), body('status').notEmpty().withMessage('Status is required.')], handleValidation, ordersController.updateStatus);
router.patch('/orders/:id/supplier', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.')], handleValidation, ordersController.updateSupplier);
router.post('/orders/:id/notes', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.')], handleValidation, ordersController.addNote);
router.delete('/orders/:id/notes/:noteId', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.'), param('noteId').isMongoId().withMessage('Invalid note id.')], handleValidation, ordersController.deleteNote);
router.get('/orders/:id/expenses', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.')], handleValidation, expensesController.forOrder);
router.post('/orders/:id/expenses', [param('id').trim().isLength({ min: 6, max: 40 }).withMessage('Invalid order id.')], handleValidation, expensesController.createForOrder);

/* Expenses (store-wide ledger) */
router.get('/expenses', expensesController.list);
router.post('/expenses', expensesController.create);
router.delete('/expenses/:id', [param('id').isMongoId().withMessage('Invalid expense id.')], handleValidation, expensesController.remove);

/* Products */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP or AVIF images are allowed.'));
  }
});

router.get('/products', productController.adminList);
router.post(
  '/products',
  [
    body('name').trim().isLength({ min: 2, max: 140 }).withMessage('Product name is required.'),
    body('sku').trim().isLength({ min: 2, max: 60 }).withMessage('SKU is required.'),
    body('category').notEmpty().withMessage('Category is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required.'),
    body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required.')
  ],
  handleValidation,
  productController.adminCreate
);
router.get('/products/:id', [param('id').isMongoId().withMessage('Invalid product id.')], handleValidation, productController.adminGet);
router.patch('/products/:id', [param('id').isMongoId().withMessage('Invalid product id.')], handleValidation, productController.adminUpdate);
router.delete('/products/:id', [param('id').isMongoId().withMessage('Invalid product id.')], handleValidation, productController.adminRemove);
router.post('/products/:id/images', [param('id').isMongoId().withMessage('Invalid product id.')], handleValidation, uploadImages, productController.adminUploadImages);
router.delete('/products/:id/images/:imageId', [param('id').isMongoId(), param('imageId').isMongoId()], handleValidation, productController.adminDeleteImage);
router.patch('/products/:id/images/reorder', [param('id').isMongoId().withMessage('Invalid product id.')], handleValidation, productController.adminReorderImages);

/* Categories */
router.get('/categories', categoryController.adminList);
router.post('/categories', categoryController.adminCreate);
router.patch('/categories/:id', [param('id').isMongoId().withMessage('Invalid category id.')], handleValidation, categoryController.adminUpdate);
router.delete('/categories/:id', [param('id').isMongoId().withMessage('Invalid category id.')], handleValidation, categoryController.adminRemove);

/* Inventory & supplier management */
router.get('/inventory', inventoryController.list);
router.get('/suppliers/orders', suppliersController.list);

/* Customers */
router.get('/customers', customersController.list);
router.get('/customers/:id', [param('id').isMongoId().withMessage('Invalid customer id.')], handleValidation, customersController.detail);

/* Settings */
router.get('/settings', settingsController.getAdmin);
router.patch('/settings', settingsController.update);

module.exports = router;
