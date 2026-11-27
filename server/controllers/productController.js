'use strict';
const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');
const OrderItem = require('../models/OrderItem');
const { publicProduct, adminProduct } = require('../utils/serializers');
const { isValidObjectId, cleanText } = require('../utils/validators');
const { uploadBuffer, destroyImage, cloudinaryConfigured } = require('../utils/cloudinary');


/** Build a safe (escaped) case-insensitive regex $or across fields. */
function escapedRegexOr(search, fields) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  return fields.map((f) => ({ [f]: rx }));
}

/* ---------------- Public endpoints ---------------- */

async function listPublic(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
    const filter = { status: 'active' };

    const search = cleanText(req.query.search, 80);
    if (search) filter.$or = escapedRegexOr(search, ['name', 'shortDescription', 'description', 'tags']);

    const category = cleanText(req.query.category, 80);
    if (category) {
      const cat = await Category.findOne({ slug: category, isActive: true }).select('_id');
      if (cat) filter.category = cat._id;
      else return res.json({ products: [], total: 0, page, pages: 0 });
    }

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
      filter.price = {};
      if (!Number.isNaN(minPrice) && minPrice >= 0) filter.price.$gte = minPrice;
      if (!Number.isNaN(maxPrice) && maxPrice >= 0) filter.price.$lte = maxPrice;
    }
    if (req.query.inStock === 'true') filter.stock = { $gt: 0 };
    if (req.query.featured === 'true') filter.featured = true;

    const sort = String(req.query.sort || 'featured');
    const sortMap = {
      featured: { featured: -1, createdAt: -1 },
      newest: { createdAt: -1 },
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      name: { name: 1 }
    };
    const sortSpec = sortMap[sort] || sortMap.featured;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).populate('category', 'name slug')
    ]);
    res.json({ products: products.map((p) => publicProduct(p)), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

async function getPublicBySlug(req, res, next) {
  try {
    const product = await Product.findOne({ slug: String(req.params.slug || '').toLowerCase(), status: 'active' }).populate('category', 'name slug');
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: publicProduct(product, { includeStockCount: false }) });
  } catch (err) {
    next(err);
  }
}

async function listCategoriesPublic(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, description: c.description, image: c.image })) });
  } catch (err) {
    next(err);
  }
}

/* ---------------- Admin endpoints ---------------- */

function adminListFilter(req) {
  const filter = {};
  const search = cleanText(req.query.search, 80);
  if (search) filter.$or = escapedRegexOr(search, ['name', 'sku', 'shortDescription']);
  if (req.query.status === 'active' || req.query.status === 'inactive') filter.status = req.query.status;
  if (req.query.featured === 'true') filter.featured = true;
  const cat = cleanText(req.query.category, 80);
  if (cat && isValidObjectId(cat)) filter.category = cat;
  if (req.query.lowStock === 'true') {
    const threshold = Math.max(0, Number(req.query.threshold) || 5);
    filter.stock = { $lte: threshold };
  }
  return filter;
}

async function adminList(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = adminListFilter(req);
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).select('+supplierCost').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('category', 'name slug')
    ]);
    res.json({ products: products.map(adminProduct), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

async function adminGet(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).select('+supplierCost').populate('category', 'name slug');
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: adminProduct(product) });
  } catch (err) {
    next(err);
  }
}

async function slugify(text) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 72);
  let slug = base || 'product';
  let n = 2;
  while (await Product.exists({ slug })) slug = `${base}-${n++}`;
  return slug;
}

function readProductBody(body, partial = false) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) out.name = cleanText(body.name, 140);
  if (!partial || has('sku')) out.sku = cleanText(body.sku, 60).toUpperCase();
  if (has('shortDescription')) out.shortDescription = cleanText(body.shortDescription, 240);
  if (has('description')) out.description = cleanText(body.description, 4000);
  if (!partial || has('category')) out.category = body.category;
  if (has('subcategory')) out.subcategory = cleanText(body.subcategory, 60);
  if (!partial || has('price')) out.price = Math.round(Number(body.price) * 100) / 100;
  if (has('compareAtPrice')) out.compareAtPrice = body.compareAtPrice === null || body.compareAtPrice === '' ? null : Math.round(Number(body.compareAtPrice) * 100) / 100;
  if (has('supplierCost')) out.supplierCost = body.supplierCost === null || body.supplierCost === '' ? null : Math.round(Number(body.supplierCost) * 100) / 100;
  if (!partial || has('stock')) out.stock = Math.floor(Number(body.stock) || 0);
  if (has('lowStockThreshold')) out.lowStockThreshold = body.lowStockThreshold === null || body.lowStockThreshold === '' ? null : Math.floor(Number(body.lowStockThreshold));
  if (has('status')) out.status = body.status;
  if (has('featured')) out.featured = Boolean(body.featured);
  if (has('tags')) out.tags = Array.isArray(body.tags) ? body.tags.map((t) => cleanText(t, 32)).filter(Boolean).slice(0, 12) : [];
  if (has('specs')) {
    out.specs = Array.isArray(body.specs)
      ? body.specs.slice(0, 30).map((s) => ({ label: cleanText(s.label, 60), value: cleanText(s.value, 200) })).filter((s) => s.label && s.value)
      : [];
  }
  return out;
}

async function adminCreate(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
    const data = readProductBody(req.body);
    if (!isValidObjectId(String(data.category))) return res.status(400).json({ error: 'Please choose a valid category.' });
    const category = await Category.findById(data.category);
    if (!category) return res.status(400).json({ error: 'Category not found.' });
    if (!Number.isFinite(data.price) || data.price < 0) return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    if (!Number.isFinite(data.stock) || data.stock < 0) return res.status(400).json({ error: 'Stock must be a valid non-negative number.' });
    if (!data.sku) return res.status(400).json({ error: 'SKU is required.' });
    if (await Product.exists({ sku: data.sku })) return res.status(409).json({ error: 'That SKU is already in use.' });

    const slug = await slugify(data.name);
    const product = await Product.create({ ...data, slug, images: [] });
    const populated = await Product.findById(product._id).select('+supplierCost').populate('category', 'name slug');
    res.status(201).json({ product: adminProduct(populated) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'Slug or SKU conflict — please adjust the name or SKU.' });
    next(err);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array({ onlyFirstError: true })[0].msg });
    const product = await Product.findById(req.params.id).select('+supplierCost');
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const data = readProductBody(req.body, true);
    if (data.category !== undefined) {
      if (!isValidObjectId(String(data.category))) return res.status(400).json({ error: 'Please choose a valid category.' });
      if (!(await Category.findById(data.category))) return res.status(400).json({ error: 'Category not found.' });
    }
    if (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0)) return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    if (data.stock !== undefined && (!Number.isFinite(data.stock) || data.stock < 0)) return res.status(400).json({ error: 'Stock must be a valid non-negative number.' });
    if (data.sku && data.sku !== product.sku && (await Product.exists({ sku: data.sku }))) {
      return res.status(409).json({ error: 'That SKU is already in use.' });
    }
    if (data.status && !['active', 'inactive'].includes(data.status)) return res.status(400).json({ error: 'Invalid status.' });

    Object.assign(product, data);
    await product.save();
    const populated = await Product.findById(product._id).select('+supplierCost').populate('category', 'name slug');
    res.json({ product: adminProduct(populated) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'SKU conflict.' });
    next(err);
  }
}

/** Archive (soft-delete). Hard delete only when no order items reference the product. */
async function adminRemove(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const referenced = await OrderItem.exists({ product: product._id });
    const mode = req.query.hard === 'true';
    if (mode) {
      if (referenced) {
        return res.status(409).json({ error: 'This product has orders and cannot be hard-deleted. It has been archived (inactive) instead.' });
      }
      // remove cloudinary images
      for (const img of product.images || []) await destroyImage(img.publicId);
      await product.deleteOne();
      return res.json({ ok: true, deleted: true });
    }
    product.status = 'inactive';
    await product.save();
    res.json({ ok: true, archived: true });
  } catch (err) {
    next(err);
  }
}

async function adminUploadImages(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No image files received.' });
    if ((product.images || []).length + files.length > 12) {
      return res.status(400).json({ error: 'A product can have at most 12 images.' });
    }
    if (!cloudinaryConfigured()) {
      return res.status(503).json({ error: 'Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (see README).' });
    }
    const uploaded = [];
    for (const file of files) {
      const result = await uploadBuffer(file.buffer, { folder: 'scentora/products', publicId: `${product.slug}-${Date.now()}` });
      uploaded.push({ url: result.secure_url, publicId: result.public_id, alt: product.name });
    }
    product.images.push(...uploaded);
    await product.save();
    res.status(201).json({ product: adminProduct(await Product.findById(product._id).select('+supplierCost').populate('category', 'name slug')) });
  } catch (err) {
    next(err);
  }
}

async function adminDeleteImage(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const image = product.images.id(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found.' });
    await destroyImage(image.publicId);
    image.deleteOne();
    await product.save();
    res.json({ product: adminProduct(await Product.findById(product._id).select('+supplierCost').populate('category', 'name slug')) });
  } catch (err) {
    next(err);
  }
}

/** Set image order: body { order: [imageId, ...] } — arrays must cover all images. */
async function adminReorderImages(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const order = Array.isArray(req.body.order) ? req.body.order.map(String) : [];
    if (order.length !== product.images.length) return res.status(400).json({ error: 'Image order must include every image exactly once.' });
    const byId = new Map(product.images.map((i) => [String(i._id), i]));
    const reordered = [];
    for (const id of order) {
      const img = byId.get(id);
      if (!img) return res.status(400).json({ error: 'Image order contains an unknown image.' });
      reordered.push(img);
    }
    product.images = reordered;
    await product.save();
    res.json({ product: adminProduct(await Product.findById(product._id).select('+supplierCost').populate('category', 'name slug')) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublic,
  getPublicBySlug,
  listCategoriesPublic,
  adminList,
  adminGet,
  adminCreate,
  adminUpdate,
  adminRemove,
  adminUploadImages,
  adminDeleteImage,
  adminReorderImages
};
