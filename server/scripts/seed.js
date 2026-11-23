'use strict';
/**
 * Seed the database with the SCENTORA catalogue (categories + 3 launch products)
 * and default store settings. Idempotent — safe to re-run; it upserts by slug/SKU.
 *
 * Usage: npm run seed
 */
const { validateConfig } = require('../config/env');

const CATEGORIES = [
  { name: 'Gift Sets', slug: 'gift-sets', description: 'Curated fragrance gift sets for every occasion.', sortOrder: 1 },
  { name: 'Combo Packs', slug: 'combo-packs', description: 'Value duos and multi-bottle combo packs.', sortOrder: 2 },
  { name: 'Pocket Perfumes', slug: 'pocket-perfumes', description: 'Travel-friendly mini and pocket sprays.', sortOrder: 3 }
];

const IMG = (n) => `/images/products/${n}.jpg`;

const PRODUCTS = [
  {
    name: 'Unisex Perfume Gift Set',
    slug: 'unisex-perfume-gift-set-6pc',
    sku: 'SC-GS-001',
    category: 'gift-sets',
    shortDescription: 'Six 15 ml fragrances in one gift set — an easy favourite for gifting.',
    description: 'A six-piece unisex perfume gift set featuring the popular #VICTORY collection in different fragrances, presented together in one set. The product gallery shows different photographs of the same set, not separate variants. An all-in-one gifting pick for birthdays, festivals and anniversaries.',
    price: 399,
    compareAtPrice: null,
    supplierCost: null,
    stock: 100,
    featured: true,
    tags: ['unisex', 'gift set', '6 pieces', '#victory'],
    specs: [
      { label: 'Contents', value: '6 × 15 ml fragrance sprays' },
      { label: 'Gender', value: 'Unisex' },
      { label: 'Ideal for', value: 'Gifting, daily use' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    images: ['gift-set-1', 'gift-set-2', 'gift-set-3', 'gift-set-4'].map((n, i) => ({ url: IMG(n), publicId: '', alt: `Unisex Perfume Gift Set — photo ${i + 1}` }))
  },
  {
    name: 'Brit Accent Depth of Ocean + Canyon Combo (2 × 50 ml)',
    slug: 'brit-accent-depth-of-ocean-canyon-2x50ml',
    sku: 'SC-CP-002',
    category: 'combo-packs',
    shortDescription: 'Two 50 ml fragrances: Depth of Ocean and Canyon — one blue, one orange.',
    description: 'The BRIT ACCENT duo pack: Depth of Ocean (50 ml) and Canyon (50 ml). A fresh aquatic-style bottle paired with a warm canyon-style bottle — two distinct everyday fragrances in one combo. The gallery shows photographs of the same duo, not separate products.',
    price: 299,
    compareAtPrice: 798,
    supplierCost: null,
    stock: 100,
    featured: true,
    tags: ['brit accent', 'combo', 'duo', '2 x 50 ml'],
    specs: [
      { label: 'Contents', value: '2 × 50 ml fragrance sprays' },
      { label: 'Fragrances', value: 'Depth of Ocean, Canyon' },
      { label: 'Gender', value: 'For men and women' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    images: ['ocean-canyon-1', 'ocean-canyon-2', 'ocean-canyon-3', 'ocean-canyon-4'].map((n, i) => ({ url: IMG(n), publicId: '', alt: `Depth of Ocean + Canyon combo — photo ${i + 1}` }))
  },
  {
    name: "Brit Accent Women's Pocket Perfume Gift Pack (5 pcs)",
    slug: 'brit-accent-women-pocket-perfume-gift-pack-5pc',
    sku: 'SC-PP-003',
    category: 'pocket-perfumes',
    shortDescription: 'Five mini spray fragrances in a red BRIT ACCENT gift box.',
    description: "The BRIT ACCENT women's pocket perfume gift pack: five mini spray fragrances — #DESIRE, #SENSUAL, #PASSION, #ELEGANCE and #FREEDOM — presented in a red gift box. Compact, travel-friendly and made for gifting. The gallery shows photographs of the same pack, not separate variants.",
    price: 299,
    compareAtPrice: 349,
    supplierCost: null,
    stock: 100,
    featured: true,
    tags: ['brit accent', 'women', 'pocket perfume', 'gift pack', '5 pieces'],
    specs: [
      { label: 'Contents', value: '5 × pocket perfume sprays' },
      { label: 'Fragrances', value: '#DESIRE, #SENSUAL, #PASSION, #ELEGANCE, #FREEDOM' },
      { label: 'Gender', value: 'Women' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    images: ['women-pocket-1', 'women-pocket-2', 'women-pocket-3', 'women-pocket-4'].map((n, i) => ({ url: IMG(n), publicId: '', alt: `Women's Pocket Perfume Gift Pack — photo ${i + 1}` }))
  }
];

async function main() {
  validateConfig();
  const { connectDB, disconnectDB } = require('../db/connect');
  const Category = require('../models/Category');
  const Product = require('../models/Product');
  const StoreSettings = require('../models/StoreSettings');

  await connectDB();

  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate({ slug: cat.slug }, { $set: cat }, { upsert: true, new: true });
  }
  console.log(`✔ ${CATEGORIES.length} categories upserted`);

  const catBySlug = new Map((await Category.find()).map((c) => [c.slug, c._id]));

  for (const p of PRODUCTS) {
    const doc = {
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      shortDescription: p.shortDescription,
      description: p.description,
      category: catBySlug.get(p.category),
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      ...(p.supplierCost !== null ? { supplierCost: p.supplierCost } : {}),
      stock: p.stock,
      featured: p.featured,
      tags: p.tags,
      specs: p.specs,
      images: p.images,
      status: 'active'
    };
    // Do not clobber admin edits to stock/price on re-run — only set them on first insert.
    const existing = await Product.findOne({ slug: p.slug });
    if (existing) {
      const { stock, price, supplierCost, ...safe } = doc;
      await Product.updateOne({ slug: p.slug }, { $set: safe });
      console.log(`✔ updated (kept existing price/stock/cost): ${p.name}`);
    } else {
      await Product.create(doc);
      console.log(`✔ created: ${p.name}`);
    }
  }

  await StoreSettings.getSettings();
  console.log('✔ store settings ensured');
  console.log('Seed complete.');
  await disconnectDB();
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
