import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useAuth, useCart } from '../context/store.jsx';
import { ProductCard, discountPct, Empty, mediaUrl } from '../components/ui.jsx';

function attrLabel(attrs) {
  return Object.values(attrs || {}).join(' · ');
}

export default function ProductDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [variant, setVariant] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { add } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    setData(null); setVariant(0); setQty(1); setMsg(''); setActiveImg(0);
    api.get(`/api/products/${slug}`).then(setData).catch(() => setData({ missing: true }));
    window.scrollTo(0, 0);
  }, [slug]);

  if (data === null) return <p>Loading…</p>;
  if (data.missing) return <Empty icon="🛍️" title="Product not found" text="It may have been removed." action={<Link className="btn btn-primary" to="/search">Back to shop</Link>} />;

  const { product, related } = data;
  const v = product.variants[variant] || {};
  const pct = discountPct(v);

  const addToCart = async (buyNow) => {
    setBusy(true); setMsg('');
    try {
      await add(v.sku, qty);
      if (buyNow) nav('/cart'); else setMsg('Added to your cart ✓');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        <Link to="/">Home</Link> / <Link to={`/category/${product.category?.slug}`}>{product.category?.name}</Link> / {product.title}
      </p>
      <div className="pdp">
        <div className="pdp-gallery">
          <img src={mediaUrl(product.media[activeImg] || product.media[0])} alt={product.title} />
          {product.media.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {product.media.map((m, i) => (
                <img
                  key={i}
                  src={mediaUrl(m)}
                  alt={`${product.title} ${i + 1}`}
                  onClick={() => setActiveImg(i)}
                  style={{
                    width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
                    border: i === activeImg ? '2px solid var(--walnut)' : '2px solid var(--line)',
                    opacity: i === activeImg ? 1 : 0.7, transition: 'all .15s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          <span className="card-brand">{product.brand}</span>
          <h1>{product.title}</h1>
          <div className="price-row" style={{ margin: '10px 0' }}>
            <span className="price" style={{ fontSize: 28 }}>{inr(v.pricePaise)}</span>
            {v.compareAtPaise > v.pricePaise && <><span className="mrp">{inr(v.compareAtPaise)}</span><span className="off">{pct}% off</span></>}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Inclusive of all taxes · SKU {v.sku}</p>

          {product.variants.length > 1 && (
            <>
              <h4 style={{ margin: '18px 0 4px', color: 'var(--espresso)' }}>{Object.keys(v.attributes || {})[0] || 'Variant'}</h4>
              <div className="variant-pills">
                {product.variants.map((vv, i) => (
                  <button key={vv.sku} className={`pill ${i === variant ? 'selected' : ''}`} disabled={vv.stock === 0}
                    onClick={() => { setVariant(i); setQty(1); }}>
                    {attrLabel(vv.attributes)}{vv.stock === 0 ? ' (sold out)' : ''}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className={v.stock <= 5 ? 'stock-low' : 'stock-ok'}>
            {v.stock === 0 ? 'Out of stock' : v.stock <= 5 ? `Only ${v.stock} left in stock` : 'In stock, ready to ship'}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0', flexWrap: 'wrap' }}>
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="decrease">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(v.stock || 1, qty + 1))} aria-label="increase">+</button>
            </div>
            <button className="btn btn-primary" disabled={busy || v.stock === 0} onClick={() => addToCart(false)}>
              {busy ? 'Adding…' : 'Add to cart'}
            </button>
            <button className="btn btn-secondary" disabled={busy || v.stock === 0} onClick={() => addToCart(true)}>Buy now</button>
          </div>
          {msg && <p style={{ fontWeight: 600, color: 'var(--walnut)' }}>{msg}</p>}

          <p style={{ lineHeight: 1.75, color: '#4a443e' }}>{product.description}</p>

          <dl className="meta-list">
            <div><dt>Delivery</dt><dd>Dispatched in 24–48 hrs · Free shipping above ₹1,999</dd></div>
            <div><dt>Returns</dt><dd>7-day easy returns on unused items</dd></div>
            <div><dt>Payment</dt><dd>UPI / QR or Cash on Delivery</dd></div>
          </dl>
        </div>
      </div>

      {related?.length > 0 && (
        <>
          <div className="section-head"><h2>You may also like</h2></div>
          <div className="grid">{related.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>
      )}
    </>
  );
}
