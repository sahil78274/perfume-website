import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, pillClass, fmtDateTime } from '../utils/format';

export default function OrderConfirmation() {
  const [state, setState] = useState('loading'); // loading | ready | missing
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem('scentora_last_order') || 'null'); } catch { stored = null; }
    if (!stored?.orderNumber || !stored?.phone) { setState('missing'); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post('/orders/track', { phone: stored.phone });
        if (cancelled) return;
        const matchedOrder = (data.orders || []).find((item) => item.orderNumber === stored.orderNumber);
        if (!matchedOrder) { setState('missing'); return; }
        setOrder(matchedOrder);
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
          <p>Your order was received. Track its progress using the mobile number entered at checkout.</p>
          <Link className="btn" to="/track-order" style={{ marginTop: 10 }}>Track my orders</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '34px 20px 60px', maxWidth: 860 }}>
      <div style={{ textAlign: 'center', margin: '8px 0 22px' }}>
        <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#1c6e3c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '0 0 6px' }}>Order received!</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>Your COD order has been placed successfully.</p>
        <div style={{ marginTop: 12 }}><span className={pillClass(order.status)}>{order.status}</span></div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Order {order.orderNumber}</h2>
          <span className="badge-cod">COD · {money(order.total)}</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Placed {fmtDateTime(order.createdAt)}</p>
        {(order.items || []).map((item, index) => (
          <div className="osi-row" key={`${item.name}-${index}`}>
            <span>{item.name} × {item.qty}</span>
          </div>
        ))}
        <div className="summary-row total"><span>Total payable on delivery</span><span>{money(order.total)}</span></div>
        {order.trackingInfo?.reference && <p>Tracking reference: <strong>{order.trackingInfo.reference}</strong></p>}
      </div>

      <div className="panel">
        <h3>Order status timeline</h3>
        <ul className="timeline">
          {(order.timeline?.length ? order.timeline : [{ status: order.status, at: order.createdAt }]).map((step, index) => (
            <li className="done" key={`${step.status}-${step.at || index}`}>
              <strong>{step.status}</strong><br /><small>{fmtDateTime(step.at)}</small>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
        <Link className="btn" to="/shop">Continue shopping</Link>
        <Link className="btn btn-outline" to="/track-order">Track my orders</Link>
        <Link className="btn btn-outline" to="/account">My orders</Link>
      </div>
    </div>
  );
}
