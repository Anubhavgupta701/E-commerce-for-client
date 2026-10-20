// Tiny JSON document store. Collections are plain arrays; settings is a single object.
// Demo-friendly: swap this module for Prisma/Postgres later without touching routes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const LIST_COLLECTIONS = [
  'users',
  'roleAssignments', // { id, userId, role: CUSTOMER|ADMIN|SUPERADMIN, grantedBy, createdAt }
  'otpChallenges',
  'sessions', // { token, userId, createdAt, expiresAt, ip }
  'categories',
  'products', // variants embedded: [{ sku, attributes, pricePaise, compareAtPaise, stock }]
  'carts', // { id, userId|null, guestId|null, items:[{sku, qty}], updatedAt }
  'orders', // items embedded
  'paymentSubmissions',
  'coupons',
  'addresses',
  'wishlists', // { id, userId, productId, createdAt }
  'files',
  'auditLogs',
  'idempotencyKeys', // { key, scope, response, createdAt }
];

let db = null;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } else {
    db = { settings: null };
    for (const c of LIST_COLLECTIONS) db[c] = [];
  }
  for (const c of LIST_COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
  if (!('settings' in db)) db.settings = null;
  return db;
}

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)), 120);
}
export function saveSync() {
  clearTimeout(timer);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function col(name) {
  if (!db) load();
  if (!Array.isArray(db[name])) db[name] = [];
  return db[name];
}

export function getSettings() {
  if (!db) load();
  return db.settings;
}
export function setSettings(s) {
  if (!db) load();
  db.settings = s;
  save();
}

export function findById(collection, id) {
  return col(collection).find((r) => r.id === id) || null;
}
