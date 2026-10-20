import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/store.jsx';
import { Field } from '../../components/ui.jsx';

export function StaffLogin() {
  const [params] = useSearchParams();
  const next = params.get('next');
  const { refresh } = useAuth();
  const nav = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!identifier.trim() || !password) {
      setErr('Please enter both your username/email and password.');
      return;
    }
    setBusy(true);
    try {
      const { user } = await api.post('/api/auth/staff-login', {
        identifier: identifier.trim(),
        password,
      });
      await refresh();

      if (next) {
        nav(next);
      } else if (user.roles?.includes('SUPERADMIN')) {
        nav('/superadmin');
      } else if (user.roles?.includes('ADMIN')) {
        nav('/admin');
      } else {
        nav('/');
      }
    } catch (e2) {
      setErr(e2.message || 'Login failed. Please check your credentials.');
    }
    setBusy(false);
  };

  return (
    <div className="form-narrow" style={{ marginTop: 40, marginBottom: 60 }}>
      <div className="form-card" style={{ borderColor: 'var(--walnut)' }}>
        <div style={{ display: 'inline-block', background: 'var(--espresso)', color: 'var(--sand)', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          🔒 Restricted Area
        </div>
        <h1 style={{ fontSize: 28, margin: '4px 0 8px' }}>Staff Portal Login</h1>
        <p className="lead" style={{ fontSize: 15, marginBottom: 20 }}>
          Sign in with your assigned Admin or Superadmin credentials.
        </p>

        {err && <div className="alert alert-error">{err}</div>}

        <form onSubmit={handleSubmit}>
          <Field label="Username or Work Email">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your username or email"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
            />
          </Field>

          <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? 'Signing in…' : 'Access Dashboard →'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14 }}>
          <Link to="/" style={{ color: 'var(--muted)' }}>← Return to storefront</Link>
        </div>
      </div>
    </div>
  );
}
