'use strict';
const Category = require('../models/Category');
const Product = require('../models/Product');
const { cleanText } = require('../utils/validators');

async function slugify(name) {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'category';
  let slug = base, n = 2;
  while (await Category.exists({ slug })) slug = `${base}-${n++}`;
  return slug;
}

async function adminList(req, res, next) {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    const counts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      categories: categories.map((c) => ({
        id: String(c._id), name: c.name, slug: c.slug, description: c.description,
        image: c.image, isActive: c.isActive, sortOrder: c.sortOrder, productCount: countById.get(String(c._id)) || 0
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function adminCreate(req, res, next) {
  try {
    const name = cleanText(req.body.name, 60);
    if (!name || name.length < 2) return res.status(400).json({ error: 'Category name is required.' });
    const category = await Category.create({
      name,
      slug: await slugify(name),
      description: cleanText(req.body.description, 240),
      image: cleanText(req.body.image, 400),
      sortOrder: Number(req.body.sortOrder) || 0,
      isActive: req.body.isActive !== false
    });
    res.status(201).json({ category: { id: String(category._id), name: category.name, slug: category.slug } });
  } catch (err) {
    next(err);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 60);
      if (name.length < 2) return res.status(400).json({ error: 'Category name is too short.' });
      category.name = name;
    }
    if (req.body.description !== undefined) category.description = cleanText(req.body.description, 240);
    if (req.body.image !== undefined) category.image = cleanText(req.body.image, 400);
    if (req.body.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.isActive !== undefined) category.isActive = Boolean(req.body.isActive);
    await category.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function adminRemove(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    const inUse = await Product.exists({ category: category._id });
    if (inUse) {
      category.isActive = false;
      await category.save();
      return res.json({ ok: true, archived: true, message: 'Category has products — deactivated instead of deleted.' });
    }
    await category.deleteOne();
    res.json({ ok: true, deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminList, adminCreate, adminUpdate, adminRemove };
