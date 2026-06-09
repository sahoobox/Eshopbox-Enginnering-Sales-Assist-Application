import { useState, useMemo } from 'react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'
import { SME_STAGES, ENT_STAGES, getStagePill, daysAgo } from '../../lib/stageConfig'

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
]

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'sunil.sethi@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
  'gautam@eshopbox.com',
  'jeevan.more@eshopbox.com',
]

const TERMINAL_STAGES = ['Won/Payment Received', 'Lost/Dropped', 'On Hold']
const COMBINED_STAGES = [...new Set([...SME_STAGES, ...ENT_STAGES])]

export default function Performance() {
  const { role, user, isMDE, isAE, isAdmin, isSalesLead } = useAuth()
  const { deals, loading: dealsLoading } = useDeals()
  const { leads, loading: leadsLoading } = useLeads()

  const defaultFilter = role === ROLES.SALES_LEAD_ENTERPRISE ? 'enterprise' : 'midmarket'
  const [pipelineFilter, setPipelineFilter] = useState(defaultFilter)

  const showToggle = isAdmin || isSalesLead

  const scopedDeals = useMemo(() => {
    if (isMDE || isAE) return deals.filter(d => d.repEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    // Admin — toggle filters data
    if (pipelineFilter === 'midmarket') return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (pipelineFilter === 'enterprise') return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    return deals
  }, [deals, role, isMDE, isAE, user, pipelineFilter])

  const scopedLeads = useMemo(() => {
    if (isMDE || isAE) return leads.filter(l => l.ownerEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    if (pipelineFilter === 'midmarket') return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (pipelineFilter === 'enterprise') return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, isMDE, isAE, user, pipelineFilter])

  // KPI
  const activeDeals = scopedDeals.filter(d => !TERMINAL_STAGES.includes(d.stage))
  const wonDeals = scopedDeals.filter(d => d.stage === 'Won/Payment Received')
  const demoedDeals = scopedDeals.filter(d => d.demoDate)
  const closeRate = demoedDeals.length > 0 ? (wonDeals.length / demoedDeals.length * 100).toFixed(0) : null
  const closeRateColor = closeRate === null ? 'var(--ink-3)' : closeRate >= 30 ? 'var(--ok)' : closeRate >= 25 ? 'var(--warn)' : 'var(--danger)'
  const avgDays = activeDeals.length > 0
    ? Math.round(activeDeals.reduce((s, d) => s + (daysAgo(d.stageChangedOn) || 0), 0) / activeDeals.length)
    : null
  const contactedLeads = scopedLeads.filter(l => l.leadStatus !== 'New')
  const inboundPct = scopedLeads.length > 0 ? Math.round(contactedLeads.length / scopedLeads.length * 100) : null
  const inboundColor = inboundPct === null ? 'var(--ink-3)' : inboundPct >= 80 ? 'var(--ok)' : inboundPct >= 60 ? 'var(--warn)' : 'var(--danger)'

  // Stage bar chart
  const stageList = isMDE || role === ROLES.SALES_LEAD_MIDMARKET || pipelineFilter === 'midmarket'
    ? SME_STAGES
    : isAE || role === ROLES.SALES_LEAD_ENTERPRISE || pipelineFilter === 'enterprise'
    ? ENT_STAGES
    : COMBINED_STAGES
  const stageData = stageList.map(s => ({ stage: s, count: scopedDeals.filter(d => d.stage === s).length }))
  const maxCount = Math.max(...stageData.map(s => s.count), 1)

  // Deals by source
  const sourceMap = new Map()
  for (const d of scopedDeals) {
    const src = d.leadSource || d.source || 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
  }
  const sources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1])

  // Lost reasons
  const lostDeals = scopedDeals.filter(d => d.stage === 'Lost/Dropped')
  const lostMap = new Map()
  for (const d of lostDeals) {
    const r = d.lostReason?.trim() || 'No reason given'
    lostMap.set(r, (lostMap.get(r) || 0) + 1)
  }
  const lostReasons = [...lostMap.entries()].sort((a, b) => b[1] - a[1])

  // Activation health
  const activationDeals = scopedDeals.filter(d =>
    ['Account Setup In Progress', 'Awaiting First Shipment'].includes(d.stage)
  )

  // On hold
  const onHoldDeals = [...scopedDeals.filter(d => d.stage === 'On Hold')]
    .sort((a, b) => (daysAgo(b.stageChangedOn) || 0) - (daysAgo(a.stageChangedOn) || 0))

  // Inbound response by rep
  const repMap = new Map()
  for (const l of scopedLeads) {
    const name = l.ownerName || 'Unknown'
    if (!repMap.has(name)) repMap.set(name, { total: 0, contacted: 0 })
    const r = repMap.get(name)
    r.total++
    if (['Connecting', 'Connected', 'Pending Review'].includes(l.leadStatus)) r.contacted++
  }
  const repLeads = [...repMap.entries()]
    .map(([name, { total, contacted }]) => ({ name, total, contacted, sla: Math.round(contacted / total * 100) }))
    .sort((a, b) => b.sla - a.sla)

  if (dealsLoading || leadsLoading) return <div className="main"><Loading text="Loading performance data…" /></div>

  return (
    <div className="main">
      <Topbar
        title="Performance"
        subtitle="Pipeline health · conversion · reports"
        actions={
          showToggle && (
            <div className="seg">
              <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => setPipelineFilter('midmarket')}>Mid-Market</button>
              <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => setPipelineFilter('enterprise')}>Enterprise</button>
              <button className={pipelineFilter === 'both' ? 'is-on' : ''} onClick={() => setPipelineFilter('both')}>Both</button>
            </div>
          )
        }
      />

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiTile label="TOTAL ACTIVE DEALS" value={activeDeals.length} sub="non-terminal stages" />
        <KpiTile label="DEMO→CLOSE RATE" value={closeRate !== null ? `${closeRate}%` : '—'} sub="target 30% · floor 25%" valueColor={closeRateColor} />
        <KpiTile label="AVG DAYS IN STAGE" value={avgDays !== null ? `${avgDays}d` : '—'} sub="active deals only" warn={avgDays > 21} />
        <KpiTile label="INBOUND RESPONSE" value={inboundPct !== null ? `${inboundPct}%` : '—'} sub="same-day contact rate" valueColor={inboundColor} />
      </div>

      {/* Pipeline by stage */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ws-side-head"><h4>Pipeline by stage</h4></div>
        <div style={{ padding: '8px 20px 16px' }}>
          {stageData.map(({ stage, count }) => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 220, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>{stage}</div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                <div style={{
                  width: count === 0 ? 0 : `${Math.max(count / maxCount * 100, 2)}%`,
                  height: '100%',
                  background: 'var(--info)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column reports */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ReportCard title="Deals by source">
            {sources.length === 0
              ? <EmptyNote>No source data.</EmptyNote>
              : (
                <table className="t">
                  <thead><tr><th>Source</th><th>Count</th><th>%</th></tr></thead>
                  <tbody>
                    {sources.map(([src, count]) => (
                      <tr key={src}>
                        <td style={{ fontSize: 13 }}>{src}</td>
                        <td style={{ fontSize: 13 }}>{count}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{Math.round(count / scopedDeals.length * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </ReportCard>

          <ReportCard title="Lost reason breakdown">
            {lostReasons.length === 0
              ? <EmptyNote>No lost deals.</EmptyNote>
              : (
                <table className="t">
                  <thead><tr><th>Reason</th><th>Count</th><th>% of lost</th></tr></thead>
                  <tbody>
                    {lostReasons.map(([reason, count]) => (
                      <tr key={reason}>
                        <td style={{ fontSize: 13 }}>{reason}</td>
                        <td style={{ fontSize: 13 }}>{count}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{Math.round(count / lostDeals.length * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </ReportCard>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ReportCard title="Activation health">
            {activationDeals.length === 0
              ? <EmptyNote>No activation deals.</EmptyNote>
              : (
                <table className="t">
                  <thead><tr><th>Brand</th><th>Stage</th><th>Rep</th><th>Days</th></tr></thead>
                  <tbody>
                    {activationDeals.map(deal => {
                      const days = daysAgo(deal.stageChangedOn)
                      const color = days > 14 ? 'var(--danger)' : days > 7 ? 'var(--warn)' : 'var(--ink-2)'
                      return (
                        <tr key={deal.id}>
                          <td style={{ fontSize: 13 }}><b>{deal.brandName || deal.dealName}</b></td>
                          <td><span className={`pill ${getStagePill(deal.stage)}`} style={{ fontSize: 11 }}>{deal.stage}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{deal.repName}</td>
                          <td style={{ fontSize: 13, fontWeight: 600, color }}>{days != null ? `${days}d` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            }
          </ReportCard>

          <ReportCard title="On hold age">
            {onHoldDeals.length === 0
              ? <EmptyNote>No deals on hold.</EmptyNote>
              : (
                <table className="t">
                  <thead><tr><th>Brand</th><th>Rep</th><th>Days on hold</th></tr></thead>
                  <tbody>
                    {onHoldDeals.map(deal => {
                      const days = daysAgo(deal.stageChangedOn)
                      const color = days > 60 ? 'var(--danger)' : days > 30 ? 'var(--warn)' : 'var(--ink-2)'
                      return (
                        <tr key={deal.id}>
                          <td style={{ fontSize: 13 }}><b>{deal.brandName || deal.dealName}</b></td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{deal.repName}</td>
                          <td style={{ fontSize: 13, fontWeight: 600, color }}>{days != null ? `${days}d` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            }
          </ReportCard>
        </div>
      </div>

      {/* Inbound response time */}
      <ReportCard title="Inbound response time">
        {repLeads.length === 0
          ? <EmptyNote>No lead data available.</EmptyNote>
          : (
            <table className="t">
              <thead><tr><th>Rep</th><th>Leads assigned</th><th>Contacted</th><th>SLA %</th></tr></thead>
              <tbody>
                {repLeads.map(({ name, total, contacted, sla }) => {
                  const slaColor = sla >= 80 ? 'var(--ok)' : sla >= 60 ? 'var(--warn)' : 'var(--danger)'
                  return (
                    <tr key={name}>
                      <td style={{ fontSize: 13 }}>{name}</td>
                      <td style={{ fontSize: 13 }}>{total}</td>
                      <td style={{ fontSize: 13 }}>{contacted}</td>
                      <td style={{ fontSize: 13, fontWeight: 600, color: slaColor }}>{sla}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        }
      </ReportCard>
    </div>
  )
}

function KpiTile({ label, value, sub, warn, valueColor }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: warn ? 'var(--danger)' : valueColor || 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function ReportCard({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="ws-side-head"><h4>{title}</h4></div>
      <div style={{ padding: '0 0 8px' }}>{children}</div>
    </div>
  )
}

function EmptyNote({ children }) {
  return <div style={{ padding: '12px 20px', color: 'var(--ink-3)', fontSize: 13 }}>{children}</div>
}
