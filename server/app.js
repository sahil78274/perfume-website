'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { config } = require('./config/env');
const { sanitize } = require('./middleware/sanitize');
const { originCheck } = require('./middleware/auth');
const { apiNotFound, errorHandler } = require('./middleware/errors');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render / reverse proxies terminate TLS upstream

  /* Security headers */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // inline style attributes used minimally
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );

  /* CORS — same-origin by default; whitelist extra origins from env */
  const allowedOrigins = new Set(
    [config.corsOrigin, config.clientUrl]
      .filter(Boolean)
      .flatMap((v) => String(v).split(',').map((s) => s.trim()).filter(Boolean))
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key']
    })
  );

  app.use(compression());
  app.use(morgan(config.isProduction ? 'combined' : 'dev', {
    skip: (req) => req.path === '/api/health'
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitize);
  app.use(originCheck);

  /* API routes */
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiNotFound);

  /* Static: customer storefront */
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(
    express.static(publicDir, {
      index: 'index.html',
      setHeaders(res, filePath) {
        if (/\.(html)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(jpg|jpeg|png|webp|avif|gif|svg|woff2?)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    })
  );

  /* Chart.js for the admin dashboard (served from node_modules, not committed) */
  app.get('/admin/vendor/chart.umd.min.js', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'));
  });

  /* Static: admin panel at /admin */
  const adminDir = path.join(__dirname, '..', 'admin');
  app.get('/admin', (req, res) => res.redirect('/admin/'));
  app.use(
    '/admin',
    express.static(adminDir, {
      index: 'index.html',
      setHeaders(res, filePath) {
        res.setHeader('Cache-Control', /\.(html)$/i.test(filePath) ? 'no-cache' : 'public, max-age=86400');
      }
    })
  );

  /* 404 for everything else */
  app.use((req, res) => {
    if (req.accepts('html')) {
      res.status(404).sendFile(path.join(publicDir, '404.html'));
    } else {
      res.status(404).json({ error: 'Not found.' });
    }
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
