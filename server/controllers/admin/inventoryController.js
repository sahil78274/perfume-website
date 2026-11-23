'use strict';
const Product = require('../../models/Product');
const StoreSettings = require('../../models/StoreSettings');
const { round2 } = require('../../utils/pricing');
const { cleanText } = require('../../utils/validators');

/**
 * GET /api/admin/inventory?search&stock=low|out&status&page&limit
 * Stock overview for the admin dashboard. Supplier costs never leave the server.
 * One aggregation keeps summary, counts and the paginated table consistent.
 */
async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const settings = await StoreSettings.getSettings();
    const defaultThreshold = Number(settings.lowStockThreshold ?? 5);
    const search = cleanText(req.query.search, 80);

    const filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: escaped, $options: 'i' };
      filter.$or = [{ name: rx }, { sku: rx }];
    }
    if (req.query.status === 'active' || req.query.status === 'inactive') filter.status = req.query.status;

    const stockFilter = String(req.query.stock || '');
    const thresholdExpr = { $ifNull: ['$lowStockThreshold', defaultThreshold] };

    const [summaryAgg] = await Product.aggregate([
      { $match: filter },
      { $addFields: { effectiveThreshold: thresholdExpr } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$stock' },
          retailValue: { $sum: { $multiply: ['$stock', '$price'] } },
          costValue: { $sum: { $multiply: ['$stock', { $ifNull: ['$supplierCost', 0] }] } },
          noCostProducts: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$supplierCost', null] }, null] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$effectiveThreshold'] }] }, 1, 0] } }
        }
      }
    ]);

    const pipeline = [
      { $match: filter },
      { $addFields: { effectiveThreshold: thresholdExpr } }
    ];
    if (stockFilter === 'out') pipeline.push({ $match: { stock: { $lte: 0 } } });
    else if (stockFilter === 'low') {
      pipeline.push({ $match: { stock: { $gt: 0 }, $expr: { $lte: ['$stock', '$effectiveThreshold'] } } });
    }
    pipeline.push({
      $facet: {
        total: [{ $count: 'count' }],
        products: [
          { $sort: { stock: 1, name: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryDoc' }
          },
          {
            $project: {
              name: 1, slug: 1, sku: 1, price: 1, stock: 1, status: 1, featured: 1,
              supplierCost: 1, lowStockThreshold: 1, effectiveThreshold: 1,
              categoryName: { $ifNull: [{ $arrayElemAt: ['$categoryDoc.name', 0] }, null] }
            }
          }
        ]
      }
    });

    const [facet] = await Product.aggregate(pipeline);
    const total = facet?.total?.[0]?.count || 0;
    const products = (facet?.products || []).map((p) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: p.categoryName || null,
      price: p.price,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold ?? null,
      effectiveThreshold: p.effectiveThreshold,
      supplierCost: p.supplierCost ?? null,
      stockValue: round2(p.stock * p.price),
      status: p.status,
      featured: Boolean(p.featured)
    }));

    const s = summaryAgg || {};
    res.json({
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
      defaultThreshold,
      summary: {
        totalUnits: s.totalUnits || 0,
        outOfStock: s.outOfStock || 0,
        lowStock: s.lowStock || 0,
        retailValue: round2(s.retailValue || 0),
        costValue: round2(s.costValue || 0),
        noCostProducts: s.noCostProducts || 0
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
