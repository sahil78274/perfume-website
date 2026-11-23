'use strict';
/** Pure pricing / profit helpers (no I/O) — unit-tested. */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Compute line totals and the order merchandise subtotal from *database* prices.
 * `lines` = [{ unitPrice, qty }] — always derived server-side.
 */
function computeSubtotal(lines) {
  let subtotal = 0;
  for (const l of lines) subtotal += Number(l.unitPrice) * Number(l.qty);
  return round2(subtotal);
}

function computeOrderTotal(subtotal, shippingCharge) {
  return round2(Number(subtotal) + Number(shippingCharge || 0));
}

/**
 * Order-level profit breakdown.
 * @param {object} order  Order doc/JSON: itemsSubtotal (merchandise revenue)
 * @param {number|null} productCost  Total supplier cost of the items (best available)
 * @param {object} expenses  { shipping, cod, advertising, rto, other } — sums of recorded expenses
 */
function computeProfit(subtotal, productCost, expenses) {
  const cost = productCost === null || productCost === undefined ? null : round2(productCost);
  const exp = {
    shipping: round2(expenses.shipping || 0),
    cod: round2(expenses.cod || 0),
    advertising: round2(expenses.advertising || 0),
    rto: round2(expenses.rto || 0),
    other: round2(expenses.other || 0)
  };
  const expenseTotal = round2(Object.values(exp).reduce((a, b) => a + b, 0));
  const grossMargin = cost === null ? null : round2(Number(subtotal) - cost);
  const netProfit = grossMargin === null ? null : round2(grossMargin - expenseTotal);
  return { cost, expenses: exp, expenseTotal, grossMargin, netProfit };
}

/** Effective per-order expense buckets from expense documents. */
function bucketExpenses(expenseDocs) {
  const out = { shipping: 0, cod: 0, advertising: 0, rto: 0, other: 0 };
  for (const e of expenseDocs || []) {
    const t = e.type === 'cod_charge' ? 'cod' : e.type;
    if (out[t] !== undefined) out[t] += Number(e.amount) || 0;
    else out.other += Number(e.amount) || 0;
  }
  return out;
}

module.exports = { round2, computeSubtotal, computeOrderTotal, computeProfit, bucketExpenses };
