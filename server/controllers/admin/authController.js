'use strict';
const bcrypt = require('bcryptjs');
const Admin = require('../../models/Admin');
const { setAdminCookie, clearAdminCookie } = require('../../middleware/auth');

function publicAdmin(a) {
  return { id: String(a._id), name: a.name, email: a.email, lastLoginAt: a.lastLoginAt };
}

/** POST /api/admin/auth/login — rate limited, no registration endpoint exists. */
async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const admin = await Admin.findOne({ email });
    const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !ok) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ error: 'This admin account is deactivated.' });
    }
    admin.lastLoginAt = new Date();
    await admin.save();
    setAdminCookie(res, admin);
    res.json({ admin: publicAdmin(admin) });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  clearAdminCookie(res);
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ admin: publicAdmin(req.admin) });
}

module.exports = { login, logout, me };
