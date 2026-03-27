import { useState } from 'react';
import { login, register } from '../services/auth.js';

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--space-4)',
};

const CARD = {
  width: '100%', maxWidth: 400,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
};

const INPUT_STYLE = {
  width: '100%', padding: '9px 12px',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  fontSize: 13, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box',
};

export default function AuthModal({ onSuccess, onClose, defaultTab = 'signin' }) {
  const [tab, setTab]               = useState(defaultTab);
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  function switchTab(t) {
    setTab(t);
    setError('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // JS validation — no HTML attributes used
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (tab === 'register' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = tab === 'signin' ? '/api/auth/login' : '/api/auth/register';
      console.log('[AuthModal] submitting to', endpoint, { email, tab });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      console.log('[AuthModal] response status:', res.status, 'body:', data);

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('meridian_token', data.token);
      localStorage.setItem('meridian_user', JSON.stringify(data.user));
      onSuccess(data.user, data.token);
    } catch (err) {
      console.error('[AuthModal] fetch error:', err);
      setError('Could not reach the server. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={CARD}>

        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-5)' }}>
          {[['signin', 'Sign In'], ['register', 'Create Account']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px 10px',
                fontSize: 12, fontFamily: "'DM Mono', monospace",
                color: tab === id ? 'var(--accent-green)' : 'var(--text-muted)',
                borderBottom: tab === id ? '2px solid var(--accent-green)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>
              Email
            </label>
            <input
              type="text" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoFocus
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'register' ? 'Min. 8 characters' : ''}
              style={INPUT_STYLE}
            />
          </div>

          {tab === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>
                Confirm Password
              </label>
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                style={INPUT_STYLE}
              />
            </div>
          )}

          {error && (
            <p style={{ fontSize: 11, color: 'var(--accent-red)', fontFamily: "'DM Mono', monospace", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 'var(--space-1)',
              padding: '10px 16px',
              background: loading ? 'var(--bg-input)' : 'var(--accent-green)',
              border: 'none', borderRadius: 'var(--radius)',
              color: loading ? 'var(--text-muted)' : '#000',
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Mono', monospace",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: 'inline-block', width: 12, height: 12,
                  border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                {tab === 'signin' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              tab === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
