import { useEffect, useState } from 'react';
import { api, inr } from '../../api.js';
import { Field, Chip, Modal } from '../../components/ui.jsx';

// ==========================================
// 1. PAYMENTS REVIEW & VERIFICATION
// ==========================================
export function Payments() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState(''); // '' means All
  const [search, setSearch] = useState('');
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get(`/api/superadmin/payment-submissions?status=${encodeURIComponent(filter)}`)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  };

  useEffect(load, [filter]);

  const decide = async (sub, approve) => {
    if (!approve && !reason.trim()) {
      alert('A rejection reason is required so the customer knows why.');
      return;
    }
    if (!window.confirm(`Are you sure you want to ${approve ? 'APPROVE' : 'REJECT'} payment for Order ${sub.orderNumber}?`)) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post(`/api/superadmin/payment-submissions/${sub.id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason });
      setReview(null);
      setReason('');
      setMsg(`Payment for Order ${sub.orderNumber} ${approve ? 'approved successfully ✓' : 'rejected.'}`);
      load();
    } catch (e) {
      alert(e.message || 'Action failed.');
    }
    setBusy(false);
  };

  const filteredItems = (items || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.orderNumber || '').toLowerCase().includes(q) || (s.utr || '').toLowerCase().includes(q);
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Payment Verification</h1>
          <p className="lead" style={{ margin: '4px 0 0' }}>Review customer UPI/QR payment claims against bank or UPI records before confirming orders.</p>
        </div>
      </div>

      {msg && <div className="alert alert-ok" style={{ marginTop: 14 }}>{msg}</div>}

      <div className="toolbar" style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by Order # or UTR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[
            ['', 'All'],
            ['PENDING', 'Pending'],
            ['SUBMITTED', 'Submitted'],
            ['APPROVED', 'Approved'],
            ['REJECTED', 'Rejected'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <p>Loading payment submissions…</p>
      ) : filteredItems.length === 0 ? (
        <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
          <h3>No payment submissions found</h3>
          <p style={{ color: 'var(--muted)' }}>
            {search ? 'No payments matching your search.' : filter ? `No submissions with status "${filter}".` : 'No UPI/QR payment submissions have been received yet.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Order #</th>
                <th>UTR / Ref ID</th>
                <th>Claimed Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((s) => (
                <tr key={s.id}>
                  <td><small>{new Date(s.submittedAt || s.createdAt).toLocaleString('en-IN')}</small></td>
                  <td><strong>{s.orderNumber}</strong></td>
                  <td><code>{s.utr}</code></td>
                  <td><strong>{s.amountDisplay || (s.amountClaimedPaise ? inr(s.amountClaimedPaise) : '—')}</strong></td>
                  <td><Chip status={s.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(s.status) && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 8px', fontSize: 12 }}
                          onClick={() => decide(s, true)}
                        >
                          Approve ✓
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 12 }}
                        onClick={() => { setReview(s); setReason(''); }}
                      >
                        Details →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {review && (
        <Modal onClose={() => setReview(null)}>
          <h2 style={{ marginTop: 0 }}>Review Payment Submission</h2>
          <div className="sum-row"><span>Order Number</span><strong>{review.orderNumber}</strong></div>
          <div className="sum-row"><span>Claimed Amount</span><strong>{review.amountDisplay || inr(review.amountClaimedPaise)}</strong></div>
          <div className="sum-row"><span>UTR / Transaction ID</span><code>{review.utr}</code></div>
          <div className="sum-row"><span>Status</span><Chip status={review.status} /></div>
          <div className="sum-row"><span>Submission Time</span><span>{new Date(review.submittedAt || review.createdAt).toLocaleString('en-IN')}</span></div>

          {review.screenshotUrl && (
            <div style={{ margin: '14px 0', padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Payment Screenshot</span>
              <img src={review.screenshotUrl} alt="Payment Receipt" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 4, display: 'block' }} />
              <a href={review.screenshotUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Open Full Size ↗</a>
            </div>
          )}

          {['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(review.status) ? (
            <div style={{ marginTop: 20 }}>
              <Field label="Rejection reason (required only if rejecting)" hint="Shown to the customer on their order page so they can retry.">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. UTR not found in bank statement, amount mismatch"
                />
              </Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(review, true)}>
                  {busy ? 'Processing…' : 'Approve Payment ✓'}
                </button>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => decide(review, false)}>
                  {busy ? 'Processing…' : 'Reject Submission'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setReview(null)}>Close</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {review.rejectionReason && (
                <p style={{ color: 'crimson', fontSize: 13 }}>
                  <strong>Rejection Reason:</strong> {review.rejectionReason}
                </p>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setReview(null)}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ==========================================
// 2. CATEGORIES MANAGEMENT (Full CRUD)
// ==========================================
export function Categories() {
  const [cats, setCats] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', active: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/api/superadmin/categories')
      .then((d) => setCats(d.categories || []))
      .catch(() => setCats([]));
  };

  useEffect(load, []);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/superadmin/categories', { name: name.trim(), slug: slug.trim() || undefined });
      setName('');
      setSlug('');
      setMsg('Category added successfully ✓');
      load();
    } catch (e) {
      alert(e.message || 'Failed to add category.');
    }
    setBusy(false);
  };

  const startEdit = (c) => {
    setEditing(c);
    setEditForm({ name: c.name, slug: c.slug, active: c.active !== false });
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    setBusy(true);
    try {
      await api.patch(`/api/superadmin/categories/${editing.id}`, editForm);
      setEditing(null);
      setMsg('Category updated successfully ✓');
      load();
    } catch (e) {
      alert(e.message || 'Failed to update category.');
    }
    setBusy(false);
  };

  const remove = async (c) => {
    if (!window.confirm(`Are you sure you want to delete category "${c.name}"? Products in this category will become unassigned.`)) return;
    try {
      await api.del(`/api/superadmin/categories/${c.id}`);
      setMsg(`Category "${c.name}" deleted.`);
      load();
    } catch (e) {
      alert(e.message || 'Failed to delete category.');
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/api/superadmin/categories/${c.id}`, { active: !c.active });
      load();
    } catch (e) {
      alert(e.message || 'Failed to toggle category.');
    }
  };

  return (
    <>
      <h1>Categories</h1>
      <p className="lead">Organize products into storefront categories. Active categories show up in the top navigation and catalog filters.</p>

      {msg && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="form-card" style={{ maxWidth: 650, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Add New Category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 10, alignItems: 'end' }}>
          <Field label="Category Name">
            <input
              placeholder="e.g. Footwear"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </Field>
          <Field label="URL Slug (Optional)" hint="Auto-generated if empty">
            <input
              placeholder="footwear"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </Field>
          <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={add} style={{ height: 42, marginBottom: 2 }}>
            {busy ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>

      {cats === null ? (
        <p>Loading categories…</p>
      ) : cats.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No categories configured yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Slug</th>
                <th>Products</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><code>{c.slug}</code></td>
                  <td>{c.productCount ?? 0} items</td>
                  <td><Chip status={c.active ? 'ACTIVE' : 'DISABLED'} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h2 style={{ marginTop: 0 }}>Edit Category</h2>
          <Field label="Category Name">
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </Field>
          <Field label="URL Slug">
            <input
              value={editForm.slug}
              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
            />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0' }}>
            <input
              type="checkbox"
              checked={editForm.active}
              onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
            />
            Category is active and visible to shoppers
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-primary" disabled={busy || !editForm.name.trim()} onClick={saveEdit}>
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ==========================================
// 2.5 USERS / CUSTOMERS MANAGEMENT
// ==========================================
export function Users() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const load = () => api.get(`/api/superadmin/users?q=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);
  return (
    <>
      <h1>Customers</h1>
      <div className="toolbar">
        <input type="search" placeholder="Search name / email / phone…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn btn-secondary btn-sm" onClick={load}>Search</button>
      </div>
      {users === null ? <p>Loading…</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Name</th><th>Contact</th><th>Roles</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td>{u.name || '—'}</td><td>{u.email || u.phone}</td><td>{(u.roles || []).join(', ') || 'Customer'}</td>
              <td><Chip status={u.status} /></td>
              <td>{!(u.roles || []).includes('SUPERADMIN') && (
                <button className="btn btn-ghost btn-sm" onClick={async () => { await api.patch(`/api/superadmin/users/${u.id}/status`, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); load(); }}>
                  {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                </button>)}</td></tr>))}
          </tbody>
        </table></div>)}
    </>
  );
}

// ==========================================
// 3. STAFF & ROLES (With Password & Reset)
// ==========================================
export function Staff() {
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', role: 'ADMIN', password: '' });
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/api/superadmin/staff')
      .then((d) => setStaff(d.staff || []))
      .catch(() => setStaff([]));
  };

  useEffect(load, []);

  const invite = async () => {
    if (!form.email && !form.phone && !form.username) {
      alert('Please provide at least a username, email, or phone.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/superadmin/staff', form);
      setForm({ name: '', username: '', email: '', phone: '', role: 'ADMIN', password: '' });
      setMsg('Staff role granted successfully! The staff member can now log in at /admin/login ✓');
      load();
    } catch (e) {
      alert(e.message || 'Failed to grant staff role.');
    }
    setBusy(false);
  };

  const revoke = async (s) => {
    if (!window.confirm(`Are you sure you want to revoke staff access for ${s.user?.name || s.user?.email || 'this person'}?`)) return;
    try {
      await api.del(`/api/superadmin/staff/${s.id}`);
      setMsg('Staff role revoked.');
      load();
    } catch (e) {
      alert(e.message || 'Failed to revoke role.');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/superadmin/staff/${resetTarget.userId}/reset-password`, { password: newPassword });
      setResetTarget(null);
      setNewPassword('');
      setMsg('Password updated successfully! Staff can now log in with the new password.');
    } catch (e) {
      alert(e.message || 'Failed to reset password.');
    }
    setBusy(false);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <h1>Staff & Roles</h1>
      <p className="lead">Manage Admin and Superadmin staff accounts. Staff can sign in at <code>/admin/login</code> with their username/email and password.</p>

      {msg && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="form-card" style={{ maxWidth: 720, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Add New Staff Member</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
          <Field label="Full Name">
            <input value={form.name} onChange={set('name')} placeholder="e.g. Priyanshu Sharma" />
          </Field>
          <Field label="Assigned Role">
            <select value={form.role} onChange={set('role')}>
              <option value="ADMIN">Admin (Products & Catalog only)</option>
              <option value="SUPERADMIN">Superadmin (Full Store Control)</option>
            </select>
          </Field>
          <Field label="Username (for login)">
            <input value={form.username} onChange={set('username')} placeholder="e.g. priyanshu" />
          </Field>
          <Field label="Initial Password" hint="Defaults to Staff@123 if left empty">
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••••••" />
          </Field>
          <Field label="Work Email">
            <input type="email" value={form.email} onChange={set('email')} placeholder="staff@khaas.in" />
          </Field>
          <Field label="Phone Number (optional)">
            <input value={form.phone} onChange={set('phone')} placeholder="9876543210" inputMode="numeric" />
          </Field>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={invite} style={{ marginTop: 8 }}>
          {busy ? 'Granting Role…' : 'Grant Staff Access →'}
        </button>
      </div>

      {staff === null ? (
        <p>Loading staff…</p>
      ) : staff.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No staff members found.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Username</th>
                <th>Role</th>
                <th>Granted Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.user?.name || 'Staff Member'}</strong>
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{s.user?.email || s.user?.phone || 'No contact email'}</small>
                  </td>
                  <td><code>{s.user?.username || (s.user?.email ? s.user.email.split('@')[0] : '—')}</code></td>
                  <td><Chip status={s.role} /></td>
                  <td><small style={{ color: 'var(--muted)' }}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</small></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setResetTarget(s); setNewPassword(''); }}
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => revoke(s)}
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <Modal onClose={() => setResetTarget(null)}>
          <h2 style={{ marginTop: 0 }}>Reset Staff Password</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Set a new login password for <strong>{resetTarget.user?.name || resetTarget.user?.username || 'this user'}</strong>.
          </p>
          <Field label="New Password (min 6 characters)">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
            />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-primary" disabled={busy || !newPassword} onClick={handleResetPassword}>
              {busy ? 'Updating…' : 'Update Password ✓'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ==========================================
// 4. COUPONS MANAGEMENT (Full CRUD)
// ==========================================
export function Coupons() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({
    code: '', kind: 'percent', value: '', maxDiscount: '', minSubtotal: '', usageLimit: ''
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/api/superadmin/coupons')
      .then((d) => setList(d.coupons || []))
      .catch(() => setList([]));
  };

  useEffect(load, []);

  const create = async () => {
    if (!form.code.trim()) { alert('Coupon code is required.'); return; }
    if (!form.value || parseInt(form.value, 10) <= 0) { alert('Valid discount value is required.'); return; }
    setBusy(true);
    setMsg('');
    try {
      await api.post('/api/superadmin/coupons', {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        value: parseInt(form.value, 10),
        maxDiscountPaise: form.maxDiscount ? Math.round(parseFloat(form.maxDiscount) * 100) : null,
        minSubtotalPaise: form.minSubtotal ? Math.round(parseFloat(form.minSubtotal) * 100) : 0,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : null,
      });
      setForm({ code: '', kind: 'percent', value: '', maxDiscount: '', minSubtotal: '', usageLimit: '' });
      setMsg('Coupon created successfully ✓');
      load();
    } catch (e) {
      alert(e.message || 'Failed to create coupon.');
    }
    setBusy(false);
  };

  const remove = async (c) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${c.code}"?`)) return;
    try {
      await api.del(`/api/superadmin/coupons/${c.id}`);
      setMsg(`Coupon "${c.code}" deleted.`);
      load();
    } catch (e) {
      alert(e.message || 'Failed to delete coupon.');
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/api/superadmin/coupons/${c.id}`, { active: !c.active });
      load();
    } catch (e) {
      alert(e.message || 'Failed to toggle coupon.');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <h1>Discount Coupons</h1>
      <p className="lead">Create percentage or flat rupee discount codes for checkout promotions.</p>

      {msg && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="form-card" style={{ maxWidth: 740, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Create New Coupon</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
          <Field label="Coupon Code">
            <input
              value={form.code}
              onChange={set('code')}
              placeholder="FESTIVE20"
              style={{ textTransform: 'uppercase', fontWeight: 600 }}
            />
          </Field>
          <Field label="Discount Type">
            <select value={form.kind} onChange={set('kind')}>
              <option value="percent">Percent Discount (%)</option>
              <option value="flat">Flat Rupee Discount (₹)</option>
            </select>
          </Field>
          <Field label={form.kind === 'percent' ? 'Discount Percentage (%)' : 'Flat Discount (₹)'}>
            <input value={form.value} onChange={set('value')} inputMode="numeric" placeholder={form.kind === 'percent' ? '15' : '200'} />
          </Field>
          <Field label="Max Discount (₹, optional)" hint={form.kind === 'flat' ? 'Ignored for flat discount' : 'Caps the percentage discount'}>
            <input value={form.maxDiscount} onChange={set('maxDiscount')} inputMode="decimal" placeholder="e.g. 500" />
          </Field>
          <Field label="Min Order Value (₹, optional)">
            <input value={form.minSubtotal} onChange={set('minSubtotal')} inputMode="decimal" placeholder="e.g. 999" />
          </Field>
          <Field label="Usage Limit (optional)" hint="Max total redemptions">
            <input value={form.usageLimit} onChange={set('usageLimit')} inputMode="numeric" placeholder="e.g. 500" />
          </Field>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !form.code.trim()} onClick={create} style={{ marginTop: 6 }}>
          {busy ? 'Creating…' : 'Create Coupon Code'}
        </button>
      </div>

      {list === null ? (
        <p>Loading coupons…</p>
      ) : list.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No coupons created yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount Rule</th>
                <th>Min Order</th>
                <th>Usage</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><code><strong>{c.code}</strong></code></td>
                  <td>
                    {c.kind === 'percent' ? `${c.value}% off` : `₹${c.value} flat discount`}
                    {c.maxDiscountPaise ? ` (up to ${inr(c.maxDiscountPaise)})` : ''}
                  </td>
                  <td>{c.minSubtotalPaise ? inr(c.minSubtotalPaise) : 'No minimum'}</td>
                  <td>{c.usedCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ' (unlimited)'}</td>
                  <td><Chip status={c.active ? 'ACTIVE' : 'DISABLED'} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/api/superadmin/reports').then(setR).catch(() => setR({ err: true })); }, []);
  if (!r) return <p>Loading…</p>;
  if (r.err) return <p>Could not load reports.</p>;
  const max = Math.max(1, ...r.byDay.map((d) => d.paise));
  return (
    <>
      <h1>Reports <small style={{ color: 'var(--muted)', fontWeight: 400 }}>· last 30 days, verified payments only</small></h1>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat"><div className="v">{r.revenueDisplay}</div><div className="l">Revenue</div></div>
        <div className="stat"><div className="v">{r.orderCount}</div><div className="l">Paid orders</div></div>
      </div>
      <h3>Revenue by day</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, marginBottom: 28 }}>
        {r.byDay.map((d) => (
          <div key={d.day} title={`${d.day}: ₹${(d.paise / 100).toLocaleString('en-IN')}`}
            style={{ flex: 1, background: 'var(--walnut)', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (d.paise / max) * 150)}px`, opacity: .85 }} />
        ))}
      </div>
      <h3>Top products</h3>
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Product</th><th>Qty sold</th><th>Revenue</th></tr></thead>
        <tbody>{r.topProducts.map((p, i) => <tr key={i}><td>{p.title}</td><td>{p.qty}</td><td>₹{(p.revenue / 100).toLocaleString('en-IN')}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}

export function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/api/superadmin/settings').then((d) => setS(d.settings)); }, []);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setS({ ...s, [k]: v });
  };
  const save = async () => {
    setMsg('');
    try {
      const payload = {
        ...s,
        shippingFlatPaise: isNaN(parseInt(s.shippingFlatPaise, 10)) ? 9900 : parseInt(s.shippingFlatPaise, 10),
        freeShippingAbovePaise: isNaN(parseInt(s.freeShippingAbovePaise, 10)) ? 199900 : parseInt(s.freeShippingAbovePaise, 10),
        returnDays: isNaN(parseInt(s.returnDays, 10)) ? 7 : parseInt(s.returnDays, 10),
      };
      const d = await api.patch('/api/superadmin/settings', payload);
      setS(d.settings); setMsg('Settings saved ✓');
    } catch (e) { setMsg(e.message); }
  };
  if (!s) return <p>Loading…</p>;
  return (
    <>
      <h1>Store settings</h1>
      {msg && <p style={{ fontWeight: 600 }}>{msg}</p>}
      <div className="form-card" style={{ maxWidth: 700 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Brand name"><input value={s.brandName || ''} onChange={set('brandName')} /></Field>
          <Field label="Tagline"><input value={s.tagline || ''} onChange={set('tagline')} /></Field>
          <Field label="Support email"><input value={s.supportEmail || ''} onChange={set('supportEmail')} /></Field>
          <Field label="Support phone"><input value={s.supportPhone || ''} onChange={set('supportPhone')} /></Field>
          <Field label="Shipping flat (paise)"><input value={s.shippingFlatPaise} onChange={set('shippingFlatPaise')} inputMode="numeric" /></Field>
          <Field label="Free shipping above (paise)"><input value={s.freeShippingAbovePaise} onChange={set('freeShippingAbovePaise')} inputMode="numeric" /></Field>
          <Field label="UPI ID for QR payments"><input value={s.qrUpiId || ''} onChange={set('qrUpiId')} /></Field>
          <Field label="QR payee name"><input value={s.qrPayeeName || ''} onChange={set('qrPayeeName')} /></Field>
          <Field label="Return window (days)"><input value={s.returnDays} onChange={set('returnDays')} inputMode="numeric" /></Field>
          <Field label="Announcement strip"><input value={s.announcement || ''} onChange={set('announcement')} /></Field>
        </div>
        <Field label="QR payment instructions"><textarea rows={3} value={s.qrInstructions || ''} onChange={set('qrInstructions')} /></Field>
        <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!s.qrEnabled} onChange={set('qrEnabled')} /> QR payments enabled</label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!s.codEnabled} onChange={set('codEnabled')} /> COD enabled</label>
        </div>
        <button className="btn btn-primary" onClick={save}>Save settings</button>
      </div>
    </>
  );
}

export function AuditLogs() {
  const [d, setD] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api.get(`/api/superadmin/audit-logs?page=${page}`).then(setD).catch(() => setD({ items: [], total: 0 })); }, [page]);
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <h1>Audit log</h1>
      <p className="lead">Every privileged action — who did what, when, to which record.</p>
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Actor</th><th>Details</th></tr></thead>
        <tbody>{d.items.map((a) => (
          <tr key={a.id}>
            <td><small>{new Date(a.createdAt).toLocaleString('en-IN')}</small></td>
            <td><code style={{ fontSize: 12 }}>{a.action}</code></td>
            <td>{a.targetType}{a.targetId ? ` · ${String(a.targetId).slice(0, 12)}…` : ''}</td>
            <td><small>{a.actorId ? String(a.actorId).slice(0, 12) + '…' : 'system'}</small></td>
            <td><small style={{ color: 'var(--muted)' }}>{JSON.stringify(a.meta || {}).slice(0, 80)}</small></td>
          </tr>))}
        </tbody>
      </table></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
        <button className="btn btn-secondary btn-sm" disabled={d.items.length < 50} onClick={() => setPage(page + 1)}>Next →</button>
      </div>
    </>
  );
}
