import { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading, Empty, ToggleGroup, Pill } from '../../components/ui'
import DealCard from '../../components/ui/DealCard'
import DealDetail from './DealDetail'
import {
  ALL_PIPELINE_STAGES, SME_STAGES, ENT_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo
} from '../../lib/stageConfig'

const ORDER_VOLUME_OPTIONS = [
  '1 - 500 orders/month',
  '501 - 3,000 orders/month',
  '3,001 - 10,000 orders/month',
  'More than 10,000 orders/month',
  'New store / not shipping orders yet',
]

// ── Pipeline page ─────────────────────────────────────────
export default function Pipeline() {
  const { dealId } = useParams()
  if (dealId) return <DealDetail dealId={dealId} />
  return <PipelineList />
}

// ── Filter matching ───────────────────────────────────────
function matchSingle(deal, f) {
  switch (f.field) {
    case 'rep':         return f.values.includes(deal.repName)
    case 'stage':       return f.values.includes(deal.stage)
    case 'grade':       return f.values.includes(deal.grade)
    case 'orderVolume': return f.values.includes(deal.orderVolume)
    case 'saLogged':    return f.values.includes(deal.saLogged ? 'Yes' : 'No')
    case 'demoDate': {
      if (!deal.demoDate) return false
      const d = new Date(deal.demoDate)
      const from = f.dateFrom ? new Date(f.dateFrom) : null
      const to   = f.dateTo   ? new Date(f.dateTo + 'T23:59:59') : null
      return (!from || d >= from) && (!to || d <= to)
    }
    case 'flags': {
      let m = false
      if (f.values.includes('Has flags')) m = m || (deal.flags?.length > 0)
      if (f.values.includes('No flags'))  m = m || (!deal.flags?.length)
      const specific = f.values.filter(v => v !== 'Has flags' && v !== 'No flags')
      if (specific.length) m = m || specific.some(t => deal.flags?.some(fl => fl.title === t))
      return m
    }
    default: return true
  }
}

function matchFilters(deal, filters) {
  for (const f of filters) {
    const m = matchSingle(deal, f)
    if (f.op === 'is'     && !m) return false
    if (f.op === 'is not' &&  m) return false
  }
  return true
}

// ── Pipeline list ─────────────────────────────────────────
function PipelineList() {
  const { role, isMDE, isAE, isAdmin, isMidMarketLead, isEnterpriseLead } = useAuth()
  const { deals, loading, error, refetch } = useDeals()
  const navigate = useNavigate()

  const [view, setView] = useState('kanban')
  const defaultPipeline = isAE ? 'enterprise' : 'midmarket'
  const [pipelineFilter, setPipelineFilter] = useState(defaultPipeline)
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState([])
  const [showLegend, setShowLegend] = useState(false)
  const [tileFilter, setTileFilter] = useState('inbox')
  const [viewTab, setViewTab] = useState('health')

  const TERMINAL = ['Won/Payment Received', 'Lost/Dropped', 'On Hold']

  const isEnterprise = pipelineFilter === 'enterprise'
  const wonStage = isEnterprise ? 'Won/Payment Received' : 'Active'

  const currentStages = useMemo(() =>
    isMDE ? SME_STAGES : isAE ? ENT_STAGES : pipelineFilter === 'enterprise' ? ENT_STAGES : SME_STAGES
  , [isMDE, isAE, pipelineFilter])

  const scopedDeals = useMemo(() => {
    let d = deals
    if (pipelineFilter === 'midmarket') d = d.filter(deal => deal.pipeline === 'Mid-market')
    else if (pipelineFilter === 'enterprise') d = d.filter(deal => deal.pipeline === 'Enterprise 2.0')
    if (activeFilters.length > 0) d = d.filter(deal => matchFilters(deal, activeFilters))
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(deal =>
        (deal.brandName || deal.dealName || '').toLowerCase().includes(q) ||
        (deal.repName || '').toLowerCase().includes(q)
      )
    }
    return d
  }, [deals, search, pipelineFilter, activeFilters])

  const tileFilteredDeals = useMemo(() => {
    if (tileFilter === 'all') return scopedDeals
    if (tileFilter === 'inbox') return scopedDeals.filter(d =>
      !TERMINAL.includes(d.stage) &&
      (d.flags?.some(f => f.severity === 'critical') || !d.saLogged)
    )
    if (tileFilter === 'conducted') return scopedDeals.filter(d => d.saLogged)
    if (tileFilter === 'upcoming') return scopedDeals.filter(d => d.stage === 'Upcoming Demo')
    if (tileFilter === 'logged') return scopedDeals.filter(d => d.saLogged)
    if (tileFilter === 'notlogged') return scopedDeals.filter(d =>
      !d.saLogged && !TERMINAL.includes(d.stage) && d.stage !== 'Upcoming Demo'
    )
    if (tileFilter === 'won') return scopedDeals.filter(d => d.stage === wonStage)
    return scopedDeals
  }, [scopedDeals, tileFilter])

  const tileTooltips = {
    inbox: 'Active deals in a conducted or upcoming stage that need action — your working pipeline.',
    conducted: 'Deals where the demo has been logged in Sales Assist and the email sequence is running.',
    upcoming: 'Deals in Upcoming Demo stage — demo is scheduled but not yet conducted.',
    logged: 'Deals where the demo form has been filled and AI email drafts are ready.',
    notlogged: 'Active deals past Upcoming Demo stage where no demo has been logged yet.',
    won: isEnterprise ? 'Deals marked as Won/Payment Received — closed and confirmed.' : 'Deals in Active stage — activated and won.',
    all: 'All deals across every stage in your pipeline.',
  }

  const tiles = [
    { key: 'inbox', label: 'INBOX', count: scopedDeals.filter(d => !TERMINAL.includes(d.stage) && (d.flags?.some(f => f.severity === 'critical') || !d.saLogged)).length, sub: 'Needs your attention today' },
    { key: 'conducted', label: 'CONDUCTED', count: scopedDeals.filter(d => d.saLogged).length, sub: 'Demo done, sequence running' },
    { key: 'upcoming', label: 'UPCOMING', count: scopedDeals.filter(d => d.stage === 'Upcoming Demo').length, sub: 'Scheduled, not yet done' },
    { key: 'logged', label: 'DEMO LOGGED', count: scopedDeals.filter(d => d.saLogged).length, sub: 'Form filled, drafts ready' },
    { key: 'notlogged', label: 'NOT LOGGED', count: scopedDeals.filter(d => !d.saLogged && !TERMINAL.includes(d.stage) && d.stage !== 'Upcoming Demo').length, sub: 'Form pending, drafts blocked' },
    { key: 'won', label: isEnterprise ? 'WON' : 'ACTIVE / WON', count: scopedDeals.filter(d => d.stage === wonStage).length, sub: isEnterprise ? 'Closed and payment confirmed' : 'Activated and won' },
    { key: 'all', label: 'ALL DEALS', count: scopedDeals.length, sub: 'Every deal across all stages' },
  ]

  const pageTitle = () => {
    if (isMDE) return 'My deals'
    if (isAE) return 'My deals · Enterprise'
    if (role === ROLES.SALES_LEAD_MIDMARKET) return 'Mid-Market Pipeline'
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return 'Enterprise Pipeline'
    return pipelineFilter === 'midmarket' ? 'Mid-Market Pipeline' : 'Enterprise Pipeline'
  }

  const showPipelineToggle = isAdmin ||
    role === ROLES.SALES_LEAD_MIDMARKET ||
    role === ROLES.SALES_LEAD_ENTERPRISE

  const filterBarRef = useRef(null)

  useEffect(() => {
    if (!showLegend) return
    const handler = (e) => {
      if (!e.target.closest('[data-legend]')) setShowLegend(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLegend])

  if (loading) return <div className="main"><Loading text="Fetching deals from Zoho CRM…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Pipeline" />
      <div className="callout danger">Failed to load deals: {error}</div>
    </div>
  )

  return (
    <div className="main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Topbar
        title="All Deals"
        subtitle="Grade, stage and flag overview across all your deals"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="seg">
              <button className={view === 'kanban' ? 'is-on' : ''} onClick={() => setView('kanban')}>Kanban</button>
              <button className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>List</button>
            </div>
            <div data-legend style={{ position: 'relative' }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setShowLegend(v => !v)}
                title="Card legend"
                style={{ padding: '4px 8px', fontSize: 13 }}
              >
                ⓘ
              </button>
              {showLegend && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 200,
                  background: 'var(--surface)', border: '1px solid var(--line-2)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)',
                  padding: '14px 16px', width: 260, marginTop: 6
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                    Card Legend
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                    Colour strips
                  </div>
                  {[
                    { color: 'var(--ok)', label: 'Grade A — High probability (55–70%)' },
                    { color: 'var(--info)', label: 'Grade B — Medium probability (30–50%)' },
                    { color: 'var(--warn)', label: 'Grade C — Low probability (10–25%)' },
                    { color: 'var(--danger)', label: 'Grade D — Very low probability (<10%)' },
                    { color: 'var(--ok)', opacity: 0.5, label: 'Demo logged in Sales Assist' },
                    { color: 'var(--danger)', opacity: 0.7, label: 'Has critical flags' },
                    { color: 'var(--warn)', opacity: 0.7, label: 'Has attention flags' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 28, height: 5, borderRadius: 2, flexShrink: 0,
                        background: item.color, opacity: item.opacity || 1
                      }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{item.label}</span>
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                      Left border
                    </div>
                    {[
                      { color: 'var(--danger)', label: 'Critical — needs immediate attention' },
                      { color: 'var(--warn)', label: 'Stale — needs attention soon' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 4, height: 20, borderRadius: 2, flexShrink: 0, background: item.color }} />
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowLegend(false)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-sm" onClick={refetch}>↻ Refresh</button>
          </div>
        }
      />

      {/* Filter tiles */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'nowrap', width: '100%', overflow: 'hidden', flexShrink: 0 }}>
        {tiles.map(tile => (
          <div
            key={tile.key}
            onClick={() => setTileFilter(tile.key)}
            title={tileTooltips[tile.key]}
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px',
              background: tileFilter === tile.key ? 'var(--info-bg)' : 'var(--surface)',
              color: tileFilter === tile.key ? 'var(--info)' : 'var(--ink-1)',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${tileFilter === tile.key ? 'var(--info)' : 'var(--line)'}`,
              boxShadow: tileFilter === tile.key ? '0 0 0 3px var(--info-bg)' : 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', opacity: 0.7, marginBottom: 4 }}>
              {tile.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{tile.count}</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{tile.sub}</div>
          </div>
        ))}
      </div>

      {tileFilter !== 'all' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', marginBottom: 8,
          background: 'var(--info-bg)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12.5, color: 'var(--info)',
          flexShrink: 0
        }}>
          <span>⚡</span>
          <span>
            <b>Viewing: {tiles.find(t => t.key === tileFilter)?.label}</b>
            {' · '}
            {tileTooltips[tileFilter]}
          </span>
          <button
            onClick={() => setTileFilter('all')}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--info)', cursor: 'pointer', fontSize: 12,
              fontWeight: 600, flexShrink: 0
            }}
          >
            Show all deals ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, flexShrink: 0 }}>
        <button className="pipeline-filter-trigger" onClick={() => filterBarRef.current?.openAdd()}>
          + Add filter
        </button>

        <FilterBar
          ref={filterBarRef}
          filters={activeFilters}
          onChange={setActiveFilters}
          deals={deals}
          stages={currentStages}
          isAdmin={isAdmin}
          isMidMarketLead={isMidMarketLead}
          isEnterpriseLead={isEnterpriseLead}
          search={search}
          onSearch={setSearch}
        />

        {showPipelineToggle && (
          <div className="seg" style={{ flexShrink: 0 }}>
            <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => setPipelineFilter('midmarket')}>Mid-Market</button>
            <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => setPipelineFilter('enterprise')}>Enterprise</button>
          </div>
        )}
      </div>

      {/* Health / Needs attention tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <button
          onClick={() => setViewTab('health')}
          style={{
            padding: '8px 16px', border: 'none', background: 'none',
            borderBottom: viewTab === 'health' ? '2px solid var(--brand)' : '2px solid transparent',
            fontWeight: viewTab === 'health' ? 600 : 400,
            color: viewTab === 'health' ? 'var(--brand)' : 'var(--ink-3)',
            cursor: 'pointer', fontSize: 13
          }}
        >
          Pipeline
        </button>
        <button
          onClick={() => setViewTab('attention')}
          style={{
            padding: '8px 16px', border: 'none', background: 'none',
            borderBottom: viewTab === 'attention' ? '2px solid var(--brand)' : '2px solid transparent',
            fontWeight: viewTab === 'attention' ? 600 : 400,
            color: viewTab === 'attention' ? 'var(--brand)' : 'var(--ink-3)',
            cursor: 'pointer', fontSize: 13
          }}
        >
          Needs attention <span style={{ background: 'var(--danger)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>
            {tileFilteredDeals.filter(d => d.flags?.length > 0).length}
          </span>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {viewTab === 'attention' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table className="t" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Grade</th>
                  <th>Brand</th>
                  <th>Rep</th>
                  <th>Stage</th>
                  <th>Flags</th>
                  <th style={{ width: 100 }}>Days in stage</th>
                </tr>
              </thead>
              <tbody>
                {tileFilteredDeals
                  .filter(d => d.flags?.length > 0)
                  .sort((a, b) => {
                    const sev = { critical: 0, warning: 1, info: 2 }
                    const aMax = Math.min(...(a.flags?.map(f => sev[f.severity] ?? 3) || [3]))
                    const bMax = Math.min(...(b.flags?.map(f => sev[f.severity] ?? 3) || [3]))
                    return aMax - bMax
                  })
                  .map(deal => {
                    const days = deal.stageChangedOn
                      ? Math.floor((Date.now() - new Date(deal.stageChangedOn)) / 86400000)
                      : null
                    return (
                      <tr key={deal.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 24, height: 24, borderRadius: 6, fontWeight: 700, fontSize: 12,
                            background: deal.grade === 'A' ? 'var(--ok-bg)' : deal.grade === 'B' ? 'var(--info-bg)' : deal.grade === 'C' ? 'var(--warn-bg)' : 'var(--danger-bg)',
                            color: deal.grade === 'A' ? 'var(--ok)' : deal.grade === 'B' ? 'var(--info)' : deal.grade === 'C' ? 'var(--warn)' : 'var(--danger)',
                          }}>
                            {deal.grade}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{deal.brandName || deal.dealName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{deal.solutionInterest}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{deal.repName?.split(' ')[0]}</td>
                        <td><span className="pill pill-neutral" style={{ fontSize: 11 }}>{deal.stage}</span></td>
                        <td style={{ maxWidth: 400 }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {deal.flags?.map((f, i) => (
                              <span key={i} className={`pill ${f.severity === 'critical' ? 'pill-danger' : f.severity === 'warning' ? 'pill-warn' : 'pill-info'}`} style={{ fontSize: 10.5 }}>
                                {f.title}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: days >= 14 ? 'var(--danger)' : days >= 7 ? 'var(--warn)' : 'var(--ink-2)' }}>
                          {days != null ? `${days}d` : '—'}
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        ) : view === 'kanban'
          ? <KanbanView deals={tileFilteredDeals} pipelineFilter={pipelineFilter} />
          : <ListView deals={tileFilteredDeals} onOpen={id => navigate(`/pipeline/${id}`)} />
        }
      </div>
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────
const FilterBar = forwardRef(function FilterBar({ filters, onChange, deals, stages, isAdmin, isMidMarketLead, isEnterpriseLead, search, onSearch }, ref) {
  const [open, setOpen] = useState(null)   // null | { mode: 'add'|'edit', id? }
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

  let repDeals = deals
  if (isMidMarketLead) repDeals = deals.filter(d => d.pipeline === 'Mid-market')
  if (isEnterpriseLead) repDeals = deals.filter(d => d.pipeline === 'Enterprise 2.0')
  const repNames = [...new Set(repDeals.map(d => d.repName).filter(Boolean))].sort()
  const flagTitles = [...new Set(deals.flatMap(d => d.flags?.map(f => f.title) || []))].sort()

  const FIELDS = [
    ...(isAdmin || isMidMarketLead || isEnterpriseLead
      ? [{ key: 'rep', label: 'Rep', type: 'multi', opts: repNames }]
      : []),
    { key: 'stage',       label: 'Stage',        type: 'multi', opts: stages },
    { key: 'grade',       label: 'Grade',        type: 'multi', opts: ['A', 'B', 'C', 'D'] },
    { key: 'orderVolume', label: 'Order Volume',  type: 'multi', opts: ORDER_VOLUME_OPTIONS },
    { key: 'saLogged',    label: 'SA Logged',     type: 'multi', opts: ['Yes', 'No'] },
    { key: 'demoDate',    label: 'Demo Date',     type: 'date' },
    { key: 'flags',       label: 'Flags',         type: 'multi', opts: ['Has flags', 'No flags', ...flagTitles] },
  ]

  const fieldDef = key => FIELDS.find(f => f.key === key)

  const openAdd = () => {
    setDraft({ field: null, op: 'is', values: [], dateFrom: '', dateTo: '', preset: null })
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
      onChange([...filters, { ...draft, id: String(Date.now()) }])
    } else {
      onChange(filters.map(f => f.id === open.id ? { ...draft, id: open.id } : f))
    }
    close()
  }

  const toggleValue = val => setDraft(d => ({
    ...d,
    values: d.values.includes(val) ? d.values.filter(v => v !== val) : [...d.values, val],
  }))

  const setPreset = preset => {
    const today = new Date()
    const from = new Date(today)
    if (preset === 'Last 7 days')  from.setDate(today.getDate() - 7)
    if (preset === 'Last 30 days') from.setDate(today.getDate() - 30)
    if (preset === 'Last 90 days') from.setDate(today.getDate() - 90)
    const fmt = d => d.toISOString().split('T')[0]
    setDraft(d => ({ ...d, preset, dateFrom: fmt(from), dateTo: fmt(today) }))
  }

  const chipLabel = f => {
    const def = fieldDef(f.field)
    if (!def) return ''
    const opLbl = f.op === 'is' ? 'is' : 'is not'
    if (def.type === 'date') {
      const val = f.preset || (f.dateFrom && f.dateTo ? `${f.dateFrom} – ${f.dateTo}` : f.dateFrom || f.dateTo || '…')
      return `${def.label} ${opLbl} ${val}`
    }
    const vals = f.values.length > 2 ? `${f.values[0]}, +${f.values.length - 1}` : f.values.join(', ')
    return `${def.label} ${opLbl} ${vals}`
  }

  const activeDef = draft?.field ? fieldDef(draft.field) : null
  const canApply = draft?.field && (
    activeDef?.type === 'date' ? (draft.dateFrom || draft.dateTo) : draft.values.length > 0
  )

  return (
    <div style={{
      position: 'relative',
      flex: 1,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      border: '1.5px solid var(--line)',
      borderRadius: 8,
      padding: '6px 10px',
      minHeight: 36,
    }}>
      {filters.map(f => (
        <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            className={`filter-chip${open?.id === f.id ? ' filter-chip-active' : ''}`}
            onClick={() => openEdit(f)}
          >
            {chipLabel(f)}
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

      <input
        style={{
          border: 'none',
          outline: 'none',
          flex: 1,
          minWidth: 120,
          fontSize: 13,
          background: 'transparent',
        }}
        placeholder="Search brand or rep…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />

      {open && (
        <div ref={dropRef} className="filter-dropdown">
          {step === 'field' ? (
            <>
              <div className="fdd-title">Filter by</div>
              {FIELDS.map(f => (
                <button key={f.key} className="fdd-field-opt" onClick={() => {
                  setDraft(d => ({ ...d, field: f.key, values: [], preset: null, dateFrom: '', dateTo: '' }))
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
                    {['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days'].map(p => (
                      <button
                        key={p}
                        className={`fdd-preset${draft.preset === p ? ' active' : ''}`}
                        onClick={() => setPreset(p)}
                      >{p}</button>
                    ))}
                  </div>
                  <div className="fdd-date-inputs">
                    <input type="date" value={draft.dateFrom}
                      onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value, preset: null }))} />
                    <span style={{ color: 'var(--ink-3)' }}>–</span>
                    <input type="date" value={draft.dateTo}
                      onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value, preset: null }))} />
                  </div>
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

// ── Kanban view ───────────────────────────────────────────
function KanbanView({ deals, pipelineFilter }) {
  const { isMDE, isAE } = useAuth()
  const stages = isMDE ? SME_STAGES
    : isAE ? ENT_STAGES
    : pipelineFilter === 'enterprise' ? ENT_STAGES
    : SME_STAGES

  return (
    <div className="kanban-wrap" style={{ overflowX: 'auto' }}>
      <div className="kanban">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const criticalCount = stageDeals.filter(d => d.attentionLevel === 'high').length

          return (
            <div key={stage} className="kcol">
              <div className="kcol-head">
                <div className="kch-top">
                  <span className="kdot" style={{ background: stageDotColor(stage) }} />
                  <span className="kname">{stage}</span>
                  <span className="kcount">{stageDeals.length}</span>
                </div>
                {criticalCount > 0 && (
                  <div className="kch-meta">
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{criticalCount} critical</span>
                  </div>
                )}
              </div>
              <div className="kcol-body" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                {stageDeals.length === 0
                  ? <div className="kcol-empty">No deals</div>
                  : stageDeals.map(deal => <DealCard key={deal.id} deal={deal} />)
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────
function ListView({ deals, onOpen }) {
  return (
    <div className="table-wrap" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <table className="t">
        <thead>
          <tr>
            <th>Brand</th>
            <th>Owner</th>
            <th>Stage</th>
            <th>Solution</th>
            <th>Volume</th>
            <th>Grade</th>
            <th>Flags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No deals found</td></tr>
          )}
          {deals.map(deal => (
            <tr key={deal.id} className="clickable" onClick={() => onOpen(deal.id)}>
              <td>
                <b>{deal.brandName || deal.dealName}</b>
                {deal.mismatch && (
                  <span className="mismatch-tag" style={{ marginLeft: 6 }}>⚠ {deal.mismatchLabel}</span>
                )}
              </td>
              <td>{deal.repName}</td>
              <td>
                <span className={`pill ${getStagePill(deal.stage)}`}>{deal.stage}</span>
              </td>
              <td>{deal.solutionInterest || '—'}</td>
              <td>{deal.orderVolume || '—'}</td>
              <td>
                {deal.grade ? (
                  <span className={`kc-grade kc-grade-${deal.grade.toLowerCase()}`}>{deal.grade}</span>
                ) : '—'}
              </td>
              <td>
                {deal.flags?.length > 0
                  ? <span className={`pill ${deal.attentionLevel === 'high' ? 'pill-danger' : 'pill-warn'}`}>{deal.flags.length}</span>
                  : <span style={{ color: 'var(--ink-3)' }}>—</span>
                }
              </td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn btn-sm" onClick={e => { e.stopPropagation(); onOpen(deal.id) }}>Open →</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// helper — stage dot color
function stageDotColor(stage) {
  const map = {
    'Upcoming Demo':             'var(--ink-3)',
    'Demo Done':                 'var(--info)',
    'Proposal Sent':             'var(--purple)',
    'Account Setup In Progress': '#d27a4f',
    'Awaiting First Shipment':   '#d27a4f',
    'First Shipment Done':       'var(--warn)',
    'Active':                    'var(--ok)',
    'Follow up Meeting Done':    'var(--warn)',
    'On Hold':                   '#b5a484',
    'Won/Payment Received':      'var(--ok)',
    'Lost/Dropped':              'var(--danger)',
  }
  return map[stage] || 'var(--ink-3)'
}
