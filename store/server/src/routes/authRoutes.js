import { Router } from 'express';
import {
  requestOtp, verifyOtp, destroySession, publicUser,
  attachUser, requireAuth, verifyFirebaseToken, LEGACY_OTP_ENABLED,
  loginWithPassword,
} from '../auth.js';

const router = Router();

function setSessionCookie(res, session) {
  res.cookie('sid', session.token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 864e5, path: '/',
  });
}

// ---------- Staff Login (Username/Email + Password for Admin / Superadmin) ----------
router.post('/staff-login', async (req, res) => {
  try {
    const { identifier, username, email, password } = req.body || {};
    const loginId = identifier || username || email;
    const { session, user } = await loginWithPassword(loginId, password, { ip: req.ip });
    setSessionCookie(res, session);
    res.json({ ok: true, user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Login failed. Please try again.' });
  }
});

// ---------- Firebase login (Customer: Google / Email link) ----------
router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'Login token missing. Please try again.' });
    const { session, user } = await verifyFirebaseToken(idToken, { ip: req.ip });
    setSessionCookie(res, session);
    res.json({ ok: true, user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Login failed. Please try again.' });
  }
});

// ---------- Legacy self-rolled OTP (default OFF — enable only with ALLOW_LEGACY_OTP=true) ----------
router.post('/otp/request', (req, res) => {
  if (!LEGACY_OTP_ENABLED) return res.status(404).json({ error: 'Not available.' });
  try {
    const { destination, purpose } = req.body || {};
    const result = requestOtp(destination, purpose === 'SIGNUP' ? 'SIGNUP' : 'LOGIN', { ip: req.ip });
    // NOTE: devOtp is never revealed unless DEV_OTP_REVEAL=true (default false).
    res.json({ ok: true, message: 'Code sent. It expires in 5 minutes.', ...result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not send code.' });
  }
});

router.post('/otp/verify', (req, res) => {
  if (!LEGACY_OTP_ENABLED) return res.status(404).json({ error: 'Not available.' });
  try {
    const { challengeId, code } = req.body || {};
    if (!challengeId || !code) return res.status(400).json({ error: 'Code and challenge are required.' });
    const { session, user } = verifyOtp(challengeId, String(code), { ip: req.ip });
    setSessionCookie(res, session);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Verification failed.' });
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.sid;
  if (token) destroySession(token);
  res.clearCookie('sid', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', attachUser, requireAuth, (req, res) => {
  res.json({ user: publicUser(req.auth.user) });
});

export default router;
