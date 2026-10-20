import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/store.jsx';

export function AdminShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user || !(user.roles || []).some((r) => ['ADMIN', 'SUPERADMIN'].includes(r))) {
    return (
      <div className="wrap page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h1 style={{ fontSize: 32 }}>Staff Login Required</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '12px auto 24px' }}>
          This area requires an Admin account. Please log in with your assigned staff credentials.
        </p>
        <a className="btn btn-primary" href="/admin/login?next=/admin">Staff Login →</a>
      </div>
    );
  }
  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="who"><strong>{user.name || 'Admin'}</strong><span>Catalog admin</span></div>
        <NavLink to="/admin" end>Products</NavLink>
        <NavLink to="/admin/products/new">+ New product</NavLink>
        <a href="/" style={{ marginTop: 12 }}>← Storefront</a>
        <a href="#" onClick={async (e) => { e.preventDefault(); await logout(); nav('/'); }}>Logout</a>
      </aside>
      <div className="portal-main"><Outlet /></div>
    </div>
  );
}

export function SuperShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user || !(user.roles || []).includes('SUPERADMIN')) {
    return (
      <div className="wrap page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h1 style={{ fontSize: 32 }}>Superadmin Access Required</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '12px auto 24px' }}>
          This area requires Superadmin credentials. Please log in with your assigned staff credentials.
        </p>
        <a className="btn btn-primary" href="/admin/login?next=/superadmin">Superadmin Login →</a>
      </div>
    );
  }
  const links = [
    ['/superadmin', 'Overview'], ['/superadmin/orders', 'Orders'], ['/superadmin/payments', 'Payments'],
    ['/superadmin/categories', 'Categories'], ['/superadmin/users', 'Users'], ['/superadmin/staff', 'Staff & roles'],
    ['/superadmin/coupons', 'Coupons'], ['/superadmin/reports', 'Reports'], ['/superadmin/settings', 'Settings'], ['/superadmin/audit', 'Audit log'],
  ];
  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="who"><strong>{user.name || 'Owner'}</strong><span>Superadmin</span></div>
        {links.map(([to, l]) => <NavLink key={to} to={to} end={to === '/superadmin'}>{l}</NavLink>)}
        <a href="/" style={{ marginTop: 12 }}>← Storefront</a>
        <a href="#" onClick={async (e) => { e.preventDefault(); await logout(); nav('/'); }}>Logout</a>
      </aside>
      <div className="portal-main"><Outlet /></div>
    </div>
  );
}
