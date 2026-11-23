'use strict';
const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'store', unique: true, immutable: true },
    storeName: { type: String, trim: true, maxlength: 80, default: 'SCENTORA' },
    supportEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    supportPhone: { type: String, trim: true, maxlength: 20, default: '' },
    shippingCharge: { type: Number, min: 0, default: 0 },
    freeShippingAbove: { type: Number, min: 0, default: null }, // null = disabled
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    codMessage: { type: String, trim: true, maxlength: 240, default: 'Payment is collected in cash only when your order is delivered.' },
    promoConsentText: { type: String, trim: true, maxlength: 300, default: 'Send me offers and new-arrival updates on WhatsApp/SMS/email (optional).' },
    confirmationNote: { type: String, trim: true, maxlength: 400, default: 'We will contact you to confirm your order before dispatch.' }
  },
  { timestamps: true }
);

storeSettingsSchema.statics.getSettings = async function () {
  let doc = await this.findOne({ key: 'store' });
  if (!doc) doc = await this.create({ key: 'store' });
  return doc;
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
