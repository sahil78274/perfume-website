import { useState } from 'react';
import api from '../api/axios';
import { money, pillClass, fmtDateTime } from '../utils/format';
import { PHONE_RE } from '../utils/constants';

export default function TrackOrder() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const mobile = phone.trim();
    if (!PHONE_RE.test(mobile)) {
      setOrders(null);
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setBusy(true);
    setError('');
    setOrders(null);
    try {
      const { data } = await api.post('/orders/track', { phone: mobile });
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (requestError) {
      setError(requestError.message || 'We could not load your orders. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="track-page">
      <header className="track-intro">
        <span className="track-eyebrow">SCENTORA · ORDER CARE</span>
        <h1 className="serif">Track your orders</h1>
        <p>Enter the mobile number used at checkout to see your latest order updates.</p>
      </header>

      <form className="track-form" onSubmit={submit} noValidate>
        <label htmlFor="trackPhone">Mobile number</label>
        <div className="track-phone-control">
          <span className="track-country-code" aria-label="India country code">+91</span>
          <input
            id="trackPhone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            aria-describedby="trackPhoneHint"
            value={phone}
            maxLength={10}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </div>
        <small id="trackPhoneHint">Use the 10-digit Indian mobile number linked to your order.</small>
        <button type="submit" className="btn track-submit" disabled={busy}>
          {busy ? 'Finding your orders…' : 'Track My Orders'}
        </button>
      </form>

      {error && <div className="track-message track-error" role="alert">{error}</div>}

      {orders && orders.length === 0 && (
        <div className="track-message track-empty" role="status">No orders found for this mobile number.</div>
      )}

      {orders?.length > 0 && (
        <section className="track-results" aria-live="polite">
          <div className="track-results-heading">
            <h2 className="serif">Your orders</h2>
            <span>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
          </div>
          {orders.map((order) => (
            <article className="track-order-card" key={order.orderNumber}>
              <div className="track-order-head">
                <div>
                  <span className="track-order-label">ORDER ID</span>
                  <h3>{order.orderNumber}</h3>
                  <time dateTime={order.createdAt}>Placed {fmtDateTime(order.createdAt)}</time>
                </div>
                <span className={pillClass(order.status)}>{order.status}</span>
              </div>

              <div className="track-items">
                {(order.items || []).map((item, index) => (
                  <div className="track-item" key={`${item.name}-${index}`}>
                    <img
                      src={item.image || '/images/favicon.svg'}
                      alt={item.name}
                      loading="lazy"
                      onError={(event) => { event.currentTarget.src = '/images/favicon.svg'; }}
                    />
                    <div className="track-item-info">
                      <strong>{item.name}</strong>
                      <span>Quantity: {item.qty}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="track-order-meta">
                <div><span>Payment method</span><strong>Cash on Delivery</strong></div>
                <div className="track-total"><span>Order total</span><strong>{money(order.total)}</strong></div>
              </div>

              <div className="track-history">
                <h4>Order status timeline</h4>
                <ol className="timeline">
                  {(order.timeline?.length ? order.timeline : [{ status: order.status, at: order.createdAt }]).map((step, index) => (
                    <li className="done" key={`${step.status}-${step.at || index}`}>
                      <strong>{step.status}</strong>
                      <br />
                      <small>{fmtDateTime(step.at)}</small>
                    </li>
                  ))}
                </ol>
              </div>

              {order.trackingInfo?.reference && (
                <div className="track-shipment-info">
                  <span>Tracking information</span>
                  <strong>{order.trackingInfo.reference}</strong>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
