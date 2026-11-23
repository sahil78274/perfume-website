'use strict';
const { config } = require('../config/env');

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.isProduction) return false;

  // Local Arena/Vite previews are only allowed outside production.
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin) ||
    /^https:\/\/[^/]+\.e2b\.app$/.test(origin);
}

module.exports = { isAllowedOrigin };
