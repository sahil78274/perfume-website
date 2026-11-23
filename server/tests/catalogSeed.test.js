'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, PRODUCTS } = require('../scripts/seed');

const requested = [
  ['bella-vita-unisex-gift-set-2x20ml', 'SC-GS-004', 449, 'unisex-gift-sets', 'bella-vita-unisex-gift-set.jpg'],
  ['bella-vita-luxury-women-perfume-gift-set-2x20ml', 'SC-GS-005', 449, 'women-gift-sets', 'bella-vita-luxury-women-gift-set.jpg'],
  ['quimper-premium-perfume-set-20ml', 'SC-GS-006', 299, 'unisex-gift-sets', 'quimper-premium-perfume-set.jpg'],
  ['vibes-perfume-gift-set-2x50ml', 'SC-GS-007', 299, 'unisex-gift-sets', 'vibes-perfume-gift-set.jpg'],
  ['la-french-city-of-dreams-gift-set', 'SC-GS-008', 449, 'unisex-gift-sets', 'la-french-city-of-dreams-gift-set.jpg'],
  ['brit-accent-element-of-fire-depth-of-ocean-combo-100ml', 'SC-CP-004', 299, 'unisex-combo-sets', 'brit-accent-fire-ocean-combo.jpg']
];

test('catalogue seed includes the six requested active products with unique SKUs, prices, categories and uploaded images', () => {
  const slugs = new Set(PRODUCTS.map((product) => product.slug));
  const skus = new Set(PRODUCTS.map((product) => product.sku));
  assert.equal(slugs.size, PRODUCTS.length);
  assert.equal(skus.size, PRODUCTS.length);

  for (const [slug, sku, price, category, filename] of requested) {
    const product = PRODUCTS.find((entry) => entry.slug === slug);
    assert.ok(product, `missing seed product ${slug}`);
    assert.equal(product.sku, sku);
    assert.equal(product.price, price);
    assert.equal(product.category, category);
    assert.equal(product.stock, undefined, 'do not invent stock; Mongo schema default applies');
    assert.equal(product.preserveExisting, true, 're-seeding must preserve admin edits');
    assert.equal(product.images.length, 1);
    assert.equal(product.images[0].url, `/images/products/${filename}`);
    assert.equal(fs.existsSync(path.join(__dirname, '../../client/public', product.images[0].url.slice(1))), true);
  }

  for (const slug of ['unisex-gift-sets', 'women-gift-sets', 'unisex-combo-sets']) {
    assert.ok(CATEGORIES.some((category) => category.slug === slug), `missing category ${slug}`);
  }
});

test('development storefront catalog mirrors all six uploaded products with their specified prices and categories', async () => {
  const { DEV_PRODUCTS, DEV_CATEGORIES } = await import('../../client/src/data/devCatalog.js');
  for (const [slug, sku, price, category, filename] of requested) {
    const product = DEV_PRODUCTS.find((entry) => entry.slug === slug);
    assert.ok(product, `missing preview product ${slug}`);
    assert.equal(product.price, price);
    assert.equal(product.category.slug, category);
    assert.equal(product.images[0].url, `/images/products/${filename}`);
    assert.equal(fs.existsSync(path.join(__dirname, '../../client/public', product.images[0].url.slice(1))), true);
    assert.equal(product.inStock, false, 'no inventory count was supplied');
  }
  for (const slug of ['unisex-gift-sets', 'women-gift-sets', 'unisex-combo-sets']) {
    assert.ok(DEV_CATEGORIES.some((category) => category.slug === slug));
  }
});
