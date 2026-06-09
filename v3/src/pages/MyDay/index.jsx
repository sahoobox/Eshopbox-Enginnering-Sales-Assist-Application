import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'
import { getStagePill, daysAgo, formatDate } from '../../lib/stageConfig'

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

const TERMINAL_STAGES = ['Won/Payment Received', 'Lost/Dropped', 'On Hold']

export default function MyDay() {
  const { user, role, isMDE, isAE, isAdmin } = useAuth()
  const { deals, loading: dealsLoading } = useDeals()
  const { leads, loading: leadsLoading } = useLeads()
  const navigate = useNavigate()

  const firstName = user?.name?.split(' ')[0] || 'there'
  const todayStr = new Date().toISOString().split('T')[0]

  const scopedDeals = useMemo(() => {
    if (isMDE || isAE) return deals.filter(d => d.repEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    return deals
  }, [deals, role, isMDE, isAE, user])

  const scopedLeads = useMemo(() => {
    if (isMDE || isAE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, isMDE, isAE, user])

  const leadsToday = scopedLeads.filter(l => l.createdAt?.startsWith(todayStr))
  const attentionDeals = scopedDeals.filter(d => d.attentionLevel === 'high')
  const upcomingDemos = scopedDeals.filter(d => d.stage === 'Demo Call Scheduled')
  const activePipeline = scopedDeals.filter(d => !TERMINAL_STAGES.includes(d.stage))
  const wonDeals = scopedDeals.filter(d => d.stage === 'Won/Payment Received')
  const demoedDeals = scopedDeals.filter(d => d.demoDate)
  const closeRate = demoedDeals.length > 0 ? (wonDeals.length / demoedDeals.length * 100).toFixed(0) : null
  const closeRateColor = closeRate === null ? 'var(--ink-3)' : closeRate >= 30 ? 'var(--ok)' : closeRate >= 25 ? 'var(--warn)' : 'var(--danger)'

  const isLeadOrAdmin = !isMDE && !isAE

  if (dealsLoading || leadsLoading) return <div className="main"><Loading text="Loading your day…" /></div>

  return (
    <div className="main">
      <Topbar
        title={`Good morning, ${firstName}`}
        subtitle="Here's what needs your attention today."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiTile label="TASKS TODAY" value={0} sub="from Zoho tasks · coming soon" muted />
        <KpiTile label="INBOUND LEADS" value={leadsToday.length} sub="new today · same-day SLA" onClick={() => navigate('/leads')} />
        <KpiTile label="ATTENTION FLAGS" value={attentionDeals.length} sub="high-priority deals" warn={attentionDeals.length > 0} onClick={() => navigate('/pipeline')} />
        <KpiTile label="UPCOMING DEMOS" value={upcomingDemos.length} sub="scheduled demos" onClick={() => navigate('/pipeline')} />
        <KpiTile label="ACTIVE PIPELINE" value={activePipeline.length} sub="excluding won/lost/on hold" onClick={() => navigate('/pipeline')} />
        <KpiTile label="DEMO→CLOSE RATE" value={closeRate !== null ? `${closeRate}%` : '—'} sub="target 30% · floor 25%" valueColor={closeRateColor} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LeadsQueue leads={leadsToday} navigate={navigate} />
        <AttentionQueue deals={attentionDeals} navigate={navigate} />
        <DemosQueue deals={upcomingDemos} navigate={navigate} />
        {isLeadOrAdmin && (
          <>
            <StaleDealsQueue deals={scopedDeals} navigate={navigate} />
            <ActivationQueue deals={scopedDeals} navigate={navigate} />
          </>
        )}
      </div>
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────
function KpiTile({ label, value, sub, warn, muted, valueColor, onClick }) {
  return (
    <div
      className="card card-pad"
      style={{ textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: muted ? 'var(--ink-3)' : warn ? 'var(--danger)' : valueColor || 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ── Queue wrapper ─────────────────────────────────────────
function Queue({ title, count, children, emptyMsg, navigate, viewAllPath }) {
  return (
    <div className="card">
      <div className="ws-side-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14 }}>{title}</h4>
        <span className="pill pill-neutral" style={{ fontSize: 11 }}>{count}</span>
        {viewAllPath && count > 10 && (
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => navigate(viewAllPath)}>
            View all {count} →
          </button>
        )}
      </div>
      {count === 0
        ? <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>{emptyMsg}</div>
        : <div className="queue">{children}</div>
      }
    </div>
  )
}

// ── Queue 1: Inbound leads ────────────────────────────────
function LeadsQueue({ leads, navigate }) {
  const shown = leads.slice(0, 10)
  return (
    <Queue title="Inbound leads · same-day contact" count={leads.length} emptyMsg="No new inbound leads today." navigate={navigate} viewAllPath="/leads">
      {shown.map(lead => {
        const time = lead.createdAt
          ? new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
          : ''
        return (
          <div key={lead.id} className="q-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/leads/${lead.id}`)}>
            <div className="q-accent info" />
            <div className="q-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div>
                  <div className="label">{lead.company || lead.fullName || '—'}</div>
                  <div className="desc">{lead.fullName}{lead.orderVolume ? ` · ${lead.orderVolume} orders/mo` : ''}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {lead.leadSource && <span className="pill pill-neutral" style={{ fontSize: 11 }}>{lead.leadSource}</span>}
                  {lead.leadStatus === 'New' && <span className="pill pill-warn" style={{ fontSize: 11 }}>today by 6pm</span>}
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{time}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{lead.ownerName}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Queue>
  )
}

// ── Queue 2: Attention ────────────────────────────────────
function AttentionQueue({ deals, navigate }) {
  const shown = deals.slice(0, 10)
  return (
    <Queue title="Needs your attention" count={deals.length} emptyMsg="No flags — you're all clear! ✓" navigate={navigate} viewAllPath="/pipeline">
      {shown.map(deal => {
        const topFlag = deal.flags?.[0]
        return (
          <div key={deal.id} className="q-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
            <div className="q-accent danger" />
            <div className="q-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div>
                  <div className="label">{deal.brandName || deal.dealName}</div>
                  <div className="desc" style={{ color: 'var(--danger)' }}>{topFlag?.title || 'High priority'}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`pill ${getStagePill(deal.stage)}`} style={{ fontSize: 11 }}>{deal.stage}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{deal.repName}</span>
                  {deal.stageChangedOn && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{daysAgo(deal.stageChangedOn)}d in stage</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Queue>
  )
}

// ── Queue 3: Upcoming demos ───────────────────────────────
function DemosQueue({ deals, navigate }) {
  const shown = deals.slice(0, 10)
  return (
    <Queue title="Upcoming demos" count={deals.length} emptyMsg="No upcoming demos scheduled." navigate={navigate} viewAllPath="/pipeline">
      {shown.map(deal => (
        <div key={deal.id} className="q-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
          <div className="q-accent info" />
          <div className="q-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div>
                <div className="label">{deal.brandName || deal.dealName}</div>
                <div className="desc">{deal.repName}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {deal.demoDate && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{formatDate(deal.demoDate)}</span>}
                {deal.orderVolume && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{deal.orderVolume}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </Queue>
  )
}

// ── Queue 4: Stale deals (21-day no-activity) ─────────────
function StaleDealsQueue({ deals, navigate }) {
  const stale = deals.filter(d => d.flags?.some(f => f.rule === 5))
  const shown = stale.slice(0, 10)
  return (
    <Queue title="21-day no-activity deals" count={stale.length} emptyMsg="No stale deals — pipeline is healthy." navigate={navigate} viewAllPath="/pipeline">
      {shown.map(deal => {
        const flag = deal.flags?.find(f => f.rule === 5)
        return (
          <div key={deal.id} className="q-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
            <div className="q-accent warn" />
            <div className="q-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div>
                  <div className="label">{deal.brandName || deal.dealName}</div>
                  <div className="desc">{deal.repName}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`pill ${getStagePill(deal.stage)}`} style={{ fontSize: 11 }}>{deal.stage}</span>
                  {flag && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{flag.desc}</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Queue>
  )
}

// ── Queue 5: Activation health ────────────────────────────
function ActivationQueue({ deals, navigate }) {
  const activation = deals.filter(d => ['Account Setup In Progress', 'Awaiting First Shipment'].includes(d.stage))
  const shown = activation.slice(0, 10)
  return (
    <Queue title="Activation health" count={activation.length} emptyMsg="No activation issues." navigate={navigate} viewAllPath="/pipeline">
      {shown.map(deal => {
        const days = daysAgo(deal.stageChangedOn)
        const daysColor = days > 14 ? 'var(--danger)' : days > 7 ? 'var(--warn)' : 'var(--ink-2)'
        return (
          <div key={deal.id} className="q-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
            <div className="q-accent ok" />
            <div className="q-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div>
                  <div className="label">{deal.brandName || deal.dealName}</div>
                  <div className="desc">{deal.repName}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`pill ${getStagePill(deal.stage)}`} style={{ fontSize: 11 }}>{deal.stage}</span>
                  {days != null && <span style={{ fontSize: 12, fontWeight: 600, color: daysColor }}>{days}d in stage</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Queue>
  )
}
