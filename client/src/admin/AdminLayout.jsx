import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-4H4z' },
  { to: '/admin/orders', label: 'Orders', icon: 'M9 5h6l1 2h4v14H4V7h4zM9 12h6M9 16h6' },
  { to: '/admin/products', label: 'Products', icon: 'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7' },
  { to: '/admin/customers', label: 'Customers', icon: 'M9 5a3.4 3.4 0 1 1 0 6.8A3.4 3.4 0 0 1 9 5zM2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16 4.5a3.4 3.4 0 0 1 0 7' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10M8 5.5l8 4' },
  { to: '/admin/suppliers', label: 'Supplier Management', icon: 'M3 7h13v10H3zM16 10h4l1 3v4h-5zM6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zM14 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z' },
  { to: '/admin/finance', label: 'Profit & Expenses', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { to: '/admin/settings', label: 'Store Settings', icon: 'M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zM19.4 15a1.7 1.7 0 0 0 .3 1.9M4.6 15a1.7 1.7 0 0 1-.3 1.9M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18' }
];

export default function AdminLayout() {
  const { admin, loading, logout } = useAdminAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div className="admin-root">
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          Verifying admin session…
        </div>
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="admin-root">
      <div className="app visible">
        <aside className="sidebar">
          <div className="side-logo">SCENT<span>ORA</span><small className="brand-sub">ADMIN CONSOLE</small></div>
          <nav className="side-nav" aria-label="Admin sections">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                {item.label}
              </NavLink>
            ))}
            <a href="/" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></svg>
              View store
            </a>
          </nav>
          <div className="side-foot">
            <div className="muted" style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>Signed in as</div>
            <div className="admin-name">{admin.name}</div>
            <button type="button" onClick={async () => { await logout(); toast('Signed out.'); navigate('/admin/login', { replace: true }); }}>Log out</button>
          </div>
        </aside>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
