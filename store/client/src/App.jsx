import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreLayout } from './components/Layout.jsx';
import { useAuth } from './context/store.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import { Login, VerifyOtp } from './pages/Auth.jsx';
import { Profile, Orders, Addresses, Wishlist, OrderDetail } from './pages/Account.jsx';
import Info from './pages/Info.jsx';
import { AdminShell, SuperShell } from './pages/portals/Shells.jsx';
import { AdminProducts, ProductForm } from './pages/portals/AdminProducts.jsx';
import { Dashboard, SOrders } from './pages/portals/SuperMain.jsx';
import { Payments, Categories, Users, Staff, Coupons, Reports, Settings, AuditLogs } from './pages/portals/SuperMore.jsx';
import { StaffLogin } from './pages/portals/StaffLogin.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="wrap page"><p>Loading…</p></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

function Store({ children }) {
  return <StoreLayout>{children}</StoreLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Store><Home /></Store>} />
      <Route path="/search" element={<Store><Catalog /></Store>} />
      <Route path="/category/:slug" element={<Store><Catalog /></Store>} />
      <Route path="/product/:slug" element={<Store><ProductDetail /></Store>} />
      <Route path="/cart" element={<Store><CartPage /></Store>} />
      <Route path="/checkout" element={<Store><RequireAuth><Checkout /></RequireAuth></Store>} />
      <Route path="/orders/:orderNumber/payment" element={<Store><RequireAuth><PaymentPage /></RequireAuth></Store>} />
      <Route path="/login" element={<Store><Login /></Store>} />
      <Route path="/admin/login" element={<Store><StaffLogin /></Store>} />
      <Route path="/staff/login" element={<Store><StaffLogin /></Store>} />
      <Route path="/verify-otp" element={<Store><VerifyOtp /></Store>} />
      <Route path="/account" element={<Store><RequireAuth><Profile /></RequireAuth></Store>} />
      <Route path="/account/orders" element={<Store><RequireAuth><Orders /></RequireAuth></Store>} />
      <Route path="/account/orders/:orderNumber" element={<Store><RequireAuth><OrderDetail /></RequireAuth></Store>} />
      <Route path="/account/addresses" element={<Store><RequireAuth><Addresses /></RequireAuth></Store>} />
      <Route path="/account/wishlist" element={<Store><RequireAuth><Wishlist /></RequireAuth></Store>} />
      <Route path="/info/:slug" element={<Store><Info /></Store>} />

      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminProducts />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
      </Route>

      <Route path="/superadmin" element={<SuperShell />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<SOrders />} />
        <Route path="payments" element={<Payments />} />
        <Route path="categories" element={<Categories />} />
        <Route path="users" element={<Users />} />
        <Route path="staff" element={<Staff />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit" element={<AuditLogs />} />
      </Route>

      <Route path="*" element={<Store><div className="empty"><div className="e-icon">🧭</div><h3>Page not found</h3><a className="btn btn-primary" href="/">Back home</a></div></Store>} />
    </Routes>
  );
}
