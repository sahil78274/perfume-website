import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, pillClass, ORDER_STEPS } from '../utils/format';

function Timeline({ status }) {
  if (['Cancelled', 'RTO', 'Returned'].includes(status)) {
    return (
      <div className="cod-note" style={{ background: '#fdeeee', borderColor: '#ecc9c9', color: '#a33' }}>
        <span>This order is marked <strong>{status}</strong>. Please contact support if you believe this is a mistake.</span>
      </div>
    );
  }
  const current = Math.max(0, ORDER_STEPS.indexOf(status));
  return (
    <ul className="timeline">
      {ORDER_STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'done now' : ''}><strong>{s}</strong></li>
      ))}
    </ul>
  );
}

export default function OrderConfirmation() {
  const [state, setState] = useState('loading'); // loading | ready | missing
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem('scentora_last_order') || 'null'); } catch { stored = null; }
    if (!stored || !stored.orderNumber) { setState('missing'); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post('/orders/track', { orderNumber: stored.orderNumber, phone: stored.phone });
        if (cancelled) return;
        setOrder(data.order);
        setState('ready');
      } catch {
        if (!cancelled) setState('missing');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return <div className="container" style={{ padding: '34px 20px' }}><div className="state-box">Loading your order…</div></div>;
  }

  if (state === 'missing' || !order) {
    return (
      <div className="container" style={{ padding: '34px 20px 60px', maxWidth: 860 }}>
        <div className="empty-state">
          <h3>Order placed!</h3>
          <p>Your order was received, but we couldn't reload the details on this device. You can look it up any time with your order ID and mobile number.</p>
          <Link className="btn" to="/track-order" style={{ marginTop: 10 }}>Track my order</Link>
        </div>
      </div>
    );
  }

  const o = order;
  const addr = o.shippingAddress || {};

  return (
    <div className="container" style={{ padding: '34px 20px 60px', maxWidth: 860 }}>
      <div style={{ textAlign: 'center', margin: '8px 0 22px' }}>
        <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#1c6e3c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '0 0 6px' }}>Order received!</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Thank you, {o.contact.name}. We'll call <strong>{o.contact.phone}</strong> to confirm your order before dispatch.
        </p>
        <div style={{ marginTop: 12 }}><span className={pillClass(o.status)}>{o.status}</span></div>
      </div>

      <div className="panel">
        <div className="panel-title"><h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Order {o.orderNumber}</h2><span className="badge-cod">COD · {money(o.total)}</span></div>
        {(o.items || []).map((i, idx) => (
          <div className="osi-row" key={idx}><span>{i.name} × {i.qty}</span><span>{money(i.lineTotal)}</span></div>
        ))}
        <div className="summary-row"><span>Subtotal</span><span>{money(o.itemsSubtotal)}</span></div>
        <div className="summary-row"><span>Shipping</span><span>{o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
        <div className="summary-row total"><span>Total payable on delivery</span><span>{money(o.total)}</span></div>
      </div>

      <div className="panel">
        <h3>Delivery details</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: '6px 0' }}>
          {[addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', ')}<br />
          PIN {addr.pincode}{addr.landmark ? <><br />Landmark: {addr.landmark}</> : null}
        </p>
        <h3 style={{ marginTop: 16 }}>What happens next</h3>
        <Timeline status={o.status} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
        <Link className="btn" to="/shop">Continue shopping</Link>
        <Link className="btn btn-outline" to="/track-order">Track this order</Link>
        <Link className="btn btn-outline" to="/account">My orders</Link>
      </div>
    </div>
  );
}
