import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { money } from '../utils/format';

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart();
  const [shippingCharge, setShippingCharge] = useState(0);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/settings');
        if (cancelled) return;
        setShippingCharge(Number(data.shippingCharge) || 0);
        setFreeShippingAbove(
          data.freeShippingAbove === null || data.freeShippingAbove === undefined ? null : Number(data.freeShippingAbove)
        );
      } catch { /* fall back to free-shipping display when settings are unavailable */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const shipping = useMemo(
    () => (freeShippingAbove !== null && subtotal >= freeShippingAbove ? 0 : shippingCharge),
    [subtotal, freeShippingAbove, shippingCharge]
  );

  if (!items.length) {
    return (
      <div className="container" style={{ padding: '20px 20px 60px' }}>
        <nav className="breadcrumb"><Link to="/">Home</Link> / Cart</nav>
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="#b58b52" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
          <h3>Your cart is empty</h3>
          <p>Looks like you haven't added any fragrances yet.</p>
          <Link className="btn" to="/shop" style={{ marginTop: 10 }}>Browse the collection</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      <nav className="breadcrumb"><Link to="/">Home</Link> / Cart</nav>
      <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '6px 0 18px' }}>Your cart</h1>

      <div className="cart-layout">
        <div>
          {items.map((item) => (
            <div className="cart-item" key={item.id}>
              <Link to={`/product/${item.slug}`}><img src={item.image} alt={item.name} /></Link>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0' }}>{money(item.price)} each</div>
                <div className="qty-control">
                  <button type="button" aria-label="Decrease quantity" onClick={() => setQty(item.id, item.qty - 1)}>−</button>
                  <input type="number" min={1} max={20} value={item.qty} aria-label="Quantity"
                    onChange={(e) => setQty(item.id, Number(e.target.value))} />
                  <button type="button" aria-label="Increase quantity" onClick={() => setQty(item.id, item.qty + 1)}>+</button>
                </div>
                <div><button type="button" className="remove-link" onClick={() => remove(item.id)}>Remove from cart</button></div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{money(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <aside className="summary-card" aria-label="Order summary">
          <h2 className="serif" style={{ fontWeight: 400, fontSize: 21, margin: '0 0 10px' }}>Order summary</h2>
          <div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : money(shipping)}</span></div>
          <div className="summary-row total"><span>Total (COD)</span><span>{money(subtotal + shipping)}</span></div>
          <div className="cod-note">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M2 11h20" /></svg>
            <span><strong>Cash on Delivery</strong><br />Pay in cash only when your order is delivered to you.</span>
          </div>
          <Link className="btn btn-gold btn-full" to="/checkout">Proceed to checkout →</Link>
          <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '10px 0 0', textAlign: 'center' }}>You won't be charged now · No advance payment</p>
        </aside>
      </div>
    </div>
  );
}
