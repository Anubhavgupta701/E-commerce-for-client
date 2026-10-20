import { Router } from 'express';
import { col, findById, getSettings, setSettings } from '../db.js';
import { requireRole, audit, rolesOf, publicUser } from '../auth.js';
import { uid, nowIso, formatINR, hashPassword } from '../util.js';

const router = Router();
const superOnly = requireRole('SUPERADMIN');

const FULFILMENT_FLOW = ['PLACED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];

// ---------- Overview ----------
router.get('/overview', superOnly, (_req, res) => {
  const orders = col('orders');
  const subs = col('paymentSubmissions');
  const revenue = orders
    .filter((o) => ['APPROVED', 'COD_COLLECTED'].includes(o.paymentStatus))
    .reduce((n, o) => n + o.totalPaise, 0);
  const lowStock = [];
  for (const p of col('products')) {
    for (const v of p.variants) {
      if (v.stock <= 5) lowStock.push({ product: p.title, sku: v.sku, stock: v.stock });
    }
  }
  res.json({
    revenuePaise: revenue, revenueDisplay: formatINR(revenue),
    orderCount: orders.length,
    pendingPayments: subs.filter((s) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(s.status)).length,
    lowStock: lowStock.slice(0, 10),
    recentAudit: col('auditLogs').slice(-8).reverse(),
  });
});

// ---------- Orders ----------
router.get('/orders', superOnly, (req, res) => {
  const { status = '', q = '' } = req.query;
  let list = [...col('orders')];
  if (status) list = list.filter((o) => o.fulfilmentStatus === status || o.paymentStatus === status);
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((o) => o.orderNumber.toLowerCase().includes(n) || (o.contact.phone || '').includes(n));
  }
  list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  res.json({ orders: list });
});

router.patch('/orders/:id/fulfilment', superOnly, (req, res) => {
  const order = findById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const { status } = req.body || {};
  const allowed = [...FULFILMENT_FLOW, 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid fulfilment status.' });
  if (order.paymentMethod === 'QR' && order.paymentStatus !== 'APPROVED' && ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(status)) {
    return res.status(400).json({ error: 'Payment must be approved before fulfilment can advance.' });
  }
  const from = order.fulfilmentStatus;
  order.fulfilmentStatus = status;
  order.updatedAt = nowIso();
  order.timeline.push({ at: nowIso(), event: `Fulfilment: ${from} → ${status}`, by: req.auth.user.id });
  if (status === 'DELIVERED' && order.paymentMethod === 'COD' && order.paymentStatus === 'COD_DUE') {
    order.paymentStatus = 'COD_COLLECTED';
    order.timeline.push({ at: nowIso(), event: 'COD collected at delivery', by: req.auth.user.id });
  }
  audit(req.auth.user.id, 'order.fulfilment', 'order', order.id, { from, to: status });
  res.json({ order });
});

// ---------- Categories ----------
router.get('/categories', superOnly, (_req, res) => {
  const products = col('products');
  const cats = [...col('categories')].sort((a, b) => a.sort - b.sort).map((c) => ({
    ...c,
    productCount: products.filter((p) => p.categoryId === c.id).length,
  }));
  res.json({ categories: cats });
});
router.post('/categories', superOnly, (req, res) => {
  const { name, slug } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });
  const s = (slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  if (col('categories').some((c) => c.slug === s)) return res.status(400).json({ error: 'A category with this slug already exists.' });
  const cat = { id: uid('cat_'), name: name.trim(), slug: s, active: true, sort: col('categories').length + 1 };
  col('categories').push(cat);
  audit(req.auth.user.id, 'category.create', 'category', cat.id, { name: cat.name });
  res.status(201).json({ category: cat });
});
router.patch('/categories/:id', superOnly, (req, res) => {
  const cat = findById('categories', req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found.' });
  const { name, slug, active } = req.body || {};
  if (name?.trim()) cat.name = name.trim();
  if (slug?.trim()) {
    const s = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (col('categories').some((c) => c.slug === s && c.id !== cat.id)) {
      return res.status(400).json({ error: 'A category with this slug already exists.' });
    }
    cat.slug = s;
  }
  if (typeof active === 'boolean') cat.active = active;
  audit(req.auth.user.id, 'category.update', 'category', cat.id, {});
  res.json({ category: cat });
});
router.delete('/categories/:id', superOnly, (req, res) => {
  const i = col('categories').findIndex((c) => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Category not found.' });
  const cat = col('categories')[i];
  col('categories').splice(i, 1);
  audit(req.auth.user.id, 'category.delete', 'category', cat.id, { name: cat.name });
  res.json({ ok: true });
});

// ---------- Users ----------
router.get('/users', superOnly, (req, res) => {
  const { q = '' } = req.query;
  let list = [...col('users')];
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((u) => (u.email || '').toLowerCase().includes(n) || (u.phone || '').includes(n) || (u.name || '').toLowerCase().includes(n));
  }
  list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  res.json({ users: list.slice(0, 100).map((u) => ({ ...publicUser(u), status: u.status, createdAt: u.createdAt })) });
});
router.patch('/users/:id/status', superOnly, (req, res) => {
  const user = findById('users', req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (rolesOf(user.id).includes('SUPERADMIN')) return res.status(400).json({ error: 'Superadmin accounts cannot be disabled here.' });
  const { status } = req.body || {};
  if (!['ACTIVE', 'DISABLED'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  user.status = status;
  audit(req.auth.user.id, 'user.status', 'user', user.id, { status });
  res.json({ user: publicUser(user) });
});

// ---------- Staff provisioning (invite-only, never public signup) ----------
router.get('/staff', superOnly, (_req, res) => {
  const staff = col('roleAssignments')
    .filter((r) => ['ADMIN', 'SUPERADMIN'].includes(r.role))
    .map((r) => {
      const u = findById('users', r.userId);
      return {
        ...r,
        user: u ? { ...publicUser(u), username: u.username || (u.email ? u.email.split('@')[0] : '') } : null,
      };
    });
  res.json({ staff });
});
router.post('/staff', superOnly, (req, res) => {
  const { name, email, phone, role, password, username } = req.body || {};
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) return res.status(400).json({ error: 'Role must be ADMIN or SUPERADMIN.' });
  if (!email && !phone && !username) return res.status(400).json({ error: 'Email, phone, or username is required.' });
  let user = col('users').find((u) => (email && u.email === email.toLowerCase()) || (phone && u.phone === phone) || (username && u.username === username.toLowerCase()));
  if (!user) {
    user = {
      id: uid('user_'),
      name: name || '',
      email: (email || '').toLowerCase(),
      phone: phone || '',
      username: username ? String(username).trim().toLowerCase() : (email ? email.split('@')[0].toLowerCase() : ''),
      passwordHash: password ? hashPassword(password) : hashPassword('Staff@123'),
      emailVerified: false,
      phoneVerified: false,
      status: 'ACTIVE',
      createdAt: nowIso(),
    };
    col('users').push(user);
  } else {
    if (username) user.username = String(username).trim().toLowerCase();
    if (password) user.passwordHash = hashPassword(password);
  }
  if (rolesOf(user.id).includes(role)) return res.status(400).json({ error: 'This user already has that role.' });
  col('roleAssignments').push({ id: uid('ra_'), userId: user.id, role, grantedBy: req.auth.user.id, createdAt: nowIso() });
  audit(req.auth.user.id, 'staff.grant', 'user', user.id, { role });
  res.status(201).json({ user: { ...publicUser(user), username: user.username } });
});
router.post('/staff/:userId/reset-password', superOnly, (req, res) => {
  const user = findById('users', req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  user.passwordHash = hashPassword(password);
  audit(req.auth.user.id, 'staff.reset_password', 'user', user.id, {});
  res.json({ ok: true, message: 'Password updated successfully.' });
});
router.delete('/staff/:assignmentId', superOnly, (req, res) => {
  const i = col('roleAssignments').findIndex((r) => r.id === req.params.assignmentId);
  if (i < 0) return res.status(404).json({ error: 'Assignment not found.' });
  const ra = col('roleAssignments')[i];
  if (ra.role === 'SUPERADMIN') {
    const supers = col('roleAssignments').filter((r) => r.role === 'SUPERADMIN');
    if (supers.length <= 1) return res.status(400).json({ error: 'Cannot remove the last Superadmin.' });
  }
  col('roleAssignments').splice(i, 1);
  audit(req.auth.user.id, 'staff.revoke', 'user', ra.userId, { role: ra.role });
  res.json({ ok: true });
});

// ---------- Coupons ----------
router.get('/coupons', superOnly, (_req, res) => {
  res.json({ coupons: col('coupons') });
});
router.post('/coupons', superOnly, (req, res) => {
  const { code, kind, value, maxDiscountPaise, minSubtotalPaise, usageLimit, endsAt } = req.body || {};
  if (!code?.trim()) return res.status(400).json({ error: 'Coupon code is required.' });
  if (!['percent', 'flat'].includes(kind)) return res.status(400).json({ error: 'Kind must be percent or flat.' });
  if (!Number.isInteger(value) || value <= 0) return res.status(400).json({ error: 'Value must be a positive integer.' });
  const c = String(code).trim().toUpperCase();
  if (col('coupons').some((x) => x.code === c)) return res.status(400).json({ error: 'Coupon code already exists.' });
  const coupon = {
    id: uid('cpn_'), code: c, kind, value,
    maxDiscountPaise: Number.isInteger(maxDiscountPaise) ? maxDiscountPaise : null,
    minSubtotalPaise: Number.isInteger(minSubtotalPaise) ? minSubtotalPaise : 0,
    active: true, startsAt: nowIso(), endsAt: endsAt || null,
    usageLimit: Number.isInteger(usageLimit) ? usageLimit : null, usedCount: 0, createdAt: nowIso(),
  };
  col('coupons').push(coupon);
  audit(req.auth.user.id, 'coupon.create', 'coupon', coupon.id, { code: c });
  res.status(201).json({ coupon });
});
router.patch('/coupons/:id', superOnly, (req, res) => {
  const c = findById('coupons', req.params.id);
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  const { active } = req.body || {};
  if (typeof active === 'boolean') c.active = active;
  audit(req.auth.user.id, 'coupon.update', 'coupon', c.id, { active });
  res.json({ coupon: c });
});
router.delete('/coupons/:id', superOnly, (req, res) => {
  const i = col('coupons').findIndex((c) => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Coupon not found.' });
  const c = col('coupons')[i];
  col('coupons').splice(i, 1);
  audit(req.auth.user.id, 'coupon.delete', 'coupon', c.id, { code: c.code });
  res.json({ ok: true });
});

// ---------- Settings ----------
router.get('/settings', superOnly, (_req, res) => {
  res.json({ settings: getSettings() });
});
router.patch('/settings', superOnly, (req, res) => {
  const s = getSettings();
  const allowed = ['brandName', 'tagline', 'supportEmail', 'supportPhone', 'shippingFlatPaise', 'freeShippingAbovePaise', 'codEnabled', 'qrEnabled', 'qrUpiId', 'qrPayeeName', 'qrInstructions', 'announcement', 'returnDays'];
  for (const k of allowed) if (req.body[k] !== undefined) s[k] = req.body[k];
  setSettings(s);
  audit(req.auth.user.id, 'settings.update', 'settings', 'global', {});
  res.json({ settings: s });
});

// ---------- Reports ----------
router.get('/reports', superOnly, (req, res) => {
  const { from, to } = req.query;
  const fromD = from ? new Date(from) : new Date(Date.now() - 30 * 864e5);
  const toD = to ? new Date(to) : new Date();
  const orders = col('orders').filter((o) => {
    const d = new Date(o.createdAt);
    return d >= fromD && d <= toD && ['APPROVED', 'COD_COLLECTED'].includes(o.paymentStatus);
  });
  const byDay = {};
  const byProduct = {};
  for (const o of orders) {
    const day = o.createdAt.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + o.totalPaise;
    for (const it of o.items) {
      byProduct[it.title] = byProduct[it.title] || { qty: 0, revenue: 0 };
      byProduct[it.title].qty += it.qty;
      byProduct[it.title].revenue += it.lineTotalPaise;
    }
  }
  const revenue = orders.reduce((n, o) => n + o.totalPaise, 0);
  res.json({
    revenuePaise: revenue, revenueDisplay: formatINR(revenue), orderCount: orders.length,
    byDay: Object.entries(byDay).sort().map(([day, paise]) => ({ day, paise })),
    topProducts: Object.entries(byProduct).map(([title, v]) => ({ title, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  });
});

// ---------- Audit ----------
router.get('/audit-logs', superOnly, (req, res) => {
  const { page = '1' } = req.query;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const all = [...col('auditLogs')].reverse();
  res.json({ items: all.slice((pg - 1) * 50, pg * 50), total: all.length, page: pg });
});

export default router;
