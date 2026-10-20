import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Chip } from '../../components/ui.jsx';

export function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/api/superadmin/overview').then(setD).catch(() => setD({ err: true })); }, []);
  if (!d) return <p>Loading…</p>;
  if (d.err) return <p>Could not load overview.</p>;
  return (
    <>
      <h1>Overview</h1>
      <div className="stat-grid">
        <div className="stat"><div className="v">{d.revenueDisplay}</div><div className="l">Verified revenue</div></div>
        <div className="stat"><div className="v">{d.orderCount}</div><div className="l">Total orders</div></div>
        <div className="stat"><div className="v">{d.pendingPayments}</div><div className="l">Payments awaiting review</div></div>
        <div className="stat"><div className="v">{d.lowStock.length}</div><div className="l">Low-stock variants</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="dash-grid">
        <div>
          <h3>Needs attention</h3>
          {d.pendingPayments > 0
            ? <p><Link className="btn btn-primary btn-sm" to="/superadmin/payments">{d.pendingPayments} payment{d.pendingPayments > 1 ? 's' : ''} to review →</Link></p>
            : <p style={{ color: 'var(--muted)' }}>Payment queue is clear. 🎉</p>}
          {d.lowStock.length > 0 && (
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead>
              <tbody>{d.lowStock.map((s, i) => <tr key={i}><td>{s.product}</td><td><code>{s.sku}</code></td><td>{s.stock}</td></tr>)}</tbody>
            </table></div>)}
        </div>
        <div>
          <h3>Recent activity</h3>
          <div className="table-wrap"><table className="data">
            <tbody>{d.recentAudit.map((a) => (
              <tr key={a.id}><td><code style={{ fontSize: 12 }}>{a.action}</code><br /><small style={{ color: 'var(--muted)' }}>{new Date(a.createdAt).toLocaleString('en-IN')}</small></td></tr>))}
            </tbody>
          </table></div>
        </div>
      </div>
      <style>{`@media (max-width:768px){.dash-grid{grid-template-columns:1fr !important}}`}</style>
    </>
  );
}

export function SOrders() {
  const [orders, setOrders] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const load = () => api.get(`/api/superadmin/orders?q=${encodeURIComponent(q)}&status=${status}`).then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  useEffect(() => { load(); }, []);

  const advance = async (o, next) => {
    if (!window.confirm(`Move order ${o.orderNumber} to ${next}?`)) return;
    try { await api.patch(`/api/superadmin/orders/${o.id}/fulfilment`, { status: next }); load(); }
    catch (e) { alert(e.message); }
  };

  const FLOW = ['PLACED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];
  return (
    <>
      <h1>Orders</h1>
      <div className="toolbar">
        <input type="search" placeholder="Order no / phone…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          {['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COD_DUE', 'PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>Filter</button>
      </div>
      {orders === null ? <p>Loading…</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Pay</th><th>Fulfilment</th><th>Advance</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id}>
              <td><strong>{o.orderNumber}</strong><br /><small style={{ color: 'var(--muted)' }}>{o.paymentMethod}</small></td>
              <td>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
              <td>{o.address?.name || '—'}<br /><small style={{ color: 'var(--muted)' }}>{o.contact?.phone || o.address?.phone || '—'}</small></td>
              <td>{(o.totalPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
              <td><Chip status={o.paymentStatus} /></td>
              <td><Chip status={o.fulfilmentStatus} /></td>
              <td>
                <select defaultValue="" onChange={(e) => e.target.value && advance(o, e.target.value)} aria-label="Advance fulfilment">
                  <option value="">Move to…</option>
                  {FLOW.filter((s) => s !== o.fulfilmentStatus).map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </td>
            </tr>))}
          </tbody>
        </table></div>)}
    </>
  );
}
