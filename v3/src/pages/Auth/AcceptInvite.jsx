import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../components/ui/Toast'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { API_BASE } = useAuth()
  const token = searchParams.get('token')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokenValid, setTokenValid] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid invite link — no token found')
      setTokenValid(false)
      return
    }
    // Check token validity by trying to fetch invite info
    fetch(`${API_BASE}/auth/invite-info?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.email) {
          setInviteEmail(d.email)
          setTokenValid(true)
        } else {
          setError(d.error || 'Invalid or expired invite link')
          setTokenValid(false)
        }
      })
      .catch(() => {
        setError('Failed to verify invite link')
        setTokenValid(false)
      })
  }, [token])

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `${API_BASE}/auth/accept-invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name, password })
        }
      )
      const data = await res.json()
      if (data.token) {
        toast.success('Account created successfully! Please log in.')
        navigate('/login')
      } else {
        setError(data.error || 'Failed to accept invite')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24
    }}>
      <div className="card card-pad" style={{
        width: '100%',
        maxWidth: 420
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: 32
        }}>
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--brand)',
            letterSpacing: '-0.02em'
          }}>
            Sales Assist
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            marginTop: 4
          }}>
            Eshopbox · v3
          </div>
        </div>

        {tokenValid === false ? (
          <div>
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16
            }}>
              <p style={{
                color: 'var(--danger)',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4
              }}>
                Invalid Invite Link
              </p>
              <p style={{
                color: 'var(--ink-2)',
                fontSize: 13
              }}>
                {error}
              </p>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/login')}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 4,
              color: 'var(--ink)'
            }}>
              Set up your account
            </h2>
            <p style={{
              fontSize: 13,
              color: 'var(--ink-3)',
              marginBottom: 24
            }}>
              You've been invited to join Sales Assist
              {inviteEmail && ` as ${inviteEmail}`}
            </p>

            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--danger)'
              }}>
                {error}
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Full Name
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Password
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Confirm Password
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ width: '100%' }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', marginTop: 8 }}
              >
                {loading ? 'Setting up...' : 'Create Account →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
