'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATEGORIES, PRODUCTS } = require('../scripts/seed');

const SIZES = 'S, M, L, XL, XXL';

const requested = [
  ['mens-white-relaxed-fit-trousers', 'SC-MF-009', 699, 'Trousers', 'mens-white-relaxed-fit-trousers.png'],
  ['mens-dark-green-half-zip-sweatshirt', 'SC-MF-010', 499, 'Sweatshirts', 'mens-dark-green-half-zip-sweatshirt.png']
];

test("catalogue seed includes the Men's Fashion category and both requested products with unique SKUs and exact selling prices", () => {
  const slugs = new Set(PRODUCTS.map((product) => product.slug));
  const skus = new Set(PRODUCTS.map((product) => product.sku));
  assert.equal(slugs.size, PRODUCTS.length, 'duplicate product slug in seed catalogue');
  assert.equal(skus.size, PRODUCTS.length, 'duplicate SKU in seed catalogue');

  const category = CATEGORIES.find((c) => c.slug === 'mens-fashion');
  assert.ok(category, 'missing category mens-fashion');
  assert.equal(category.name, "Men's Fashion");

  for (const [slug, sku, price, subcategory, filename] of requested) {
    const product = PRODUCTS.find((entry) => entry.slug === slug);
    assert.ok(product, `missing seed product ${slug}`);
    assert.equal(product.sku, sku);
    assert.equal(product.price, price);
    assert.equal(product.category, 'mens-fashion');
    assert.equal(product.subcategory, subcategory);
    assert.equal(product.compareAtPrice, null);
    assert.equal(product.supplierCost, null, 'purchase cost stays unset — never invented, admins record it separately');
    assert.equal(product.stock, undefined, 'do not invent stock; Mongo schema default applies until availability is confirmed');
    assert.equal(product.preserveExisting, true, 're-seeding must preserve admin edits and never create duplicates');
    assert.deepEqual(product.specs, [{ label: 'Sizes', value: SIZES }], 'only confirmed sizes, no invented specs');
    assert.equal(product.images.length, 1);
    assert.equal(product.images[0].url, `/images/products/${filename}`);
    assert.equal(product.images[0].publicId, '', 'repo-static image, not a Cloudinary upload');
    assert.equal(fs.existsSync(path.join(__dirname, '../../client/public', product.images[0].url.slice(1))), true, `attached image file must exist: ${filename}`);
  }
});

test("development storefront catalog mirrors both Men's Fashion products with their specified prices and subcategories", async () => {
  const { DEV_PRODUCTS, DEV_CATEGORIES } = await import('../../client/src/data/devCatalog.js');
  const category = DEV_CATEGORIES.find((c) => c.slug === 'mens-fashion');
  assert.ok(category, 'missing preview category mens-fashion');
  assert.equal(category.name, "Men's Fashion");

  for (const [slug, , price, subcategory, filename] of requested) {
    const product = DEV_PRODUCTS.find((entry) => entry.slug === slug);
    assert.ok(product, `missing preview product ${slug}`);
    assert.equal(product.price, price);
    assert.equal(product.category.slug, 'mens-fashion');
    assert.equal(product.subcategory, subcategory);
    assert.deepEqual(product.specs, [{ label: 'Sizes', value: SIZES }]);
    assert.equal(product.images[0].url, `/images/products/${filename}`);
    assert.equal(fs.existsSync(path.join(__dirname, '../../client/public', product.images[0].url.slice(1))), true, `attached image file must exist: ${filename}`);
    assert.equal(product.inStock, false, 'no confirmed inventory count was supplied');
    assert.equal(product.featured, true);
  }
});
