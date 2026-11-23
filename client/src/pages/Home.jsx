import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../services/products';
import ProductCard from '../components/ProductCard';
import DevPreviewBanner from '../components/DevPreviewBanner';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [devPreview, setDevPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchProducts({ featured: 'true', limit: 6 });
        if (cancelled) return;
        setProducts(data.products || []);
        setDevPreview(Boolean(data.devPreview));
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load products. Please refresh the page.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {devPreview && <DevPreviewBanner />}

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="eyebrow">A signature, in every drop</div>
            <h1>Make every<br />moment linger.</h1>
            <p>Explore curated fragrance gift sets, perfume combos and pocket scents for everyday wear and gifting, delivered with Cash on Delivery across India.</p>
            <Link className="btn btn-gold" to="/shop">Explore the collection&nbsp;&nbsp;→</Link>
          </div>
        </div>
      </section>

      <div className="trust" aria-hidden="true">
        <div>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 16.9 6.7 18.3l1.2-5.9L3.4 8.3l6-.7z" /></svg>
          <b>Carefully selected</b>Curated fragrances, honest pricing
        </div>
        <div>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M2 11h20" /></svg>
          <b>Cash on delivery</b>Pay only when your parcel arrives
        </div>
        <div>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.6 8.6 0 0 1-3.8-.85L3 20l1.15-5.5A8.2 8.2 0 0 1 3.4 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z" /></svg>
          <b>Order support</b>Real humans, via your order phone number
        </div>
      </div>

      <section className="section container">
        <div className="section-head">
          <small>THE COLLECTION</small>
          <h2>Featured fragrances &amp; gift sets</h2>
          <p>Handpicked sets from the SCENTORA catalogue. Every order is confirmed by phone before dispatch.</p>
        </div>

        {state === 'loading' && <div className="state-box">Loading the collection…</div>}
        {state === 'error' && <div className="state-box error">{error}</div>}
        {state === 'ready' && products.length === 0 && (
          <div className="state-box">No featured products right now — please check back soon.</div>
        )}
        {state === 'ready' && products.length > 0 && (
          <div className="products">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
          <Link className="btn btn-outline" to="/shop">View all products&nbsp;&nbsp;→</Link>
        </div>
      </section>

      <section className="about">
        <h2>More than a fragrance.</h2>
        <p>A scent is a small detail that says a lot. SCENTORA brings you carefully selected perfume gift sets and everyday duos with simple shopping, clear pricing and convenient cash-on-delivery ordering.</p>
      </section>
    </>
  );
}
