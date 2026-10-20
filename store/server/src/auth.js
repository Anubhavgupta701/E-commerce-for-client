// OTP auth + session + role middleware. Server is the authority on roles — never the client.
import { col, findById } from './db.js';
import jwt from 'jsonwebtoken';
import {
  uid, hashOtp, randomOtp, sessionToken, normalizeDestination, isEmail, nowIso, addMinutes,
  verifyPassword,
} from './util.js';

const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 45;
const HOURLY_LIMIT = 5;
// Screen pe OTP kabhi mat dikhao — production default. (Demo me bhi band.)
export const DEV_OTP_REVEAL = process.env.DEV_OTP_REVEAL === 'true';
// Legacy self-rolled OTP endpoints: default OFF. Firebase is the auth path now.
export const LEGACY_OTP_ENABLED = process.env.ALLOW_LEGACY_OTP === 'true';
const SESSION_TTL_HOURS = 24 * 7;

// ---------- Firebase ID token verification ----------
// Primary path: Google's public certs (JWKS) — needs NO secret, only the project ID.
// If a service account is provided via env, firebase-admin is used instead.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'khaas-store';
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let _certs = null;
let _certsAt = 0;

async function getGoogleCerts() {
  if (_certs && Date.now() - _certsAt < 3600000) return _certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error('cert-fetch-failed');
  _certs = await res.json();
  _certsAt = Date.now();
  return _certs;
}

async function verifyViaGoogleCerts(idToken) {
  const certs = await getGoogleCerts();
  const header = jwt.decode(idToken, { complete: true })?.header;
  const cert = header?.kid && certs[header.kid];
  if (!cert) {
    const e = new Error('bad-key');
    throw e;
  }
  return jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  });
}

/** Verify a Firebase ID token, link/create the local user, return { session, user }. */
export async function verifyFirebaseToken(idToken, meta = {}) {
  let decoded;
  try {
    decoded = await verifyViaGoogleCerts(idToken);
  } catch {
    const e = new Error('Login session expired or invalid. Please try again.');
    e.status = 401;
    throw e;
  }
  // NOTE: raw JWT payload uses `sub` for the uid (Admin SDK adds `uid` alias).
  const fUid = decoded.sub || decoded.uid;
  const email = (decoded.email || '').toLowerCase() || '';
  const phone = (decoded.phone_number || '').replace(/\D/g, '') || '';
  const provider = decoded.firebase?.sign_in_provider || 'unknown';

  let user = fUid ? col('users').find((u) => u.firebaseUid && u.firebaseUid === fUid) : null;
  if (!user && email) user = col('users').find((u) => u.email === email);
  if (!user && phone) user = col('users').find((u) => u.phone === phone);
  if (!user) {
    user = {
      id: uid('user_'), firebaseUid: fUid,
      name: decoded.name || '',
      email, phone,
      emailVerified: !!decoded.email_verified || !!email,
      phoneVerified: !!phone,
      status: 'ACTIVE', createdAt: nowIso(),
    };
    col('users').push(user);
  } else {
    // link + refresh verified flags (roles stay exactly as the DB says)
    if (!user.firebaseUid) user.firebaseUid = fUid;
    if (email && !user.email) { user.email = email; user.emailVerified = true; }
    if (phone && !user.phone) { user.phone = phone; user.phoneVerified = true; }
    if (!user.name && decoded.name) user.name = decoded.name;
  }
  if (user.status !== 'ACTIVE') {
    const e = new Error('This account is disabled. Please contact support.');
    e.status = 403;
    throw e;
  }
  const session = createSession(user.id, meta.ip);
  audit(user.id, 'auth.firebase', 'user', user.id, { provider });
  return { session, user: publicUser(user) };
}

/** Authenticate staff (Admin/Superadmin) via dedicated username/email + password. */
export async function loginWithPassword(identifier, password, meta = {}) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean || !password) {
    const e = new Error('Username/Email and password are required.');
    e.status = 400;
    throw e;
  }
  const user = col('users').find(
    (u) => (u.email && u.email.toLowerCase() === clean) ||
           (u.username && u.username.toLowerCase() === clean)
  );
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    const e = new Error('Invalid username or password.');
    e.status = 401;
    throw e;
  }
  if (user.status !== 'ACTIVE') {
    const e = new Error('This account is disabled. Please contact support.');
    e.status = 403;
    throw e;
  }
  const roles = rolesOf(user.id);
  if (!roles.some((r) => ['ADMIN', 'SUPERADMIN'].includes(r))) {
    const e = new Error('Access denied. This account does not have staff permissions.');
    e.status = 403;
    throw e;
  }
  const session = createSession(user.id, meta.ip);
  audit(user.id, 'auth.staff_login', 'user', user.id, { roles });
  return { session, user: publicUser(user) };
}

function createSession(userId, ip) {
  const s = {
    token: sessionToken(), userId, createdAt: nowIso(),
    expiresAt: addMinutes(new Date(), SESSION_TTL_HOURS * 60), ip: ip || null,
  };
  col('sessions').push(s);
  return s;
}

export function rolesOf(userId) {
  return col('roleAssignments').filter((r) => r.userId === userId).map((r) => r.role);
}

function rateLimitError(destination) {
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const recent = col('otpChallenges').filter((c) => c.destination === destination && c.createdAt > hourAgo);
  if (recent.length >= HOURLY_LIMIT) return 'Too many codes requested. Please try again later.';
  const last = recent[recent.length - 1];
  if (last) {
    const waitMs = new Date(last.createdAt).getTime() + RESEND_COOLDOWN_SEC * 1000 - Date.now();
    if (waitMs > 0) return `Please wait ${Math.ceil(waitMs / 1000)}s before requesting a new code.`;
  }
  return null;
}

export function requestOtp(destinationRaw, purpose = 'LOGIN', meta = {}) {
  const destination = normalizeDestination(destinationRaw);
  if (!destination || destination.length < 6) {
    const e = new Error('Enter a valid email address or phone number.');
    e.status = 400;
    throw e;
  }
  const limited = rateLimitError(destination);
  if (limited) {
    const e = new Error(limited);
    e.status = 429;
    throw e;
  }
  // Invalidate prior active challenges for this destination+purpose
  for (const c of col('otpChallenges')) {
    if (c.destination === destination && c.purpose === purpose && !c.consumedAt) c.consumedAt = nowIso();
  }
  const challenge = {
    id: uid('chg_'),
    destination,
    isEmail: isEmail(String(destinationRaw).trim()),
    purpose,
    codeHash: null, // set below
    createdAt: nowIso(),
    expiresAt: addMinutes(new Date(), OTP_TTL_MIN),
    attempts: 0,
    consumedAt: null,
    ip: meta.ip || null,
  };
  const code = randomOtp(6);
  challenge.codeHash = hashOtp(code, challenge.id);
  col('otpChallenges').push(challenge);

  // TODO(prod): send `code` via transactional SMS/email provider. Never log in prod.
  console.log(`[otp] ${destination} -> ${code} (challenge ${challenge.id})`);

  return {
    challengeId: challenge.id,
    // Demo convenience: reveal the code so the store works without an SMS provider.
    // Set DEV_OTP_REVEAL=false in production.
    ...(DEV_OTP_REVEAL ? { devOtp: code } : {}),
    expiresAt: challenge.expiresAt,
    resendAfterSec: RESEND_COOLDOWN_SEC,
  };
}

export function verifyOtp(challengeId, code, meta = {}) {
  const c = findById('otpChallenges', challengeId);
  if (!c || c.consumedAt) {
    const e = new Error('This code has expired. Please request a new one.');
    e.status = 400;
    throw e;
  }
  if (new Date(c.expiresAt) < new Date()) {
    c.consumedAt = nowIso();
    const e = new Error('This code has expired. Please request a new one.');
    e.status = 400;
    throw e;
  }
  c.attempts += 1;
  if (c.attempts > OTP_MAX_ATTEMPTS) {
    c.consumedAt = nowIso();
    const e = new Error('Too many incorrect attempts. Please request a new code.');
    e.status = 429;
    throw e;
  }
  if (hashOtp(String(code).trim(), c.id) !== c.codeHash) {
    const left = OTP_MAX_ATTEMPTS - c.attempts;
    const e = new Error(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`);
    e.status = 400;
    throw e;
  }
  c.consumedAt = nowIso();

  // Find or create customer account. Staff roles must already exist — never granted here.
  let user = col('users').find((u) =>
    c.isEmail ? u.email === c.destination : u.phone === c.destination);
  if (!user) {
    user = {
      id: uid('user_'), name: '', email: c.isEmail ? c.destination : '',
      phone: c.isEmail ? '' : c.destination,
      emailVerified: c.isEmail, phoneVerified: !c.isEmail,
      status: 'ACTIVE', createdAt: nowIso(),
    };
    col('users').push(user);
  }
  if (user.status !== 'ACTIVE') {
    const e = new Error('This account is disabled. Please contact support.');
    e.status = 403;
    throw e;
  }

  const session = createSession(user.id, meta.ip);
  return { session, user: publicUser(user) };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    roles: rolesOf(user.id),
  };
}

export function getSession(token) {
  if (!token) return null;
  const s = col('sessions').find((x) => x.token === token);
  if (!s || new Date(s.expiresAt) < new Date()) return null;
  const user = findById('users', s.userId);
  if (!user || user.status !== 'ACTIVE') return null;
  return { session: s, user };
}

export function destroySession(token) {
  const i = col('sessions').findIndex((x) => x.token === token);
  if (i >= 0) col('sessions').splice(i, 1);
}

// ---- Express middleware ----
export function attachUser(req, _res, next) {
  const token = req.cookies?.sid || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const found = getSession(token);
  req.auth = found ? { user: found.user, roles: rolesOf(found.user.id), session: found.session } : null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Please log in to continue.' });
    const ok = req.auth.roles.some((r) => allowed.includes(r));
    if (!ok) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}

export function audit(actorId, action, targetType, targetId, meta = {}) {
  col('auditLogs').push({
    id: uid('log_'), actorId: actorId || null, action, targetType, targetId: targetId || null,
    meta, createdAt: nowIso(),
  });
}
