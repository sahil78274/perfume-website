'use strict';
const SupplierDetails = require('../models/SupplierDetails');
const { Expense } = require('../models/Expense');
const { computeProfit, bucketExpenses, round2 } = require('../utils/pricing');

/**
 * Build the profit breakdown for a single order.
 * - productCost: actual supplier purchase cost if recorded on SupplierDetails,
 *   otherwise the sum of supplier-cost snapshots from the order items.
 *   Returns null when no cost information exists at all (profits reported as "unknown").
 */
async function orderProfit(order, items) {
  const [supplier, expenseDocs] = await Promise.all([
    SupplierDetails.findOne({ order: order._id }),
    Expense.find({ order: order._id })
  ]);

  let productCost = null;
  let costSource = 'none';
  if (supplier && supplier.supplierPurchaseCost !== null && supplier.supplierPurchaseCost !== undefined) {
    productCost = round2(supplier.supplierPurchaseCost);
    costSource = 'supplier';
  } else {
    const snapshot = (items || []).reduce((sum, i) => {
      return i.supplierCost !== null && i.supplierCost !== undefined ? sum + Number(i.supplierCost) * i.qty : sum;
    }, 0);
    const withCost = (items || []).some((i) => i.supplierCost !== null && i.supplierCost !== undefined);
    if (withCost) {
      productCost = round2(snapshot);
      costSource = 'product';
    }
  }

  const buckets = bucketExpenses(expenseDocs);
  const profit = computeProfit(order.itemsSubtotal, productCost, buckets);
  return { ...profit, costSource, hasExpenses: expenseDocs.length > 0 };
}

module.exports = { orderProfit };
