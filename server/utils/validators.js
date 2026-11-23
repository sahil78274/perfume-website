'use strict';
/**
 * Pure validation helpers shared by the frontend-facing API and unit tests.
 * Keep these free of I/O so they can be tested in isolation.
 */

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^[1-9]\d{5}$/; // Indian PIN codes never start with 0
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/** Normalise an Indian mobile number: strip spaces/dashes, drop leading +91 / 0091 / 91 */
function normalizePhone(raw) {
  if (raw === undefined || raw === null) return '';
  let p = String(raw).trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.startsWith('0091')) p = p.slice(4);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  else if (p.startsWith('0') && p.length === 11) p = p.slice(1);
  return p;
}

function isValidPhone(raw) {
  return INDIAN_MOBILE_RE.test(normalizePhone(raw));
}

function normalizePincode(raw) {
  return String(raw === undefined || raw === null ? '' : raw).trim().replace(/\D/g, '');
}

function isValidPincode(raw) {
  return PINCODE_RE.test(normalizePincode(raw));
}

function isValidEmail(raw) {
  if (!raw) return true; // optional wherever used
  const v = String(raw).trim();
  return v.length <= 254 && EMAIL_RE.test(v);
}

function isValidObjectId(id) {
  return OBJECT_ID_RE.test(String(id || ''));
}

/** Password policy: min 8 chars, at least one letter and one number. */
function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters long.';
  if (p.length > 128) return 'Password must be at most 128 characters long.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain at least one letter and one number.';
  return null;
}

/** Escape a string for safe CSV output (formula-injection safe + quote doubling). */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers, rows) {
  const head = headers.map(csvCell).join(',');
  const body = rows.map((r) => r.map(csvCell).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}

/** Trim + collapse internal whitespace, cap length. */
function cleanText(raw, maxLen) {
  const v = String(raw === undefined || raw === null ? '' : raw).replace(/\s+/g, ' ').trim();
  return typeof maxLen === 'number' ? v.slice(0, maxLen) : v;
}

/** Trim but keep newlines (order notes), cap length. */
function cleanMultiline(raw, maxLen) {
  const v = String(raw === undefined || raw === null ? '' : raw).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return typeof maxLen === 'number' ? v.slice(0, maxLen) : v;
}

module.exports = {
  INDIAN_MOBILE_RE,
  PINCODE_RE,
  normalizePhone,
  isValidPhone,
  normalizePincode,
  isValidPincode,
  isValidEmail,
  isValidObjectId,
  passwordProblem,
  csvCell,
  toCsv,
  cleanText,
  cleanMultiline
};
