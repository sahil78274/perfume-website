'use strict';
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const PRODUCTION_FRONTEND_ORIGIN = 'https://scentora-store.onrender.com';

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtCustomerTtl: process.env.JWT_CUSTOMER_TTL || '7d',
  jwtAdminTtl: process.env.JWT_ADMIN_TTL || '12h',

  clientUrl: process.env.CLIENT_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '',

  adminSetup: {
    name: process.env.ADMIN_NAME || '',
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || ''
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },

  email: {
    host: process.env.EMAIL_HOST || '',
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
    adminNotify: process.env.ADMIN_NOTIFY_EMAIL || ''
  },

  // Production cross-site cookies must always be Secure. COOKIE_SECURE can only opt in during development.
  cookieSecure: isProduction || process.env.COOKIE_SECURE === 'true'
};

function configuredOrigins() {
  return [config.corsOrigin, config.clientUrl]
    .filter(Boolean)
    .flatMap((value) => String(value).split(',').map((origin) => origin.trim()).filter(Boolean));
}

// Production is deliberately pinned to the real storefront origin. Development also permits Vite.
config.allowedOrigins = isProduction
  ? [PRODUCTION_FRONTEND_ORIGIN]
  : [...new Set([...configuredOrigins(), 'http://localhost:5173', 'http://127.0.0.1:5173'])];
config.productionFrontendOrigin = PRODUCTION_FRONTEND_ORIGIN;

config.cloudinary.configured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

config.email.configured = Boolean(
  config.email.host && config.email.user && config.email.password && config.email.from
);

/** Validate the configuration we cannot boot without. Throws with a clear message listing every problem. */
function validateConfig() {
  const problems = [];
  if (!config.mongoUri) {
    problems.push('MONGODB_URI is missing (e.g. mongodb+srv://user:pass@cluster.mongodb.net/scentora)');
  } else if (!/^mongodb(\+srv)?:\/\//.test(config.mongoUri)) {
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  if (!config.jwtSecret) {
    problems.push('JWT_SECRET is missing (use a long random string, e.g. `openssl rand -hex 48`)');
  } else if (config.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters long');
  }
  if (isProduction) {
    const configured = configuredOrigins();
    if (!configured.includes(PRODUCTION_FRONTEND_ORIGIN)) {
      console.warn(`[config] Set CORS_ORIGIN and CLIENT_URL to ${PRODUCTION_FRONTEND_ORIGIN}; production CORS is pinned to that storefront origin.`);
    }
    if (configured.some((origin) => origin !== PRODUCTION_FRONTEND_ORIGIN)) {
      console.warn('[config] Ignoring non-storefront CORS origins in production.');
    }
  }
  if (problems.length) {
    const err = new Error(
      'Invalid environment configuration:\n  - ' + problems.join('\n  - ') +
      '\nSee .env.example and README.md for the full list of required variables.'
    );
    err.code = 'CONFIG_INVALID';
    throw err;
  }
}

module.exports = { config, validateConfig, PRODUCTION_FRONTEND_ORIGIN };
