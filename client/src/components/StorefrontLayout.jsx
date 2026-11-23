import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

function Logo() {
  return (
    <Link className="logo" to="/">
      SCENT<span>ORA</span>
    </Link>
  );
}

export default function StorefrontLayout() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu on every navigation
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  const navLinkClass = ({ isActive }) => (isActive ? 'active' : undefined);

  return (
    <>
      <div className="topbar">Complimentary shipping on select orders · Cash on Delivery</div>
      <header className="site">
        <div className="container header-inner">
          <Logo />
          <nav className="nav-desktop" aria-label="Primary">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/shop" className={navLinkClass}>Shop</NavLink>
            <NavLink to="/track-order" className={navLinkClass}>Track Order</NavLink>
            <NavLink to="/account" className={navLinkClass}>Account</NavLink>
          </nav>
          <div className="header-actions">
            <NavLink className="iconbtn" to="/shop" aria-label="Search products">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </NavLink>
            <NavLink className="iconbtn" to="/account" aria-label="My account">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
            </NavLink>
            <NavLink className="iconbtn" to="/cart" aria-label="View cart">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
              {count > 0 && <span className="cart-badge">{count}</span>}
            </NavLink>
            <button
              type="button"
              className="iconbtn hamburger"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        <div className={`nav-mobile${menuOpen ? ' open' : ''}`}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/track-order">Track Order</NavLink>
          <NavLink to="/account">Account</NavLink>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site">
        <div className="logo">SCENT<span>ORA</span></div>
        <div className="footnote">
          © 2026 SCENTORA. All rights reserved.<br />
          Cash on Delivery across India. Every order is confirmed by phone before dispatch. Products are sourced and fulfilled through partner suppliers; packaging and contents as listed per product.
        </div>
        <div className="footer-links">
          <Link to="/shop">Shop</Link>
          <Link to="/track-order">Track order</Link>
          <Link to="/privacy">Privacy notice</Link>
          <Link to="/account">My account</Link>
        </div>
      </footer>
    </>
  );
}
