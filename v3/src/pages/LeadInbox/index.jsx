import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'umang.seth@eshopbox.com',
]

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'sunil.sethi@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
  'gautam@eshopbox.com',
]

export default function LeadInbox() {
  const { role, user } = useAuth()
  const { leads, loading, error, refetch } = useLeads()
  const navigate = useNavigate()

  const scopedLeads = useMemo(() => {
    if (role === ROLES.MDE || role === ROLES.AE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, user])

  const todayStr = new Date().toISOString().split('T')[0]
  const isPast6pm = new Date().getHours() >= 18
  const leadsToday = scopedLeads.filter(l => l.createdAt?.startsWith(todayStr))
  const sameDayDue = leadsToday.filter(l => l.leadStatus === 'New')
  const slaBreached = isPast6pm ? sameDayDue.length : 0

  if (loading) return <div className="main"><Loading text="Fetching leads from Zoho CRM…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Lead inbox" />
      <div className="callout danger">Failed to load leads: {error}</div>
    </div>
  )

  return (
    <div className="main">
      <Topbar
        title="Lead inbox"
        subtitle="Inbound Contact Sales + qualified outbound. Routing by volume tier. Same-day contact required."
        actions={<button className="btn btn-sm" onClick={refetch}>↻ Refresh</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatTile label="TODAY" value={leadsToday.length} sub="new leads" />
        <StatTile label="SLA BREACHED" value={slaBreached} sub="contact before 6pm" warn={slaBreached > 0} />
        <StatTile label="SAME-DAY DUE" value={sameDayDue.length} sub="still in New status" warn={sameDayDue.length > 0} />
      </div>

      <div className="callout info" style={{ marginBottom: 16, fontSize: 12.5, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <b>Routing:</b>
        <span>Volume &lt; 500 → <b>Self-Serve / Dormant</b> · no MDE assignment · SDR outreach every 90 days</span>
        <span>·</span>
        <span>Volume 501–10,000 + Contact Sales → <b>Round-robin to MDE</b></span>
        <span>·</span>
        <span>Volume &gt; 10,000 → <b>Assigned to AE-Enterprise</b></span>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Contact</th>
              <th>Volume</th>
              <th>Source</th>
              <th>UTM</th>
              <th>SLA</th>
              <th>Assigned to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scopedLeads.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No leads found</td></tr>
            )}
            {scopedLeads.map(lead => {
              const isToday = lead.createdAt?.startsWith(todayStr)
              const needsContact = isToday && lead.leadStatus === 'New'
              const canConvert = lead.leadStatus === 'New'
              const createdTime = lead.createdAt
                ? (isToday
                    ? `Today ${new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                    : new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
                : '—'

              return (
                <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <b>{lead.companyName || lead.Company || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}</b>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{createdTime}</div>
                  </td>
                  <td>
                    <div>{`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{lead.email}</div>
                  </td>
                  <td>{lead.orderVolume || '—'}</td>
                  <td>
                    {lead.leadSource
                      ? <span className="pill pill-neutral">{lead.leadSource}</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </td>
                  <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{lead.utmSource || 'direct'}</td>
                  <td>
                    {needsContact
                      ? <span className="pill pill-warn">today by 6pm</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </td>
                  <td>{lead.ownerName || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={!canConvert}
                      style={!canConvert ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    >
                      Convert →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatTile({ label, value, sub, warn }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: warn ? 'var(--danger)' : 'var(--ink-1)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
