import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useAuth, useCart } from '../context/store.jsx';
import { Field } from '../components/ui.jsx';

const blank = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export default function Checkout() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const nav = useNavigate();
  const [addr, setAddr] = useState(blank);
  const [saved, setSaved] = useState([]);
  const [method, setMethod] = useState('QR');
  const [coupon, setCoupon] = useState('');
  const [errors, setErrors] = useState({});
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!user) { nav('/login?next=/checkout'); return; }
    refresh();
    api.get('/api/addresses').then((d) => {
      setSaved(d.addresses);
      if (d.addresses[0]) setAddr({ ...blank, ...d.addresses[0] });
    }).catch(() => {});
    api.get('/api/settings/public').then((d) => {
      setSettings(d.settings);
      if (d.settings?.qrEnabled === false && d.settings?.codEnabled !== false) {
        setMethod('COD');
      }
    }).catch(() => {});
  }, [user]);

  if (!user) return null;
  if (!cart.items.length) {
    return <div className="empty"><div className="e-icon">🛒</div><h3>Your cart is empty</h3><Link className="btn btn-primary" to="/search">Shop now</Link></div>;
  }

  const set = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });

  const place = async () => {
    setBusy(true); setErrors({}); setTop('');
    try {
      const key = 'ck_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const { order } = await api.post('/api/checkout', {
        address: addr, paymentMethod: method,
        couponCode: coupon.trim() || undefined, idempotencyKey: key,
      });
      await refresh();
      nav(method === 'QR' ? `/orders/${order.orderNumber}/payment` : `/account/orders/${order.orderNumber}?placed=1`);
    } catch (e) {
      try {
        const parsed = JSON.parse(e.message);
        setTop(parsed.error || e.message);
      } catch { setTop(e.message); }
      setBusy(false);
    }
  };

  return (
    <>
      <div className="steps">
        <div className="step">1 · Cart</div>
        <div className="step active">2 · Details & payment</div>
        <div className="step">3 · Done</div>
      </div>
      <h1>Checkout</h1>
      {top && <div className="alert alert-error">{top}</div>}
      <div className="cart-layout">
        <div>
          <div className="form-card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Delivery address</h3>
            {saved.length > 0 && (
              <Field label="Saved addresses">
                <select onChange={(e) => { const a = saved.find((x) => x.id === e.target.value); if (a) setAddr({ ...blank, ...a }); }} defaultValue="">
                  <option value="">Choose a saved address…</option>
                  {saved.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
                </select>
              </Field>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Full name" error={errors.name}><input value={addr.name} onChange={set('name')} placeholder="Aarav Sharma" /></Field>
              <Field label="Phone" error={errors.phone}><input value={addr.phone} onChange={set('phone')} placeholder="98765 43210" inputMode="numeric" /></Field>
            </div>
            <Field label="Address line 1" error={errors.line1}><input value={addr.line1} onChange={set('line1')} placeholder="Flat / house no, street" /></Field>
            <Field label="Address line 2 (optional)"><input value={addr.line2} onChange={set('line2')} placeholder="Landmark" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <Field label="City" error={errors.city}><input value={addr.city} onChange={set('city')} /></Field>
              <Field label="State" error={errors.state}><input value={addr.state} onChange={set('state')} /></Field>
              <Field label="Pincode" error={errors.pincode}><input value={addr.pincode} onChange={set('pincode')} inputMode="numeric" /></Field>
            </div>
          </div>

          <div className="form-card">
            <h3 style={{ marginTop: 0 }}>Payment method</h3>
            {settings?.qrEnabled !== false && (
              <label style={{ display: 'flex', gap: 14, padding: 16, border: '1.5px solid var(--line)', borderRadius: 12, marginBottom: 12, cursor: 'pointer', background: method === 'QR' ? 'var(--sand)' : '#fff' }}>
                <input type="radio" checked={method === 'QR'} onChange={() => setMethod('QR')} />
                <div><strong>UPI / QR payment</strong><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Pay via any UPI app, then submit your UTR here. Ships after our team verifies payment.</p></div>
              </label>
            )}
            {settings?.codEnabled !== false && (
              <label style={{ display: 'flex', gap: 14, padding: 16, border: '1.5px solid var(--line)', borderRadius: 12, cursor: 'pointer', background: method === 'COD' ? 'var(--sand)' : '#fff' }}>
                <input type="radio" checked={method === 'COD'} onChange={() => setMethod('COD')} />
                <div><strong>Cash on Delivery</strong><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Pay in cash when your order arrives.</p></div>
              </label>
            )}
          </div>
        </div>

        <div className="summary">
          <h3 style={{ marginTop: 0 }}>Order summary</h3>
          {cart.items.map((it) => (
            <div className="sum-row" key={it.sku}><span>{it.title} × {it.qty}</span><span>{it.lineTotalDisplay}</span></div>
          ))}
          <div className="coupon-row">
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code (optional)" />
          </div>
          <div className="sum-row"><span>Subtotal</span><span>{cart.subtotalDisplay}</span></div>
          <div className="sum-row"><span>Shipping</span><span>{cart.subtotalPaise >= 199900 ? <span className="free">FREE</span> : inr(9900)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{inr(cart.subtotalPaise + (cart.subtotalPaise >= 199900 ? 0 : 9900))}</span></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy} onClick={place}>
            {busy ? 'Placing order…' : method === 'QR' ? 'Place order & pay →' : 'Place order →'}
          </button>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>By placing this order you agree to our <Link to="/info/terms">terms</Link> and <Link to="/info/returns">returns policy</Link>.</p>
        </div>
      </div>
    </>
  );
}
