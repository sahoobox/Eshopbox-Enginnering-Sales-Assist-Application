import { useMemo, useState, useEffect } from 'react'
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

const PAGE_SIZE = 50

const dropdownStyle = {
  height: 34,
  fontSize: 13,
  padding: '0 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--ink-1)',
  cursor: 'pointer',
  outline: 'none',
}

export default function LeadInbox() {
  const { role, user } = useAuth()
  const { leads, loading, error, refetch } = useLeads()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [volumeFilter, setVolumeFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [utmFilter, setUtmFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)

  const scopedLeads = useMemo(() => {
    if (role === ROLES.MDE || role === ROLES.AE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, user])

  const uniqueOwners = useMemo(() => {
    const names = [...new Set(scopedLeads.map(l => l.ownerName).filter(Boolean))].sort()
    return names
  }, [scopedLeads])

  const uniqueUtms = useMemo(() => {
    const utms = [...new Set(scopedLeads.map(l => l.utmSource).filter(Boolean))].sort()
    return utms
  }, [scopedLeads])

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

    if (statusFilter !== 'all') {
      result = result.filter(l => (l.leadStatus || '') === statusFilter)
    }

    if (sourceFilter !== 'all') {
      result = result.filter(l => (l.leadSource || '') === sourceFilter)
    }

    if (volumeFilter !== 'all') {
      result = result.filter(l => (l.orderVolume || '') === volumeFilter)
    }

    if (ownerFilter !== 'all') {
      result = result.filter(l => (l.ownerName || '') === ownerFilter)
    }

    if (utmFilter !== 'all') {
      result = result.filter(l => (l.utmSource || '') === utmFilter)
    }

    if (dateFilter !== 'all' && dateFilter !== 'custom') {
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
  }, [scopedLeads, search, statusFilter, sourceFilter, volumeFilter, ownerFilter, utmFilter, dateFilter, customFrom, customTo])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, statusFilter, sourceFilter, volumeFilter, ownerFilter, utmFilter, dateFilter, customFrom, customTo])

  const totalLeads = filteredLeads.length
  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = totalLeads === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const end = Math.min(safePage * PAGE_SIZE, totalLeads)
  const paginated = filteredLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const todayStr = new Date().toISOString().split('T')[0]
  const isPast6pm = new Date().getHours() >= 18
  const leadsToday = scopedLeads.filter(l => l.createdAt?.startsWith(todayStr))
  const sameDayDue = leadsToday.filter(l => l.leadStatus === 'New')
  const slaBreached = isPast6pm ? sameDayDue.length : 0

  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all' || volumeFilter !== 'all' ||
    ownerFilter !== 'all' || utmFilter !== 'all' || dateFilter !== 'all' || search.trim()

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('all')
    setSourceFilter('all')
    setVolumeFilter('all')
    setOwnerFilter('all')
    setUtmFilter('all')
    setDateFilter('all')
    setCustomFrom('')
    setCustomTo('')
  }

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

      {/* Search */}
      <div style={{ marginBottom: 10 }}>
        <input
          className="search-input"
          style={{ width: '100%', maxWidth: 480 }}
          placeholder="Search by brand, contact, email, rep, source, volume..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={dropdownStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Disqualified">Disqualified</option>
        </select>

        <select style={dropdownStyle} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">All Source</option>
          <option value="Contact Sales">Contact Sales</option>
          <option value="Sign Up">Sign Up</option>
          <option value="Inbound Website">Inbound Website</option>
          <option value="Outbound">Outbound</option>
        </select>

        <select style={dropdownStyle} value={volumeFilter} onChange={e => setVolumeFilter(e.target.value)}>
          <option value="all">All Volume</option>
          <option value="1 - 500 orders/month">1 – 500 orders/month</option>
          <option value="501 - 2,000 orders/month">501 – 2,000 orders/month</option>
          <option value="3,001 - 10,000 orders/month">3,001 – 10,000 orders/month</option>
          <option value="10,000+ orders/month">10,000+ orders/month</option>
        </select>

        <select style={dropdownStyle} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="all">All Reps</option>
          {uniqueOwners.map(name => <option key={name} value={name}>{name}</option>)}
        </select>

        <select style={dropdownStyle} value={utmFilter} onChange={e => setUtmFilter(e.target.value)}>
          <option value="all">All UTM</option>
          {uniqueUtms.map(utm => <option key={utm} value={utm}>{utm}</option>)}
        </select>

        <select style={dropdownStyle} value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="custom">Custom range</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{ height: 34, padding: '0 12px', fontSize: 13, background: 'none',
                     border: '1px solid var(--border)', borderRadius: 6, color: 'var(--brand)',
                     cursor: 'pointer', fontWeight: 600 }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Custom date range */}
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

      {/* Count line */}
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
        {totalLeads === 0
          ? 'No leads found'
          : `Showing ${start}–${end} of ${totalLeads} leads`}
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table className="t" style={{ minWidth: 1180, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '200px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '120px' }} />
          </colgroup>
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
            {paginated.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No leads found</td></tr>
            )}
            {paginated.map(lead => {
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
                  <td style={{ overflow: 'hidden' }}>
                    <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.company || '—'}
                    </b>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{createdTime}</div>
                  </td>
                  <td style={{ overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.email}
                    </div>
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
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: 12 }}>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Page {safePage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
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
