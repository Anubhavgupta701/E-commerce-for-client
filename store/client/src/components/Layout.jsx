import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth, useCart } from '../context/store.jsx';
import { api } from '../api.js';

export function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/api/settings/public').then((d) => setSettings(d.settings)).catch(() => {});
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    nav(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
    setMenuOpen(false);
  };

  const brand = settings?.brandName || 'Mahi Green World';
  const announcement = settings?.announcement;

  return (
    <>
      {announcement && <div className="announce">{announcement}</div>}
      <header className="header">
        <div className="wrap header-inner">
          <button className="icon-btn mobile-nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="menu">☰</button>
          <Link className="logo" to="/">🌿 {brand}<span>.</span></Link>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/category/apparel">Apparel</NavLink>
            <NavLink to="/category/home">Home & Living</NavLink>
            <NavLink to="/category/accessories">Accessories</NavLink>
          </nav>
          <div className="header-actions">
            <form className="searchbar" onSubmit={submitSearch}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search products" />
              <button className="icon-btn" type="submit" aria-label="Search">⌕</button>
            </form>
            <Link className="icon-btn" to={user ? '/account' : '/login'} aria-label="Account" title={user ? user.name || 'Account' : 'Login'}>👤</Link>
            <Link className="icon-btn" to="/cart" aria-label="Cart">
              🛒{cart.count > 0 && <span className="cart-count">{cart.count}</span>}
            </Link>
            {user ? (
              <>
                {user.roles?.includes('SUPERADMIN') && (
                  <Link className="btn btn-primary btn-sm" to="/superadmin" style={{ padding: '6px 12px' }}>Superadmin</Link>
                )}
                {user.roles?.includes('ADMIN') && !user.roles?.includes('SUPERADMIN') && (
                  <Link className="btn btn-primary btn-sm" to="/admin" style={{ padding: '6px 12px' }}>Admin</Link>
                )}
                <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); nav('/'); }}>Logout</button>
              </>
            ) : (
              <Link className="btn btn-secondary btn-sm" to="/login">Login</Link>
            )}
          </div>
        </div>
        {menuOpen && (
          <div className="wrap" style={{ paddingBottom: 12 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[['/', 'Home'], ['/category/apparel', 'Apparel'], ['/category/home', 'Home & Living'], ['/category/accessories', 'Accessories'], ['/search', 'Search']].map(([to, label]) => (
                <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} style={{ padding: '10px 4px', fontWeight: 600 }}>{label}</NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">🌿 Mahi Green World.</div>
            <p style={{ opacity: .8, fontSize: 14.5, maxWidth: 300, lineHeight: 1.7 }}>Nature's best, delivered to your door. Eco-friendly apparel, home goods and accessories, crafted sustainably.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <Link to="/category/apparel">Apparel</Link>
            <Link to="/category/home">Home & Living</Link>
            <Link to="/category/accessories">Accessories</Link>
            <Link to="/search">All products</Link>
          </div>
          <div>
            <h4>Help</h4>
            <Link to="/info/shipping">Shipping</Link>
            <Link to="/info/returns">Returns & refunds</Link>
            <Link to="/info/faq">FAQ</Link>
            <Link to="/info/contact">Contact us</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/info/about">About</Link>
            <Link to="/info/privacy">Privacy policy</Link>
            <Link to="/info/terms">Terms of service</Link>
            <Link to="/account/orders">Track order</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Mahi Green World. All rights reserved.</span>
          <span>Made with care in India</span>
        </div>
      </div>
    </footer>
  );
}

export function StoreLayout({ children, banner }) {
  return (
    <>
      <Header />
      {banner && <div className="full-bleed-banner">{banner}</div>}
      <main className="wrap page">{children}</main>
      <Footer />
    </>
  );
}
