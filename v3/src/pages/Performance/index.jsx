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
  'raghwendra.kumar@eshopbox.com',
]

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
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
  const [dateFilter, setDateFilter] = useState('month')

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

  const dateFilteredDeals = useMemo(() => {
    if (dateFilter === 'all') return scopedDeals
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const cutoff = dateFilter === 'month' ? startOfMonth : startOfQuarter
    return scopedDeals.filter(d => {
      if (!d.createdAt) return true
      return new Date(d.createdAt) >= cutoff
    })
  }, [scopedDeals, dateFilter])

  // KPI
  const activeDeals = dateFilteredDeals.filter(d => !TERMINAL_STAGES.includes(d.stage))
  const wonDeals = dateFilteredDeals.filter(d => d.stage === 'Won/Payment Received')
  const demoedDeals = dateFilteredDeals.filter(d => d.demoDate)
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
  const stageData = stageList.map(s => ({ stage: s, count: dateFilteredDeals.filter(d => d.stage === s).length }))
  const maxCount = Math.max(...stageData.map(s => s.count), 1)

  // Deals by source
  const sourceMap = new Map()
  for (const d of dateFilteredDeals) {
    const src = d.leadSource || d.source || 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
  }
  const sources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1])

  // Lost reasons
  const lostDeals = dateFilteredDeals.filter(d => d.stage === 'Lost/Dropped')
  const lostMap = new Map()
  for (const d of lostDeals) {
    const r = d.lostReason?.trim() || 'No reason given'
    lostMap.set(r, (lostMap.get(r) || 0) + 1)
  }
  const lostReasons = [...lostMap.entries()].sort((a, b) => b[1] - a[1])

  // Activation health
  const activationDeals = dateFilteredDeals.filter(d =>
    ['Account Setup In Progress', 'Awaiting First Shipment'].includes(d.stage)
  )

  // On hold
  const onHoldDeals = [...dateFilteredDeals.filter(d => d.stage === 'On Hold')]
    .sort((a, b) => (daysAgo(b.stageChangedOn) || 0) - (daysAgo(a.stageChangedOn) || 0))

  // Rep leaderboard
  const repStats = useMemo(() => {
    const map = new Map()
    for (const d of dateFilteredDeals) {
      const name = d.repName || 'Unknown'
      const email = d.repEmail || ''
      if (!map.has(email)) map.set(email, {
        name, email,
        total: 0, active: 0, won: 0, lost: 0,
        logged: 0, gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0,
        flags: 0
      })
      const r = map.get(email)
      r.total++
      if (!TERMINAL_STAGES.includes(d.stage)) r.active++
      if (d.stage === 'Won/Payment Received') r.won++
      if (d.stage === 'Lost/Dropped') r.lost++
      if (d.saLogged) r.logged++
      if (d.grade === 'A') r.gradeA++
      else if (d.grade === 'B') r.gradeB++
      else if (d.grade === 'C') r.gradeC++
      else r.gradeD++
      r.flags += (d.flags?.length || 0)
    }
    return [...map.values()].sort((a, b) => b.won - a.won || b.active - a.active)
  }, [dateFilteredDeals])

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="seg">
              <button className={dateFilter === 'month' ? 'is-on' : ''} onClick={() => setDateFilter('month')}>This month</button>
              <button className={dateFilter === 'quarter' ? 'is-on' : ''} onClick={() => setDateFilter('quarter')}>This quarter</button>
              <button className={dateFilter === 'all' ? 'is-on' : ''} onClick={() => setDateFilter('all')}>All time</button>
            </div>
            {showToggle && (
              <div className="seg">
                <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => setPipelineFilter('midmarket')}>Mid-Market</button>
                <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => setPipelineFilter('enterprise')}>Enterprise</button>
                <button className={pipelineFilter === 'both' ? 'is-on' : ''} onClick={() => setPipelineFilter('both')}>Both</button>
              </div>
            )}
          </div>
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
                        <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{Math.round(count / dateFilteredDeals.length * 100)}%</td>
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

      {/* Rep leaderboard */}
      <ReportCard title="Rep leaderboard">
        {repStats.length === 0
          ? <EmptyNote>No rep data.</EmptyNote>
          : (
            <table className="t">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Active</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Logged</th>
                  <th>A</th>
                  <th>B</th>
                  <th>C</th>
                  <th>D</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {repStats.map(r => (
                  <tr key={r.email}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{r.name.split(' ')[0]}</td>
                    <td style={{ fontSize: 13 }}>{r.active}</td>
                    <td style={{ fontSize: 13, color: 'var(--ok)', fontWeight: r.won > 0 ? 600 : 400 }}>{r.won}</td>
                    <td style={{ fontSize: 13, color: r.lost > 0 ? 'var(--danger)' : 'var(--ink-3)' }}>{r.lost}</td>
                    <td style={{ fontSize: 13 }}>{r.logged}</td>
                    <td style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>{r.gradeA}</td>
                    <td style={{ fontSize: 12, color: 'var(--info)' }}>{r.gradeB}</td>
                    <td style={{ fontSize: 12, color: 'var(--warn)' }}>{r.gradeC}</td>
                    <td style={{ fontSize: 12, color: 'var(--danger)' }}>{r.gradeD}</td>
                    <td style={{ fontSize: 12, color: r.flags > 3 ? 'var(--danger)' : 'var(--ink-3)' }}>{r.flags}</td>
                  </tr>
                ))}
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
