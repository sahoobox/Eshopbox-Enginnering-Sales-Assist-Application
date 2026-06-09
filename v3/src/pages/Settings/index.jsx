import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Topbar } from '../../components/ui'

const TEAM = [
  { name: 'Sriya Komal',        email: 'sriya.komal@eshopbox.com',         role: 'MDE',        pipeline: 'Mid-Market', status: 'Active' },
  { name: 'Mriganki Srivastava',email: 'mriganki.srivastava@eshopbox.com', role: 'MDE',        pipeline: 'Mid-Market', status: 'Active' },
  { name: 'Shubham Kumar',      email: 'shubham.kumar@eshopbox.com',       role: 'MDE',        pipeline: 'Mid-Market', status: 'Active' },
  { name: 'Taufeeq Ahmad',      email: 'taufeeq.ahmad@eshopbox.com',       role: 'AE',         pipeline: 'Enterprise', status: 'Active' },
  { name: 'Sunil Sethi',        email: 'sunil.sethi@eshopbox.com',         role: 'AE',         pipeline: 'Enterprise', status: 'Active' },
  { name: 'Afzal Maknoo',       email: 'afzal.maknoo@eshopbox.com',        role: 'AE',         pipeline: 'Enterprise', status: 'Active' },
  { name: 'Raghwendra Kumar',   email: 'raghwendra.kumar@eshopbox.com',    role: 'AE',         pipeline: 'Enterprise', status: 'Active' },
  { name: 'Jeevan More',        email: 'jeevan.more@eshopbox.com',         role: 'AE',         pipeline: 'Enterprise', status: 'Active' },
  { name: 'Umang Seth',         email: 'umang.seth@eshopbox.com',          role: 'Sales Lead', pipeline: 'Mid-Market', status: 'Active' },
  { name: 'Gautam Raheja',      email: 'gautam@eshopbox.com',              role: 'Sales Lead', pipeline: 'Enterprise', status: 'Active' },
  { name: 'Ankush',             email: 'ankush@eshopbox.com',              role: 'Admin',      pipeline: 'Both',       status: 'Active' },
]

const RULES = [
  {
    n: 1,
    condition: 'Volume < 500 (any source)',
    action: 'Tag Self-Serve · add to Dormant list · create SDR outreach task every 90 days',
  },
  {
    n: 2,
    condition: 'Volume 501–10,000 + Contact Sales form',
    action: 'Create Lead · round-robin to MDE · alert with same-day contact flag',
  },
  {
    n: 3,
    condition: 'Volume 501–10,000 + Sign Up',
    action: 'Create Deal at Account Setup In Progress (SME) · round-robin to MDE · alert',
  },
  {
    n: 4,
    condition: 'Volume > 10,000 (any source)',
    action: 'Assign to AE-Enterprise · alert with same-day contact flag',
  },
  {
    n: 5,
    condition: 'Deal has no activity for 21 days',
    action: 'Flag deal · alert Sales Lead · suggest moving to On Hold',
  },
  {
    n: 6,
    condition: 'Deal in On Hold stage for 60 days',
    action: 'Create SDR re-engagement task',
  },
  {
    n: 7,
    condition: 'Account Setup In Progress · no contact in 24 hours',
    action: 'Alert MDE and Sales Lead',
  },
  {
    n: 8,
    condition: 'Awaiting First Shipment for 7+ days',
    action: 'Alert MDE and Sales Lead',
  },
]

const TEMPLATES = [
  { name: 'Pre-Demo: Meeting confirmation + agenda', timing: 'Day 0',          type: 'Manual', body: `Hi {FirstName}, confirming our demo on {Date} at {Time}. Here's what we'll cover: [Agenda]. Please let me know if you'd like to adjust anything.` },
  { name: 'Pre-Demo: Pre-read',                      timing: 'Meeting day −2', type: 'Auto',   body: `Hi {FirstName}, ahead of our call on {Date}, I've attached a quick overview of how Eshopbox works for brands like yours. Excited to show you the platform.` },
  { name: 'Pre-Demo: Reminder',                      timing: 'Meeting day −1', type: 'Auto',   body: `Hi {FirstName}, just a quick reminder about our demo tomorrow at {Time}. Here's the meeting link: {Link}. See you then!` },
  { name: 'Post-Demo Day 1: Recap email',             timing: 'Day 1',          type: 'Manual', body: `Hi {FirstName}, thank you for the time today! Here's a summary of what we discussed: [Key points]. Next step: {NextStep} by {Date}.` },
  { name: 'Post-Demo Day 3: ROI email',               timing: 'Day 3',          type: 'Auto',   body: `Hi {FirstName}, based on your volume of {Volume} orders/month, Eshopbox typically helps brands like yours reduce fulfillment cost by 15–20%. Happy to put together a custom ROI model.` },
  { name: 'Post-Demo Day 4: Objection handler',       timing: 'Day 4',          type: 'Auto',   body: `Hi {FirstName}, I know switching fulfillment partners feels like a big move. Here are the three concerns we hear most often — and how we address them: [Objections].` },
  { name: 'Post-Demo Day 5+: Decision nudge',         timing: 'Day 5+',         type: 'Auto',   body: `Hi {FirstName}, we'd love to get your account set up before the busy season. Can we lock in a go-live date this week? Happy to jump on a quick call.` },
]

const INTEGRATIONS = [
  { name: 'Zoho CRM',           desc: 'Source of truth for deals, leads, contacts, and tasks.',         status: 'Connected' },
  { name: 'Gmail OAuth',        desc: 'Sends sequence emails on behalf of the assigned rep.',            status: 'Connected' },
  { name: 'WhatsApp Bot',       desc: 'Receives inbound lead messages and routes to rep queue.',         status: 'Connected' },
  { name: 'SDR Command Center', desc: 'Triggers re-engagement tasks and dormant list management.',       status: 'Integration active' },
  { name: 'Eshopbox Pulse',     desc: 'Syncs shipment milestones to trigger post-activation follow-ups.',status: 'Integration active' },
]

const ROLE_PILL = {
  MDE:          'pill-info',
  AE:           'pill-neutral',
  'Sales Lead': 'pill-warn',
  Admin:        'pill-ok',
}

const TABS = ['Team', 'Rule Engine', 'Email Templates', 'Integrations']

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('Team')

  return (
    <div className="main">
      <Topbar
        title="Settings"
        subtitle="Team management · Rules · Templates"
      />

      {!isAdmin ? (
        <div className="callout danger" style={{ marginTop: 8 }}>
          Access denied — Settings is only available to admins.
        </div>
      ) : (
        <>
          <div className="seg" style={{ marginBottom: 20 }}>
            {TABS.map(t => (
              <button key={t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {tab === 'Team'           && <TeamTab />}
          {tab === 'Rule Engine'    && <RuleEngineTab />}
          {tab === 'Email Templates'&& <EmailTemplatesTab />}
          {tab === 'Integrations'   && <IntegrationsTab />}
        </>
      )}
    </div>
  )
}

// ── Tab 1: Team ───────────────────────────────────────────
function TeamTab() {
  return (
    <div className="card">
      <div className="ws-side-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>Team members</h4>
        <button
          className="btn btn-sm"
          onClick={() => alert('Invite flow coming soon')}
        >
          + Invite member
        </button>
      </div>
      <div style={{ padding: '0 0 8px' }}>
        <table className="t">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Pipeline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map(m => (
              <tr key={m.email}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.email}</td>
                <td><span className={`pill ${ROLE_PILL[m.role] || 'pill-neutral'}`}>{m.role}</span></td>
                <td style={{ fontSize: 13 }}>{m.pipeline}</td>
                <td><span className="pill pill-ok">{m.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab 2: Rule Engine ────────────────────────────────────
function RuleEngineTab() {
  return (
    <div className="card">
      <div className="ws-side-head">
        <div>
          <h4>Routing &amp; Automation Rules</h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
            Read-only in v1. Contact developer to modify rules.
          </p>
        </div>
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        {RULES.map(rule => (
          <div
            key={rule.n}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 1fr 80px',
              gap: 16,
              alignItems: 'start',
              padding: '10px 0',
              borderBottom: 'var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', paddingTop: 1 }}>#{rule.n}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 3 }}>CONDITION</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>{rule.condition}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 3 }}>ACTION</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{rule.action}</div>
            </div>
            <div style={{ paddingTop: 16 }}>
              <span className="pill pill-ok">Active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab 3: Email Templates ────────────────────────────────
function EmailTemplatesTab() {
  return (
    <div className="card">
      <div className="ws-side-head">
        <div>
          <h4>Sequence Email Templates</h4>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
            Edit content only. Sequence timing and triggers are configured in Zoho.
          </p>
        </div>
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        {TEMPLATES.map(tpl => (
          <div
            key={tpl.name}
            style={{
              padding: '12px 0',
              borderBottom: 'var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{tpl.name}</span>
                <span className="pill pill-neutral" style={{ fontSize: 11 }}>{tpl.timing}</span>
                <span className={`pill ${tpl.type === 'Manual' ? 'pill-warn' : 'pill-info'}`} style={{ fontSize: 11 }}>{tpl.type}</span>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => alert('Template editing coming in v2')}
              >
                Edit
              </button>
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              background: 'var(--surface-2)',
              borderRadius: 6,
              padding: '8px 12px',
              lineHeight: 1.55,
            }}>
              {tpl.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab 4: Integrations ───────────────────────────────────
function IntegrationsTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {INTEGRATIONS.map(intg => (
        <div key={intg.name} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{intg.name}</span>
            <span className="pill pill-ok">{intg.status}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{intg.desc}</p>
          <div>
            <button
              className="btn btn-sm"
              onClick={() => alert(`${intg.name} configuration coming soon`)}
            >
              Configure
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
