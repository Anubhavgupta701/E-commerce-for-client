import { Router } from 'express';
import { col } from '../db.js';
import { requireAuth } from '../auth.js';
import { uid, nowIso, formatINR } from '../util.js';
import { findVariant } from './catalog.js';

const router = Router();

function cartKey(req) {
  if (req.auth) return { userId: req.auth.user.id, guestId: null };
  let gid = req.cookies?.gid;
  if (!gid) {
    gid = uid('guest_');
    // set lazily on next response via middleware below
    req._newGuestId = gid;
  }
  return { userId: null, guestId: gid };
}

export function getCart(req) {
  const { userId, guestId } = cartKey(req);
  let cart = col('carts').find((c) => (userId ? c.userId === userId : c.guestId === guestId));
  if (!cart) {
    cart = { id: uid('cart_'), userId, guestId, items: [], updatedAt: nowIso() };
    col('carts').push(cart);
  }
  return cart;
}

export function serializeCart(cart) {
  const items = [];
  let subtotalPaise = 0;
  for (const it of cart.items) {
    const found = findVariant(it.sku);
    if (!found || found.product.status !== 'ACTIVE') continue;
    const lineTotal = found.variant.pricePaise * it.qty;
    subtotalPaise += lineTotal;
    items.push({
      sku: it.sku, qty: it.qty,
      title: found.product.title, slug: found.product.slug,
      image: typeof found.product.media[0] === 'string' ? found.product.media[0] : (found.product.media[0]?.key ? `/${found.product.media[0].key}` : null),
      attributes: found.variant.attributes,
      unitPricePaise: found.variant.pricePaise,
      unitPriceDisplay: formatINR(found.variant.pricePaise),
      lineTotalPaise: lineTotal, lineTotalDisplay: formatINR(lineTotal),
      stock: found.variant.stock,
    });
  }
  return { items, count: items.reduce((n, i) => n + i.qty, 0), subtotalPaise, subtotalDisplay: formatINR(subtotalPaise) };
}

// set guest cookie if we minted one
router.use((req, res, next) => {
  if (req._newGuestId) res.cookie('gid', req._newGuestId, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5 });
  next();
});

router.get('/', (req, res) => {
  res.json(serializeCart(getCart(req)));
});

router.post('/items', (req, res) => {
  const { sku, qty = 1 } = req.body || {};
  const found = findVariant(sku);
  if (!found || found.product.status !== 'ACTIVE') return res.status(404).json({ error: 'This item is no longer available.' });
  const q = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
  if (found.variant.stock < q) return res.status(400).json({ error: `Only ${found.variant.stock} in stock.` });
  const cart = getCart(req);
  const line = cart.items.find((i) => i.sku === sku);
  const newQty = (line ? line.qty : 0) + q;
  if (found.variant.stock < newQty) return res.status(400).json({ error: `Only ${found.variant.stock} in stock.` });
  if (line) line.qty = newQty; else cart.items.push({ sku, qty: q });
  cart.updatedAt = nowIso();
  res.json(serializeCart(cart));
});

router.patch('/items', (req, res) => {
  const { sku, qty } = req.body || {};
  const cart = getCart(req);
  const line = cart.items.find((i) => i.sku === sku);
  if (!line) return res.status(404).json({ error: 'Item not in cart.' });
  const q = parseInt(qty, 10) || 0;
  if (q <= 0) cart.items = cart.items.filter((i) => i.sku !== sku);
  else {
    const found = findVariant(sku);
    if (found && found.variant.stock < q) return res.status(400).json({ error: `Only ${found.variant.stock} in stock.` });
    line.qty = Math.min(99, q);
  }
  cart.updatedAt = nowIso();
  res.json(serializeCart(cart));
});

router.delete('/items/:sku', (req, res) => {
  const cart = getCart(req);
  cart.items = cart.items.filter((i) => i.sku !== req.params.sku);
  cart.updatedAt = nowIso();
  res.json(serializeCart(cart));
});

// Server-side revalidation: never trust client totals.
router.post('/validate', (req, res) => {
  const cart = getCart(req);
  const issues = [];
  for (const it of cart.items) {
    const found = findVariant(it.sku);
    if (!found || found.product.status !== 'ACTIVE') issues.push({ sku: it.sku, issue: 'unavailable' });
    else if (found.variant.stock < it.qty) issues.push({ sku: it.sku, issue: 'low-stock', available: found.variant.stock });
  }
  res.json({ valid: issues.length === 0, issues, ...serializeCart(cart) });
});

export default router;
