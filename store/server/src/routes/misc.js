import { Router } from 'express';
import { col, findById, getSettings } from '../db.js';
import { requireAuth, publicUser, audit } from '../auth.js';
import { uid, nowIso } from '../util.js';

const router = Router();

// Public store settings (safe subset only — never secrets)
router.get('/settings/public', (_req, res) => {
  const s = getSettings() || {};
  res.json({
    settings: {
      brandName: s.brandName, tagline: s.tagline, currencySymbol: s.currencySymbol,
      supportEmail: s.supportEmail, supportPhone: s.supportPhone,
      shippingFlatPaise: s.shippingFlatPaise, freeShippingAbovePaise: s.freeShippingAbovePaise,
      codEnabled: s.codEnabled, qrEnabled: s.qrEnabled,
      announcement: s.announcement, returnDays: s.returnDays,
    },
  });
});

// Coupon preview (validated again at checkout — server is the authority)
router.get('/coupons/validate', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  const cpn = col('coupons').find((c) => c.code === code);
  if (!cpn || !cpn.active) return res.status(400).json({ error: 'This coupon code is not valid.' });
  res.json({ coupon: { code: cpn.code, kind: cpn.kind, value: cpn.value, maxDiscountPaise: cpn.maxDiscountPaise, minSubtotalPaise: cpn.minSubtotalPaise } });
});

// ---------- Account ----------
router.get('/account', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.auth.user) });
});
router.patch('/account', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (name !== undefined) req.auth.user.name = String(name).trim().slice(0, 80);
  res.json({ user: publicUser(req.auth.user) });
});

// ---------- Addresses ----------
router.get('/addresses', requireAuth, (req, res) => {
  res.json({ addresses: col('addresses').filter((a) => a.userId === req.auth.user.id) });
});
router.post('/addresses', requireAuth, (req, res) => {
  const a = req.body || {};
  const rec = {
    id: uid('addr_'), userId: req.auth.user.id,
    name: String(a.name || '').trim(), phone: String(a.phone || '').replace(/\D/g, ''),
    line1: String(a.line1 || '').trim(), line2: String(a.line2 || '').trim(),
    city: String(a.city || '').trim(), state: String(a.state || '').trim(),
    pincode: String(a.pincode || '').trim(), createdAt: nowIso(),
  };
  if (!rec.name || !rec.line1 || !rec.city) return res.status(400).json({ error: 'Name, address line 1 and city are required.' });
  col('addresses').push(rec);
  res.status(201).json({ address: rec });
});
router.delete('/addresses/:id', requireAuth, (req, res) => {
  const i = col('addresses').findIndex((a) => a.id === req.params.id && a.userId === req.auth.user.id);
  if (i < 0) return res.status(404).json({ error: 'Address not found.' });
  col('addresses').splice(i, 1);
  res.json({ ok: true });
});

// ---------- Wishlist ----------
router.get('/wishlist', requireAuth, (req, res) => {
  const ids = col('wishlists').filter((w) => w.userId === req.auth.user.id).map((w) => w.productId);
  const products = ids.map((id) => findById('products', id)).filter((p) => p && p.status === 'ACTIVE');
  res.json({ productIds: ids, products: products.map((p) => ({ id: p.id, title: p.title, slug: p.slug, media: p.media, priceFrom: Math.min(...p.variants.map((v) => v.pricePaise)) })) });
});
router.post('/wishlist', requireAuth, (req, res) => {
  const { productId } = req.body || {};
  if (!findById('products', productId)) return res.status(404).json({ error: 'Product not found.' });
  if (!col('wishlists').some((w) => w.userId === req.auth.user.id && w.productId === productId)) {
    col('wishlists').push({ id: uid('wish_'), userId: req.auth.user.id, productId, createdAt: nowIso() });
  }
  res.json({ ok: true });
});
router.delete('/wishlist/:productId', requireAuth, (req, res) => {
  const i = col('wishlists').findIndex((w) => w.userId === req.auth.user.id && w.productId === req.params.productId);
  if (i >= 0) col('wishlists').splice(i, 1);
  res.json({ ok: true });
});

export default router;
