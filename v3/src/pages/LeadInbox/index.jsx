import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
]

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'gautam@eshopbox.com',
  'jeevan.more@eshopbox.com',
]

export default function LeadInbox() {
  const { role, user } = useAuth()
  const { leads, loading, error, refetch } = useLeads()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const scopedLeads = useMemo(() => {
    if (role === ROLES.MDE || role === ROLES.AE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, user])

  const filteredLeads = useMemo(() => {
    let result = scopedLeads
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        (l.company || '').toLowerCase().includes(q) ||
        (l.fullName || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.ownerName || '').toLowerCase().includes(q) ||
        (l.leadSource || '').toLowerCase().includes(q) ||
        (l.orderVolume || '').toLowerCase().includes(q) ||
        (l.leadStatus || '').toLowerCase().includes(q) ||
        (l.utmSource || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q)
      )
    }
    if (dateFilter !== 'all') {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfWeek = new Date(startOfDay)
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay())
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      result = result.filter(l => {
        if (!l.createdAt) return false
        const d = new Date(l.createdAt)
        if (dateFilter === 'today') return d >= startOfDay
        if (dateFilter === 'week') return d >= startOfWeek
        if (dateFilter === 'month') return d >= startOfMonth
        return true
      })
    }
    if (dateFilter === 'custom') {
      result = result.filter(l => {
        if (!l.createdAt) return false
        const d = new Date(l.createdAt)
        if (customFrom && d < new Date(customFrom)) return false
        if (customTo) {
          const toEnd = new Date(customTo)
          toEnd.setHours(23, 59, 59, 999)
          if (d > toEnd) return false
        }
        return true
      })
    }
    return result
  }, [scopedLeads, search, dateFilter, customFrom, customTo])

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

      <div style={{ marginBottom: 12 }}>
        <input
          className="search-input"
          style={{ width: '100%', maxWidth: 480 }}
          placeholder="Search by brand, contact, email, rep, source, volume..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>Date:</span>
        {[
          { key: 'all', label: 'All time' },
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This week' },
          { key: 'month', label: 'This month' },
          { key: 'custom', label: 'Custom range' },
        ].map(d => (
          <button key={d.key}
            onClick={() => setDateFilter(d.key)}
            className={`btn btn-sm${dateFilter === d.key ? ' btn-primary' : ''}`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {dateFilter === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>From</span>
          <input
            type="date"
            className="input"
            style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>To</span>
          <input
            type="date"
            className="input"
            style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
            value={customTo}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setCustomTo(e.target.value)}
          />
          {(customFrom || customTo) && (
            <button
              onClick={() => { setCustomFrom(''); setCustomTo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--brand)',
                       cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
        Showing {filteredLeads.length} of {scopedLeads.length} leads
        {search && <button onClick={() => setSearch('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Clear</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredLeads.length === 0 && (
          <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
            No leads found
          </div>
        )}
        {filteredLeads.map(lead => {
          const isToday = lead.createdAt?.startsWith(todayStr)
          const needsContact = isToday && lead.leadStatus === 'New'
          const createdTime = lead.createdAt
            ? (isToday
                ? `Today ${new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                : new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
            : '—'

          return (
            <div key={lead.id}
              className="card card-pad"
              onClick={() => navigate(`/leads/${lead.id}`)}
              style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'center' }}
            >
              {/* Brand + time */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{lead.company || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{createdTime}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {needsContact && <span className="pill pill-warn">today by 6pm</span>}
                  {lead.leadStatus && <span className="pill pill-neutral">{lead.leadStatus}</span>}
                </div>
              </div>

              {/* Contact */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.fullName || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{lead.email || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{lead.phone || '—'}</div>
              </div>

              {/* Volume + Source + UTM */}
              <div>
                <div style={{ fontSize: 13 }}>{lead.orderVolume || '—'}</div>
                <div style={{ marginTop: 4 }}>
                  {lead.leadSource
                    ? <span className="pill pill-neutral">{lead.leadSource}</span>
                    : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>—</span>
                  }
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  {lead.utmSource ? `UTM: ${lead.utmSource}` : 'direct'}
                  {lead.utmCampaign ? ` · ${lead.utmCampaign}` : ''}
                </div>
              </div>

              {/* Assigned to + action */}
              <div style={{ textAlign: 'right', minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{lead.ownerName || '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Assigned</div>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={e => {
                    e.stopPropagation()
                    navigate(`/form?leadId=${lead.id}&company=${encodeURIComponent(lead.company || '')}&email=${encodeURIComponent(lead.email || '')}&name=${encodeURIComponent((lead.firstName + ' ' + lead.lastName).trim())}`)
                  }}
                >
                  + Log demo →
                </button>
              </div>
            </div>
          )
        })}
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
