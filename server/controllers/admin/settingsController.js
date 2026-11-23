'use strict';
const bcrypt = require('bcryptjs');
const StoreSettings = require('../../models/StoreSettings');
const Admin = require('../../models/Admin');
const { cleanText, cleanMultiline, passwordProblem } = require('../../utils/validators');

function publicSettings(s) {
  return {
    storeName: s.storeName,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    shippingCharge: s.shippingCharge,
    freeShippingAbove: s.freeShippingAbove,
    lowStockThreshold: s.lowStockThreshold,
    codMessage: s.codMessage,
    promoConsentText: s.promoConsentText,
    confirmationNote: s.confirmationNote
  };
}

/** GET /api/settings — public, safe subset */
async function getPublic(req, res, next) {
  try {
    const s = await StoreSettings.getSettings();
    res.json({
      storeName: s.storeName,
      supportEmail: s.supportEmail,
      supportPhone: s.supportPhone,
      shippingCharge: s.shippingCharge,
      freeShippingAbove: s.freeShippingAbove,
      codMessage: s.codMessage,
      promoConsentText: s.promoConsentText,
      confirmationNote: s.confirmationNote
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/settings */
async function getAdmin(req, res, next) {
  try {
    res.json({ settings: publicSettings(await StoreSettings.getSettings()) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/settings */
async function update(req, res, next) {
  try {
    const s = await StoreSettings.getSettings();
    const b = req.body || {};
    if (b.storeName !== undefined) {
      const v = cleanText(b.storeName, 80);
      if (v.length < 2) return res.status(400).json({ error: 'Store name is too short.' });
      s.storeName = v;
    }
    if (b.supportEmail !== undefined) {
      const v = cleanText(b.supportEmail, 254).toLowerCase();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return res.status(400).json({ error: 'Invalid support email.' });
      s.supportEmail = v;
    }
    if (b.supportPhone !== undefined) s.supportPhone = cleanText(b.supportPhone, 20);
    if (b.shippingCharge !== undefined) {
      const v = Math.round(Number(b.shippingCharge) * 100) / 100;
      if (!Number.isFinite(v) || v < 0 || v > 100000) return res.status(400).json({ error: 'Invalid shipping charge.' });
      s.shippingCharge = v;
    }
    if (b.freeShippingAbove !== undefined) {
      if (b.freeShippingAbove === '' || b.freeShippingAbove === null) s.freeShippingAbove = null;
      else {
        const v = Math.round(Number(b.freeShippingAbove) * 100) / 100;
        if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Invalid free-shipping threshold.' });
        s.freeShippingAbove = v;
      }
    }
    if (b.lowStockThreshold !== undefined) {
      const v = Math.floor(Number(b.lowStockThreshold));
      if (!Number.isFinite(v) || v < 0 || v > 100000) return res.status(400).json({ error: 'Invalid low-stock threshold.' });
      s.lowStockThreshold = v;
    }
    if (b.codMessage !== undefined) s.codMessage = cleanMultiline(b.codMessage, 240);
    if (b.promoConsentText !== undefined) s.promoConsentText = cleanMultiline(b.promoConsentText, 300);
    if (b.confirmationNote !== undefined) s.confirmationNote = cleanMultiline(b.confirmationNote, 400);
    await s.save();
    res.json({ settings: publicSettings(s) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/auth/change-password { currentPassword, newPassword } */
async function changePassword(req, res, next) {
  try {
    const current = String(req.body.currentPassword || '');
    const nextPassword = String(req.body.newPassword || '');
    const admin = await Admin.findById(req.admin._id);
    const ok = admin && (await bcrypt.compare(current, admin.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
    const problem = passwordProblem(nextPassword);
    if (problem) return res.status(400).json({ error: problem });
    admin.passwordHash = await bcrypt.hash(nextPassword, 12);
    await admin.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublic, getAdmin, update, changePassword };
