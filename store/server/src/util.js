import crypto from 'node:crypto';

const PEPPER = process.env.OTP_PEPPER || 'khaas-dev-pepper-change-in-prod';

export function uid(prefix = '') {
  return prefix + crypto.randomBytes(9).toString('hex');
}

export function orderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replaceAll('-', '');
  return `KH-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function hashOtp(code, challengeId) {
  return crypto.createHmac('sha256', PEPPER).update(`${challengeId}:${code}`).digest('hex');
}

export function randomOtp(digits = 6) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function sessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hmacSign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function hmacVerify(payload, sig, secret) {
  const expected = hmacSign(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** paise -> "₹1,299.00" */
export function formatINR(paise) {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function isEmail(dest) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest);
}

export function normalizeDestination(raw) {
  const d = String(raw || '').trim();
  if (isEmail(d)) return d.toLowerCase();
  const digits = d.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return digits;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addMinutes(date, mins) {
  return new Date(new Date(date).getTime() + mins * 60000).toISOString();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expectedHash] = stored.split(':');
  const actualHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

