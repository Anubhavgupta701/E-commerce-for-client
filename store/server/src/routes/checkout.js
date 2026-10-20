import { Router } from 'express';
import { col, findById, getSettings } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { uid, orderNumber, nowIso, formatINR } from '../util.js';
import { findVariant } from './catalog.js';
import { getCart } from './cart.js';

const router = Router();

function validateAddress(a) {
  const errors = {};
  if (!a || typeof a !== 'object') return { _all: 'Delivery address is required.' };
  if (!a.name?.trim()) errors.name = 'Full name is required.';
  if (!a.phone?.replace(/\D/g, '').match(/^\d{10}$/)) errors.phone = 'Enter a valid 10-digit phone number.';
  if (!a.line1?.trim()) errors.line1 = 'Address line 1 is required.';
  if (!a.city?.trim()) errors.city = 'City is required.';
  if (!a.state?.trim()) errors.state = 'State is required.';
  if (!a.pincode?.match(/^\d{6}$/)) errors.pincode = 'Enter a valid 6-digit pincode.';
  return errors;
}

function applyCoupon(code, subtotalPaise) {
  if (!code) return { discountPaise: 0, coupon: null };
  const cpn = col('coupons').find((c) => c.code === String(code).trim().toUpperCase());
  if (!cpn || !cpn.active) {
    const e = new Error('This coupon code is not valid.');
    e.status = 400; throw e;
  }
  const now = nowIso();
  if (cpn.startsAt && cpn.startsAt > now) { const e = new Error('This coupon is not active yet.'); e.status = 400; throw e; }
  if (cpn.endsAt && cpn.endsAt < now) { const e = new Error('This coupon has expired.'); e.status = 400; throw e; }
  if (cpn.usageLimit && cpn.usedCount >= cpn.usageLimit) { const e = new Error('This coupon has reached its usage limit.'); e.status = 400; throw e; }
  if (subtotalPaise < (cpn.minSubtotalPaise || 0)) {
    const e = new Error(`This coupon needs a minimum order of ${formatINR(cpn.minSubtotalPaise)}.`); e.status = 400; throw e;
  }
  let discount = 0;
  if (cpn.kind === 'percent') discount = Math.floor((subtotalPaise * cpn.value) / 100);
  else discount = cpn.value * 100; // flat value in ₹ converted to paise
  if (cpn.maxDiscountPaise) discount = Math.min(discount, cpn.maxDiscountPaise);
  discount = Math.min(discount, subtotalPaise);
  return { discountPaise: discount, coupon: cpn };
}

function serializeOrder(o) {
  return {
    ...o,
    totalDisplay: formatINR(o.totalPaise),
    subtotalDisplay: formatINR(o.subtotalPaise),
    discountDisplay: formatINR(o.discountPaise || 0),
    shippingDisplay: formatINR(o.shippingPaise || 0),
  };
}

// ---------- Checkout: transactional, server-recalculated ----------
router.post('/', requireAuth, (req, res) => {
  try {
    const { address, paymentMethod, couponCode, idempotencyKey } = req.body || {};
    const scopeUser = req.auth.user.id;

    if (idempotencyKey) {
      const prev = col('idempotencyKeys').find((k) => k.key === idempotencyKey && k.scope === 'checkout' && k.userId === scopeUser);
      if (prev) return res.json(prev.response);
    }

    const settings = getSettings();
    if (!['QR', 'COD'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose a payment method.' });
    if (paymentMethod === 'QR' && !settings.qrEnabled) return res.status(400).json({ error: 'QR payment is currently disabled.' });
    if (paymentMethod === 'COD' && !settings.codEnabled) return res.status(400).json({ error: 'Cash on delivery is currently disabled.' });

    const addrErrors = validateAddress(address);
    if (Object.keys(addrErrors).length) return res.status(400).json({ error: 'Please fix the address fields.', fields: addrErrors });

    const cart = getCart(req);
    if (!cart.items.length) return res.status(400).json({ error: 'Your cart is empty.' });

    // Revalidate prices + stock on the server
    const lines = [];
    let subtotal = 0;
    for (const it of cart.items) {
      const found = findVariant(it.sku);
      if (!found || found.product.status !== 'ACTIVE') return res.status(400).json({ error: `"${it.sku}" is no longer available. Please review your cart.` });
      if (found.variant.stock < it.qty) return res.status(400).json({ error: `Only ${found.variant.stock} left of "${found.product.title}". Please review your cart.` });
      const lineTotal = found.variant.pricePaise * it.qty;
      subtotal += lineTotal;
      lines.push({
        productId: found.product.id, sku: it.sku,
        title: found.product.title, // snapshot at purchase time
        attributes: found.variant.attributes,
        unitPricePaise: found.variant.pricePaise,
        qty: it.qty, lineTotalPaise: lineTotal,
      });
    }

    const { discountPaise, coupon } = applyCoupon(couponCode, subtotal);
    const shipping = subtotal - discountPaise >= settings.freeShippingAbovePaise ? 0 : settings.shippingFlatPaise;
    const total = subtotal - discountPaise + shipping;

    // Decrement stock (single-threaded => atomic enough for this deployment)
    for (const it of cart.items) {
      const found = findVariant(it.sku);
      found.variant.stock -= it.qty;
    }
    if (coupon) coupon.usedCount = (coupon.usedCount || 0) + 1;

    const order = {
      id: uid('ord_'),
      orderNumber: orderNumber(),
      userId: req.auth.user.id,
      contact: { email: req.auth.user.email, phone: req.auth.user.phone },
      address: {
        name: address.name.trim(), phone: address.phone.replace(/\D/g, ''),
        line1: address.line1.trim(), line2: (address.line2 || '').trim(),
        city: address.city.trim(), state: address.state.trim(), pincode: address.pincode,
      },
      items: lines,
      subtotalPaise: subtotal, discountPaise, couponCode: coupon ? coupon.code : null,
      shippingPaise: shipping, taxPaise: 0, totalPaise: total,
      currency: 'INR',
      paymentMethod,
      paymentStatus: paymentMethod === 'QR' ? 'PENDING' : 'COD_DUE',
      fulfilmentStatus: 'PLACED',
      timeline: [{ at: nowIso(), event: 'Order placed', by: req.auth.user.id }],
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    col('orders').push(order);
    audit(req.auth.user.id, 'order.create', 'order', order.id, { orderNumber: order.orderNumber, totalPaise: total });

    cart.items = [];
    cart.updatedAt = nowIso();

    const response = { order: serializeOrder(order) };
    if (idempotencyKey) col('idempotencyKeys').push({ key: idempotencyKey, scope: 'checkout', userId: scopeUser, response, createdAt: nowIso() });
    res.status(201).json(response);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Checkout failed. Please try again.' });
  }
});

// ---------- Customer order views ----------
router.get('/orders/me', requireAuth, (req, res) => {
  const list = col('orders')
    .filter((o) => o.userId === req.auth.user.id)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .map(serializeOrder);
  res.json({ orders: list });
});

router.get('/orders/:orderNumber', requireAuth, (req, res) => {
  const o = col('orders').find((x) => x.orderNumber === req.params.orderNumber);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const isOwner = o.userId === req.auth.user.id;
  const isStaff = req.auth.roles.includes('SUPERADMIN');
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'You do not have permission to view this order.' });
  const submissions = col('paymentSubmissions').filter((s) => s.orderId === o.id)
    .map((s) => ({ ...s, screenshotKey: undefined }));
  res.json({ order: serializeOrder(o), paymentSubmissions: submissions });
});

export default router;
