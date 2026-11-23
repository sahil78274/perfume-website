import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

const EMPTY = {
  storeName: '', supportEmail: '', supportPhone: '',
  shippingCharge: '', freeShippingAbove: '', lowStockThreshold: '',
  codMessage: '', promoConsentText: '', confirmationNote: ''
};

export default function Settings() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState('loading');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/admin/settings');
        if (!alive) return;
        const s = data.settings || {};
        setForm({
          storeName: s.storeName || '',
          supportEmail: s.supportEmail || '',
          supportPhone: s.supportPhone || '',
          shippingCharge: s.shippingCharge ?? '',
          freeShippingAbove: s.freeShippingAbove ?? '',
          lowStockThreshold: s.lowStockThreshold ?? '',
          codMessage: s.codMessage || '',
          promoConsentText: s.promoConsentText || '',
          confirmationNote: s.confirmationNote || ''
        });
        setState('ready');
      } catch (err) {
        if (!alive) return;
        setState('error');
        toast(err.message || 'Could not load settings.', 'error');
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      storeName: form.storeName,
      supportEmail: form.supportEmail,
      supportPhone: form.supportPhone,
      shippingCharge: form.shippingCharge === '' ? 0 : Number(form.shippingCharge),
      freeShippingAbove: form.freeShippingAbove === '' ? null : Number(form.freeShippingAbove),
      lowStockThreshold: form.lowStockThreshold === '' ? 0 : Math.floor(Number(form.lowStockThreshold)),
      codMessage: form.codMessage,
      promoConsentText: form.promoConsentText,
      confirmationNote: form.confirmationNote
    };
    try {
      await api.patch('/admin/settings', payload);
      toast('Store settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Could not save the settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast('New password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { toast('New passwords do not match.', 'error'); return; }
    setChanging(true);
    try {
      await api.post('/admin/auth/change-password', { currentPassword, newPassword });
      toast('Password updated. Use it on your next sign-in.', 'success');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast(err.message || 'Could not change the password.', 'error');
    } finally {
      setChanging(false);
    }
  };

  if (state === 'loading') return <div className="panel"><p className="muted">Loading settings…</p></div>;
  if (state === 'error') return <div className="panel"><p className="warn">Could not load the store settings. Is the backend running?</p></div>;

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Configuration</div><h1>Store Settings</h1></div>
        {admin ? <span className="muted" style={{ fontSize: 12 }}>Signed in as {admin.name}{admin.email ? ` · ${admin.email}` : ''}</span> : null}
      </div>

      <form className="panel" onSubmit={save}>
        <h2>Storefront &amp; checkout</h2>
        <div className="two-col" style={{ gap: 12 }}>
          <div className="field"><label className="field-label" htmlFor="setName">Store name</label>
            <input id="setName" type="text" required maxLength={80} value={form.storeName} onChange={set('storeName')} /></div>
          <div className="field"><label className="field-label" htmlFor="setEmail">Support email</label>
            <input id="setEmail" type="email" maxLength={254} value={form.supportEmail} onChange={set('supportEmail')} /></div>
          <div className="field"><label className="field-label" htmlFor="setPhone">Support phone</label>
            <input id="setPhone" type="text" maxLength={20} value={form.supportPhone} onChange={set('supportPhone')} placeholder="+91 …" /></div>
          <div className="field"><label className="field-label" htmlFor="setShip">Shipping charge (₹)</label>
            <input id="setShip" type="number" min="0" step="0.01" value={form.shippingCharge} onChange={set('shippingCharge')} /></div>
          <div className="field"><label className="field-label" htmlFor="setFreeShip">Free shipping above (₹, blank = never)</label>
            <input id="setFreeShip" type="number" min="0" step="0.01" value={form.freeShippingAbove} onChange={set('freeShippingAbove')} placeholder="e.g. 999" /></div>
          <div className="field"><label className="field-label" htmlFor="setLow">Default low-stock alert (units)</label>
            <input id="setLow" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} /></div>
        </div>

        <div className="field" style={{ marginTop: 10 }}><label className="field-label" htmlFor="setCod">COD checkout message</label>
          <textarea id="setCod" rows={2} maxLength={240} value={form.codMessage} onChange={set('codMessage')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label className="field-label" htmlFor="setPromo">Promo consent text (newsletter checkbox)</label>
          <textarea id="setPromo" rows={2} maxLength={300} value={form.promoConsentText} onChange={set('promoConsentText')} /></div>
        <div className="field" style={{ marginTop: 10 }}><label className="field-label" htmlFor="setConfirm">Order confirmation note</label>
          <textarea id="setConfirm" rows={2} maxLength={400} value={form.confirmationNote} onChange={set('confirmationNote')} /></div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>

      <form className="panel" onSubmit={changePassword}>
        <h2>Change admin password</h2>
        <div className="two-col" style={{ gap: 12 }}>
          <div className="field"><label className="field-label" htmlFor="pwCurrent">Current password</label>
            <input id="pwCurrent" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
          <div className="field"><label className="field-label" htmlFor="pwNew">New password (min 8 characters)</label>
            <input id="pwNew" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <div className="field"><label className="field-label" htmlFor="pwConfirm">Confirm new password</label>
            <input id="pwConfirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Use at least 8 characters with a mix of letters and numbers. Never share this password.</p>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn" disabled={changing}>{changing ? 'Updating…' : 'Update password'}</button>
        </div>
      </form>
    </>
  );
}
