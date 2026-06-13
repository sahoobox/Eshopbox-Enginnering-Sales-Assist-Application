import { useMemo } from 'react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'
import { SME_STAGES, ENT_STAGES, daysAgo } from '../../lib/stageConfig'
import { useState } from 'react'

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

export default function Reports() {
  const { role, user } = useAuth()
  const { deals, loading: dealsLoading } = useDeals()
  const { leads, loading: leadsLoading } = useLeads()
  const [pipelineFilter, setPipelineFilter] = useState(
    role === ROLES.SALES_LEAD_ENTERPRISE ? 'enterprise' : 'midmarket'
  )
  const [dateFilter, setDateFilter] = useState('month')
  const showToggle = role === ROLES.ADMIN ||
    role === ROLES.SALES_LEAD_MIDMARKET ||
    role === ROLES.SALES_LEAD_ENTERPRISE

  const scopedDeals = useMemo(() => {
    if (role === ROLES.SALES_LEAD_MIDMARKET) return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    if (pipelineFilter === 'midmarket') return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (pipelineFilter === 'enterprise') return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    return deals
  }, [deals, role, pipelineFilter])

  const filteredDeals = useMemo(() => {
    if (dateFilter === 'all') return scopedDeals
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const cutoff = dateFilter === 'month' ? startOfMonth : startOfQuarter
    return scopedDeals.filter(d => !d.createdAt || new Date(d.createdAt) >= cutoff)
  }, [scopedDeals, dateFilter])

  const scopedLeads = useMemo(() => {
    if (role === ROLES.SALES_LEAD_MIDMARKET) return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    if (pipelineFilter === 'midmarket') return leads.filter(l => MDE_EMAILS.includes(l.ownerEmail))
    if (pipelineFilter === 'enterprise') return leads.filter(l => AE_EMAILS.includes(l.ownerEmail))
    return leads
  }, [leads, role, pipelineFilter])

  // Stage funnel
  const stageList = (role === ROLES.SALES_LEAD_ENTERPRISE || pipelineFilter === 'enterprise') ? ENT_STAGES : SME_STAGES
  const stageData = stageList.map(s => ({ stage: s, count: filteredDeals.filter(d => d.stage === s).length }))
  const maxStage = Math.max(...stageData.map(s => s.count), 1)

  // Deals by source
  const sourceMap = new Map()
  for (const d of filteredDeals) {
    const src = d.leadSource || 'Unknown'
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
  }
  const sources = [...sourceMap.entries()].sort((a, b) => b[1] - a[1])
  const maxSource = Math.max(...sources.map(s => s[1]), 1)

  // Lost reasons
  const lostDeals = filteredDeals.filter(d => d.stage === 'Lost/Dropped')
  const lostMap = new Map()
  for (const d of lostDeals) {
    const r = d.lostReason?.trim() || 'No reason given'
    lostMap.set(r, (lostMap.get(r) || 0) + 1)
  }
  const lostReasons = [...lostMap.entries()].sort((a, b) => b[1] - a[1])
  const maxLost = Math.max(...lostReasons.map(r => r[1]), 1)

  // Inbound response
  const totalInbound = scopedLeads.length
  const breached = scopedLeads.filter(l => l.leadStatus === 'New').length
  const breachRate = totalInbound > 0 ? Math.round((breached / totalInbound) * 100) : 0

  // Activation health
  const setupDeals = filteredDeals.filter(d => d.stage === 'Account Setup in Progress')
  const awaitingDeals = filteredDeals.filter(d => d.stage === 'Awaiting First Shipment')

  // Stalled deals
  const stalledDeals = filteredDeals
    .filter(d => !TERMINAL_STAGES.includes(d.stage) && (daysAgo(d.stageChangedOn) || 0) >= 14)
    .sort((a, b) => (daysAgo(b.stageChangedOn) || 0) - (daysAgo(a.stageChangedOn) || 0))
    .slice(0, 10)

  // Grade distribution
  const grades = ['A', 'B', 'C', 'D']
  const gradeData = grades.map(g => ({ grade: g, count: filteredDeals.filter(d => d.grade === g && !TERMINAL_STAGES.includes(d.stage)).length }))
  const maxGrade = Math.max(...gradeData.map(g => g.count), 1)
  const gradeColors = { A: 'var(--ok)', B: 'var(--info)', C: 'var(--warn)', D: 'var(--danger)' }

  if (dealsLoading || leadsLoading) return <div className="main"><Loading text="Loading reports…" /></div>

  return (
    <div className="main">
      <Topbar
        title="Reports"
        subtitle="Pipeline analytics · conversion · deal health"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="seg">
              <button className={dateFilter === 'month' ? 'is-on' : ''} onClick={() => setDateFilter('month')}>This month</button>
              <button className={dateFilter === 'quarter' ? 'is-on' : ''} onClick={() => setDateFilter('quarter')}>This quarter</button>
              <button className={dateFilter === 'all' ? 'is-on' : ''} onClick={() => setDateFilter('all')}>All time</button>
            </div>
            {showToggle && (
              <div className="seg">
                <button className={pipelineFilter === 'midmarket' ? 'is-on' : ''} onClick={() => setPipelineFilter('midmarket')}>Mid-Market</button>
                <button className={pipelineFilter === 'enterprise' ? 'is-on' : ''} onClick={() => setPipelineFilter('enterprise')}>Enterprise</button>
              </div>
            )}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Pipeline by stage */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Pipeline by stage</h3>
          {stageData.map(({ stage, count }) => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 200, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>{stage}</div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                <div style={{ width: count === 0 ? 0 : `${Math.max(count / maxStage * 100, 2)}%`, height: '100%', background: 'var(--info)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{count}</div>
            </div>
          ))}
        </div>

        {/* Deals by source */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Deals by source</h3>
          {sources.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No source data.</div>
            : sources.map(([src, count]) => (
              <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 160, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>{src}</div>
                <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                  <div style={{ width: `${count / maxSource * 100}%`, height: '100%', background: 'var(--ok)', borderRadius: 4 }} />
                </div>
                <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{count}</div>
              </div>
            ))
          }
        </div>

        {/* Lost reason breakdown */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Lost reason breakdown</h3>
          {lostReasons.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No lost deals.</div>
            : lostReasons.map(([reason, count]) => (
              <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)' }}>{reason}</div>
                <div style={{ width: 100, background: 'var(--surface-2)', borderRadius: 4, height: 18, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: `${count / maxLost * 100}%`, height: '100%', background: 'var(--danger)', borderRadius: 4 }} />
                </div>
                <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{count}</div>
              </div>
            ))
          }
        </div>

        {/* Inbound response */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Inbound response</h3>
          <div style={{ fontSize: 32, fontWeight: 700, color: breachRate > 20 ? 'var(--danger)' : 'var(--ok)', lineHeight: 1, marginBottom: 6 }}>
            {breachRate}%
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6 }}>same-day breach</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 }}>
            {breached} of {totalInbound} leads still in New status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{totalInbound}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Total inbound leads</div>
            </div>
            <div style={{ padding: '12px 14px', background: breached > 0 ? 'var(--danger-bg)' : 'var(--ok-bg)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: breached > 0 ? 'var(--danger)' : 'var(--ok)' }}>{breached}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Not yet contacted</div>
            </div>
          </div>
        </div>

        {/* Activation health */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Activation health</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{setupDeals.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Account Setup In Progress</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{awaitingDeals.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Awaiting First Shipment</div>
            </div>
          </div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Grade distribution (active deals)</h4>
          {gradeData.map(({ grade, count }) => (
            <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: gradeColors[grade] + '20', color: gradeColors[grade], fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{grade}</div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                <div style={{ width: count === 0 ? 0 : `${Math.max(count / maxGrade * 100, 2)}%`, height: '100%', background: gradeColors[grade], borderRadius: 4 }} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{count}</div>
            </div>
          ))}
        </div>

        {/* Stalled deals */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Stalled deal age <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-3)' }}>(14+ days in stage)</span></h3>
          {stalledDeals.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No stalled deals.</div>
            : stalledDeals.map(deal => {
              const days = daysAgo(deal.stageChangedOn)
              const color = days >= 30 ? 'var(--danger)' : 'var(--warn)'
              return (
                <div key={deal.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                  <div>
                    <b>{deal.brandName || deal.dealName}</b>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 6 }}>· {deal.repName?.split(' ')[0]} · {deal.stage}</span>
                  </div>
                  <span style={{ color, fontWeight: 600, flexShrink: 0 }}>{days}d</span>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}
