import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  GoogleAuthProvider, signInWithPopup,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth';
import { api } from '../api.js';
import { useAuth } from '../context/store.jsx';
import { auth, firebaseConfigured, missingConfigMessage } from '../lib/firebase.js';
import { Field } from '../components/ui.jsx';

async function finishWithBackend(firebaseUser, refresh) {
  const idToken = await firebaseUser.getIdToken();
  const { user } = await api.post('/api/auth/firebase', { idToken });
  await refresh();
  return user;
}

function routeByRole(user, nav, next) {
  if (user.roles.includes('SUPERADMIN')) nav('/superadmin');
  else if (user.roles.includes('ADMIN')) nav('/admin');
  else nav(next);
}

export function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Email link state
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  // Complete email-link sign-in when returning from inbox
  useEffect(() => {
    if (!firebaseConfigured || !isSignInWithEmailLink(auth, window.location.href)) return;
    let stored = window.localStorage.getItem('khaas_email_link');
    if (!stored) {
      stored = window.prompt('Please confirm your email address to complete sign in:');
    }
    if (!stored) return;
    setBusy(true);
    signInWithEmailLink(auth, stored.trim(), window.location.href)
      .then(async (cred) => {
        window.localStorage.removeItem('khaas_email_link');
        const user = await finishWithBackend(cred.user, refresh);
        routeByRole(user, nav, next);
      })
      .catch((e) => {
        setErr(friendly(e));
        setBusy(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const friendly = (e) => {
    const code = e?.code || '';
    const msg = e?.message || '';

    if (code === 'auth/operation-not-allowed' || msg.includes('OPERATION_NOT_ALLOWED')) {
      return 'Email link sign-in is disabled in Firebase. Please enable "Email link (passwordless sign-in)" under Firebase Console → Authentication → Sign-in method → Email/Password.';
    }
    if (code === 'auth/unauthorized-continue-uri') {
      return 'Login URL is not authorized. Please add localhost to Authorized Domains in Firebase Console → Authentication → Settings.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection error. Please check your internet connection.';
    }
    if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('proxy error')) {
      return 'Unable to connect to backend server. Please verify the server is running on port 4000.';
    }

    const map = {
      'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
      'auth/cancelled-popup-request': 'A sign-in popup is already open.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
      'auth/too-many-requests': 'Too many attempts. Please wait a few moments and try again.',
      'auth/unauthorized-domain': 'This domain is not authorized in Firebase Console.',
      'auth/invalid-email': 'Please enter a valid email address.',
    };
    return map[code] || msg || 'Login failed. Please try again.';
  };

  const social = async (provider) => {
    setErr('');
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      const user = await finishWithBackend(cred.user, refresh);
      routeByRole(user, nav, next);
    } catch (e) {
      setErr(friendly(e));
    }
    setBusy(false);
  };

  const sendLink = async (e) => {
    e.preventDefault();
    setErr('');
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setErr('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, em, actionCodeSettings);
      window.localStorage.setItem('khaas_email_link', em);
      setLinkSent(true);
    } catch (e2) {
      setErr(friendly(e2));
    }
    setBusy(false);
  };

  if (!firebaseConfigured) {
    return (
      <div className="form-narrow">
        <div className="form-card">
          <h1 style={{ fontSize: 28 }}>Login</h1>
          <div className="alert alert-info">{missingConfigMessage}</div>
          <p><Link to="/">← Back home</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-narrow">
      <div className="form-card">
        <h1 style={{ fontSize: 30 }}>Welcome to <span className="display-accent">Khaas.</span></h1>
        <p className="lead">Log in securely — no passwords to remember.</p>
        {err && <div className="alert alert-error">{err}</div>}

        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => social(new GoogleAuthProvider())}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '12px 16px',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: 'var(--muted)', fontSize: 13 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} /> or continue with email <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        {!linkSent ? (
          <form onSubmit={sendLink}>
            <Field label="Email address" hint="We will email you a secure login link.">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                inputMode="email"
                autoComplete="email"
              />
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending link…' : 'Send login link →'}
            </button>
          </form>
        ) : (
          <div>
            <div className="alert alert-ok">
              Sign-in link sent to <strong>{email}</strong>!
              <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5 }}>
                • If you don't see it, check your <strong>Spam or Junk</strong> folder.<br />
                • Click the link on <strong>this computer and browser</strong> to complete sign-in.
              </div>
            </div>
            <p style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setLinkSent(false)}
              >
                ← Use a different email
              </button>
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
            Store Manager or Administrator?
          </p>
          <Link to="/admin/login" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--walnut)' }}>
            Staff & Admin Login with Password →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Legacy route kept for old bookmarks — redirects to the new login.
export function VerifyOtp() {
  const nav = useNavigate();
  useEffect(() => { nav('/login', { replace: true }); }, [nav]);
  return null;
}
