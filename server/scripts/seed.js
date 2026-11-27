'use strict';
/**
 * Seed the database with the SCENTORA catalogue and default store settings.
 * Idempotent — safe to re-run; products are identified by unique slug/SKU.
 *
 * Usage: npm run seed
 */
const { validateConfig } = require('../config/env');

const CATEGORIES = [
  { name: 'Gift Sets', slug: 'gift-sets', description: 'Curated fragrance gift sets for every occasion.', sortOrder: 1 },
  { name: 'Combo Packs', slug: 'combo-packs', description: 'Value duos and multi-bottle combo packs.', sortOrder: 2 },
  { name: 'Pocket Perfumes', slug: 'pocket-perfumes', description: 'Travel-friendly mini and pocket sprays.', sortOrder: 3 },
  { name: 'Unisex / Gift Sets', slug: 'unisex-gift-sets', description: 'Unisex fragrance gift sets.', sortOrder: 4 },
  { name: 'Women / Gift Sets', slug: 'women-gift-sets', description: 'Women’s fragrance gift sets.', sortOrder: 5 },
  { name: 'Unisex / Combo Sets', slug: 'unisex-combo-sets', description: 'Unisex fragrance combo sets.', sortOrder: 6 },
  { name: "Men's Fashion", slug: 'mens-fashion', description: 'Men’s fashion essentials — trousers, sweatshirts and everyday apparel.', sortOrder: 7 }
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
  },
  {
    name: 'Bella Vita Unisex Gift Set',
    slug: 'bella-vita-unisex-gift-set-2x20ml',
    sku: 'SC-GS-004',
    category: 'unisex-gift-sets',
    shortDescription: 'Bella Vita Unisex Perfume Gift Set, 2 × 20 ml.',
    description: 'Bella Vita Unisex Perfume Gift Set, 2 × 20 ml.',
    price: 449,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['bella vita', 'unisex', 'gift set', '2 x 20 ml'],
    preserveExisting: true,
    images: [{ url: IMG('bella-vita-unisex-gift-set'), publicId: '', alt: 'Bella Vita Unisex Gift Set — 2 × 20 ml' }]
  },
  {
    name: 'Bella Vita Luxury Women Perfume',
    slug: 'bella-vita-luxury-women-perfume-gift-set-2x20ml',
    sku: 'SC-GS-005',
    category: 'women-gift-sets',
    shortDescription: 'Bella Vita Luxury Women Perfume Gift Set, 2 × 20 ml.',
    description: 'Bella Vita Luxury Women Perfume Gift Set, 2 × 20 ml.',
    price: 449,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['bella vita', 'women', 'gift set', '2 x 20 ml'],
    preserveExisting: true,
    images: [{ url: IMG('bella-vita-luxury-women-gift-set'), publicId: '', alt: 'Bella Vita Luxury Women Perfume Gift Set — 2 × 20 ml' }]
  },
  {
    name: 'Quimper Premium Perfume Set',
    slug: 'quimper-premium-perfume-set-20ml',
    sku: 'SC-GS-006',
    category: 'unisex-gift-sets',
    shortDescription: 'Quimper Premium Perfume Set featuring Saudi Sultan and Arabic Khalifa, 20 ml + 20 ml.',
    description: 'Quimper Premium Perfume Set featuring Saudi Sultan and Arabic Khalifa, 20 ml + 20 ml.',
    price: 299,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['quimper', 'unisex', 'gift set', 'saudi sultan', 'arabic khalifa', '20 ml'],
    preserveExisting: true,
    images: [{ url: IMG('quimper-premium-perfume-set'), publicId: '', alt: 'Quimper Premium Perfume Set — Saudi Sultan and Arabic Khalifa, 20 ml + 20 ml' }]
  },
  {
    name: 'Vibes Perfume Gift Set',
    slug: 'vibes-perfume-gift-set-2x50ml',
    sku: 'SC-GS-007',
    category: 'unisex-gift-sets',
    shortDescription: 'Vibes Perfume Gift Set, 2 × 50 ml, for men and women.',
    description: 'Vibes Perfume Gift Set, 2 × 50 ml, for men and women.',
    price: 299,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['vibes', 'unisex', 'gift set', '2 x 50 ml'],
    preserveExisting: true,
    images: [{ url: IMG('vibes-perfume-gift-set'), publicId: '', alt: 'Vibes Perfume Gift Set — 2 × 50 ml, for men and women' }]
  },
  {
    name: 'La French City of Dreams Gift Set',
    slug: 'la-french-city-of-dreams-gift-set',
    sku: 'SC-GS-008',
    category: 'unisex-gift-sets',
    shortDescription: 'La French City of Dreams Perfume Gift Set.',
    description: 'La French City of Dreams Perfume Gift Set.',
    price: 449,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['la french', 'unisex', 'gift set', 'city of dreams'],
    preserveExisting: true,
    images: [{ url: IMG('la-french-city-of-dreams-gift-set'), publicId: '', alt: 'La French City of Dreams Gift Set' }]
  },
  {
    name: 'Brit Accent Perfume Combo',
    slug: 'brit-accent-element-of-fire-depth-of-ocean-combo-100ml',
    sku: 'SC-CP-004',
    category: 'unisex-combo-sets',
    shortDescription: 'Brit Accent Element of Fire and Depth of Ocean perfume combo, 100 ml as shown in the product image.',
    description: 'Brit Accent Element of Fire and Depth of Ocean perfume combo, 100 ml as shown in the product image.',
    price: 299,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['brit accent', 'unisex', 'combo set', 'element of fire', 'depth of ocean', '100 ml'],
    preserveExisting: true,
    images: [{ url: IMG('brit-accent-fire-ocean-combo'), publicId: '', alt: 'Brit Accent Element of Fire and Depth of Ocean Perfume Combo — 100 ml' }]
  },
  {
    name: "Men's White Relaxed-Fit Trousers",
    slug: 'mens-white-relaxed-fit-trousers',
    sku: 'SC-MF-009',
    category: 'mens-fashion',
    subcategory: 'Trousers',
    shortDescription: 'White relaxed-fit trousers with a clean, minimal and versatile look.',
    description: 'White relaxed-fit trousers with a clean, minimal and versatile look, suitable for casual and smart-casual outfits.',
    price: 699,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['men', 'fashion', 'trousers', 'white'],
    preserveExisting: true,
    images: [{ url: IMG('mens-white-relaxed-fit-trousers'), publicId: '', alt: "Men's White Relaxed-Fit Trousers" }]
  },
  {
    name: "Men's Dark Green Half-Zip Sweatshirt",
    slug: 'mens-dark-green-half-zip-sweatshirt',
    sku: 'SC-MF-010',
    category: 'mens-fashion',
    subcategory: 'Sweatshirts',
    shortDescription: 'Dark green half-zip sweatshirt with a high collar and front zipper.',
    description: 'Dark green half-zip sweatshirt featuring a high collar, front zipper and ribbed cuffs and hem.',
    price: 499,
    compareAtPrice: null,
    supplierCost: null,
    featured: true,
    tags: ['men', 'fashion', 'sweatshirt', 'half-zip', 'dark green'],
    preserveExisting: true,
    images: [{ url: IMG('mens-dark-green-half-zip-sweatshirt'), publicId: '', alt: "Men's Dark Green Half-Zip Sweatshirt" }]
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
      ...(p.subcategory ? { subcategory: p.subcategory } : {}),
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      ...(p.supplierCost !== null ? { supplierCost: p.supplierCost } : {}),
      ...(p.stock !== undefined ? { stock: p.stock } : {}),
      featured: p.featured,
      tags: p.tags,
      specs: p.specs,
      images: p.images,
      status: 'active'
    };
    // A slug or SKU collision with a different product identity is an error, never a duplicate insert.
    const existing = await Product.findOne({ $or: [{ slug: p.slug }, { sku: p.sku }] });
    if (existing && (existing.slug !== p.slug || existing.sku !== p.sku)) {
      throw new Error(`Product slug/SKU collision while seeding ${p.name}: ${p.slug} / ${p.sku}`);
    }
    if (p.preserveExisting) {
      // New catalogue entries use insert-only upserts so re-running seed never overwrites admin edits.
      const result = await Product.updateOne(
        { slug: p.slug, sku: p.sku },
        { $setOnInsert: doc },
        { upsert: true, runValidators: true }
      );
      console.log(result.upsertedCount ? `✔ created: ${p.name}` : `✔ already exists (preserved admin edits): ${p.name}`);
    } else if (existing) {
      // Existing catalogue seeds keep their historical behavior: update copy/images, preserve price/stock/cost.
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

if (require.main === module) {
  main().catch((err) => {
    console.error('seed failed:', err);
    process.exit(1);
  });
}

module.exports = { CATEGORIES, PRODUCTS };
