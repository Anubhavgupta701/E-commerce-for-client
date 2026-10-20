import { Link } from 'react-router-dom';
import { inr, statusLabel } from '../api.js';

export function discountPct(v) {
  if (!v.compareAtPaise || v.compareAtPaise <= v.pricePaise) return 0;
  return Math.round(((v.compareAtPaise - v.pricePaise) / v.compareAtPaise) * 100);
}

export function mediaUrl(m) {
  if (!m) return '/img/linen-shirt.svg';
  if (typeof m === 'string') return m;
  if (m.key) return `/${m.key}`;
  return '/img/linen-shirt.svg';
}

export function ProductCard({ p, onWish, wished }) {
  const v0 = p.variants[0] || {};
  const pct = discountPct(v0);
  return (
    <div className="card">
      <div className="card-img">
        <Link to={`/product/${p.slug}`} aria-label={p.title}>
          <img src={mediaUrl(p.media[0])} alt={p.title} loading="lazy" />
        </Link>
        {pct > 0 && <span className="badge-sale">{pct}% OFF</span>}
      </div>
      <div className="card-body">
        <span className="card-brand">{p.brand}</span>
        <h3 className="card-title"><Link to={`/product/${p.slug}`}>{p.title}</Link></h3>
        <div className="price-row">
          <span className="price">{p.priceFromDisplay || inr(p.priceFrom)}</span>
          {v0.compareAtPaise > v0.pricePaise && <span className="mrp">{inr(v0.compareAtPaise)}</span>}
        </div>
      </div>
    </div>
  );
}

export function Chip({ status }) {
  const cls = `chip chip-${String(status || 'pending').toLowerCase()}`;
  return <span className={cls}>{statusLabel(status)}</span>;
}

export function Empty({ icon = '🛍️', title, text, action }) {
  return (
    <div className="empty">
      <div className="e-icon">{icon}</div>
      <h3 style={{ color: 'var(--espresso)' }}>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}><div className="skel" style={{ aspectRatio: '4/5' }} /><div className="skel" style={{ height: 18, marginTop: 12 }} /><div className="skel" style={{ height: 14, width: '60%', marginTop: 8 }} /></div>
      ))}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <div className="err">{error}</div>}
      {hint && !error && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Modal({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 14 }}>Page {page} of {pages}</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}
