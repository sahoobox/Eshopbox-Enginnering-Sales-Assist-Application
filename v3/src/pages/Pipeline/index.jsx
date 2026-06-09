import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading, Empty, ToggleGroup, Pill } from '../../components/ui'
import DealCard from '../../components/ui/DealCard'
import DealDetail from './DealDetail'
import {
  ALL_PIPELINE_STAGES, SME_STAGES, ENT_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo
} from '../../lib/stageConfig'

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

// ── Pipeline page ─────────────────────────────────────────
export default function Pipeline() {
  const { dealId } = useParams()
  if (dealId) return <DealDetail dealId={dealId} />
  return <PipelineList />
}

function PipelineList() {
  const { role, isMDE, isAE, isAdmin } = useAuth()
  const { deals, loading, error, refetch } = useDeals()
  const navigate = useNavigate()

  const [view, setView] = useState('kanban')
  const [pipelineFilter, setPipelineFilter] = useState('midmarket')
  const [search, setSearch] = useState('')

  const scopedDeals = useMemo(() => {
    let d = deals
    // Pipeline filter (admin / lead roles only — reps see their own deals from backend)
    if (pipelineFilter === 'midmarket') {
      d = d.filter(deal => MDE_EMAILS.includes(deal.repEmail))
    } else if (pipelineFilter === 'enterprise') {
      d = d.filter(deal => AE_EMAILS.includes(deal.repEmail))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(deal =>
        (deal.brandName || deal.dealName || '').toLowerCase().includes(q) ||
        (deal.repName || '').toLowerCase().includes(q)
      )
    }
    return d
  }, [deals, search, pipelineFilter])

  console.log('pipelineFilter:', pipelineFilter, 'total:', deals.length, 'scoped:', scopedDeals.length, 'sample repEmail:', deals[0]?.repEmail, 'in MDE?', MDE_EMAILS.includes(deals[0]?.repEmail))

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

  if (loading) return <div className="main"><Loading text="Fetching deals from Zoho CRM…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Pipeline" />
      <div className="callout danger">Failed to load deals: {error}</div>
    </div>
  )

  console.log('Unique stages:', [...new Set(deals.map(d => d.stage))])

  return (
    <div className="main">
      <Topbar
        title={pageTitle()}
        subtitle={`${scopedDeals.length} deals · owner-based visibility`}
        actions={
          <button className="btn btn-sm" onClick={refetch}>↻ Refresh</button>
        }
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {showPipelineToggle && (
          <div className="seg">
            <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => setPipelineFilter('midmarket')}>Mid-Market</button>
            <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => setPipelineFilter('enterprise')}>Enterprise</button>
          </div>
        )}
        <div className="seg">
          <button className={view === 'kanban' ? 'is-on' : ''} onClick={() => setView('kanban')}>Kanban</button>
          <button className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <input
          className="search-input"
          placeholder="Search brand or rep…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {view === 'kanban'
        ? <KanbanView deals={scopedDeals} pipelineFilter={pipelineFilter} />
        : <ListView deals={scopedDeals} onOpen={id => navigate(`/pipeline/${id}`)} />
      }
    </div>
  )
}

// ── Kanban view ───────────────────────────────────────────
function KanbanView({ deals, pipelineFilter }) {
  const { isMDE, isAE } = useAuth()
  const stages = isMDE ? SME_STAGES
    : isAE ? ENT_STAGES
    : pipelineFilter === 'enterprise' ? ENT_STAGES
    : SME_STAGES

  return (
    <div className="kanban-wrap">
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
function ListView({ deals, onOpen }) {
  return (
    <div className="table-wrap">
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
