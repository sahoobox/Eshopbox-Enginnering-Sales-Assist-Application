import { useState, useEffect, useRef } from 'react';
import { API_BASE, setAuth } from '../api.js';

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(120);
  const [resetSuccess, setResetSuccess] = useState(false);
  const countdownRef = useRef(null);

  const C = {
    bg:      '#FAFAF7',
    white:   '#FFFFFF',
    ink:     '#1D1D1D',
    muted:   '#6A6760',
    accent:  '#F95253',
    border:  '#EBE8E0',
    danger:  '#991F1F',
    surface2:'#F4F2EC',
  };

  function startCountdown() {
    setCountdown(120);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (step === 'verify') startCountdown();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToLogin() {
    setStep('login');
    setError('');
    setOtpInput('');
    setNewPassword('');
    setConfirmPassword('');
    setResetSuccess(false);
  }

  function formatCountdown(secs) {
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

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

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }
      setStep('verify');
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: otpInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        return;
      }
      setStep('reset');
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError('');
    setLoading(true);
    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      startCountdown();
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: otpInput, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Try again.');
        return;
      }
      setResetSuccess(true);
      setTimeout(goToLogin, 2000);
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
    background: C.white,
    color: C.ink,
    transition: 'border-color 0.15s ease',
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 7,
    display: 'block',
  };

  const btnStyle = {
    width: '100%',
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    background: C.accent,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    opacity: loading ? 0.65 : 1,
    letterSpacing: '0.01em',
    marginTop: 4,
    boxShadow: loading ? 'none' : '0 2px 8px rgba(249,82,83,0.25)',
  };

  function renderError(msg) {
    if (!msg) return null;
    return (
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.danger, marginBottom: 16, lineHeight: 1.5 }}>
        {msg}
      </div>
    );
  }

  function renderHeader(title, subtitle) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.ink }}>SALES ASSIST</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 6px 0', letterSpacing: '-0.3px', lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: C.muted, margin: '0 0 28px 0', lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
    );
  }

  const backLink = (
    <button
      type="button"
      onClick={goToLogin}
      style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', marginTop: 16 }}
    >
      ← Back to login
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '24px' }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <div style={{ background: C.white, borderRadius: 20, padding: '44px 40px', width: '100%', maxWidth: 400, border: `1px solid ${C.border}`, boxShadow: '0 4px 24px rgba(29,29,29,0.07)' }}>

        {step === 'login' && (
          <>
            {renderHeader('Sign in', 'Eshopbox team only')}
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@eshopbox.com"
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
              </div>
              {renderError(error)}
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setResetEmail(email); setError(''); setStep('forgot'); }}
              style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', marginTop: 16 }}
            >
              Forgot password?
            </button>
          </>
        )}

        {step === 'forgot' && (
          <>
            {renderHeader('Forgot password', 'Enter your Eshopbox email to receive an OTP')}
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>Email</div>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="you@eshopbox.com"
                  required
                  style={inputStyle}
                />
              </div>
              {renderError(error)}
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
            {backLink}
          </>
        )}

        {step === 'verify' && (
          <>
            {renderHeader('Enter OTP', `We sent a 6-digit code to ${resetEmail}`)}
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 18 }}>
                <div style={labelStyle}>OTP</div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  style={{ ...inputStyle, letterSpacing: '0.25em', textAlign: 'center', fontSize: 22, fontWeight: 600, padding: '14px' }}
                />
              </div>
              {renderError(error)}
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 16 }}>
              {countdown > 0 ? (
                <span>Resend OTP in {formatCountdown(countdown)}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{ fontSize: 13, color: C.accent, fontWeight: 600, background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  Resend OTP
                </button>
              )}
            </div>
            {backLink}
          </>
        )}

        {step === 'reset' && (
          <>
            {renderHeader('Set new password', null)}
            {resetSuccess ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#15803D', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
                Password updated! Redirecting to login...
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: 18 }}>
                  <div style={labelStyle}>New password</div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={labelStyle}>Confirm password</div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={inputStyle}
                  />
                </div>
                <button type="submit" disabled={loading} style={btnStyle}>
                  {loading ? 'Updating...' : 'Set password'}
                </button>
                {renderError(error)}
              </form>
            )}
            {!resetSuccess && backLink}
          </>
        )}

      </div>
    </div>
  );
}
