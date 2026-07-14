import { useMemo, useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useLeads } from '../../hooks/useLeads'
import { Topbar } from '../../components/ui'

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

// ── Lead filter matching ──────────────────────────────────
function matchLeadSingle(lead, f) {
  const val = f.values
  switch (f.field) {
    case 'status':
      return val.includes(lead.leadStatus || '')
    case 'source':
      return val.includes(lead.leadSource || '')
    case 'volume': {
      const isEmpty = !lead.orderVolume || lead.orderVolume === '—' || lead.orderVolume.trim() === ''
      if (val.includes('(No volume)') && isEmpty) return true
      return val.includes(lead.orderVolume || '')
    }
    case 'owner':
      return val.includes(lead.ownerName || '')
    case 'utm':
      return val.includes(lead.utmSource || '')
    case 'createdAt': {
      if (!lead.createdAt) return false
      const d = new Date(lead.createdAt)
      const now = new Date()
      if (f.preset === 'today') {
        return d.toDateString() === now.toDateString()
      }
      if (f.preset === 'week') {
        const start = new Date(now)
        start.setDate(now.getDate() - 7)
        return d >= start
      }
      if (f.preset === 'month') {
        return d.getMonth() === now.getMonth() &&
               d.getFullYear() === now.getFullYear()
      }
      if (f.preset === 'custom' && f.from && f.to) {
        return d >= new Date(f.from) &&
               d <= new Date(f.to + 'T23:59:59')
      }
      return true
    }
    default:
      return true
  }
}

function matchLeadFilters(lead, filters) {
  return filters.every(f => {
    const match = matchLeadSingle(lead, f)
    return f.op === 'is' ? match : !match
  })
}

function leadChipLabel(f) {
  const v = f.values?.join(', ') || ''
  const labels = {
    status: 'Status', source: 'Source',
    volume: 'Volume', owner: 'Assigned To',
    utm: 'UTM', createdAt: 'Date Created',
  }
  const opLbl = f.op === 'is' ? 'is' : 'is not'
  if (f.field === 'createdAt') {
    if (f.preset === 'custom')
      return `Date ${opLbl} ${f.from || '…'} – ${f.to || '…'}`
    const presetLabels = { today: 'Today', week: 'This week', month: 'This month' }
    return `Date ${opLbl} ${presetLabels[f.preset] || f.preset}`
  }
  return `${labels[f.field] || f.field} ${opLbl} ${v}`
}

// ── Lead Filter Bar ───────────────────────────────────────
const LeadFilterBar = forwardRef(function LeadFilterBar({ filters, onChange, leads, showOwnerFilter }, ref) {
  const [open, setOpen] = useState(null)
  const [step, setStep] = useState('field')
  const [draft, setDraft] = useState(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) close() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const close = () => { setOpen(null); setDraft(null); setStep('field') }

  useImperativeHandle(ref, () => ({ openAdd }))

  const FIELDS = useMemo(() => [
    { key: 'createdAt', label: 'Date Created', type: 'date' },
    { key: 'status', label: 'Status', type: 'multi',
      opts: [...new Set(leads.map(l => l.leadStatus).filter(Boolean))].sort() },
    { key: 'volume', label: 'Volume', type: 'multi',
      opts: ['(No volume)', ...[...new Set(leads.map(l => l.orderVolume).filter(v => v && v !== '—' && v.trim() !== ''))].sort()] },
    { key: 'source', label: 'Source', type: 'multi',
      opts: [...new Set(leads.map(l => l.leadSource).filter(Boolean))].sort() },
    ...(showOwnerFilter ? [{ key: 'owner', label: 'Assigned To', type: 'multi',
      opts: [...new Set(leads.map(l => l.ownerName).filter(Boolean))].sort() }] : []),
  ], [leads, showOwnerFilter])

  const fieldDef = key => FIELDS.find(f => f.key === key)

  const openAdd = () => {
    setDraft({ field: null, op: 'is', values: [], preset: null, from: '', to: '' })
    setStep('field')
    setOpen({ mode: 'add' })
  }

  const openEdit = filter => {
    setDraft({ ...filter })
    setStep('value')
    setOpen({ mode: 'edit', id: filter.id })
  }

  const applyDraft = () => {
    if (!draft?.field) return
    if (open.mode === 'add') {
      // Replace any existing filter on the same field instead of appending a duplicate
      const withoutSameField = filters.filter(f => f.field !== draft.field)
      onChange([...withoutSameField, { ...draft, id: String(Date.now()) }])
    } else {
      onChange(filters.map(f => f.id === open.id ? { ...draft, id: open.id } : f))
    }
    close()
  }

  const toggleValue = val => setDraft(d => ({
    ...d,
    values: d.values.includes(val) ? d.values.filter(v => v !== val) : [...d.values, val],
  }))

  const activeDef = draft?.field ? fieldDef(draft.field) : null
  const canApply = draft?.field && (
    activeDef?.type === 'date'
      ? draft.preset && (draft.preset !== 'custom' || (draft.from || draft.to))
      : draft.values.length > 0
  )

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {filters.map(f => (
        <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            className={`filter-chip${open?.id === f.id ? ' filter-chip-active' : ''}`}
            onClick={() => openEdit(f)}
          >
            {leadChipLabel(f)}
          </button>
          <button
            className="filter-chip-remove"
            onClick={e => { e.stopPropagation(); onChange(filters.filter(x => x.id !== f.id)) }}
          >×</button>
        </span>
      ))}

      {filters.length > 0 && (
        <button className="filter-clear-btn" onClick={() => onChange([])}>Clear all</button>
      )}

      {open && (
        <div ref={dropRef} className="filter-dropdown">
          {step === 'field' ? (
            <>
              <div className="fdd-title">Filter by</div>
              {FIELDS.map(f => (
                <button key={f.key} className="fdd-field-opt" onClick={() => {
                  setDraft(d => ({ ...d, field: f.key, values: [], preset: null, from: '', to: '' }))
                  setStep('value')
                }}>
                  {f.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="fdd-header">
                {open.mode === 'add' && (
                  <button className="fdd-back" onClick={() => setStep('field')}>← Back</button>
                )}
                <span className="fdd-title" style={{ padding: 0 }}>{activeDef?.label}</span>
              </div>

              <div className="fdd-op-row">
                {['is', 'is not'].map(op => (
                  <button
                    key={op}
                    className={`fdd-op${draft.op === op ? ' active' : ''}`}
                    onClick={() => setDraft(d => ({ ...d, op }))}
                  >{op}</button>
                ))}
              </div>

              {activeDef?.type === 'multi' && (
                <div className="fdd-opts">
                  {activeDef.opts.map(opt => (
                    <label key={opt} className="fdd-opt-row">
                      <input
                        type="checkbox"
                        checked={draft.values.includes(opt)}
                        onChange={() => toggleValue(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {activeDef?.type === 'date' && (
                <div className="fdd-date">
                  <div className="fdd-presets">
                    {[
                      { label: 'Today', value: 'today' },
                      { label: 'This week', value: 'week' },
                      { label: 'This month', value: 'month' },
                      { label: 'Custom range', value: 'custom' },
                    ].map(p => (
                      <button
                        key={p.value}
                        className={`fdd-preset${draft.preset === p.value ? ' active' : ''}`}
                        onClick={() => setDraft(d => ({ ...d, preset: p.value, from: '', to: '' }))}
                      >{p.label}</button>
                    ))}
                  </div>
                  {draft.preset === 'custom' && (
                    <div className="fdd-date-inputs">
                      <input type="date" value={draft.from || ''}
                        onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} />
                      <span style={{ color: 'var(--ink-3)' }}>–</span>
                      <input type="date" value={draft.to || ''}
                        onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}

              <div className="fdd-footer">
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }}
                  onClick={applyDraft}
                  disabled={!canApply}
                >Apply</button>
                <button className="btn btn-sm" onClick={close}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
})

// ── Lead Inbox page ───────────────────────────────────────
export default function LeadInbox() {
  const { role, user } = useAuth()
  const isAdmin = role === ROLES.ADMIN
  const { leads, loading, error, refetch } = useLeads()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') || ''
  const [localSearch, setLocalSearch] = useState(
    () => searchParams.get('q') || ''
  )
  const activeFilters = (() => { try { return JSON.parse(searchParams.get('filters') || '[]') } catch { return [] } })()
  const currentPage = Number(searchParams.get('page') || 1)
  const pageSize = Number(searchParams.get('size') || 50)
  const sortOrder = searchParams.get('sort') || 'desc'
  const defaultLeadPipeline = role === ROLES.SALES_LEAD_MIDMARKET ? 'Mid-Market' : role === ROLES.SALES_LEAD_ENTERPRISE ? 'Enterprise' : 'all'
  const activePipeline = searchParams.get('pipeline') || defaultLeadPipeline

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        next.delete(k)
      } else {
        next.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    })
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (localSearch) next.set('q', localSearch)
        else next.delete('q')
        next.delete('page')
        return next
      }, { replace: true })
    }, 500)
    return () => clearTimeout(timer)
  }, [localSearch])

  const filterBarRef = useRef(null)
  const tableRef = useRef(null)
  const [theadEl, setTheadEl] = useState(null)
  const theadRef = useCallback(node => { if (node) setTheadEl(node) }, [])
  const stickyRef = useRef(null)
  const [showStickyHeader, setShowStickyHeader] = useState(false)
  const [stickyLeft, setStickyLeft] = useState(0)
  const [stickyWidth, setStickyWidth] = useState(0)
  const [colWidths, setColWidths] = useState([])

  const scopedLeads = useMemo(() => {
    if (role === ROLES.MDE || role === ROLES.AE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, user])

  const showOwnerFilter = role === ROLES.ADMIN ||
    role === ROLES.SALES_LEAD_MIDMARKET ||
    role === ROLES.SALES_LEAD_ENTERPRISE

  // ── Date range tiles (Today / This Week / This Month / Last Month / All Time) ──
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // Same local-calendar-date comparison as matchLeadSingle's createdAt 'today' preset,
  // so the tile's displayed count always matches what clicking it actually filters to.
  const leadsToday = scopedLeads.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === now.toDateString()).length
  const leadsThisWeek = scopedLeads.filter(l => l.createdAt && new Date(l.createdAt) >= weekStart).length
  const leadsThisMonth = scopedLeads.filter(l => {
    if (!l.createdAt) return false
    const d = new Date(l.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const leadsLastMonth = scopedLeads.filter(l => {
    if (!l.createdAt) return false
    const d = new Date(l.createdAt)
    return d >= lastMonthStart && d <= lastMonthEnd
  }).length
  const leadsTotal = scopedLeads.length

  // Date tiles write into activeFilters (as a createdAt filter) instead of keeping separate state,
  // so they stay unified with the Add Filter chip system.
  const setDatePresetFilter = (preset) => {
    if (preset === null) {
      const fs = activeFilters.filter(f => f.field !== 'createdAt')
      updateParams({ filters: fs.length ? fs : null, page: null })
      return
    }
    if (preset === 'lastMonth') {
      const from = lastMonthStart.toISOString().split('T')[0]
      const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      const existing = activeFilters.filter(f => f.field !== 'createdAt')
      const fs = [...existing, {
        id: String(Date.now()),
        field: 'createdAt',
        op: 'is',
        values: [],
        preset: 'custom',
        from,
        to,
        _tilePreset: 'lastMonth',
      }]
      updateParams({ filters: fs, page: null })
      return
    }
    const existing = activeFilters.filter(f => f.field !== 'createdAt')
    const fs = [...existing, {
      id: String(Date.now()),
      field: 'createdAt',
      op: 'is',
      values: [],
      preset,
      from: '',
      to: '',
    }]
    updateParams({ filters: fs, page: null })
  }

  const activeDateTile = (() => {
    const dateFilter = activeFilters.find(f => f.field === 'createdAt')
    if (!dateFilter) return null
    if (dateFilter._tilePreset === 'lastMonth') return 'lastMonth'
    if (dateFilter.preset === 'today') return 'today'
    if (dateFilter.preset === 'week') return 'week'
    if (dateFilter.preset === 'month') return 'month'
    return null
  })()

  const filteredLeads = useMemo(() => {
    let result = scopedLeads

    if (activePipeline === 'Enterprise') {
      result = result.filter(l => AE_EMAILS.includes(l.ownerEmail))
    } else if (activePipeline === 'Mid-Market') {
      result = result.filter(l => !AE_EMAILS.includes(l.ownerEmail))
    }

    if (localSearch.trim()) {
      const q = localSearch.toLowerCase()
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

    if (activeFilters.length > 0) {
      result = result.filter(l => matchLeadFilters(l, activeFilters))
    }

    return result
  }, [scopedLeads, localSearch, activeFilters, activePipeline])

  const sortedLeads = useMemo(() =>
    [...filteredLeads].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0)
      const dateB = new Date(b.createdAt || 0)
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    }), [filteredLeads, sortOrder])

  useEffect(() => { updateParams({ page: null }) }, [activeFilters, activePipeline])

  useEffect(() => {
    const mainEl = document.querySelector('.main')
    if (!mainEl || !theadEl) return

    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const theadRect = theadEl.getBoundingClientRect()
        const mainRect = mainEl.getBoundingClientRect()
        if (theadRect.top < mainRect.top) {
          setShowStickyHeader(true)
          const tableRect = tableRef.current?.getBoundingClientRect()
          setStickyLeft(tableRect.left)
          setStickyWidth(tableRect.width)
          const firstRow = tableRef.current?.querySelector('tbody tr:first-child')
          if (firstRow) {
            const tds = firstRow.querySelectorAll('td')
            setColWidths(Array.from(tds).map(td => td.offsetWidth))
          } else {
            const ths = theadEl.querySelectorAll('th')
            setColWidths(Array.from(ths).map(th => th.offsetWidth))
          }
        } else {
          setShowStickyHeader(false)
        }
        ticking = false
      })
    }

    mainEl.addEventListener('scroll', handleScroll)
    return () => mainEl.removeEventListener('scroll', handleScroll)
  }, [theadEl])

  const handleTableScroll = (e) => {
    if (stickyRef.current) {
      stickyRef.current.scrollLeft = e.target.scrollLeft
    }
  }

  const totalLeads = sortedLeads.length
  const showAll = pageSize >= 99999
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(totalLeads / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const start = totalLeads === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = showAll ? totalLeads : Math.min(safePage * pageSize, totalLeads)
  const paginated = showAll ? sortedLeads : sortedLeads.slice((safePage - 1) * pageSize, safePage * pageSize)

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <DateFilterTile
          label="Today"
          value={loading ? '…' : leadsToday}
          sub={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          active={activeDateTile === 'today'}
          onClick={() => setDatePresetFilter(activeDateTile === 'today' ? null : 'today')}
        />
        <DateFilterTile
          label="This Week"
          value={loading ? '…' : leadsThisWeek}
          sub="Last 7 days"
          active={activeDateTile === 'week'}
          onClick={() => setDatePresetFilter(activeDateTile === 'week' ? null : 'week')}
        />
        <DateFilterTile
          label="This Month"
          value={loading ? '…' : leadsThisMonth}
          sub={new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          active={activeDateTile === 'month'}
          onClick={() => setDatePresetFilter(activeDateTile === 'month' ? null : 'month')}
        />
        <DateFilterTile
          label="Last Month"
          value={loading ? '…' : leadsLastMonth}
          sub={new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          active={activeDateTile === 'lastMonth'}
          onClick={() => setDatePresetFilter(activeDateTile === 'lastMonth' ? null : 'lastMonth')}
        />
        <DateFilterTile
          label="All Time"
          value={loading ? '…' : leadsTotal}
          sub="All leads"
          active={activeDateTile === null && !activeFilters.find(f => f.field === 'createdAt' && f.preset === 'custom' && !f._tilePreset)}
          onClick={() => setDatePresetFilter(null)}
        />
      </div>

      <div className="pipeline-searchbar">
        <button className="pipeline-filter-trigger" onClick={() => filterBarRef.current?.openAdd()}>
          🔍 + Add filter
        </button>
        <input
          className="pipeline-searchbar-input"
          placeholder="Search by brand, contact, email, rep, source, volume..."
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
        />
        {isAdmin && (
          <div className="seg" style={{ flexShrink: 0 }}>
            {['all', 'Mid-Market', 'Enterprise'].map(p => (
              <button key={p}
                className={activePipeline === p ? 'is-on' : ''}
                onClick={() => updateParams({ pipeline: p === 'all' ? null : p })}
              >{p === 'all' ? 'All' : p}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <LeadFilterBar
          ref={filterBarRef}
          filters={activeFilters}
          onChange={fs => updateParams({ filters: fs.length ? fs : null })}
          leads={scopedLeads}
          showOwnerFilter={showOwnerFilter}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {totalLeads === 0
            ? 'No leads found'
            : showAll
              ? `Showing all ${totalLeads} leads`
              : `Showing ${start}–${end} of ${totalLeads} leads`}
        </span>
        <select
          value={pageSize}
          onChange={e => updateParams({ size: Number(e.target.value) === 50 ? null : Number(e.target.value), page: null })}
          style={{
            marginLeft: 12,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1.5px solid var(--line)',
            fontSize: 13,
            background: 'var(--surface)',
            color: 'var(--ink-1)',
            cursor: 'pointer',
          }}
        >
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
          <option value={300}>300 rows</option>
          <option value={500}>500 rows</option>
          <option value={99999}>All rows</option>
        </select>
      </div>

      {loading && leads.length > 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '12px',
          color: 'var(--ink-3)',
          fontSize: 12
        }}>
          ↻ Refreshing...
        </div>
      ) : loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          color: 'var(--ink-3)',
          gap: 12
        }}>
          <div className="spinner" />
          <div style={{ fontSize: 13 }}>
            Fetching leads from Zoho CRM…
          </div>
        </div>
      ) : (
      <div ref={tableRef} className="table-wrap" style={{ overflowX: 'auto' }} onScroll={handleTableScroll}>
        <table className="t" style={{ minWidth: 1180, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '90px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '100px' }} />
          </colgroup>
          <thead ref={theadRef}>
            <tr>
              <th onClick={() => updateParams({ sort: sortOrder === 'desc' ? 'asc' : 'desc' })}
                style={{ cursor: 'pointer', userSelect: 'none' }}>
                DATE {sortOrder === 'desc' ? '↓' : '↑'}
              </th>
              <th>Brand</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Volume</th>
              <th>Source</th>
              <th>Assigned to</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No leads found</td></tr>
            )}
            {paginated.map(lead => {
              const canConvert = lead.leadStatus === 'New'
              const createdDate = lead.createdAt
                ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                : '—'
              const createdTime = lead.createdAt
                ? new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                : ''
              const STATUS_STYLE = {
                'Connected':   { background: '#F0FFF4', color: '#2F9E44' },
                'Connecting':  { background: '#F0F4FF', color: '#3B5BDB' },
                'Bad Timing':  { background: '#FFF7ED', color: '#C2410C' },
              }
              const statusStyle = STATUS_STYLE[lead.leadStatus] || { background: 'var(--surface-2)', color: 'var(--ink-3)' }

              return (
                <tr key={lead.id} onClick={() => window.open(`/leads/${lead.id}`, '_blank')} style={{ cursor: 'pointer' }}>
                  <td style={{ whiteSpace: 'nowrap', padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)' }}>{createdDate}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{createdTime}</div>
                  </td>
                  <td style={{ overflow: 'hidden', padding: '14px 16px' }}>
                    <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.company || '—'}
                    </b>
                  </td>
                  <td style={{ overflow: 'hidden', padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.email}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {lead.leadStatus
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', ...statusStyle }}>{lead.leadStatus}</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 13, padding: '14px 16px' }}>{lead.orderVolume || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {lead.leadSource
                      ? <span className="pill pill-neutral">{lead.leadSource}</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 13, padding: '14px 16px' }}>{lead.ownerName || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '14px 12px' }}>
                    {lead.converted ? (
                      <span style={{ fontSize: 11, color: '#2F9E44', fontWeight: 600 }}>✓ Converted</span>
                    ) : (
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={!canConvert}
                        style={!canConvert ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        onClick={e => e.stopPropagation()}
                      >
                        Convert →
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {showStickyHeader && (
        <div
          ref={stickyRef}
          style={{
            position: 'fixed',
            top: 0,
            left: stickyLeft,
            width: stickyWidth,
            zIndex: 100,
            background: 'white',
            borderBottom: '2px solid var(--line)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <table style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr>
                {['Date', 'Brand', 'Contact', 'Status', 'Volume', 'Source', 'Assigned to', ''].map((col, i) => (
                  <th key={i} style={{
                    width: colWidths[i],
                    padding: '9px 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--ink-3)',
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--line)',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      )}

      {!showAll && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button
            className="btn btn-sm"
            onClick={() => updateParams({ page: currentPage <= 1 ? null : currentPage - 1 })}
            disabled={safePage === 1}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Page {safePage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => updateParams({ page: Math.min(totalPages, currentPage + 1) })}
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

function DateFilterTile({ label, value, sub, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? '#FFF7ED' : 'var(--surface-2)',
        border: active ? '1.5px solid var(--warn)' : '1.5px solid var(--line)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Active indicator bar at top */}
      {active && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: 'var(--warn)',
          borderRadius: '12px 12px 0 0'
        }} />
      )}

      {/* Label */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: active ? 'var(--ink-2)' : 'var(--ink-3)',
        marginBottom: 6
      }}>
        {label}
      </div>

      {/* Count */}
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        lineHeight: 1,
        marginBottom: 4
      }}>
        {value}
      </div>

      {/* Sub caption */}
      <div style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        marginTop: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {sub}
      </div>

      {/* Active checkmark */}
      {active && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--warn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#fff',
          fontWeight: 700
        }}>
          ✓
        </div>
      )}
    </div>
  )
}
