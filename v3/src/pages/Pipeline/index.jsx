import { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading, Empty, ToggleGroup, Pill } from '../../components/ui'
import DealCard from '../../components/ui/DealCard'
import DealDetail from './DealDetail'
import {
  ALL_PIPELINE_STAGES, MID_MARKET_STAGES, ENT_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo
} from '../../lib/stageConfig'

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'gautam@eshopbox.com',
  'jeevan.more@eshopbox.com',
]

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
]

const LEAD_EMAILS = [
  'umang.seth@eshopbox.com',
  'gautam@eshopbox.com',
]

const REP_EMAILS = new Set([...AE_EMAILS, ...MDE_EMAILS, ...LEAD_EMAILS])

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
      if (!deal.demoDate || !deal.saLogged) return false
      const d = new Date(deal.demoDate)
      const from = f.dateFrom ? new Date(f.dateFrom) : null
      const to   = f.dateTo   ? new Date(f.dateTo + 'T23:59:59') : null
      return (!from || d >= from) && (!to || d <= to)
    }
    case 'createdAt': {
      if (!deal.createdAt) return false
      const d = new Date(deal.createdAt)
      const from = f.dateFrom ? new Date(f.dateFrom) : null
      const to   = f.dateTo   ? new Date(f.dateTo + 'T23:59:59') : null
      return (!from || d >= from) && (!to || d <= to)
    }
    case 'demoScheduledDateTime': {
      if (!deal.demoScheduledDateTime) return false
      const d = new Date(deal.demoScheduledDateTime)
      const from = f.dateFrom ? new Date(f.dateFrom) : null
      const to   = f.dateTo   ? new Date(f.dateTo + 'T23:59:59') : null
      return (!from || d >= from) && (!to || d <= to)
    }
    case 'city': {
      const cityVal = (deal.city || '').toLowerCase()
      const search = (f.values?.[0] || '').toLowerCase()
      if (!search) return true
      return f.op === 'does not contain' ? !cityVal.includes(search) : cityVal.includes(search)
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
    if ((f.op === 'contains' || f.op === 'does not contain') && !m) return false
  }
  return true
}

// ── Pipeline list ─────────────────────────────────────────
function PipelineList() {
  const { role, isMDE, isAE, isAdmin, isMidMarketLead, isEnterpriseLead } = useAuth()
  const { deals, loading, error, refetch } = useDeals()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultPipeline = isAE ? 'enterprise' : 'midmarket'
  const activeTile = searchParams.get('tile') || 'inbox'
  const pipelineFilter = searchParams.get('pipeline') || defaultPipeline
  const view = searchParams.get('view') || 'kanban'
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortDir = searchParams.get('sortDir') || 'desc'
  const searchQuery = searchParams.get('q') || ''
  const activeFilters = (() => { try { return JSON.parse(searchParams.get('filters') || '[]') } catch { return [] } })()
  const [showLegend, setShowLegend] = useState(false)
  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState(50)

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

  const TERMINAL = ['Won/Payment Received', 'Lost/Dropped', 'On Hold']

  const isEnterprise = pipelineFilter === 'enterprise'
  const wonStage = isEnterprise ? 'Won/Payment Received' : 'Active'

  const currentStages = useMemo(() =>
    isMDE ? MID_MARKET_STAGES : isAE ? ENT_STAGES : pipelineFilter === 'enterprise' ? ENT_STAGES : MID_MARKET_STAGES
  , [isMDE, isAE, pipelineFilter])

  const scopedDeals = useMemo(() => {
    let d = deals
    if (pipelineFilter === 'midmarket') d = d.filter(deal => deal.pipeline === 'Mid-market')
    else if (pipelineFilter === 'enterprise') d = d.filter(deal => deal.pipeline === 'Enterprise 2.0')
    if (activeFilters.length > 0) d = d.filter(deal => matchFilters(deal, activeFilters))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      d = d.filter(deal =>
        (deal.brandName || deal.dealName || '').toLowerCase().includes(q) ||
        (deal.repName || '').toLowerCase().includes(q)
      )
    }
    return d
  }, [deals, searchQuery, pipelineFilter, activeFilters])

  const tileFilteredDeals = useMemo(() => {
    if (activeTile === 'all') return scopedDeals
    if (activeTile === 'inbox') return scopedDeals.filter(d =>
      !TERMINAL.includes(d.stage) &&
      (d.flags?.some(f => f.severity === 'critical') || !d.saLogged)
    )
    if (activeTile === 'upcoming') return scopedDeals.filter(d => d.stage === 'Upcoming Demo')
    if (activeTile === 'logged') return scopedDeals.filter(d => d.saLogged)
    if (activeTile === 'notlogged') return scopedDeals.filter(d =>
      !d.saLogged && !TERMINAL.includes(d.stage) && d.stage !== 'Upcoming Demo'
    )
    if (activeTile === 'won') return scopedDeals.filter(d => d.stage === wonStage)
    return scopedDeals
  }, [scopedDeals, activeTile])

  const sortedDeals = useMemo(() => {
    const arr = [...tileFilteredDeals]
    arr.sort((a, b) => {
      let aVal, bVal
      if (sortBy === 'createdAt') {
        aVal = new Date(a.createdAt || 0)
        bVal = new Date(b.createdAt || 0)
      } else if (sortBy === 'demoDate') {
        aVal = new Date(a.demoDate || 0)
        bVal = new Date(b.demoDate || 0)
      } else if (sortBy === 'dealName') {
        return sortDir === 'asc'
          ? (a.dealName || '').localeCompare(b.dealName || '')
          : (b.dealName || '').localeCompare(a.dealName || '')
      }
      return sortDir === 'asc'
        ? aVal - bVal
        : bVal - aVal
    })
    return arr
  }, [tileFilteredDeals, sortBy, sortDir])

  const totalListDeals = sortedDeals.length
  const showAllList = listPageSize >= 99999
  const listStart = showAllList ? 0 : (listPage - 1) * listPageSize
  const listEnd = showAllList ? totalListDeals : listStart + listPageSize
  const paginatedDeals = sortedDeals.slice(listStart, listEnd)
  const totalListPages = Math.ceil(totalListDeals / listPageSize)

  useEffect(() => setListPage(1), [sortedDeals])

  const tileTooltips = {
    inbox: 'Active deals in a conducted or upcoming stage that need action — your working pipeline.',
    upcoming: 'Deals in Upcoming Demo stage — demo is scheduled but not yet conducted.',
    logged: 'Deals where the demo form has been filled and AI email drafts are ready.',
    notlogged: 'Active deals past Upcoming Demo stage where no demo has been logged yet.',
    won: isEnterprise ? 'Deals marked as Won/Payment Received — closed and confirmed.' : 'Deals in Active stage — activated and won.',
    all: 'All deals across every stage in your pipeline.',
  }

  const tiles = [
    { key: 'inbox', label: 'INBOX', count: scopedDeals.filter(d => !TERMINAL.includes(d.stage) && (d.flags?.some(f => f.severity === 'critical') || !d.saLogged)).length, sub: 'Needs your attention today' },
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

  const listTableRef = useRef(null)
  const [listTheadEl, setListTheadEl] = useState(null)
  const listTheadRef = useCallback(node => { if (node) setListTheadEl(node) }, [])
  const [showListStickyHeader, setShowListStickyHeader] = useState(false)
  const [listStickyLeft, setListStickyLeft] = useState(0)
  const [listStickyWidth, setListStickyWidth] = useState(0)
  const [listColWidths, setListColWidths] = useState([])

  useEffect(() => {
    const mainEl = document.querySelector('.main')
    if (!mainEl || !listTheadEl) return

    const handleScroll = () => {
      const theadRect = listTheadEl.getBoundingClientRect()
      const mainRect = mainEl.getBoundingClientRect()
      if (theadRect.top < mainRect.top) {
        const tableRect = listTableRef.current?.getBoundingClientRect()
        setShowListStickyHeader(true)
        setListStickyLeft(tableRect?.left || 0)
        setListStickyWidth(tableRect?.width || 0)
        const firstRow = listTableRef.current?.querySelector('tbody tr:first-child')
        if (firstRow) {
          const tds = firstRow.querySelectorAll('td')
          setListColWidths(Array.from(tds).map(td => td.offsetWidth))
        } else {
          const ths = listTheadEl.querySelectorAll('th')
          setListColWidths(Array.from(ths).map(th => th.offsetWidth))
        }
      } else {
        setShowListStickyHeader(false)
      }
    }

    mainEl.addEventListener('scroll', handleScroll)
    return () => mainEl.removeEventListener('scroll', handleScroll)
  }, [listTheadEl])

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
    <div className="main" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar
        title="All Deals"
        subtitle="Grade, stage and flag overview across all your deals"
        actions={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap'
          }}>
            <div className="seg">
              <button className={view === 'kanban' ? 'is-on' : ''} onClick={() => updateParams({ view: 'kanban' })}>Kanban</button>
              <button className={view === 'list' ? 'is-on' : ''} onClick={() => updateParams({ view: 'list' })}>List</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                fontWeight: 500
              }}>
                Sort
              </span>
              <div className="seg">
                <button
                  className={sortDir === 'desc' ? 'is-on' : ''}
                  onClick={() => updateParams({
                    sortBy: 'createdAt', sortDir: 'desc'
                  })}
                >
                  Newest
                </button>
                <button
                  className={sortDir === 'asc' ? 'is-on' : ''}
                  onClick={() => updateParams({
                    sortBy: 'createdAt', sortDir: 'asc'
                  })}
                >
                  Oldest
                </button>
              </div>
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
            <button
              className="btn btn-sm btn-ghost"
              onClick={refetch}
              title="Refresh deals"
            >
              ↻ Refresh
            </button>
          </div>
        }
      />

      {/* Filter tiles */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'nowrap', width: '100%', overflow: 'hidden', flexShrink: 0 }}>
        {tiles.map(tile => (
          <div
            key={tile.key}
            onClick={() => updateParams({ tile: tile.key })}
            title={tileTooltips[tile.key]}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              background: activeTile === tile.key
                ? 'var(--info-bg)'
                : 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${activeTile === tile.key
                ? 'var(--info)'
                : 'var(--line)'}`,
              boxShadow: activeTile === tile.key
                ? '0 0 0 3px rgba(24, 95, 165, 0.08)'
                : 'var(--shadow-1)',
              cursor: 'pointer',
              transition: 'all var(--duration-base) var(--ease)',
              userSelect: 'none'
            }}
          >
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: activeTile === tile.key
                ? 'var(--info)'
                : 'var(--ink-3)',
              marginBottom: 6
            }}>
              {tile.label}
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1,
              color: activeTile === tile.key
                ? 'var(--info)'
                : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {tile.count}
            </div>
            <div style={{
              fontSize: 11,
              marginTop: 4,
              color: activeTile === tile.key
                ? 'var(--info)'
                : 'var(--ink-3)',
              lineHeight: 1.4
            }}>
              {tile.sub}
            </div>
          </div>
        ))}
      </div>

      {activeTile !== 'all' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'var(--info-bg)',
          border: '1px solid var(--info)',
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 13,
          color: 'var(--info)',
          fontWeight: 500
        }}>
          <span>
            Showing: <strong>{tiles.find(t => t.key === activeTile)?.label}</strong>
            {' '}({tileFilteredDeals.length} deals)
          </span>
          <button
            onClick={() => updateParams({ tile: 'all' })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--info)',
              fontSize: 13,
              fontWeight: 500,
              padding: '2px 6px'
            }}
          >
            Show all ×
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
          onChange={fs => updateParams({ filters: fs.length ? fs : null })}
          deals={deals}
          stages={currentStages}
          isAdmin={isAdmin}
          isMidMarketLead={isMidMarketLead}
          isEnterpriseLead={isEnterpriseLead}
          search={searchQuery}
          onSearch={v => updateParams({ q: v || null })}
        />

        {showPipelineToggle && (
          <div className="seg" style={{ flexShrink: 0 }}>
            <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => updateParams({ pipeline: 'midmarket' })}>Mid-Market</button>
            <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => updateParams({ pipeline: 'enterprise' })}>Enterprise</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {view === 'kanban'
          ? <KanbanView deals={sortedDeals} pipelineFilter={pipelineFilter} />
          : <ListView
              deals={paginatedDeals}
              onOpen={id => window.open(`/pipeline/${id}`, '_blank')}
              tableRef={listTableRef}
              theadRef={listTheadRef}
            />
        }
      </div>

      {view === 'list' && (
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0', fontSize: 13,
          color: 'var(--ink-3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              {showAllList
                ? `Showing all ${totalListDeals} deals`
                : `Showing ${totalListDeals === 0 ? 0 : listStart + 1}–${Math.min(listEnd, totalListDeals)} of ${totalListDeals} deals`
              }
            </span>
            <select
              value={listPageSize}
              onChange={e => { setListPageSize(Number(e.target.value)); setListPage(1) }}
              style={{
                padding: '4px 8px', borderRadius: 6,
                border: '1.5px solid var(--line)',
                fontSize: 13, background: 'var(--surface)',
                color: 'var(--ink-1)', cursor: 'pointer'
              }}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={150}>150 rows</option>
              <option value={200}>200 rows</option>
              <option value={99999}>All rows</option>
            </select>
          </div>

          {!showAllList && totalListPages > 1 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setListPage(p => Math.max(1, p - 1))}
                disabled={listPage === 1}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  border: '1.5px solid var(--line)',
                  background: 'var(--surface)', fontSize: 13,
                  cursor: listPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: listPage === 1 ? 0.4 : 1
                }}
              >Previous</button>
              <button
                onClick={() => setListPage(p => Math.min(totalListPages, p + 1))}
                disabled={listPage === totalListPages}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  border: '1.5px solid var(--line)',
                  background: 'var(--surface)', fontSize: 13,
                  cursor: listPage === totalListPages ? 'not-allowed' : 'pointer',
                  opacity: listPage === totalListPages ? 0.4 : 1
                }}
              >Next</button>
            </div>
          )}
        </div>
      )}

      {showListStickyHeader && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: listStickyLeft,
          width: listStickyWidth,
          zIndex: 100,
          background: 'white',
          borderBottom: '2px solid var(--line)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr>
                {['BRAND', 'OWNER', 'STAGE', 'SOLUTION', 'VOLUME', 'GRADE', 'FLAGS', ''].map((col, i) => (
                  <th key={i} style={{
                    width: listColWidths[i],
                    padding: '10px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--ink-3)',
                    textAlign: 'left',
                    background: 'white',
                    whiteSpace: 'nowrap'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      )}


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
  const repNames = [...new Set(
    repDeals.filter(d => REP_EMAILS.has(d.repEmail)).map(d => d.repName).filter(Boolean)
  )].sort()
  const flagTitles = [...new Set(deals.flatMap(d => d.flags?.map(f => f.title) || []))].sort()

  const FIELDS = [
    ...(isAdmin || isMidMarketLead || isEnterpriseLead
      ? [{ key: 'rep', label: 'Sales Representative', type: 'multi', opts: repNames }]
      : []),
    { key: 'stage',       label: 'Stage',        type: 'multi', opts: stages },
    { key: 'grade',       label: 'Grade',        type: 'multi', opts: ['A', 'B', 'C', 'D'] },
    { key: 'orderVolume', label: 'Order Volume',  type: 'multi', opts: ORDER_VOLUME_OPTIONS },
    { key: 'createdAt',             label: 'Deal Created Date',   type: 'date' },
    { key: 'demoScheduledDateTime', label: 'Demo Scheduled Date', type: 'date' },
    { key: 'demoDate',    label: 'Demo Logged Date', type: 'date' },
    { key: 'city',        label: 'City',          type: 'text' },
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
    if (f.field === 'city') {
      return `City ${f.op || 'contains'} "${f.values?.[0]}"`
    }
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
                  setDraft(d => ({
                    ...d, field: f.key, op: f.type === 'text' ? 'contains' : 'is',
                    values: [], preset: null, dateFrom: '', dateTo: '',
                  }))
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

              {activeDef?.type !== 'text' && (
                <div className="fdd-op-row">
                  {['is', 'is not'].map(op => (
                    <button
                      key={op}
                      className={`fdd-op${draft.op === op ? ' active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, op }))}
                    >{op}</button>
                  ))}
                </div>
              )}

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

              {activeDef?.type === 'text' && (
                <div style={{ marginTop: 8 }}>
                  <select
                    value={draft.op || 'contains'}
                    onChange={e => setDraft(d => ({ ...d, op: e.target.value }))}
                    className="form-select"
                    style={{ marginBottom: 8, width: '100%' }}
                  >
                    <option value="contains">Contains</option>
                    <option value="does not contain">Does not contain</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Type to search…"
                    value={draft.values?.[0] || ''}
                    onChange={e => setDraft(d => ({ ...d, values: [e.target.value] }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
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
  const stages = isMDE ? MID_MARKET_STAGES
    : isAE ? ENT_STAGES
    : pipelineFilter === 'enterprise' ? ENT_STAGES
    : MID_MARKET_STAGES

  return (
    <div className="kanban-wrap" style={{ overflowX: 'auto' }}>
      <div className="kanban">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const criticalCount = stageDeals.filter(d => d.attentionLevel === 'high').length

          return (
            <div key={stage} className="kcol" style={{ overflow: 'visible', background: '#f5f5f5' }}>
              <div className="kcol-head" style={{ paddingTop: 12, paddingBottom: 8 }}>
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
              <div className="kcol-body">
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
function ListView({ deals, onOpen, tableRef, theadRef }) {
  return (
    <div ref={tableRef} className="table-wrap" style={{ width: '100%' }}>
      <table className="t">
        <thead ref={theadRef}>
          <tr>
            <th style={{ background: 'white' }}>Brand</th>
            <th style={{ background: 'white' }}>Owner</th>
            <th style={{ background: 'white' }}>Stage</th>
            <th style={{ background: 'white' }}>Solution</th>
            <th style={{ background: 'white' }}>Volume</th>
            <th style={{ background: 'white' }}>Grade</th>
            <th style={{ background: 'white' }}>Flags</th>
            <th style={{ background: 'white' }}></th>
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
