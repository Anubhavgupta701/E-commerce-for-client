import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, saveSync, save } from './db.js';
import { attachUser } from './auth.js';

import authRoutes from './routes/authRoutes.js';
import catalog from './routes/catalog.js';
import cart from './routes/cart.js';
import checkout from './routes/checkout.js';
import payments from './routes/payments.js';
import files from './routes/files.js';
import superadmin from './routes/superadmin.js';
import misc from './routes/misc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
load();

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

// persist db on graceful shutdown too
process.on('SIGINT', () => { saveSync(); process.exit(0); });

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Persist the JSON store after any mutating request (debounced write).
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') res.on('finish', () => save());
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', catalog);          // /api/products, /api/categories, /api/admin/products
app.use('/api/cart', cart);
app.use('/api/checkout', checkout); // POST /api/checkout + /api/checkout/orders/*
app.use('/api', payments);          // payment submissions + review
app.use('/api/files', files);
app.use('/api/superadmin', superadmin);
app.use('/api', misc);              // settings/public, coupons/validate, account, addresses, wishlist

// serve storefront build when present
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

// consistent error shape
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Khaas API listening on http://localhost:${PORT}`);
  console.log(`Auth: Firebase (Google/Facebook/Phone OTP/Email link). Legacy OTP endpoints ${process.env.ALLOW_LEGACY_OTP === 'true' ? 'ENABLED' : 'disabled'}.`);
});
