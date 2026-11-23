import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchProductBySlug, fetchProducts } from '../services/products';
import { money } from '../utils/format';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ProductCard from '../components/ProductCard';
import DevPreviewBanner from '../components/DevPreviewBanner';

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [devPreview, setDevPreview] = useState(false);
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const data = await fetchProductBySlug(slug);
        if (cancelled) return;
        setProduct(data.product);
        setDevPreview(Boolean(data.devPreview));
        setIndex(0);
        setQty(1);
        setState('ready');
        document.title = `${data.product.name} — SCENTORA`;
      } catch (err) {
        if (cancelled) return;
        setError(err.status === 404
          ? 'This product could not be found (it may be out of season or discontinued).'
          : err.message || 'Could not load this product.');
        setState('error');
      }
    })();
    return () => { cancelled = true; document.title = 'SCENTORA — Fragrance Store'; };
  }, [slug]);

  /* Related products (same category) */
  useEffect(() => {
    if (!product) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rel = await fetchProducts({ limit: 4, category: (product.category && product.category.slug) || undefined });
        if (!cancelled) setRelated((rel.products || []).filter((p) => p.slug !== product.slug).slice(0, 3));
      } catch {
        if (!cancelled) setRelated([]);
      }
    })();
    return () => { cancelled = true; };
  }, [product]);

  const images = useMemo(
    () => (product && product.images && product.images.length
      ? product.images
      : [{ url: '/images/products/gift-set-1.jpg', alt: (product && product.name) || 'Product photo' }]),
    [product]
  );

  const render = useCallback((i) => setIndex(((i % images.length) + images.length) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (state === 'loading') {
    return <div className="container" style={{ padding: '30px 20px' }}><div className="state-box">Loading product…</div></div>;
  }
  if (state === 'error') {
    return (
      <div className="container" style={{ padding: '30px 20px 60px' }}>
        <nav className="breadcrumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / Product</nav>
        <div className="state-box error">{error}</div>
        <div style={{ textAlign: 'center', marginTop: 16 }}><Link className="btn" to="/shop">Browse the shop</Link></div>
      </div>
    );
  }

  const p = product;
  const inStock = p.inStock !== false;
  const save = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice - p.price : 0;
  const cartPayload = () => ({
    id: p.id, slug: p.slug, name: p.name, price: p.price,
    image: (p.images && p.images[0] && p.images[0].url) || ''
  });

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      {devPreview && <DevPreviewBanner />}
      <nav className="breadcrumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / <span>{p.name}</span></nav>

      <div className="two-col">
        <div>
          <div className="gallery">
            <div className="gallery-stage">
              <img src={images[index].url} alt={images[index].alt || p.name} onClick={() => setLightbox(true)} style={{ cursor: 'zoom-in' }} />
              <button type="button" className="gallery-arrow prev" aria-label="Previous photo" onClick={() => render(index - 1)}>‹</button>
              <button type="button" className="gallery-arrow next" aria-label="Next photo" onClick={() => render(index + 1)}>›</button>
            </div>
            <div className="gallery-dots" aria-label="Photo selector">
              {images.map((img, i) => (
                <button key={i} type="button" className={i === index ? 'active' : undefined} aria-label={`Photo ${i + 1}`} onClick={() => render(i)} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="tag">{(p.category && p.category.name) || 'Perfume'}</div>
          <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '8px 0 10px' }}>{p.name}</h1>
          <div className="price" style={{ margin: '4px 0 6px' }}>
            <strong style={{ fontSize: 28 }}>{money(p.price)}</strong>
            {save > 0 && <del style={{ marginLeft: 10 }}>{money(p.compareAtPrice)}</del>}
            {save > 0 && <span className="save-note" style={{ marginLeft: 10 }}>You save {money(save)}</span>}
          </div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>
            {inStock
              ? <span style={{ color: 'var(--ok)', fontWeight: 700 }}>● In stock</span>
              : <span style={{ color: 'var(--danger)', fontWeight: 700 }}>● Out of stock</span>}
            {inStock && ' — usually dispatched after phone confirmation'}
          </div>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.7 }}>{p.shortDescription}</p>
          <span className="badge-cod">Cash on Delivery · Pay at your doorstep</span>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0' }}>
            <div className="qty-control" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <input type="number" min={1} max={20} value={qty} inputMode="numeric" aria-label="Quantity"
                onChange={(e) => setQty(Math.min(20, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
              <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
            </div>
            <button type="button" className="btn" disabled={!inStock}
              onClick={() => { add(cartPayload(), qty); toast('Added to your cart', 'success'); }}>
              {inStock ? 'Add to Cart' : 'Out of stock'}
            </button>
            <button type="button" className="btn btn-gold" disabled={!inStock}
              onClick={() => { add(cartPayload(), qty); navigate('/checkout'); }}>
              {inStock ? 'Buy Now — COD' : 'Out of stock'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>Every order is confirmed by phone before dispatch. No advance payment required.</p>

          <div className="panel" style={{ marginTop: 18 }}>
            <h3>Specifications</h3>
            <table className="specs">
              <tbody>
                {(Array.isArray(p.specs) && p.specs.length ? p.specs : [{ label: 'Contents', value: 'See product description' }]).map((s) => (
                  <tr key={s.label}><td>{s.label}</td><td>{s.value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {p.description && (
        <div className="panel" style={{ marginTop: 10 }}>
          <h3>About this product</h3>
          <p style={{ color: '#444', lineHeight: 1.8, fontSize: 14 }}>{p.description}</p>
        </div>
      )}

      <div className="section" style={{ paddingTop: 44 }}>
        <div className="section-head"><small>YOU MAY ALSO LIKE</small><h2 style={{ fontSize: 26 }}>More from the collection</h2></div>
        {related.length
          ? <div className="products">{related.map((rp) => <ProductCard key={rp.id} product={rp} />)}</div>
          : <p className="state-box">More products coming soon.</p>}
      </div>

      {lightbox && (
        <div className="lightbox show" role="dialog" aria-label="Product photo viewer" onClick={() => setLightbox(false)}>
          <button type="button" className="lightbox-close" aria-label="Close viewer" onClick={() => setLightbox(false)}>✕</button>
          <img src={images[index].url} alt={images[index].alt || p.name} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
