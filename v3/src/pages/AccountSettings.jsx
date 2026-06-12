import { useAuth, ROLE_LABELS } from '../context/AuthContext'
import { useState, useEffect } from 'react'

export default function AccountSettings() {
  const { user, role, authFetch } = useAuth()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [zohoConnected, setZohoConnected] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    authFetch('/api/settings/connections')
      .then(r => r.json())
      .then(d => {
        setGmailConnected(d.gmailConnected || false)
        setZohoConnected(d.zohoConnected || false)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const connectGmail = () => {
    window.location.href = '/api/auth/gmail'
  }

  const connectZoho = () => {
    window.location.href = '/api/auth/zoho'
  }

  return (
    <div className="main">
      <div style={{ maxWidth: 640 }}>
        <div className="topbar">
          <div className="topbar-title-block">
            <h1 className="page-title">Account settings</h1>
            <p className="page-sub">Manage your profile and integrations.</p>
          </div>
        </div>

        {/* Profile card */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="ws-side-head" style={{ marginBottom: 12 }}>
            <h4>Your profile</h4>
          </div>
          {[
            { label: 'Your name', value: user?.name || '—' },
            { label: 'Your email', value: user?.email || '—' },
            { label: 'Your role', value: ROLE_LABELS[role] || role || '—' },
          ].map((row, i) => (
            <div key={i} className="ws-side-row">
              <span className="k">{row.label}</span>
              <span className="v">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Gmail connection */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gmail connection</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              Connect your Gmail account to create email drafts directly from Sales Assist.
            </div>
          </div>
          {checking ? (
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking…</span>
          ) : gmailConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pill pill-ok">✓ Gmail connected</span>
              <button className="btn btn-sm" onClick={connectGmail}>Reconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connectGmail}>
              Connect Gmail
            </button>
          )}
        </div>

        {/* Zoho connection */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Zoho connection</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              Connect your Zoho account to send emails directly from your CRM mailbox.
            </div>
          </div>
          {checking ? (
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking…</span>
          ) : zohoConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pill pill-ok">✓ Zoho connected</span>
              <button className="btn btn-sm" onClick={connectZoho}>Reconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connectZoho}>
              Connect Zoho
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
