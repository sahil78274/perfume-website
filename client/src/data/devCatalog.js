/**
 * Local development catalogue — used ONLY when the backend is unreachable or the
 * database is not configured (local frontend preview). It mirrors the seed data
 * exactly (same names, prices, images as `npm run seed`) so the storefront renders
 * meaningfully before MongoDB is set up.
 *
 * This is a preview convenience, never a fake order facility: placing an order
 * still requires the backend and is blocked with a clear message otherwise.
 */
export const DEV_CATEGORIES = [
  { id: 'dev-cat-gift', name: 'Gift Sets', slug: 'gift-sets', description: 'Curated fragrance gift sets for every occasion.' },
  { id: 'dev-cat-combo', name: 'Combo Packs', slug: 'combo-packs', description: 'Value duos and multi-bottle combo packs.' },
  { id: 'dev-cat-pocket', name: 'Pocket Perfumes', slug: 'pocket-perfumes', description: 'Travel-friendly mini and pocket sprays.' }
];

const img = (name, alt) => ({ url: `/images/products/${name}.jpg`, alt });

export const DEV_PRODUCTS = [
  {
    id: 'dev-gift-set-001',
    slug: 'unisex-perfume-gift-set-6pc',
    name: 'Unisex Perfume Gift Set',
    category: DEV_CATEGORIES[0],
    shortDescription: 'Six 15 ml fragrances in one gift set — an easy favourite for gifting.',
    description:
      'A six-piece unisex perfume gift set featuring the popular #VICTORY collection in different fragrances, presented together in one set. The product gallery shows different photographs of the same set, not separate variants. An all-in-one gifting pick for birthdays, festivals and anniversaries.',
    price: 399,
    compareAtPrice: null,
    images: ['gift-set-1', 'gift-set-2', 'gift-set-3', 'gift-set-4'].map((n, i) => img(n, `Unisex Perfume Gift Set — photo ${i + 1}`)),
    specs: [
      { label: 'Contents', value: '6 × 15 ml fragrance sprays' },
      { label: 'Gender', value: 'Unisex' },
      { label: 'Ideal for', value: 'Gifting, daily use' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    tags: ['unisex', 'gift set', '6 pieces', '#victory'],
    inStock: true,
    featured: true
  },
  {
    id: 'dev-combo-002',
    slug: 'brit-accent-depth-of-ocean-canyon-2x50ml',
    name: 'Brit Accent Depth of Ocean + Canyon Combo (2 × 50 ml)',
    category: DEV_CATEGORIES[1],
    shortDescription: 'Two 50 ml fragrances: Depth of Ocean and Canyon — one blue, one orange.',
    description:
      'The BRIT ACCENT duo pack: Depth of Ocean (50 ml) and Canyon (50 ml). A fresh aquatic-style bottle paired with a warm canyon-style bottle — two distinct everyday fragrances in one combo. The gallery shows photographs of the same duo, not separate products.',
    price: 299,
    compareAtPrice: 798,
    images: ['ocean-canyon-1', 'ocean-canyon-2', 'ocean-canyon-3', 'ocean-canyon-4'].map((n, i) => img(n, `Depth of Ocean + Canyon combo — photo ${i + 1}`)),
    specs: [
      { label: 'Contents', value: '2 × 50 ml fragrance sprays' },
      { label: 'Fragrances', value: 'Depth of Ocean, Canyon' },
      { label: 'Gender', value: 'For men and women' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    tags: ['brit accent', 'combo', 'duo', '2 x 50 ml'],
    inStock: true,
    featured: true
  },
  {
    id: 'dev-pocket-003',
    slug: 'brit-accent-women-pocket-perfume-gift-pack-5pc',
    name: "Brit Accent Women's Pocket Perfume Gift Pack (5 pcs)",
    category: DEV_CATEGORIES[2],
    shortDescription: 'Five mini spray fragrances in a red BRIT ACCENT gift box.',
    description:
      "The BRIT ACCENT women's pocket perfume gift pack: five mini spray fragrances — #DESIRE, #SENSUAL, #PASSION, #ELEGANCE and #FREEDOM — presented in a red gift box. Compact, travel-friendly and made for gifting. The gallery shows photographs of the same pack, not separate variants.",
    price: 299,
    compareAtPrice: 349,
    images: ['women-pocket-1', 'women-pocket-2', 'women-pocket-3', 'women-pocket-4'].map((n, i) => img(n, `Women's Pocket Perfume Gift Pack — photo ${i + 1}`)),
    specs: [
      { label: 'Contents', value: '5 × pocket perfume sprays' },
      { label: 'Fragrances', value: '#DESIRE, #SENSUAL, #PASSION, #ELEGANCE, #FREEDOM' },
      { label: 'Gender', value: 'Women' },
      { label: 'Note', value: 'Gallery photos show the same product' }
    ],
    tags: ['brit accent', 'women', 'pocket perfume', 'gift pack', '5 pieces'],
    inStock: true,
    featured: true
  }
];
