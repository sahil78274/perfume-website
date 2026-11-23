import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/ToastContext';
import { money } from '../utils/format';
import { STATES, PHONE_RE, PINCODE_RE } from '../utils/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMPTY_FORM = {
  name: '', phone: '', email: '', houseAndStreet: '', area: '', city: '',
  state: '', pincode: '', landmark: '', notes: ''
};

const validators = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
  phone: (v) => (PHONE_RE.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number.'),
  email: (v) => (!v.trim() || EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address (or leave blank).'),
  houseAndStreet: (v) => (v.trim().length >= 2 ? '' : 'House number and street are required.'),
  area: (v) => (v.trim().length >= 2 ? '' : 'Area / locality is required.'),
  city: (v) => (v.trim().length >= 2 ? '' : 'City is required.'),
  state: (v) => (v ? '' : 'Please select your state.'),
  pincode: (v) => (PINCODE_RE.test(v.trim()) ? '' : 'Enter a valid 6-digit PIN code.'),
  notes: (v) => (String(v).length <= 500 ? '' : 'Notes must be 500 characters or fewer.')
};

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const { user } = useCustomerAuth();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [shippingCharge, setShippingCharge] = useState(0);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [placing, setPlacing] = useState(false);

  const cartSignature = useMemo(() => items.map((i) => `${i.id}:${i.qty}`).join('|'), [items]);

  /* Idempotency key — one per cart state; reused across retries so a double-submit never creates two orders */
  const idempotencyKey = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('scentora_checkout_key');
      const stored = raw ? JSON.parse(raw) : null;
      if (stored && stored.signature === cartSignature) return stored.key;
      const key = crypto.randomUUID();
      sessionStorage.setItem('scentora_checkout_key', JSON.stringify({ signature: cartSignature, key }));
      return key;
    } catch {
      return `fallback-${Date.now()}`;
    }
  }, [cartSignature]);

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

  /* Prefill contact details + saved addresses when logged in */
  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: user.name || f.name, phone: user.phone || f.phone, email: user.email || f.email }));
      let cancelled = false;
      (async () => {
        try {
          const { data } = await api.get('/account/addresses');
          if (!cancelled) setAddresses(data.addresses || []);
        } catch { /* address book is optional at checkout */ }
      })();
      return () => { cancelled = true; };
    }
    return undefined;
  }, [user]);

  const shipping = freeShippingAbove !== null && subtotal >= freeShippingAbove ? 0 : shippingCharge;
  const total = subtotal + shipping;

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const validateField = (field) => {
    const message = validators[field] ? validators[field](form[field] ?? '') : '';
    setErrors((prev) => ({ ...prev, [field]: message }));
    return !message;
  };

  const applySavedAddress = (id) => {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setForm((f) => ({
      ...f,
      houseAndStreet: a.houseAndStreet || '', area: a.area || '', city: a.city || '',
      state: a.state || '', pincode: a.pincode || '', landmark: a.landmark || '',
      name: a.fullName || f.name, phone: a.phone || f.phone
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const fields = ['name', 'phone', 'email', 'houseAndStreet', 'area', 'city', 'state', 'pincode', 'notes'];
    const results = {};
    let allValid = true;
    for (const field of fields) {
      const message = validators[field](form[field] ?? '');
      results[field] = message;
      if (message) allValid = false;
    }
    setErrors((prev) => ({ ...prev, ...results }));
    if (!allValid) {
      toast('Please fix the highlighted fields.', 'error');
      const first = document.querySelector('.field-error.show');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setPlacing(true);
    const payload = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
      items: items.map((i) => ({ productId: i.id, qty: i.qty })),
      idempotencyKey
    };
    try {
      const { data } = await api.post('/orders', payload);
      try { sessionStorage.setItem('scentora_last_order', JSON.stringify({ orderNumber: data.order.orderNumber, phone: payload.phone })); } catch { /* ignore */ }
      clear();
      try { sessionStorage.removeItem('scentora_checkout_key'); } catch { /* ignore */ }
      navigate('/order-confirmation', { replace: true });
    } catch (err) {
      setPlacing(false);
      toast(err.message || 'Could not place your order. Please try again.', 'error');
    }
  };

  if (!items.length) {
    return (
      <div className="container" style={{ padding: '20px 20px 60px' }}>
        <nav className="breadcrumb"><Link to="/">Home</Link> / <Link to="/cart">Cart</Link> / Checkout</nav>
        <div className="empty-state">
          <h3>Your cart is empty</h3>
          <p>Add a fragrance or two before checking out.</p>
          <Link className="btn" to="/shop" style={{ marginTop: 10 }}>Browse the collection</Link>
        </div>
      </div>
    );
  }

  const fieldError = (field) => <div className={`field-error${errors[field] ? ' show' : ''}`}>{errors[field] || ''}</div>;
  const invalidClass = (field) => (errors[field] ? 'invalid' : '');

  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      <nav className="breadcrumb"><Link to="/">Home</Link> / <Link to="/cart">Cart</Link> / Checkout</nav>
      <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '6px 0 4px' }}>Checkout</h1>
      <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 0 }}>Cash on Delivery — you pay the delivery person in cash when your parcel arrives.</p>

      <form className="checkout-layout" noValidate onSubmit={submit}>
        <div>
          <div className="panel">
            <div className="cod-banner">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#d9b98b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M2 11h20" /></svg>
              <span><b>CASH ON DELIVERY</b><br />We never ask for card numbers, UPI PINs or banking passwords — not online, not over the phone.</span>
            </div>

            {addresses.length > 0 && (
              <div className="field">
                <label htmlFor="savedAddressSelect">Use a saved address</label>
                <select id="savedAddressSelect" defaultValue="" onChange={(e) => applySavedAddress(e.target.value)}>
                  <option value="">— Choose a saved address —</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.label || 'Address')} — {a.houseAndStreet}, {a.area}, {a.city} ({a.pincode}){a.isDefault ? ' · Default' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!user && (
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0' }}>
                Tip: <Link to="/account?next=/checkout">create an account</Link> or <Link to="/account?next=/checkout">log in</Link> to save your address for next time. Guest checkout works too.
              </p>
            )}

            <h2 className="serif" style={{ fontWeight: 400, fontSize: 20, marginTop: 14 }}>Contact &amp; delivery details</h2>
            <div className="form-grid">
              <div className="field full"><label htmlFor="custName">Full name <span className="req">*</span></label>
                <input id="custName" name="name" required maxLength={80} autoComplete="name" placeholder="Your full name"
                  className={invalidClass('name')} value={form.name} onChange={set('name')} onBlur={() => validateField('name')} />{fieldError('name')}</div>
              <div className="field"><label htmlFor="custPhone">Mobile number <span className="req">*</span></label>
                <input id="custPhone" name="phone" required inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit mobile"
                  className={invalidClass('phone')} value={form.phone} onChange={set('phone')} onBlur={() => validateField('phone')} />{fieldError('phone')}</div>
              <div className="field"><label htmlFor="custEmail">Email <span style={{ textTransform: 'none', color: 'var(--muted)' }}>(optional)</span></label>
                <input id="custEmail" name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com"
                  className={invalidClass('email')} value={form.email} onChange={set('email')} onBlur={() => validateField('email')} />{fieldError('email')}</div>
              <div className="field full"><label htmlFor="custHouse">House number &amp; street <span className="req">*</span></label>
                <input id="custHouse" name="houseAndStreet" required maxLength={200} placeholder="e.g. 42, Shivaji Marg, Near Hanuman Mandir"
                  className={invalidClass('houseAndStreet')} value={form.houseAndStreet} onChange={set('houseAndStreet')} onBlur={() => validateField('houseAndStreet')} />{fieldError('houseAndStreet')}</div>
              <div className="field full"><label htmlFor="custArea">Area / locality <span className="req">*</span></label>
                <input id="custArea" name="area" required maxLength={120} placeholder="e.g. Sector 12, Ashok Vihar"
                  className={invalidClass('area')} value={form.area} onChange={set('area')} onBlur={() => validateField('area')} />{fieldError('area')}</div>
              <div className="field"><label htmlFor="custCity">City <span className="req">*</span></label>
                <input id="custCity" name="city" required maxLength={80} placeholder="Panipat"
                  className={invalidClass('city')} value={form.city} onChange={set('city')} onBlur={() => validateField('city')} />{fieldError('city')}</div>
              <div className="field"><label htmlFor="custState">State <span className="req">*</span></label>
                <select id="custState" name="state" required className={invalidClass('state')}
                  value={form.state} onChange={set('state')} onBlur={() => validateField('state')}>
                  <option value="">Select state…</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {fieldError('state')}
              </div>
              <div className="field"><label htmlFor="custPin">PIN code <span className="req">*</span></label>
                <input id="custPin" name="pincode" required inputMode="numeric" maxLength={6} placeholder="6-digit PIN"
                  className={invalidClass('pincode')} value={form.pincode} onChange={set('pincode')} onBlur={() => validateField('pincode')} />{fieldError('pincode')}</div>
              <div className="field"><label htmlFor="custLandmark">Landmark <span style={{ textTransform: 'none', color: 'var(--muted)' }}>(optional)</span></label>
                <input id="custLandmark" name="landmark" maxLength={120} placeholder="e.g. Opposite city hospital" value={form.landmark} onChange={set('landmark')} /></div>
              <div className="field full"><label htmlFor="custNotes">Order notes <span style={{ textTransform: 'none', color: 'var(--muted)' }}>(optional)</span></label>
                <textarea id="custNotes" name="notes" maxLength={500} placeholder="Gift wrap request, delivery instructions…"
                  className={invalidClass('notes')} value={form.notes} onChange={set('notes')} onBlur={() => validateField('notes')} />{fieldError('notes')}</div>
            </div>
          </div>
        </div>

        <aside className="summary-card" aria-label="Order summary">
          <div className="panel-title"><h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Order summary</h2><Link to="/cart" style={{ fontSize: 11 }}>Edit cart</Link></div>
          <div className="order-summary-items">
            {items.map((i) => (
              <div className="osi-row" key={i.id}><span>{i.name} × {i.qty}</span><span>{money(i.price * i.qty)}</span></div>
            ))}
          </div>
          <div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : money(shipping)}</span></div>
          <div className="summary-row total"><span>Total · COD</span><span>{money(total)}</span></div>
          <button type="submit" className="btn btn-gold btn-full" disabled={placing} style={{ marginTop: 12 }}>
            {placing ? 'Placing your order…' : 'Place COD order'}
          </button>
          <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '10px 0 0' }}>
            By placing this order you agree to be contacted by phone about delivery. See our <Link to="/privacy">privacy notice</Link>. We never store card or banking details.
          </p>
        </aside>
      </form>
    </div>
  );
}
