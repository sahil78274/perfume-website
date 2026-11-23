'use strict';
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'auth-persistence-test-secret-long-enough';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { config, PRODUCTION_FRONTEND_ORIGIN } = require('../config/env');
const Admin = require('../models/Admin');
const {
  ADMIN_COOKIE,
  CUSTOMER_COOKIE,
  setAdminCookie,
  clearAdminCookie,
  setCustomerCookie,
  clearCustomerCookie,
  adminAuth
} = require('../middleware/auth');
const { createApp } = require('../app');

function cookieRecorder() {
  return {
    cookies: {},
    cleared: {},
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this; },
    clearCookie(name, options) { this.cleared[name] = options; return this; }
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('production admin and customer cookies are HttpOnly, Secure, SameSite=None and clear with matching scope', () => {
  assert.equal(config.isProduction, true);
  assert.deepEqual(config.allowedOrigins, [PRODUCTION_FRONTEND_ORIGIN]);
  const res = cookieRecorder();
  const admin = { _id: 'admin-1', name: 'Store Admin' };
  const user = { _id: 'customer-1', name: 'Customer' };

  setAdminCookie(res, admin);
  setCustomerCookie(res, user);
  for (const [name, lifetime] of [[ADMIN_COOKIE, 12 * 60 * 60 * 1000], [CUSTOMER_COOKIE, 7 * 24 * 60 * 60 * 1000]]) {
    const { value, options } = res.cookies[name];
    assert.ok(value);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'none');
    assert.equal(options.path, '/');
    assert.equal(options.maxAge, lifetime);
    assert.equal(Object.hasOwn(options, 'domain'), false);
    assert.ok(jwt.verify(value, config.jwtSecret));
  }

  clearAdminCookie(res);
  clearCustomerCookie(res);
  for (const name of [ADMIN_COOKIE, CUSTOMER_COOKIE]) {
    const options = res.cleared[name];
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'none');
    assert.equal(options.path, '/');
    assert.equal(Object.hasOwn(options, 'domain'), false);
  }
});

test('adminAuth continues to verify the JWT and active admin record', async () => {
  const originalFindById = Admin.findById;
  const token = jwt.sign({ sub: 'admin-1', role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });
  Admin.findById = () => ({ select: async () => ({ _id: 'admin-1', name: 'Store Admin', isActive: true }) });
  try {
    const req = { cookies: { [ADMIN_COOKIE]: token } };
    const res = responseRecorder();
    let nextCalled = false;
    await adminAuth(req, res, (error) => { if (error) throw error; nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.admin._id, 'admin-1');

    const invalidRes = responseRecorder();
    await adminAuth({ cookies: { [ADMIN_COOKIE]: 'not-a-valid-jwt' } }, invalidRes, () => assert.fail('invalid token must not pass'));
    assert.equal(invalidRes.statusCode, 401);
  } finally {
    Admin.findById = originalFindById;
  }
});

test('production CORS preflight reflects only the configured SCENTORA storefront and allows credentials', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const allowed = await fetch(`${base}/api/admin/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: PRODUCTION_FRONTEND_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), PRODUCTION_FRONTEND_ORIGIN);
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    assert.doesNotMatch(allowed.headers.get('access-control-allow-origin'), /\*/);

    const denied = await fetch(`${base}/api/admin/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://untrusted.example',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    assert.notEqual(denied.headers.get('access-control-allow-origin'), 'https://untrusted.example');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
