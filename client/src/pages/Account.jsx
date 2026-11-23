import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/ToastContext';
import { money, pillClass, fmtDate, fmtDateTime, ORDER_STEPS } from '../utils/format';
import { STATES, PHONE_RE, PINCODE_RE } from '../utils/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const CANCELLABLE = ['Pending Confirmation', 'New Order', 'Confirmed'];

/* ================= Orders tab ================= */
function OrdersTab() {
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    setState('loading');
    try {
      const { data } = await api.get('/account/orders', { params: { limit: 20 } });
      setOrders(data.orders || []);
      setState('ready');
    } catch (err) {
      setState('error');
      toast(err.message || 'Could not load your orders.', 'error');
    }
  }, [toast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openDetail = async (orderNumber) => {
    setBusy(true);
    try {
      const { data } = await api.get(`/account/orders/${encodeURIComponent(orderNumber)}`);
      setDetail(data.order);
    } catch (err) {
      toast(err.message || 'Could not load the order.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderNumber) => {
    if (!window.confirm('Cancel this order? If it has not started fulfilment, stock will be released immediately.')) return;
    try {
      await api.post(`/account/orders/${encodeURIComponent(orderNumber)}/cancel`, {});
      toast('Your order has been cancelled.', 'success');
      await loadOrders();
      if (detail && detail.orderNumber === orderNumber) openDetail(orderNumber);
    } catch (err) {
      toast(err.message || 'Could not cancel the order.', 'error');
    }
  };

  return (
    <div className="tab-panel">
      {state === 'loading' && <div className="state-box">Loading your orders…</div>}
      {state === 'error' && <div className="state-box error">We couldn't load your orders. Please try again.</div>}
      {state === 'ready' && orders.length === 0 && (
        <div className="empty-state"><h3>No orders yet</h3><p>When you place your first order it will show up here.</p><Link className="btn" to="/shop" style={{ marginTop: 8 }}>Browse the collection</Link></div>
      )}
      {state === 'ready' && orders.map((o) => (
        <div key={o.orderNumber} className="panel" style={{ cursor: 'pointer' }} onClick={() => openDetail(o.orderNumber)}>
          <div className="panel-title">
            <div><h3 style={{ margin: 0 }}>Order {o.orderNumber}</h3><small className="muted">{fmtDateTime(o.createdAt)} · {o.itemsCount} item(s) · COD</small></div>
            <span className={pillClass(o.status)}>{o.status}</span>
          </div>
          <div className="summary-row" style={{ border: 0, paddingBottom: 0 }}><span>Total</span><b>{money(o.total)}</b></div>
        </div>
      ))}

      {detail && (
        <div className="panel" style={{ marginTop: 12, borderColor: 'var(--gold)' }}>
          <div className="panel-title">
            <h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Order {detail.orderNumber}</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>Close</button>
          </div>
          {(detail.items || []).map((i, idx) => (
            <div className="osi-row" key={idx}><span>{i.name} × {i.qty}</span><span>{money(i.lineTotal)}</span></div>
          ))}
          <div className="summary-row"><span>Subtotal</span><span>{money(detail.itemsSubtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{detail.shippingCharge === 0 ? 'FREE' : money(detail.shippingCharge)}</span></div>
          <div className="summary-row total"><span>Total · COD</span><span>{money(detail.total)}</span></div>
          <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
            <strong>Deliver to:</strong> {[detail.shippingAddress?.houseAndStreet, detail.shippingAddress?.area, detail.shippingAddress?.city, detail.shippingAddress?.state].filter(Boolean).join(', ')} · PIN {detail.shippingAddress?.pincode}
          </p>
          {(detail.timeline || []).length > 0 && (
            <ul className="timeline">{detail.timeline.map((t, i) => <li key={i} className="done"><strong>{t.status}</strong><br /><small>{fmtDateTime(t.at)}{t.note ? ' · ' + t.note : ''}</small></li>)}</ul>
          )}
          {CANCELLABLE.includes(detail.status) && (
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} style={{ marginTop: 10 }} onClick={() => cancelOrder(detail.orderNumber)}>Cancel this order</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Addresses tab ================= */
const EMPTY_ADDRESS = { label: '', fullName: '', phone: '', pincode: '', houseAndStreet: '', area: '', city: '', state: '', landmark: '', isDefault: false };

function AddressesTab() {
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { data } = await api.get('/account/addresses');
      setAddresses(data.addresses || []);
      setState('ready');
    } catch (err) {
      setState('error');
      toast(err.message || 'Could not load addresses.', 'error');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const a = editing;
    if (!PHONE_RE.test(a.phone.trim())) { toast('Enter a valid 10-digit mobile number.', 'error'); return; }
    if (!PINCODE_RE.test(a.pincode.trim())) { toast('Enter a valid 6-digit PIN code.', 'error'); return; }
    setBusy(true);
    const payload = { ...a, fullName: a.fullName.trim(), phone: a.phone.trim(), pincode: a.pincode.trim() };
    try {
      if (a.id) await api.patch(`/account/addresses/${a.id}`, payload);
      else await api.post('/account/addresses', payload);
      toast('Address saved.', 'success');
      setEditing(null);
      load();
    } catch (err) {
      toast(err.message || 'Could not save the address.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (id) => {
    try { await api.post(`/account/addresses/${id}/default`, {}); toast('Default address updated.', 'success'); load(); }
    catch (err) { toast(err.message || 'Could not update default.', 'error'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try { await api.delete(`/account/addresses/${id}`); toast('Address deleted.'); load(); }
    catch (err) { toast(err.message || 'Could not delete.', 'error'); }
  };

  const field = (label, key, opts = {}) => (
    <div className={`field${opts.full ? ' full' : ''}`}>
      <label htmlFor={`addr-${key}`}>{label}{opts.req && <span className="req"> *</span>}</label>
      <input id={`addr-${key}`} maxLength={opts.max || 200} inputMode={opts.inputMode} value={editing[key] ?? ''}
        onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} required={opts.req} />
    </div>
  );

  return (
    <div className="tab-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ fontWeight: 400, fontSize: 20, margin: '4px 0' }}>Saved addresses</h2>
        {!editing && <button type="button" className="btn btn-sm" onClick={() => setEditing({ ...EMPTY_ADDRESS })}>+ Add address</button>}
      </div>

      {editing && (
        <form className="panel" style={{ marginTop: 10 }} onSubmit={submit}>
          <h3>{editing.id ? 'Edit address' : 'Add a new address'}</h3>
          <div className="form-grid">
            {field('Label', 'label', { max: 40 })}
            {field('Recipient name', 'fullName', { req: true, max: 80 })}
            {field('Mobile', 'phone', { req: true, max: 10, inputMode: 'numeric' })}
            {field('PIN code', 'pincode', { req: true, max: 6, inputMode: 'numeric' })}
            {field('House number & street', 'houseAndStreet', { req: true, max: 200, full: true })}
            {field('Area / locality', 'area', { req: true, max: 120, full: true })}
            {field('City', 'city', { req: true, max: 80 })}
            <div className="field">
              <label htmlFor="addr-state">State<span className="req"> *</span></label>
              <select id="addr-state" required value={editing.state} onChange={(e) => setEditing({ ...editing, state: e.target.value })}>
                <option value="">Select state…</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {field('Landmark', 'landmark', { max: 120 })}
            <div className="field" style={{ display: 'flex', alignItems: 'end' }}>
              <label className="checkbox-row" style={{ marginBottom: 13 }}>
                <input type="checkbox" checked={Boolean(editing.isDefault)} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} /> Make this my default address
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="submit" className="btn btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {state === 'loading' && <div className="state-box">Loading addresses…</div>}
      {state === 'ready' && addresses.length === 0 && !editing && (
        <div className="state-box">No saved addresses yet — add one to speed up checkout.</div>
      )}
      <div id="addressesList" style={{ marginTop: 12 }}>
        {addresses.map((a) => (
          <div className="address-card" key={a.id}>
            <div>
              <strong>{a.label || 'Address'}</strong>{a.isDefault && <span className="default-tag">Default</span>}
              <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.6 }}>
                {a.fullName} · {a.phone}<br />
                {[a.houseAndStreet, a.area, a.city, a.state].filter(Boolean).join(', ')} · PIN {a.pincode}
                {a.landmark && <><br />Landmark: {a.landmark}</>}
              </div>
            </div>
            <div className="address-actions">
              {!a.isDefault && <button type="button" className="linkish" onClick={() => makeDefault(a.id)}>Make default</button>}
              <button type="button" className="linkish" onClick={() => setEditing({ ...a })}>Edit</button>
              <button type="button" className="linkish" style={{ color: 'var(--danger)' }} onClick={() => remove(a.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Profile & security tabs ================= */
function ProfileTab() {
  const { user, refresh } = useCustomerAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [promoConsent, setPromoConsent] = useState(Boolean(user?.promoConsent));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPromoConsent(Boolean(user?.promoConsent));
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    if (email.trim() && !EMAIL_RE.test(email.trim())) { toast('Enter a valid email or leave it blank.', 'error'); return; }
    setBusy(true);
    try {
      await api.patch('/auth/me', { name: name.trim(), email: email.trim(), promoConsent });
      await refresh();
      toast('Profile saved.', 'success');
    } catch (err) {
      toast(err.message || 'Could not save your profile.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tab-panel">
      <form className="panel" style={{ maxWidth: 480 }} onSubmit={submit}>
        <h2 className="serif" style={{ fontWeight: 400, fontSize: 20 }}>Profile</h2>
        <div className="field"><label htmlFor="profileName">Full name</label><input id="profileName" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="profilePhone">Mobile number</label><input id="profilePhone" disabled value={user?.phone || ''} /><div className="hint">Mobile number is your login ID and can't be changed here. Contact support to update it.</div></div>
        <div className="field"><label htmlFor="profileEmail">Email <span style={{ textTransform: 'none', color: 'var(--muted)' }}>(optional)</span></label><input id="profileEmail" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <label className="checkbox-row" style={{ margin: '10px 0' }}><input type="checkbox" checked={promoConsent} onChange={(e) => setPromoConsent(e.target.checked)} /><span>Send me offers and new-arrival updates (optional).</span></label>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!PASSWORD_RE.test(newPassword)) { toast('Password must be at least 8 characters with 1 letter and 1 number.', 'error'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword('');
      toast('Password updated.', 'success');
    } catch (err) {
      toast(err.message || 'Could not update your password.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tab-panel">
      <form className="panel" style={{ maxWidth: 480 }} onSubmit={submit}>
        <h2 className="serif" style={{ fontWeight: 400, fontSize: 20 }}>Change password</h2>
        <div className="field"><label htmlFor="currentPassword">Current password</label><input id="currentPassword" type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
        <div className="field"><label htmlFor="newPassword">New password</label><input id="newPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters, 1 letter + 1 number" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  );
}

/* ================= Auth (logged-out) view ================= */
function AuthView() {
  const { login, register } = useCustomerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [promoText, setPromoText] = useState('Send me offers and new-arrival updates (optional).');
  const [busy, setBusy] = useState(false);

  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', phone: '', email: '', password: '', promoConsent: false });

  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') ? next : null;
  const goAfterAuth = useCallback(() => {
    if (safeNext) navigate(safeNext, { replace: true });
  }, [safeNext, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/settings');
        if (!cancelled && data.promoConsentText) setPromoText(data.promoConsentText);
      } catch { /* keep default copy */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!PHONE_RE.test(loginForm.phone.trim())) { toast('Enter a valid 10-digit mobile number.', 'error'); return; }
    setBusy(true);
    try {
      await login(loginForm.phone.trim(), loginForm.password);
      toast('Welcome back!', 'success');
      goAfterAuth();
    } catch (err) {
      toast(err.message || 'Could not log in.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!PHONE_RE.test(regForm.phone.trim())) { toast('Enter a valid 10-digit mobile number.', 'error'); return; }
    if (!PASSWORD_RE.test(regForm.password)) { toast('Password must be at least 8 characters with 1 letter and 1 number.', 'error'); return; }
    if (regForm.email.trim() && !EMAIL_RE.test(regForm.email.trim())) { toast('Enter a valid email or leave it blank.', 'error'); return; }
    setBusy(true);
    try {
      await register({
        name: regForm.name.trim(), phone: regForm.phone.trim(), email: regForm.email.trim(),
        password: regForm.password, promoConsent: regForm.promoConsent
      });
      toast('Account created — welcome to SCENTORA!', 'success');
      goAfterAuth();
    } catch (err) {
      toast(err.message || 'Could not create your account.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '6px 0 40px' }}>
      <h1 className="serif" style={{ fontWeight: 400, fontSize: 32, margin: '6px 0 14px' }}>Welcome to SCENTORA</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button type="button" className={mode === 'login' ? 'btn btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setMode('login')}>Log in</button>
        <button type="button" className={mode === 'register' ? 'btn btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setMode('register')}>Create account</button>
      </div>

      {mode === 'login' ? (
        <form className="panel" style={{ maxWidth: 480 }} onSubmit={submitLogin}>
          <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Log in</h2>
          <div className="field"><label htmlFor="loginPhone">Mobile number</label><input id="loginPhone" required inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit mobile" value={loginForm.phone} onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })} /></div>
          <div className="field"><label htmlFor="loginPassword">Password</label><input id="loginPassword" type="password" required autoComplete="current-password" placeholder="Your password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /></div>
          <button type="submit" className="btn btn-full" disabled={busy} style={{ marginTop: 6 }}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>New here? <button type="button" className="linkish" onClick={() => setMode('register')}>Create an account</button> · <Link to="/track-order">Track a guest order</Link></p>
        </form>
      ) : (
        <form className="panel" style={{ maxWidth: 480 }} onSubmit={submitRegister}>
          <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Create your account</h2>
          <div className="field"><label htmlFor="regName">Full name</label><input id="regName" required maxLength={80} autoComplete="name" placeholder="Your full name" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="regPhone">Mobile number</label><input id="regPhone" required inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit mobile" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} /></div>
          <div className="field"><label htmlFor="regEmail">Email <span style={{ textTransform: 'none', color: 'var(--muted)' }}>(optional)</span></label><input id="regEmail" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="regPassword">Password</label><input id="regPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters, 1 letter + 1 number" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} /></div>
          <label className="checkbox-row" style={{ margin: '10px 0 4px' }}><input type="checkbox" checked={regForm.promoConsent} onChange={(e) => setRegForm({ ...regForm, promoConsent: e.target.checked })} /><span>{promoText}</span></label>
          <p style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>We only use your details to process and deliver orders, and to contact you about them. See our <Link to="/privacy">privacy notice</Link>.</p>
          <button type="submit" className="btn btn-full btn-gold" disabled={busy} style={{ marginTop: 6 }}>{busy ? 'Creating your account…' : 'Create account'}</button>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Already registered? <button type="button" className="linkish" onClick={() => setMode('login')}>Log in instead</button></p>
        </form>
      )}
    </div>
  );
}

/* ================= Page ================= */
export default function Account() {
  const { user, loading, logout } = useCustomerAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState('orders');

  if (loading) {
    return <div className="container" style={{ padding: '30px 20px' }}><div className="state-box">Loading your account…</div></div>;
  }

  const TABS = [
    { id: 'orders', label: 'My orders' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Change password' }
  ];

  return (
    <div className="container" style={{ padding: '30px 20px 60px', maxWidth: 940 }}>
      {!user ? <AuthView /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <h1 className="serif" style={{ fontWeight: 400, fontSize: 30, margin: 0 }}>My account</h1>
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: '2px 0 0' }}>Welcome back, {user.name}</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={async () => { await logout(); toast('Logged out. See you soon!'); }}>Log out</button>
          </div>

          <div className="account-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'orders' && <OrdersTab />}
          {tab === 'addresses' && <AddressesTab />}
          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
        </>
      )}
    </div>
  );
}
