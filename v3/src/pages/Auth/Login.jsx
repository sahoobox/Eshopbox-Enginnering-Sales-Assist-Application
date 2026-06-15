import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: 'var(--brand)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            margin: '0 auto 14px',
          }}>SA</div>
          <div style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-0.01em' }}>
            Sales Assist
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
            Eshopbox · Sign in to continue
          </div>
        </div>

        {/* Card */}
        <div className="card card-pad">
          {!showForgot ? (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@eshopbox.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  marginBottom: 14,
                }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '9px 12px' }}
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                onClick={() => setShowForgot(true)}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <ForgotPassword onBack={() => setShowForgot(false)} />
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 20 }}>
          Access restricted to @eshopbox.com accounts
        </p>
      </div>
    </div>
  )
}

function ForgotPassword({ onBack }) {
  const { authFetch, API_BASE } = useAuth()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('email') // email | otp | reset
  const [otp, setOtp] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const sendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg('OTP sent to your email.')
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    if (newPass.trim().length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPass.trim() !== confirmPass.trim()) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password: newPass.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Password reset</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
          You can now sign in with your new password.
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onBack}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Reset password</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
        {step === 'email' ? "We'll send a one-time code to your email." : msg}
      </div>
      {error && (
        <div style={{
          background: 'var(--danger-bg)', color: 'var(--danger)',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          fontSize: 13, marginBottom: 14,
        }}>{error}</div>
      )}
      {step === 'email' && (
        <form onSubmit={sendOtp}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="you@eshopbox.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}
      {step === 'otp' && (
        <form onSubmit={resetPassword}>
          <div className="form-group">
            <label className="form-label">OTP</label>
            <input type="text" className="form-input" placeholder="6-digit code"
              value={otp} onChange={(e) => setOtp(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input type="password" className="form-input" placeholder="••••••••"
              value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm password</label>
            <input type="password" className="form-input" placeholder="••••••••"
              value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
      <button className="btn btn-ghost btn-sm"
        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onBack}>
        ← Back to sign in
      </button>
    </div>
  )
}
