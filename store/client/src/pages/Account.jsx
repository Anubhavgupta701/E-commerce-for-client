import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useAuth } from '../context/store.jsx';
import { Field, Chip, Empty, mediaUrl } from '../components/ui.jsx';

function Tabs() {
  const tabs = [['/account', 'Profile'], ['/account/orders', 'Orders'], ['/account/addresses', 'Addresses'], ['/account/wishlist', 'Wishlist']];
  return (
    <div className="filters" style={{ marginBottom: 28 }}>
      {tabs.map(([to, l]) => <Link key={to} className="btn btn-secondary btn-sm" to={to}>{l}</Link>)}
    </div>
  );
}

export function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [msg, setMsg] = useState('');
  const save = async () => {
    try { await api.patch('/api/account', { name }); await refresh(); setMsg('Saved!'); }
    catch (e) { setMsg(e.message); }
  };
  return (<><h1>My account</h1><Tabs />
    <div className="form-card" style={{ maxWidth: 560 }}>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></Field>
      <Field label="Email"><input value={user?.email || '--'} disabled /></Field>
      <Field label="Phone"><input value={user?.phone || '--'} disabled /></Field>
      <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Contact details are verified via OTP and can't be edited here. Roles: {user?.roles.join(', ') || 'Customer'}</p>
      {msg && <p style={{ fontWeight: 600 }}>{msg}</p>}
      <button className="btn btn-primary" onClick={save}>Save changes</button>
    </div></>);
}

export function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.get('/api/checkout/orders/me').then((d) => setOrders(d.orders)).catch(() => setOrders([])); }, []);
  return (<><h1>My orders</h1><Tabs />
    {orders === null ? <p>Loading...</p> : orders.length === 0 ? (
      <Empty icon="box" title="No orders yet" text="Your orders will appear here." action={<Link className="btn btn-primary" to="/search">Shop now</Link>} />
    ) : (
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id}>
            <td><strong>{o.orderNumber}</strong></td>
            <td>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
            <td>{o.items.reduce((n, i) => n + i.qty, 0)}</td>
            <td>{o.totalDisplay}</td>
            <td><Chip status={o.paymentStatus} /></td>
            <td><Chip status={o.fulfilmentStatus} /></td>
            <td><Link to={`/account/orders/${o.orderNumber}`}>View</Link></td>
          </tr>))}
        </tbody>
      </table></div>)}</>);
}

export function Addresses() {
  const [addresses, setAddresses] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/api/addresses').then((d) => setAddresses(d.addresses)).catch(() => setAddresses([]));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api.post('/api/addresses', form);
      setForm({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      setShowForm(false);
      load();
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try { await api.del(`/api/addresses/${id}`); load(); }
    catch (er) { alert(er.message); }
  };

  return (
    <>
      <h1>My addresses</h1>
      <Tabs />

      {!showForm && (
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>+ Add new address</button>
      )}

      {showForm && (
        <div className="form-card" style={{ maxWidth: 640, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>New address</h3>
          {err && <div className="alert alert-error">{err}</div>}
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Full name"><input value={form.name} onChange={set('name')} required /></Field>
              <Field label="Phone"><input value={form.phone} onChange={set('phone')} inputMode="tel" required /></Field>
            </div>
            <Field label="Address line 1"><input value={form.line1} onChange={set('line1')} required /></Field>
            <Field label="Address line 2 (optional)"><input value={form.line2} onChange={set('line2')} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <Field label="City"><input value={form.city} onChange={set('city')} required /></Field>
              <Field label="State"><input value={form.state} onChange={set('state')} /></Field>
              <Field label="Pincode"><input value={form.pincode} onChange={set('pincode')} inputMode="numeric" /></Field>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save address'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setErr(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {addresses === null ? <p>Loading...</p> : addresses.length === 0 && !showForm ? (
        <Empty icon="pin" title="No saved addresses" text="Add a delivery address to speed up checkout." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {addresses.map((a) => (
            <div key={a.id} className="form-card" style={{ margin: 0 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{a.name}</p>
              <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13.5 }}>{a.phone}</p>
              <p style={{ margin: '0 0 4px', fontSize: 14 }}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
              <p style={{ margin: '0 0 8px', fontSize: 14 }}>{a.city}{a.state ? `, ${a.state}` : ''} {a.pincode ? `- ${a.pincode}` : ''}</p>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(a.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function Wishlist() {
  const [data, setData] = useState(null);

  const load = () => api.get('/api/wishlist').then(setData).catch(() => setData({ products: [], productIds: [] }));
  useEffect(() => { load(); }, []);

  const removeFromWishlist = async (productId) => {
    try { await api.del(`/api/wishlist/${productId}`); load(); }
    catch (e) { alert(e.message); }
  };

  if (data === null) return <><h1>My wishlist</h1><Tabs /><p>Loading...</p></>;

  return (
    <>
      <h1>My wishlist</h1>
      <Tabs />
      {data.products.length === 0 ? (
        <Empty icon="heart" title="Wishlist is empty" text="Save items you love and they will show up here." action={<Link className="btn btn-primary" to="/search">Browse products</Link>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {data.products.map((p) => (
            <div key={p.id} className="form-card" style={{ margin: 0, textAlign: 'center', padding: 16 }}>
              <Link to={`/product/${p.slug}`}>
                <img src={mediaUrl(p.media?.[0])} alt={p.title} style={{ width: '100%', maxWidth: 160, height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
              </Link>
              <h4 style={{ margin: '0 0 6px' }}><Link to={`/product/${p.slug}`} style={{ color: 'var(--espresso)' }}>{p.title}</Link></h4>
              <p style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--walnut)' }}>{inr(p.priceFrom)}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Link className="btn btn-primary btn-sm" to={`/product/${p.slug}`}>View</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => removeFromWishlist(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function OrderDetail() {
  const { orderNumber } = useParams();
  const [search] = useSearchParams();
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/api/checkout/orders/${orderNumber}`).then(setData).catch(() => setData({ missing: true })); }, [orderNumber]);
  if (data === null) return <p>Loading...</p>;
  if (data.missing) return <Empty icon="box" title="Order not found" />;
  const { order, paymentSubmissions } = data;
  return (
    <>
      <p><Link to="/account/orders">All orders</Link></p>
      <h1>Order {order.orderNumber}</h1>
      {search.get('placed') && <div className="alert alert-ok">Order placed successfully! {order.paymentMethod === 'COD' ? 'Pay in cash when it arrives.' : 'Complete your QR payment to get it shipped.'}</div>}
      <p><Chip status={order.paymentStatus} /> <Chip status={order.fulfilmentStatus} /> <span style={{ color: 'var(--muted)' }}>{order.paymentMethod === 'QR' ? 'UPI / QR' : 'Cash on Delivery'}</span></p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="addr-grid">
        <div className="form-card">
          <h3 style={{ marginTop: 0 }}>Items</h3>
          {order.items.map((it) => (
            <div className="sum-row" key={it.sku}><span>{it.title} <span style={{ color: 'var(--muted)' }}>x {it.qty}</span><br /><small style={{ color: 'var(--muted)' }}>{Object.entries(it.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(' / ')}</small></span><span>{(it.lineTotalPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
          ))}
          <div className="sum-row"><span>Subtotal</span><span>{order.subtotalDisplay}</span></div>
          {order.discountPaise > 0 && <div className="sum-row"><span>Discount {order.couponCode && `(${order.couponCode})`}</span><span style={{ color: 'var(--success)' }}>-{order.discountDisplay}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{order.shippingDisplay}</span></div>
          <div className="sum-row total"><span>Total</span><span>{order.totalDisplay}</span></div>
        </div>
        <div>
          <div className="form-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Delivery address</h3>
            <p style={{ margin: 0 }}>{order.address.name} / {order.address.phone}<br />{order.address.line1}{order.address.line2 && `, ${order.address.line2}`}<br />{order.address.city}, {order.address.state} - {order.address.pincode}</p>
          </div>
          <div className="form-card">
            <h3 style={{ marginTop: 0 }}>Timeline</h3>
            <div className="timeline">{order.timeline.map((t, i) => <div key={i}>{t.event}<br /><small style={{ color: 'var(--muted)' }}>{new Date(t.at).toLocaleString('en-IN')}</small></div>)}</div>
            {order.paymentMethod === 'QR' && ['PENDING', 'REJECTED'].includes(order.paymentStatus) && (
              <Link className="btn btn-primary" to={`/orders/${order.orderNumber}/payment`}>Complete payment</Link>
            )}
          </div>
        </div>
      </div>
      <style>{`@media (max-width:768px){.addr-grid{grid-template-columns:1fr !important}}`}</style>
    </>
  );
}
