import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchProducts } from '../services/products';
import ProductCard from '../components/ProductCard';
import DevPreviewBanner from '../components/DevPreviewBanner';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(() => searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get('maxPrice') || '');
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'featured');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [devPreview, setDevPreview] = useState(false);
  const debounce = useRef(null);

  // Keep the URL shareable (?search=&category=&sort=…)
  const syncParams = useCallback((next) => {
    const p = new URLSearchParams();
    if (next.search) p.set('search', next.search);
    if (next.category) p.set('category', next.category);
    if (next.minPrice) p.set('minPrice', next.minPrice);
    if (next.maxPrice) p.set('maxPrice', next.maxPrice);
    if (next.sort && next.sort !== 'featured') p.set('sort', next.sort);
    setSearchParams(p, { replace: true });
  }, [setSearchParams]);

  const current = useCallback(
    () => ({ search, category, minPrice, maxPrice, sort, page }),
    [search, category, minPrice, maxPrice, sort, page]
  );

  const load = useCallback(async () => {
    setState('loading');
    try {
      const c = current();
      const data = await fetchProducts({
        search: c.search || undefined,
        category: c.category || undefined,
        minPrice: c.minPrice || undefined,
        maxPrice: c.maxPrice || undefined,
        sort: c.sort,
        page: c.page,
        limit: 12
      });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setDevPreview(Boolean(data.devPreview));
      setState('ready');
    } catch (err) {
      setProducts([]);
      setError(err.message || 'Could not load products. Please try again.');
      setState('error');
    }
  }, [current]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCategories();
        if (!cancelled) setCategories(data.categories || []);
      } catch { /* category filter is optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPage(1);
    syncParams({ search, category, minPrice, maxPrice, sort });
  };

  const applySearchDebounced = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      syncParams({ search: value, category, minPrice, maxPrice, sort });
    }, 350);
  };

  const resetAll = () => {
    setSearch(''); setCategory(''); setMinPrice(''); setMaxPrice(''); setSort('featured');
    setPage(1);
    syncParams({});
  };

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      {devPreview && <DevPreviewBanner />}
      <nav className="breadcrumb"><Link to="/">Home</Link> / Shop</nav>
      <div className="section-head" style={{ textAlign: 'left', marginBottom: 18, padding: 0 }}>
        <small>THE COLLECTION</small>
        <h2 style={{ textAlign: 'left' }}>All products</h2>
      </div>

      <form className="panel" role="search" aria-label="Filter products" onSubmit={applyFilters}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="searchInput">Search</label>
            <input id="searchInput" type="text" placeholder="Search products, sets…" maxLength={80} autoComplete="off"
              value={search} onChange={(e) => applySearchDebounced(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="categorySelect">Category</label>
            <select id="categorySelect" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); syncParams({ search, category: e.target.value, minPrice, maxPrice, sort }); }}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="minPrice">Min ₹</label>
            <input id="minPrice" type="number" min={0} inputMode="numeric" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="maxPrice">Max ₹</label>
            <input id="maxPrice" type="number" min={0} inputMode="numeric" placeholder="5000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="sortSelect">Sort</label>
            <select id="sortSelect" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); syncParams({ search, category, minPrice, maxPrice, sort: e.target.value }); }}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-sm">Apply filters</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={resetAll}>Reset</button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {state === 'ready' && `${total} product${total === 1 ? '' : 's'} found · Page ${page} of ${pages}`}
          </span>
        </div>
      </form>

      {state === 'loading' && <div className="state-box">Loading products…</div>}
      {state === 'error' && <div className="state-box error">{error}</div>}
      {state === 'ready' && products.length === 0 && (
        <div className="state-box">No products match those filters. <button type="button" className="linkish" onClick={resetAll}>Clear filters</button></div>
      )}
      {state === 'ready' && products.length > 0 && (
        <div className="products" aria-live="polite" style={{ marginTop: 8 }}>
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      <div className="pagination">
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo(0, 0); }}>← Prev</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => { setPage((p) => Math.min(pages, p + 1)); window.scrollTo(0, 0); }}>Next →</button>
      </div>
    </div>
  );
}
