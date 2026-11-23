'use strict';
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

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

  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction
};

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
    if (!config.corsOrigin && !config.clientUrl) {
      // Not fatal (same-origin deployment works without CORS) — README documents this.
      console.warn('[config] Warning: neither CORS_ORIGIN nor CLIENT_URL is set. Only same-origin requests will be accepted.');
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

module.exports = { config, validateConfig };
