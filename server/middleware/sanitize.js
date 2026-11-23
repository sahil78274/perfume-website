'use strict';
/**
 * Express-5-safe NoSQL-injection sanitiser.
 * Recursively removes keys that start with '$' or contain '.' from request
 * objects *in place* (Express 5 getters make reassignment impossible).
 */
function scrubValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) scrubValue(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        scrubValue(value[key]);
      }
    }
  }
}

function sanitize(req, res, next) {
  if (req.body) scrubValue(req.body);
  if (req.query) scrubValue(req.query);
  if (req.params) scrubValue(req.params);
  next();
}

module.exports = { sanitize };
