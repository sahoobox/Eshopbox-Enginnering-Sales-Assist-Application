import { useState } from 'react';
import { API_BASE, setAuth } from '../api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const C = {
    bg: '#F7F6F2',
    white: '#FFFFFF',
    ink: '#1A1A1A',
    muted: '#6B6B6B',
    accent: '#E8441A',
    border: '#E5E3DC',
    danger: '#DC2626',
  };

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      setAuth(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: 16, padding: '40px', width: 360, border: `0.5px solid ${C.border}` }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: C.ink }}>SALES ASSIST</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Sign in</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Eshopbox team only</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@eshopbox.com"
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.danger, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}