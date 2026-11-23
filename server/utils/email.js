'use strict';
const nodemailer = require('nodemailer');
const { config } = require('../config/env');

let transporter = null;
if (config.email.configured) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password }
  });
}

function formatAddress(a) {
  return [a.houseAndStreet, a.area, a.city, a.state, a.pincode ? `PIN ${a.pincode}` : '']
    .filter(Boolean).join(', ');
}

function money(n) {
  return '\u20B9' + Number(n || 0).toLocaleString('en-IN');
}

function orderConfirmationHtml(order) {
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(i.name)} x ${i.qty}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${money(i.lineTotal)}</td></tr>`)
    .join('');
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#171717">
    <h2 style="letter-spacing:3px">SCENT<span style="color:#b58b52">ORA</span></h2>
    <p>Hi ${escapeHtml(order.contact.name)},</p>
    <p>Thank you for your order! We have received it and will contact you shortly to confirm delivery. Payment is <strong>Cash on Delivery</strong> — pay only when the package reaches you.</p>
    <p style="background:#f6f4ef;padding:10px 14px;border-radius:6px"><strong>Order ID:</strong> ${escapeHtml(order.orderNumber)}<br>
    <strong>Order total:</strong> ${money(order.total)} (COD)</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    <p style="margin-top:10px"><strong>Delivery address:</strong><br>${escapeHtml(formatAddress(order.shippingAddress))}</p>
    <p style="font-size:12px;color:#777">If this order was not placed by you, please contact us immediately with your order ID.</p>
    <p style="font-size:11px;color:#999">SCENTORA — order support ${escapeHtml(process.env.SUPPORT_PHONE || '')}</p>
  </div>`;
}

function adminNewOrderHtml(order) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171717">
    <h3>New SCENTORA order ${escapeHtml(order.orderNumber)}</h3>
    <p><strong>${escapeHtml(order.contact.name)}</strong> · ${escapeHtml(order.contact.phone)}${order.contact.email ? ' · ' + escapeHtml(order.contact.email) : ''}</p>
    <p>${escapeHtml(formatAddress(order.shippingAddress))}${order.shippingAddress.landmark ? ' · Landmark: ' + escapeHtml(order.shippingAddress.landmark) : ''}</p>
    <p>Total: <strong>${money(order.total)}</strong> · ${order.items.reduce((a, i) => a + i.qty, 0)} item(s) · COD</p>
    ${order.notes ? `<p>Order notes: ${escapeHtml(order.notes)}</p>` : ''}
    <p style="font-size:12px;color:#777">Open the admin dashboard → Orders to process this order.</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Send an email if SMTP is configured. Returns 'sent' | 'skipped' | 'failed'.
 * Never throws — notifications must not break order placement.
 */
async function sendMail({ to, subject, html }) {
  if (!transporter || !to) {
    if (!transporter) console.log(`[email] SMTP not configured — skipping mail "${subject}" to ${to || '(no recipient)'}`);
    return 'skipped';
  }
  try {
    await transporter.sendMail({ from: config.email.from, to, subject, html });
    return 'sent';
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.message);
    return 'failed';
  }
}

async function sendOrderConfirmation(order) {
  const customerResult = order.contact.email
    ? await sendMail({ to: order.contact.email, subject: `SCENTORA order ${order.orderNumber} received`, html: orderConfirmationHtml(order) })
    : 'skipped';
  if (config.email.adminNotify) {
    await sendMail({ to: config.email.adminNotify, subject: `New SCENTORA order ${order.orderNumber}`, html: adminNewOrderHtml(order) });
  }
  return customerResult;
}

module.exports = { sendMail, sendOrderConfirmation };
