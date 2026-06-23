import { useState } from 'react'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading } from '../../components/ui'

const RESOLVE_INSTRUCTIONS = {
  r1:  { title: 'Recap email not sent',                   steps: ['Open the deal', 'Go to Sequence tab', 'Create Day 1 email draft and send it to the prospect'] },
  r2:  { title: 'Pricing proposal not sent',              steps: ['Open the deal', 'Go to Sequence tab', 'Click Mark Proposal Sent after sending the pricing proposal'] },
  r3:  { title: 'ROI email overdue',                      steps: ['Open the deal', 'Go to Sequence tab', 'Create and send Day 3 ROI email'] },
  r4:  { title: 'No follow-up meeting booked',            steps: ['Open the deal', 'Go to Activities tab', 'Schedule a follow-up meeting with the prospect'] },
  r5:  { title: 'Follow-up meeting passed',               steps: ['Open the deal', 'Move stage to Follow up Meeting Done', 'Update Zoho CRM accordingly'] },
  r6:  { title: 'Stuck in same stage',                    steps: ['Open the deal', 'Review deal status with the rep', 'Move to next stage or mark as Lost/On Hold if no progress'] },
  r7:  { title: 'Deal going quiet',                       steps: ['Open the deal', 'Go to Activities tab', 'Log a call or schedule a follow-up activity'] },
  r8:  { title: 'Nudge email sent, no response',          steps: ['Open the deal', 'Call the prospect directly', 'Consider marking Lost if no response after follow-up'] },
  r9:  { title: 'No in-person meeting',                   steps: ['Open the deal', 'Go to Activities tab', 'Schedule an in-person or F2F meeting'] },
  r10: { title: 'Lost deal, no reason',                   steps: ['Open the deal', 'Click Mark Lost', 'Select the appropriate lost reason from the dropdown'] },
  r11: { title: 'Upcoming demo overdue',                  steps: ['Open the deal', 'Schedule a demo date with the prospect', 'Update the demo date in Zoho CRM'] },
  r12: { title: 'Demo not logged',                        steps: ['Open the deal', 'Click + Log Demo button', 'Fill and submit the demo form'] },
  r13: { title: 'Account setup taking too long',          steps: ['Open the deal', 'Contact the prospect to check setup progress', 'Move to Awaiting First Shipment once setup is complete'] },
  r14: { title: 'Awaiting first shipment too long',       steps: ['Open the deal', 'Follow up with the prospect on shipment timeline', 'Escalate if needed'] },
  r15: { title: 'First shipment done, not activated',     steps: ['Open the deal', 'Confirm first shipment success with prospect', 'Move stage to Active/Won'] },
}

const SEL_STYLE = {
  padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--line)',
  background: 'var(--surface)', fontSize: 12.5, color: 'var(--ink-1)',
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function NeedAttention() {
  const { deals, loading, error, refetch } = useDeals()
  const [searchQuery, setSearchQuery]     = useState('')
  const [filterFlag, setFilterFlag]       = useState('all')
  const [filterRep, setFilterRep]         = useState('all')
  const [filterPipeline, setFilterPipeline] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [resolveFlag, setResolveFlag]     = useState(null)

  const flatFlags = []
  deals.forEach(deal => {
    const daysInStage = deal.stageChangedOn
      ? Math.floor((Date.now() - new Date(deal.stageChangedOn)) / 86400000)
      : 0
    ;(deal.flags || []).forEach(flag => {
      flatFlags.push({
        flagId:       flag.id,
        flagTitle:    flag.title,
        flagSeverity: flag.severity,
        dealId:       deal.id,
        brandName:    deal.brandName || deal.dealName,
        repName:      deal.repName,
        repEmail:     deal.repEmail,
        stage:        deal.stage,
        pipeline:     deal.pipeline,
        daysInStage,
        grade:        deal.grade,
      })
    })
  })

  flatFlags.sort((a, b) => {
    const order = { high: 0, medium: 1 }
    return (order[a.flagSeverity] ?? 2) - (order[b.flagSeverity] ?? 2)
  })

  const repOptions  = [...new Set(flatFlags.map(f => f.repName).filter(Boolean))].sort()
  const flagOptions = [...new Set(flatFlags.map(f => f.flagId))].sort()

  const filteredFlags = flatFlags.filter(f => {
    if (searchQuery &&
        !f.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !f.repName?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterFlag     !== 'all' && f.flagId     !== filterFlag)     return false
    if (filterRep      !== 'all' && f.repName    !== filterRep)      return false
    if (filterPipeline !== 'all' && f.pipeline   !== filterPipeline) return false
    if (filterSeverity !== 'all' && f.flagSeverity !== filterSeverity) return false
    return true
  })

  if (loading) return <div className="main"><Loading text="Fetching deals…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Need Attention" />
      <div className="callout danger">Failed to load deals: {error}</div>
    </div>
  )

  const affectedDeals = new Set(flatFlags.map(f => f.dealId)).size

  return (
    <div className="main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Topbar
        title="Need Attention"
        subtitle={`${flatFlags.length} active flags across ${affectedDeals} deals`}
        actions={<button className="btn btn-sm" onClick={refetch}>↻ Refresh</button>}
      />

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 20px',
        borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          placeholder="Search brand or rep…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            ...SEL_STYLE, minWidth: 200, cursor: 'text',
            padding: '6px 10px',
          }}
        />
        <select style={SEL_STYLE} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="all">All severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
        <select style={SEL_STYLE} value={filterFlag} onChange={e => setFilterFlag(e.target.value)}>
          <option value="all">All flags</option>
          {flagOptions.map(id => (
            <option key={id} value={id}>{id.toUpperCase()} — {RESOLVE_INSTRUCTIONS[id]?.title || id}</option>
          ))}
        </select>
        <select style={SEL_STYLE} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
          <option value="all">All reps</option>
          {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={SEL_STYLE} value={filterPipeline} onChange={e => setFilterPipeline(e.target.value)}>
          <option value="all">All pipelines</option>
          <option value="Mid-market">Mid-Market</option>
          <option value="Enterprise 2.0">Enterprise</option>
        </select>
        {(searchQuery || filterFlag !== 'all' || filterRep !== 'all' || filterPipeline !== 'all' || filterSeverity !== 'all') && (
          <button
            onClick={() => { setSearchQuery(''); setFilterFlag('all'); setFilterRep('all'); setFilterPipeline('all'); setFilterSeverity('all') }}
            style={{ ...SEL_STYLE, color: 'var(--ink-3)', border: 'none', background: 'none' }}
          >
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
          {filteredFlags.length} of {flatFlags.length} flags
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <table className="t" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Flag</th>
              <th>Brand</th>
              <th>Rep</th>
              <th>Pipeline</th>
              <th>Stage</th>
              <th style={{ width: 64 }}>Days</th>
              <th style={{ width: 104 }}>Resolve</th>
            </tr>
          </thead>
          <tbody>
            {filteredFlags.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--ink-3)' }}>
                  {flatFlags.length === 0
                    ? 'No deals with flags — all clear.'
                    : 'No flags match the current filters.'}
                </td>
              </tr>
            )}
            {filteredFlags.map((f, i) => (
              <tr key={`${f.dealId}-${f.flagId}-${i}`}>
                {/* FLAG */}
                <td style={{ verticalAlign: 'top', paddingTop: 10 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 7px', borderRadius: 5,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    background: f.flagSeverity === 'high' ? '#FCEBEB' : '#FAEEDA',
                    color:      f.flagSeverity === 'high' ? '#A32D2D' : '#854F0B',
                  }}>
                    {f.flagId.toUpperCase()}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4, maxWidth: 180 }}>
                    {f.flagTitle}
                  </div>
                </td>

                {/* BRAND */}
                <td>
                  <span
                    onClick={() => window.open(`/pipeline/${f.dealId}`, '_blank')}
                    style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'transparent' }}
                    onMouseEnter={e => e.target.style.textDecorationColor = 'var(--accent)'}
                    onMouseLeave={e => e.target.style.textDecorationColor = 'transparent'}
                  >
                    {f.brandName || '—'}
                  </span>
                </td>

                {/* REP */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--surface-2)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9.5, fontWeight: 700, color: 'var(--ink-2)',
                    }}>
                      {initials(f.repName)}
                    </div>
                    <span style={{ fontSize: 13 }}>{f.repName?.split(' ')[0] || '—'}</span>
                  </div>
                </td>

                {/* PIPELINE */}
                <td>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 5,
                    fontSize: 11, fontWeight: 600,
                    background: f.pipeline === 'Enterprise 2.0' ? '#F5F3FF' : '#EFF6FF',
                    color:      f.pipeline === 'Enterprise 2.0' ? '#7C3AED' : '#1D4ED8',
                  }}>
                    {f.pipeline === 'Enterprise 2.0' ? 'Enterprise' : 'Mid-Market'}
                  </span>
                </td>

                {/* STAGE */}
                <td>
                  <span className="pill pill-neutral" style={{ fontSize: 11 }}>{f.stage}</span>
                </td>

                {/* DAYS */}
                <td style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'center',
                  color: f.daysInStage > 14 ? 'var(--danger)' : f.daysInStage > 7 ? 'var(--warn)' : 'var(--ink-3)',
                }}>
                  {f.daysInStage > 0 ? `${f.daysInStage}d` : '—'}
                </td>

                {/* RESOLVE */}
                <td>
                  <button
                    onClick={() => setResolveFlag(f)}
                    style={{
                      padding: '5px 11px', borderRadius: 7,
                      border: '1.5px solid var(--line)', background: 'transparent',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      color: 'var(--ink-1)', fontFamily: 'inherit',
                    }}
                  >
                    Resolve →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resolve Modal */}
      {resolveFlag && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 12, padding: '28px 32px',
            maxWidth: 440, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 4 }}>
              How to resolve: {RESOLVE_INSTRUCTIONS[resolveFlag.flagId]?.title || resolveFlag.flagTitle}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
              {resolveFlag.brandName} · {resolveFlag.repName}
            </div>
            <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(RESOLVE_INSTRUCTIONS[resolveFlag.flagId]?.steps || []).map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setResolveFlag(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1.5px solid var(--line)', background: 'transparent',
                  fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit',
                }}
              >
                Close
              </button>
              <button
                onClick={() => { window.open(`/pipeline/${resolveFlag.dealId}`, '_blank'); setResolveFlag(null) }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: 'none', background: '#3B5BDB',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: 'white', fontFamily: 'inherit',
                }}
              >
                Open Deal →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
