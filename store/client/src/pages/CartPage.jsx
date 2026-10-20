import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useCart } from '../context/store.jsx';
import { Empty } from '../components/ui.jsx';

export default function CartPage() {
  const { cart, setQty, remove, refresh } = useCart();
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const { coupon: c } = await api.get(`/api/coupons/validate?code=${encodeURIComponent(coupon.trim())}`);
      let disc = 0;
      if (c.kind === 'percent') disc = Math.floor((cart.subtotalPaise * c.value) / 100);
      else disc = c.value * 100;
      if (c.maxDiscountPaise) disc = Math.min(disc, c.maxDiscountPaise);
      setCouponMsg({ ok: true, text: `${c.code} applied — you save ${inr(Math.min(disc, cart.subtotalPaise))} at checkout.` });
    } catch (e) { setCouponMsg({ ok: false, text: e.message }); }
  };

  const validateAndGo = async () => {
    setBusy(true);
    try {
      const v = await api.post('/api/cart/validate');
      if (!v.valid) {
        await refresh();
        setCouponMsg({ ok: false, text: 'Some items changed (price/stock). Your cart was refreshed — please review.' });
      } else nav('/checkout');
    } catch (e) { setCouponMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };

  if (!cart.items.length) {
    return <Empty icon="🛒" title="Your cart is empty" text="Beautiful things are waiting." action={<Link className="btn btn-primary" to="/search">Start shopping</Link>} />;
  }

  return (
    <>
      <h1>Your cart</h1>
      <div className="cart-layout">
        <div>
          {cart.items.map((it) => (
            <div className="cart-line" key={it.sku}>
              <Link to={`/product/${it.slug}`}><img src={it.image || '/img/linen-shirt.svg'} alt={it.title} /></Link>
              <div>
                <Link to={`/product/${it.slug}`} style={{ fontWeight: 700, color: 'var(--espresso)' }}>{it.title}</Link>
                <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '4px 0' }}>
                  {Object.entries(it.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
                <div className="qty" style={{ marginTop: 10 }}>
                  <button onClick={() => setQty(it.sku, it.qty - 1)} aria-label="decrease">−</button>
                  <span>{it.qty}</span>
                  <button onClick={() => setQty(it.sku, it.qty + 1)} aria-label="increase">+</button>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(it.sku)}>Remove</button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="price">{it.lineTotalDisplay}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{it.unitPriceDisplay} each</div>
              </div>
            </div>
          ))}
        </div>
        <div className="summary">
          <h3 style={{ marginTop: 0 }}>Order summary</h3>
          <div className="coupon-row">
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" />
            <button className="btn btn-secondary btn-sm" onClick={applyCoupon}>Apply</button>
          </div>
          {couponMsg && <p style={{ fontSize: 13.5, color: couponMsg.ok ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{couponMsg.text}</p>}
          <div className="sum-row"><span>Subtotal</span><span>{cart.subtotalDisplay}</span></div>
          <div className="sum-row"><span>Shipping</span><span>Calculated at checkout</span></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy} onClick={validateAndGo}>
            {busy ? 'Checking…' : 'Proceed to checkout →'}
          </button>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>Prices and stock are re-verified on our server at checkout.</p>
        </div>
      </div>
    </>
  );
}
