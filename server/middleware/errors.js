'use strict';
const { validationResult } = require('express-validator');

/** Collect express-validator results into a consistent 400 response. */
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path || e.param || 'field',
    message: e.msg
  }));
  return res.status(400).json({ error: errors[0].message, errors });
}

/** JSON 404 for unknown API routes. */
function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

/** Central error handler — never leak internals in production. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const safeMessage =
    status < 500 && err.message ? err.message : 'Something went wrong on our side. Please try again.';
  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, '-', err.stack || err.message || err);
  }
  if (res.headersSent) return;
  res.status(status).json({ error: safeMessage });
}

module.exports = { handleValidation, apiNotFound, errorHandler };
