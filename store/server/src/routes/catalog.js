import { Router } from 'express';
import { col, findById, getSettings } from '../db.js';
import { requireRole, audit, publicUser } from '../auth.js';
import { uid, slugify, nowIso, formatINR } from '../util.js';

const router = Router();

function serializeProduct(p) {
  const category = p.categoryId ? findById('categories', p.categoryId) : null;
  const prices = p.variants.map((v) => v.pricePaise);
  return {
    id: p.id, title: p.title, slug: p.slug, description: p.description, brand: p.brand,
    status: p.status, category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    media: p.media || [], variants: p.variants,
    priceFrom: Math.min(...prices), priceTo: Math.max(...prices),
    priceFromDisplay: formatINR(Math.min(...prices)),
    inStock: p.variants.some((v) => v.stock > 0),
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

function findVariant(sku) {
  for (const p of col('products')) {
    const v = (p.variants || []).find((x) => x.sku === sku);
    if (v) return { product: p, variant: v };
  }
  return null;
}

// ---------- Public catalog ----------
router.get('/categories', (_req, res) => {
  const cats = col('categories').filter((c) => c.active).sort((a, b) => a.sort - b.sort);
  res.json({ categories: cats });
});

router.get('/products', (req, res) => {
  const { q = '', category = '', sort = 'new', page = '1', limit = '12' } = req.query;
  let list = col('products').filter((p) => p.status === 'ACTIVE');
  if (category) {
    const cat = col('categories').find((c) => c.slug === category);
    list = cat ? list.filter((p) => p.categoryId === cat.id) : [];
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((p) =>
      p.title.toLowerCase().includes(needle) ||
      (p.description || '').toLowerCase().includes(needle) ||
      (p.brand || '').toLowerCase().includes(needle));
  }
  const priceOf = (p) => Math.min(...p.variants.map((v) => v.pricePaise));
  if (sort === 'price-asc') list.sort((a, b) => priceOf(a) - priceOf(b));
  else if (sort === 'price-desc') list.sort((a, b) => priceOf(b) - priceOf(a));
  else list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(48, Math.max(1, parseInt(limit, 10) || 12));
  const total = list.length;
  const items = list.slice((pg - 1) * lim, pg * lim).map(serializeProduct);
  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) });
});

router.get('/products/:slug', (req, res) => {
  const p = col('products').find((x) => x.slug === req.params.slug && x.status === 'ACTIVE');
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const related = col('products')
    .filter((x) => x.status === 'ACTIVE' && x.id !== p.id && x.categoryId === p.categoryId)
    .slice(0, 4).map(serializeProduct);
  res.json({ product: serializeProduct(p), related });
});

// ---------- Admin: product management only ----------
const adminOnly = requireRole('ADMIN', 'SUPERADMIN');

router.get('/admin/products', adminOnly, (req, res) => {
  const { q = '', status = '' } = req.query;
  let list = [...col('products')];
  if (status) list = list.filter((p) => p.status === status);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(needle));
  }
  list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  res.json({ items: list.map(serializeProduct) });
});

function validateProductInput(body) {
  const errors = {};
  if (!body.title || !body.title.trim()) errors.title = 'Title is required.';
  if (!body.categoryId || !findById('categories', body.categoryId)) errors.categoryId = 'Valid category is required.';
  if (!Array.isArray(body.variants) || body.variants.length === 0) errors.variants = 'At least one variant is required.';
  (body.variants || []).forEach((v, i) => {
    if (!Number.isInteger(v.pricePaise) || v.pricePaise < 0) errors[`variants[${i}].pricePaise`] = 'Price must be a non-negative integer (paise).';
    if (!Number.isInteger(v.stock) || v.stock < 0) errors[`variants[${i}].stock`] = 'Stock must be a non-negative integer.';
  });
  return errors;
}

router.post('/admin/products', adminOnly, (req, res) => {
  const errors = validateProductInput(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
  const b = req.body;
  const t = nowIso();
  const slugBase = slugify(b.title);
  let slug = slugBase;
  let n = 2;
  while (col('products').some((p) => p.slug === slug)) slug = `${slugBase}-${n++}`;
  const product = {
    id: uid('prod_'), title: b.title.trim(), slug,
    description: b.description || '', brand: b.brand || getSettings()?.brandName || 'Khaas',
    categoryId: b.categoryId, status: 'ACTIVE', createdAt: t, updatedAt: t,
    media: Array.isArray(b.media) ? b.media : [],
    variants: b.variants.map((v, i) => ({
      sku: v.sku || `${slugBase.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${i}`,
      attributes: v.attributes || {},
      pricePaise: v.pricePaise,
      compareAtPaise: Number.isInteger(v.compareAtPaise) ? v.compareAtPaise : null,
      stock: v.stock,
    })),
  };
  col('products').push(product);
  audit(req.auth.user.id, 'product.create', 'product', product.id, { title: product.title });
  res.status(201).json({ product: serializeProduct(product) });
});

router.patch('/admin/products/:id', adminOnly, (req, res) => {
  const p = findById('products', req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const b = req.body;
  if (b.title !== undefined) p.title = String(b.title).trim();
  if (b.description !== undefined) p.description = b.description;
  if (b.brand !== undefined) p.brand = b.brand;
  if (b.categoryId !== undefined && findById('categories', b.categoryId)) p.categoryId = b.categoryId;
  if (b.status !== undefined && ['ACTIVE', 'ARCHIVED', 'DRAFT'].includes(b.status)) p.status = b.status;
  if (b.media !== undefined && Array.isArray(b.media)) p.media = b.media;
  if (Array.isArray(b.variants)) {
    for (const v of b.variants) {
      const ex = p.variants.find((x) => x.sku === v.sku);
      if (ex) {
        if (Number.isInteger(v.pricePaise) && v.pricePaise >= 0) ex.pricePaise = v.pricePaise;
        if (v.compareAtPaise === null || (Number.isInteger(v.compareAtPaise) && v.compareAtPaise >= 0)) ex.compareAtPaise = v.compareAtPaise;
        if (Number.isInteger(v.stock) && v.stock >= 0) ex.stock = v.stock;
        if (v.attributes) ex.attributes = v.attributes;
      }
    }
  }
  p.updatedAt = nowIso();
  audit(req.auth.user.id, 'product.update', 'product', p.id, { title: p.title });
  res.json({ product: serializeProduct(p) });
});

export { findVariant, serializeProduct };
export default router;
