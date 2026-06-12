import { useAuth, ROLE_LABELS } from '../context/AuthContext'
import { useState, useEffect } from 'react'

export default function AccountSettings() {
  const { user, role, authFetch } = useAuth()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailSignature, setGmailSignature] = useState('')
  const [zohoConnected, setZohoConnected] = useState(false)
  const [checking, setChecking] = useState(true)
  const [zohoCode, setZohoCode] = useState('')
  const [zohoConnecting, setZohoConnecting] = useState(false)
  const [zohoError, setZohoError] = useState('')
  const [zohoClientId, setZohoClientId] = useState('')
  const [zohoRedirectUri, setZohoRedirectUri] = useState('')

  useEffect(() => {
    // Check Gmail status
    authFetch('/auth/gmail/status')
      .then(r => r.json())
      .then(d => {
        setGmailConnected(d.connected || false)
        setGmailSignature(d.signature || '')
      })
      .catch(() => {})

    // Check Zoho status
    authFetch('/auth/zoho/status')
      .then(r => r.json())
      .then(d => setZohoConnected(d.connected || false))
      .catch(() => {})

    // Get Zoho config
    authFetch('/auth/zoho/config')
      .then(r => r.json())
      .then(d => {
        setZohoClientId(d.clientId || '')
        setZohoRedirectUri(d.redirectUri || '')
      })
      .catch(() => {})
      .finally(() => setChecking(false))

    // Check if returning from Gmail OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true)
      window.history.replaceState({}, '', '/settings/account')
    }
  }, [])

  const connectGmail = async () => {
    const res = await authFetch('/auth/gmail')
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const disconnectGmail = async () => {
    if (!confirm('Disconnect Gmail? You will no longer be able to create drafts.')) return
    await authFetch('/auth/gmail/disconnect', { method: 'POST' })
    setGmailConnected(false)
  }

  const openZohoOAuth = () => {
    if (!zohoClientId) return
    const url = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.deals.ALL,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.activities.ALL&client_id=${zohoClientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(zohoRedirectUri)}`
    window.open(url, '_blank', 'width=600,height=700')
  }

  const connectZoho = async () => {
    if (!zohoCode.trim()) { setZohoError('Paste the code from the Zoho authorization page.'); return }
    setZohoConnecting(true)
    setZohoError('')
    try {
      const res = await authFetch('/auth/zoho/connect', {
        method: 'POST',
        body: JSON.stringify({ code: zohoCode.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setZohoConnected(true)
        setZohoCode('')
      } else {
        setZohoError(data.error || 'Connection failed. Try again.')
      }
    } catch {
      setZohoError('Network error. Try again.')
    } finally {
      setZohoConnecting(false)
    }
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: '1px solid var(--line)', gap: 16
  }
  const labelStyle = { fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }
  const valueStyle = { fontSize: 13, color: 'var(--ink)', fontWeight: 500, textAlign: 'right' }

  return (
    <div className="main">
      <div style={{ maxWidth: 680 }}>
        <div className="topbar">
          <div className="topbar-title-block">
            <h1 className="page-title">Account settings</h1>
            <p className="page-sub">Manage your profile and integrations.</p>
          </div>
        </div>

        {/* Profile */}
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Your profile</div>
          <div style={rowStyle}>
            <span style={labelStyle}>Your name</span>
            <span style={valueStyle}>{user?.name || '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Your email</span>
            <span style={valueStyle}>{user?.email || '—'}</span>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Your role</span>
            <span style={valueStyle}>{ROLE_LABELS[role] || role || '—'}</span>
          </div>
        </div>

        {/* Gmail */}
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gmail connection</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                Connect your Gmail to create email drafts directly from Sales Assist.
                Drafts appear in your Gmail inbox ready to review and send.
              </div>
            </div>
            {checking ? null : gmailConnected ? (
              <span className="pill pill-ok" style={{ flexShrink: 0 }}>✓ Connected</span>
            ) : (
              <span className="pill pill-neutral" style={{ flexShrink: 0 }}>Not connected</span>
            )}
          </div>
          {gmailSignature && (
            <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Gmail signature detected</div>
              {gmailSignature.slice(0, 120)}{gmailSignature.length > 120 ? '…' : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {gmailConnected ? (
              <>
                <button className="btn btn-sm" onClick={connectGmail}>Reconnect</button>
                <button className="btn btn-sm btn-danger" onClick={disconnectGmail}>Disconnect</button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={connectGmail}>Connect Gmail</button>
            )}
          </div>
        </div>

        {/* Zoho */}
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Zoho CRM connection</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                Connect your Zoho account to log activities and send emails directly from your CRM mailbox.
              </div>
            </div>
            {checking ? null : zohoConnected ? (
              <span className="pill pill-ok" style={{ flexShrink: 0 }}>✓ Connected</span>
            ) : (
              <span className="pill pill-neutral" style={{ flexShrink: 0 }}>Not connected</span>
            )}
          </div>
          {!zohoConnected && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>How to connect:</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 12 }}>
                1. Click "Open Zoho authorization" below<br/>
                2. Log in and click Accept in the popup<br/>
                3. Copy the code from the redirect URL<br/>
                4. Paste it below and click Connect
              </div>
              <button className="btn btn-sm" onClick={openZohoOAuth} style={{ marginBottom: 12 }}>
                Open Zoho authorization →
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 13 }}
                  placeholder="Paste authorization code here…"
                  value={zohoCode}
                  onChange={e => setZohoCode(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={connectZoho} disabled={zohoConnecting}>
                  {zohoConnecting ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              {zohoError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{zohoError}</div>}
            </div>
          )}
          {zohoConnected && (
            <button className="btn btn-sm" onClick={() => setZohoConnected(false)}>Reconnect</button>
          )}
        </div>

      </div>
    </div>
  )
}
