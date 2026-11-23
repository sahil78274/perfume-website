import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

export default function AdminLogin() {
  const { admin, loading, login } = useAdminAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <div className="admin-root"><div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Checking session…</div></div>;
  }
  if (admin) {
    const target = (location.state && location.state.from) || '/admin/dashboard';
    return <Navigate to={target} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast('Welcome back.', 'success');
      navigate((location.state && location.state.from) || '/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-root">
      <div className="login-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-logo">SCENT<span>ORA</span></div>
          <div className="login-sub">Admin Control Room</div>
          <label htmlFor="adminEmail">Admin email</label>
          <input id="adminEmail" name="email" type="email" required autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="adminPassword">Password</label>
          <input id="adminPassword" name="password" type="password" required autoComplete="current-password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="login-error show" role="alert">{error}</div>}
          <button type="submit" className="btn btn-gold" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: 12 }}>
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>
          <p className="login-note">Restricted area. All activity is authenticated server-side and rate-limited.<br />No public registration — admins are created only via the setup script.</p>
          <p style={{ textAlign: 'center', marginTop: 10 }}><Link to="/" style={{ fontSize: 11, color: 'var(--muted)' }}>← Back to the store</Link></p>
        </form>
      </div>
    </div>
  );
}
