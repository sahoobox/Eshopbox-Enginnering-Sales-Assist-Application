import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading } from '../../components/ui'

const RESOLVE_INSTRUCTIONS = {
  r1:  "Recap email not sent after demo. Send the Day 1 recap email from the Sequence tab to keep the prospect engaged while the demo is fresh.",
  r2:  "Pricing proposal not sent 3+ days after demo. Send or mark the Day 2 proposal as sent from the Sequence tab to move this deal forward.",
  r3:  "ROI email is overdue. Send the Day 3 ROI email from the Sequence tab — this is critical to maintain momentum after the demo.",
  r4:  "No follow-up meeting booked after demo. Call the prospect and schedule a follow-up meeting before this deal goes cold.",
  r5:  "Follow-up meeting has passed but stage not updated. Update the deal stage to reflect what happened in the meeting — or it will be missed in pipeline reviews.",
  r6:  "This deal has been stuck in the same stage for 7+ days and may be getting ignored. Take action — either advance it to the next stage, put it On Hold, or mark it Lost if there is no progress.",
  r7:  "No activity logged after follow-up meeting. Log a call or schedule the next touchpoint — deals that go quiet here rarely close.",
  r8:  "Nudge email sent but no response yet. Follow up with a direct call — don't let this end on an unanswered email.",
  r9:  "Grade A deal with no in-person meeting yet. High-value deals need face time — schedule an F2F or office visit to build trust and close faster.",
  r10: "This deal was marked Lost but no reason was given. Add a lost reason so the team can learn and improve future pitches.",
  r11: "Deal has been in Upcoming Demo for 10+ days with no demo scheduled. Reach out to the prospect and lock in a demo date immediately.",
  r12: "Demo was done but not logged in Sales Assist. Log the demo form now so the sequence emails and AI analysis can be generated.",
  r13: "Account setup has been in progress for 14+ days. Follow up with the prospect on setup blockers and push to get them to first shipment.",
  r14: "Awaiting first shipment for 21+ days. Check in with the prospect — find out what is blocking the first shipment and help unblock it.",
  r15: "First shipment done but deal not activated after 14 days. Confirm the shipment went well and move this deal to Active/Won.",
}

export default function NeedAttention() {
  const navigate = useNavigate()
  const { authFetch } = useAuth()
  const { deals, loading, error, refetch } = useDeals()

  const [teamEmails, setTeamEmails] = useState([])

  useEffect(() => {
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => {
        const emails = (d.users || []).map(u => u.email)
        emails.push('shikhar.gupta@eshopbox.com')
        setTeamEmails(emails)
      })
      .catch(() => {})
  }, [])

  const flaggedDeals = deals
    .filter(d =>
      d.flags?.length > 0 &&
      (teamEmails.length === 0 || teamEmails.includes(d.repEmail)) &&
      (d.pipeline === 'Mid-market' || d.pipeline === 'Enterprise 2.0')
    )
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 }
      const aMax = Math.min(...(a.flags.map(f => sev[f.severity] ?? 3)))
      const bMax = Math.min(...(b.flags.map(f => sev[f.severity] ?? 3)))
      return aMax - bMax
    })

  const flatFlags = []
  flaggedDeals.forEach(deal => {
    ;(deal.flags || []).forEach(flag => {
      flatFlags.push({
        flagId: flag.id || flag.flag,
        flagTitle: flag.title || flag.message || flag.id,
        flagSeverity: flag.severity,
        dealId: deal.id,
        brandName: deal.brandName || deal.dealName,
        repName: deal.repName,
        stage: deal.stage,
        pipeline: deal.pipeline,
        daysInStage: deal.daysInStage || 0,
      })
    })
  })

  flatFlags.sort((a, b) => {
    const order = { high: 0, medium: 1 }
    return (order[a.flagSeverity] ?? 2) - (order[b.flagSeverity] ?? 2)
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [filterFlag, setFilterFlag] = useState('all')
  const [filterRep, setFilterRep] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [resolveFlag, setResolveFlag] = useState(null)

  const filteredFlags = flatFlags.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!f.brandName?.toLowerCase().includes(q) &&
          !f.repName?.toLowerCase().includes(q)) return false
    }
    if (filterFlag !== 'all' && f.flagId !== filterFlag) return false
    if (filterRep !== 'all' && f.repName !== filterRep) return false
    if (filterSeverity !== 'all' && f.flagSeverity !== filterSeverity) return false
    return true
  })

  const repOptions = [...new Set(flatFlags.map(f => f.repName).filter(Boolean))].sort()
  const flagOptions = [...new Set(flatFlags.map(f => f.flagId).filter(Boolean))].sort()

  if (loading) return <div className="main"><Loading text="Fetching deals…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Need Attention" />
      <div className="callout danger">Failed to load deals: {error}</div>
    </div>
  )

  return (
    <div className="main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Topbar
        title="Need Attention"
        subtitle={`${flatFlags.length} flags across ${flaggedDeals.length} deals`}
      />

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 20px' }}>
        <div style={{ padding: '0 0 24px' }}>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search brand or rep..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)', minWidth: 200 }}
            />
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)' }}>
              <option value="all">All severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <select value={filterFlag} onChange={e => setFilterFlag(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)' }}>
              <option value="all">All flags</option>
              {flagOptions.map(f => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
            <select value={filterRep} onChange={e => setFilterRep(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)' }}>
              <option value="all">All reps</option>
              {repOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {(searchQuery || filterFlag !== 'all' || filterRep !== 'all' || filterSeverity !== 'all') && (
              <button onClick={() => { setSearchQuery(''); setFilterFlag('all'); setFilterRep('all'); setFilterSeverity('all') }}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, cursor: 'pointer', background: 'transparent', color: 'var(--ink-3)' }}>
                Clear filters
              </button>
            )}
            <button onClick={refetch}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, cursor: 'pointer', background: 'transparent', color: 'var(--ink-2)', marginLeft: 'auto' }}>
              ↻ Refresh
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {filteredFlags.length} of {flatFlags.length} flags
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['FLAG', 'BRAND', 'REP', 'PIPELINE', 'STAGE', 'DAYS', 'RESOLVE'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--surface)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                      No attention flags found
                    </td>
                  </tr>
                ) : filteredFlags.map((f, i) => (
                  <tr key={`${f.dealId}-${f.flagId}-${i}`} style={{ borderBottom: '0.5px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: f.flagSeverity === 'high' ? '#FCEBEB' : '#FAEEDA', color: f.flagSeverity === 'high' ? '#A32D2D' : '#854F0B' }}>
                        {(f.flagId || '').toUpperCase()}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, maxWidth: 160 }}>
                        {f.flagTitle}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--ink-1)' }}
                        onClick={() => window.open(`/pipeline/${f.dealId}`, '_blank')}>
                        {f.brandName}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                      {f.repName}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: f.pipeline === 'Enterprise 2.0' ? '#EEEDFE' : '#EEF2FF', color: f.pipeline === 'Enterprise 2.0' ? '#3C3489' : '#3B5BDB' }}>
                        {f.pipeline === 'Enterprise 2.0' ? 'Enterprise' : 'Mid-Market'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 12 }}>
                      {f.stage}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, color: f.daysInStage > 14 ? '#E5484D' : f.daysInStage > 7 ? '#C2410C' : 'var(--ink-3)' }}>
                        {f.daysInStage}d
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => setResolveFlag(f)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--line)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit', fontWeight: 600 }}>
                        Resolve →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {resolveFlag && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setResolveFlag(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '28px 32px', maxWidth: 440, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 4 }}>
              How to resolve: {(resolveFlag.flagId || '').toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
              {resolveFlag.brandName} · {resolveFlag.repName}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8 }}>
              {RESOLVE_INSTRUCTIONS[resolveFlag.flagId] || 'Open the deal and investigate the issue.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setResolveFlag(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>
                Close
              </button>
              <button onClick={() => { window.open(`/pipeline/${resolveFlag.dealId}`, '_blank'); setResolveFlag(null) }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3B5BDB', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
                Open Deal →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
