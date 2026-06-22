import { useState, useEffect } from 'react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { Topbar } from '../../components/ui'


const FLAGS = [
  { id: 'R1',  description: 'Recap email not sent within 24hrs of demo',          pipeline: 'Both',        severity: 'high',   skip: 'Terminal stage, not SA logged, no demo date' },
  { id: 'R2',  description: 'Day 2 pricing proposal not sent within 3 days',      pipeline: 'Both',        severity: 'high',   skip: 'Terminal stage, not SA logged, stage past Demo Done' },
  { id: 'R3',  description: 'Day 3 ROI email overdue 2+ days',                    pipeline: 'Both',        severity: 'medium', skip: 'Terminal stage, not SA logged' },
  { id: 'R4',  description: 'No follow-up meeting booked within 2 days of demo',  pipeline: 'Enterprise',  severity: 'high',   skip: 'Mid-Market, terminal stage' },
  { id: 'R5',  description: 'Follow-up meeting passed, stage not updated',         pipeline: 'Enterprise',  severity: 'high',   skip: 'Mid-Market, terminal stage, no meeting date' },
  { id: 'R6',  description: 'Stuck in same stage for 7+ days',                    pipeline: 'Both',        severity: 'medium', skip: 'Terminal stages, Upcoming Demo' },
  { id: 'R7',  description: 'Follow up Meeting Done — deal going quiet 5+ days',  pipeline: 'Enterprise',  severity: 'medium', skip: 'Mid-Market, terminal stage' },
  { id: 'R8',  description: 'Nudge (Day 9) email sent — no response after 1 day', pipeline: 'Both',        severity: 'medium', skip: 'Terminal stage, not SA logged' },
  { id: 'R9',  description: 'Grade A deal — no in-person meeting after 5 days',   pipeline: 'Enterprise',  severity: 'medium', skip: 'Mid-Market, terminal stage' },
  { id: 'R10', description: 'Lost deal — no reason logged',                        pipeline: 'Both',        severity: 'medium', skip: 'Only fires on Lost/Dropped' },
  { id: 'R11', description: 'Upcoming Demo 10+ days — no demo scheduled',          pipeline: 'Both',        severity: 'high',   skip: 'Demo date already set' },
  { id: 'R12', description: 'Demo Done but form not logged in Sales Assist',       pipeline: 'Both',        severity: 'high',   skip: 'Terminal stage, SA logged' },
  { id: 'R13', description: 'Account Setup in Progress 14+ days',                  pipeline: 'Mid-Market',  severity: 'medium', skip: 'Enterprise, terminal stage' },
  { id: 'R14', description: 'Awaiting First Shipment 21+ days',                    pipeline: 'Mid-Market',  severity: 'medium', skip: 'Enterprise, terminal stage' },
  { id: 'R15', description: 'First Shipment Done 14+ days, not activated',         pipeline: 'Mid-Market',  severity: 'medium', skip: 'Enterprise, terminal stage' },
]

const TABS = ['Team', 'Flags', 'Integrations']

export default function Settings() {
  const { isAdmin, role } = useAuth()
  const [tab, setTab] = useState('Team')

  const canAccessSettings = isAdmin ||
    role === 'Sales Lead Mid-Market' ||
    role === 'Sales Lead Enterprise'

  return (
    <div className="main">
      <Topbar
        title="Settings"
        subtitle="Team management · Rules · Templates"
      />

      {!canAccessSettings ? (
        <div className="callout danger" style={{ marginTop: 8 }}>
          Access denied — Settings is only available to admins and sales leads.
        </div>
      ) : (
        <>
          <div className="seg" style={{ marginBottom: 20 }}>
            {TABS.map(t => (
              <button key={t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {tab === 'Team'         && <TeamTab />}
          {tab === 'Flags'        && <FlagsTab />}
          {tab === 'Integrations' && <IntegrationsTab />}
        </>
      )}
    </div>
  )
}

// ── Tab 1: Team ───────────────────────────────────────────
function TeamTab() {
  const { authFetch, user, role } = useAuth()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MDE')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [newRole, setNewRole] = useState('')
  const [saving, setSaving] = useState(false)

  const isAdmin = role === ROLES.ADMIN
  const isSalesLead = role === ROLES.SALES_LEAD_MIDMARKET || role === ROLES.SALES_LEAD_ENTERPRISE

  const allowedRoles = isAdmin
    ? [ROLES.MDE, ROLES.AE, ROLES.SALES_LEAD_MIDMARKET, ROLES.SALES_LEAD_ENTERPRISE, ROLES.ADMIN]
    : [ROLES.MDE, ROLES.AE]

  useEffect(() => { fetchTeam() }, [])

  async function fetchTeam() {
    setLoading(true)
    try {
      const res = await authFetch('/auth/team')
      const data = await res.json()
      setMembers(data.users || [])
      setInvites(data.pendingInvites || [])
    } catch {}
    finally { setLoading(false) }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return alert('Enter an email')
    if (!inviteEmail.endsWith('@eshopbox.com')) return alert('Only @eshopbox.com emails allowed')
    setInviting(true)
    try {
      const res = await authFetch('/auth/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const data = await res.json()
      if (data.success) {
        setInviteLink(data.inviteLink)
        setInviteEmail('')
        fetchTeam()
      } else {
        alert(data.error || 'Failed to send invite')
      }
    } finally { setInviting(false) }
  }

  async function handleRoleChange() {
    if (!newRole || !selectedMember) return
    setSaving(true)
    try {
      const res = await authFetch(`/auth/team/${selectedMember.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      })
      const data = await res.json()
      if (data.success) {
        setShowRoleModal(false)
        setSelectedMember(null)
        fetchTeam()
      } else {
        alert(data.error || 'Failed to update role')
      }
    } finally { setSaving(false) }
  }

  async function handleImpersonate(member) {
    if (!confirm(`View Sales Assist as ${member.name}?`)) return
    try {
      const res = await authFetch('/api/admin/impersonate', {
        method: 'POST',
        body: JSON.stringify({ email: member.email })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('sa_admin_token', localStorage.getItem('sa_token'))
        localStorage.setItem('sa_admin_user', localStorage.getItem('sa_user'))
        localStorage.setItem('sa_token', data.token)
        localStorage.setItem('sa_user', JSON.stringify(data.user))
        window.location.href = '/'
      } else {
        alert(data.error || 'Failed')
      }
    } catch { alert('Network error') }
  }

  async function handleRemove(member) {
    if (!confirm(`Remove ${member.name} from Sales Assist?`)) return
    try {
      const res = await authFetch(`/auth/team/${member.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchTeam()
      else alert(data.error || 'Failed to remove member')
    } catch { alert('Network error') }
  }

  const ROLE_PILL = {
    [ROLES.MDE]: 'pill-info',
    [ROLES.AE]: 'pill-purple',
    [ROLES.SALES_LEAD_MIDMARKET]: 'pill-ok',
    [ROLES.SALES_LEAD_ENTERPRISE]: 'pill-warn',
    [ROLES.ADMIN]: 'pill-danger',
  }

  const ROLE_LABEL = {
    [ROLES.MDE]: 'MDE',
    [ROLES.AE]: 'AE',
    [ROLES.SALES_LEAD_MIDMARKET]: 'Sales Lead · Mid-Market',
    [ROLES.SALES_LEAD_ENTERPRISE]: 'Sales Lead · Enterprise',
    [ROLES.ADMIN]: 'Admin',
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-3)' }}>Loading team…</div>

  return (
    <div>
      {/* Invite button */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ws-side-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4>Team members · {members.filter(m => m.is_active).length}</h4>
          <button className="btn btn-sm btn-primary" onClick={() => { setShowInvite(true); setInviteLink('') }}>
            + Invite member
          </button>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.filter(m => m.is_active).map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar av-teal" style={{ width: 28, height: 28, fontSize: 11 }}>
                      {(m.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    {m.name}
                    {m.email === user?.email && <span className="pill pill-neutral" style={{ fontSize: 10 }}>You</span>}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.email}</td>
                <td><span className={`pill ${ROLE_PILL[m.role] || 'pill-neutral'}`}>{ROLE_LABEL[m.role] || m.role}</span></td>
                <td><span className="pill pill-ok">Active</span></td>
                <td style={{ textAlign: 'right' }}>
                  {isAdmin && m.email !== user?.email && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => { setSelectedMember(m); setNewRole(m.role); setShowRoleModal(true) }}>
                        Change role
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRemove(m)}>
                        Remove
                      </button>
                      {user?.email === 'satyanarayan.sahoo@eshopbox.com' && m.email !== user?.email && (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleImpersonate(m)}
                          style={{ background: 'var(--purple)', color: 'white', border: 'none' }}
                        >
                          View as
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ws-side-head"><h4>Pending invites · {invites.length}</h4></div>
          <table className="t">
            <thead><tr><th>Email</th><th>Role</th><th>Invited by</th><th>Expires</th></tr></thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontSize: 13 }}>{inv.email}</td>
                  <td><span className={`pill ${ROLE_PILL[inv.role] || 'pill-neutral'}`}>{ROLE_LABEL[inv.role] || inv.role}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{inv.invited_by}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {new Date(inv.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Invite team member</h3>
              <button className="btn-close" onClick={() => setShowInvite(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {inviteLink ? (
                <div>
                  <div className="callout" style={{ marginBottom: 12 }}>
                    ✓ Invite created successfully! Share this link with the team member:
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, wordBreak: 'break-all', marginBottom: 10 }}>
                    {inviteLink}
                  </div>
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(inviteLink) }}>
                    Copy link
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL ADDRESS *</label>
                    <input
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="name@eshopbox.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>ROLE *</label>
                    <select
                      className="input"
                      style={{ width: '100%' }}
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                    >
                      {allowedRoles.map(r => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
                    </select>
                  </div>
                  <div className="callout" style={{ fontSize: 12 }}>
                    An invite link will be generated. Share it with the team member — they'll set their own password.
                  </div>
                </>
              )}
            </div>
            {!inviteLink && (
              <div className="modal-foot">
                <button className="btn" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  {inviting ? 'Creating invite…' : 'Create invite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role change modal */}
      {showRoleModal && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Change role · {selectedMember.name}</h3>
              <button className="btn-close" onClick={() => setShowRoleModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>NEW ROLE</label>
              <select className="input" style={{ width: '100%' }} value={newRole} onChange={e => setNewRole(e.target.value)}>
                {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowRoleModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRoleChange} disabled={saving || newRole === selectedMember.role}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Flags ─────────────────────────────────────────
function FlagsTab() {
  return (
    <div className="card">
      <div className="ws-side-head">
        <div>
          <h4>Attention Flags · R1–R15</h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
            These flags are automatically evaluated on every deal and surface in the Need Attention page.
            Contact the developer to modify rules.
          </p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="t" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 52 }}>Rule</th>
              <th>Description</th>
              <th style={{ width: 120 }}>Pipeline</th>
              <th style={{ width: 90 }}>Severity</th>
              <th>Skip conditions</th>
            </tr>
          </thead>
          <tbody>
            {FLAGS.map(f => (
              <tr key={f.id}>
                <td>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{f.id}</span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--ink-1)' }}>{f.description}</td>
                <td>
                  {f.pipeline === 'Both' && (
                    <span className="pill pill-info" style={{ fontSize: 11 }}>Both</span>
                  )}
                  {f.pipeline === 'Mid-Market' && (
                    <span className="pill pill-ok" style={{ fontSize: 11 }}>Mid-Market</span>
                  )}
                  {f.pipeline === 'Enterprise' && (
                    <span className="pill pill-purple" style={{ fontSize: 11 }}>Enterprise</span>
                  )}
                </td>
                <td>
                  {f.severity === 'high' ? (
                    <span className="pill pill-danger" style={{ fontSize: 11 }}>High</span>
                  ) : (
                    <span className="pill pill-warn" style={{ fontSize: 11 }}>Medium</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{f.skip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab 3: Integrations ───────────────────────────────────
function IntegrationsTab() {
  const { authFetch } = useAuth()
  const [gmailStatus, setGmailStatus] = useState(null)
  const [zohoStatus, setZohoStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      authFetch('/auth/gmail/status').then(r => r.json()),
      authFetch('/auth/zoho/status').then(r => r.json()),
    ]).then(([gmail, zoho]) => {
      setGmailStatus(gmail)
      setZohoStatus(zoho)
    }).finally(() => setLoading(false))
  }, [])

  async function connectGmail() {
    const res = await authFetch('/auth/gmail')
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function disconnectGmail() {
    if (!confirm('Disconnect Gmail? Email drafts will no longer be created automatically.')) return
    await authFetch('/auth/gmail/disconnect', { method: 'POST' })
    setGmailStatus({ connected: false, signature: '' })
  }

  async function connectZoho() {
    const res = await authFetch('/auth/zoho/config')
    const config = await res.json()
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'ZohoCRM.modules.deals.ALL,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.activities.ALL,ZohoCRM.settings.fields.READ,ZohoCRM.modules.leads.ALL',
      access_type: 'offline',
      prompt: 'consent',
    })
    window.location.href = `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-3)' }}>Loading integration status…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>

      {/* Zoho CRM */}
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Zoho CRM</span>
          <span className={`pill ${zohoStatus?.connected ? 'pill-ok' : 'pill-neutral'}`}>
            {zohoStatus?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Connect your personal Zoho CRM token to create tasks and log activities on your behalf.
        </p>
        <div>
          <button className="btn btn-sm btn-primary" onClick={connectZoho}>
            {zohoStatus?.connected ? 'Reconnect Zoho' : 'Connect Zoho'}
          </button>
        </div>
      </div>

      {/* Gmail OAuth */}
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Gmail</span>
          <span className={`pill ${gmailStatus?.connected ? 'pill-ok' : 'pill-neutral'}`}>
            {gmailStatus?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Connect Gmail to auto-create email drafts in your inbox and track sent status.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={connectGmail}>
            {gmailStatus?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          {gmailStatus?.connected && (
            <button className="btn btn-sm btn-danger" onClick={disconnectGmail}>
              Disconnect
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
