import api from '../api/axios';
import { DEV_PRODUCTS, DEV_CATEGORIES } from '../data/devCatalog';

/**
 * Product/catalogue API with a clearly-flagged local fallback.
 *
 * When the backend or the database is unavailable (local frontend preview),
 * read-only catalogue calls fall back to the bundled development catalogue and
 * set `devPreview: true` on the result. Callers should surface a visible
 * "Development preview" banner. Checkout (order placement) never uses this
 * fallback — it fails honestly with a clear error instead of faking an order.
 */

export function isPreviewError(err) {
  if (!err) return false;
  if (err.isNetworkError || err.status === 0) return true;
  if (err.status === 503 && err.code === 'DB_UNAVAILABLE') return true;
  return false;
}

function localQuery(params = {}) {
  let list = [...DEV_PRODUCTS];
  const search = String(params.search || '').trim().toLowerCase();
  if (search) {
    list = list.filter((p) =>
      [p.name, p.shortDescription, p.description].join(' ').toLowerCase().includes(search) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(search))
    );
  }
  const category = String(params.category || '').trim();
  if (category) list = list.filter((p) => p.category && p.category.slug === category);
  const minPrice = Number(params.minPrice);
  const maxPrice = Number(params.maxPrice);
  if (!Number.isNaN(minPrice) && params.minPrice !== '' && minPrice >= 0) list = list.filter((p) => p.price >= minPrice);
  if (!Number.isNaN(maxPrice) && params.maxPrice !== '' && maxPrice >= 0) list = list.filter((p) => p.price <= maxPrice);
  if (String(params.featured) === 'true') list = list.filter((p) => p.featured);
  if (params.inStock === 'true') list = list.filter((p) => p.inStock);

  switch (String(params.sort || 'featured')) {
    case 'newest': break;
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => Number(b.featured) - Number(a.featured));
  }

  const total = list.length;
  const limit = Math.min(48, Math.max(1, Number(params.limit) || 12));
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const slice = list.slice((page - 1) * limit, page * limit);
  return { products: slice, total, page, pages };
}

export async function fetchProducts(params = {}) {
  try {
    const { data } = await api.get('/products', { params });
    return { ...data, devPreview: false };
  } catch (err) {
    if (isPreviewError(err)) return { ...localQuery(params), devPreview: true };
    throw err;
  }
}

export async function fetchCategories() {
  try {
    const { data } = await api.get('/categories');
    return { categories: data.categories || [], devPreview: false };
  } catch (err) {
    if (isPreviewError(err)) return { categories: DEV_CATEGORIES, devPreview: true };
    throw err;
  }
}

export async function fetchProductBySlug(slug) {
  try {
    const { data } = await api.get(`/products/${encodeURIComponent(slug)}`);
    return { product: data.product, devPreview: false };
  } catch (err) {
    if (isPreviewError(err)) {
      const product = DEV_PRODUCTS.find((p) => p.slug === slug) || null;
      const error = new Error(product ? '' : 'This product could not be found (it may be out of season or discontinued).');
      error.status = product ? 0 : 404;
      if (product) return { product, devPreview: true };
      throw error;
    }
    throw err;
  }
}
