import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, pillClass, ORDER_STEPS, fmtDateTime } from '../utils/format';
import { PHONE_RE } from '../utils/constants';
import { useToast } from '../context/ToastContext';

export default function TrackOrder() {
  const { toast } = useToast();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const on = orderNumber.trim().toUpperCase();
    const ph = phone.trim();
    if (!on) { toast('Please enter your order ID.', 'error'); return; }
    if (!PHONE_RE.test(ph)) { toast('Enter a valid 10-digit Indian mobile number.', 'error'); return; }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/orders/track', { orderNumber: on, phone: ph });
      setOrder(data.order);
    } catch (err) {
      setOrder(null);
      setError(err.message || 'Could not find that order. Check the order ID and mobile number.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ padding: '34px 20px 60px', maxWidth: 760 }}>
      <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '6px 0 4px' }}>Track your order</h1>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 0 }}>Enter the order ID from your confirmation and the 10-digit mobile number used at checkout. Works for guest orders too.</p>

      <form className="panel" style={{ marginTop: 14 }} onSubmit={submit}>
        <div className="form-grid">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="orderNumber">Order ID <span className="req">*</span></label>
            <input id="orderNumber" name="orderNumber" required maxLength={40} placeholder="e.g. SC-261123-0001" autoComplete="off"
              style={{ textTransform: 'uppercase' }} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="trackPhone">Mobile number <span className="req">*</span></label>
            <input id="trackPhone" name="phone" required inputMode="numeric" maxLength={10} placeholder="10-digit mobile" autoComplete="tel-national"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Looking up…' : 'Track order'}</button>
      </form>

      {error && <div className="state-box error" style={{ marginTop: 18 }}>{error}</div>}

      {order && (
        <div style={{ marginTop: 18 }}>
          <div className="panel">
            <div className="panel-title"><h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Order {order.orderNumber}</h2><span className={pillClass(order.status)}>{order.status}</span></div>
            {(order.items || []).map((i, idx) => (
              <div className="osi-row" key={idx}><span>{i.name} × {i.qty}</span><span>{money(i.lineTotal)}</span></div>
            ))}
            <div className="summary-row"><span>Subtotal</span><span>{money(order.itemsSubtotal)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>{order.shippingCharge === 0 ? 'FREE' : money(order.shippingCharge)}</span></div>
            <div className="summary-row total"><span>Total · COD</span><span>{money(order.total)}</span></div>
          </div>

          <div className="panel">
            <h3>Delivery to</h3>
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>
              {order.contact.name}<br />
              {[order.shippingAddress?.houseAndStreet, order.shippingAddress?.area, order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ')}<br />
              PIN {order.shippingAddress?.pincode}
            </p>
            <h3 style={{ marginTop: 14 }}>Progress</h3>
            {['Cancelled', 'RTO', 'Returned'].includes(order.status) ? (
              <div className="cod-note" style={{ background: '#fdeeee', borderColor: '#ecc9c9', color: '#a33' }}>
                <span><strong>{order.status}</strong>{order.timeline?.length ? ' — ' + (order.timeline[order.timeline.length - 1].note || '') : ''}</span>
              </div>
            ) : (
              <ul className="timeline">
                {ORDER_STEPS.map((s, i) => {
                  const current = Math.max(0, ORDER_STEPS.indexOf(order.status));
                  return <li key={s} className={i < current ? 'done' : i === current ? 'done now' : ''}><strong>{s}</strong></li>;
                })}
              </ul>
            )}
            <h3 style={{ marginTop: 14 }}>History</h3>
            <ul className="timeline">
              {(order.timeline || []).map((t, i) => (
                <li key={i} className="done"><strong>{t.status}</strong><br /><small>{fmtDateTime(t.at)}{t.note ? ' · ' + t.note : ''}</small></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
