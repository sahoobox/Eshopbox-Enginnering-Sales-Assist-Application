import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, ToggleGroup, Empty } from '../../components/ui'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { pipelinePillClass, pipelineLabel } from '../../lib/fieldColors'
import { usePageTitle } from '../../hooks/usePageTitle'
import * as XLSX from 'xlsx'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// Fallback flag metadata — used only while GET /api/settings/flags hasn't resolved yet, or if it
// fails. RULE_META in the backend's attentionRules.js is the live source of truth; this is a
// best-effort backup and needs manual upkeep, same category as RULE_META itself.
const FALLBACK_RESOLVE_INSTRUCTIONS = {
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
  r16: "Deal owner is an MDE/AE rep but the deal is sitting in the wrong pipeline. Move the deal to the pipeline that matches the rep's role (MDE → Mid-market, AE → Enterprise 2.0).",
}

const FALLBACK_FLAG_LABELS = {
  r1: 'Recap Not Sent',
  r2: 'Proposal Delayed',
  r3: 'ROI Email Overdue',
  r4: 'No Follow-up',
  r5: 'Meeting Passed',
  r6: 'Stage Stuck',
  r7: 'Gone Quiet',
  r8: 'No Response',
  r9: 'No F2F Meeting',
  r10: 'No Lost Reason',
  r11: 'Demo Not Scheduled',
  r12: 'Not Logged',
  r13: 'Setup Delayed',
  r14: 'Shipment Delayed',
  r15: 'Not Activated',
  r16: 'Wrong Pipeline',
}

const FALLBACK_FLAG_ORDER = Object.keys(FALLBACK_FLAG_LABELS)

// DAYS_TOOLTIPS has no live-source equivalent — RULE_META carries no "what does the days count
// measure" field. Stays hand-maintained; same manual-sync category as RULE_META itself.
// Known gap: keep this updated whenever a rule's days metric changes.
const DAYS_TOOLTIPS = {
  r1:  'Days since last activity was logged',
  r2:  'Days since demo was conducted',
  r3:  'Days since Day 3 ROI email was scheduled',
  r4:  'Days since demo was conducted',
  r5:  'Days since deal entered current stage',
  r6:  'Days since deal entered current stage',
  r7:  'Days since last activity was logged',
  r8:  'Days since nudge email was sent',
  r9:  'Days since demo was conducted',
  r10: 'Days since deal entered current stage',
  r11: 'Days since deal entered current stage',
  r12: 'Days since demo was scheduled',
  r13: 'Days since deal entered current stage',
  r14: 'Days since deal entered current stage',
  r15: 'Days since deal entered current stage',
  r16: 'Days since deal was assigned to wrong pipeline',
  r17: 'Days since entering On Hold',
}

function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleValue = val => onChange(
    selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]
  )

  const buttonText = selected.length === 0
    ? `All ${label}`
    : `${selected.length} ${label.slice(0, -1)}${selected.length > 1 ? 's' : ''} selected`

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {buttonText}
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>▾</span>
      </button>
      {open && (
        <div className="filter-dropdown">
          <div className="fdd-title">Filter by {label}</div>
          <div className="fdd-opts">
            {options.map(opt => (
              <label key={opt.value} className="fdd-opt-row">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggleValue(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <div className="fdd-footer">
            <button className="btn btn-sm" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</button>
            <button className="btn btn-sm" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

const HEAT_RAMP = ['#fde8d7', '#fbc79a', '#f5975a', '#e8672f', '#c8431a', '#9c2f11', '#6e1e0a']

function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function RepPipelineBarChart({ flatFlags, onDrilldown }) {
  const repMap = new Map()
  flatFlags.forEach(f => {
    const repKey = f.repName || 'Unknown'
    if (!repMap.has(repKey)) repMap.set(repKey, { 'Mid-market': 0, 'Enterprise 2.0': 0, rawValues: new Set() })
    const entry = repMap.get(repKey)
    entry[f.pipeline] = (entry[f.pipeline] || 0) + 1
    entry.rawValues.add(f.repName)
  })

  const reps = [...repMap.keys()].sort((a, b) => {
    const totalA = repMap.get(a)['Mid-market'] + repMap.get(a)['Enterprise 2.0']
    const totalB = repMap.get(b)['Mid-market'] + repMap.get(b)['Enterprise 2.0']
    return totalB - totalA
  })

  if (reps.length === 0) {
    return <Empty title="Nothing to chart" body="No flags match the current filters." />
  }

  const pipelinesPresent = new Set(flatFlags.map(f => f.pipeline))
  const pipelineOrder = ['Mid-market', 'Enterprise 2.0'].filter(p => pipelinesPresent.has(p))
  const pipelineColor = { 'Mid-market': cssVar('--info', '#185FA5'), 'Enterprise 2.0': cssVar('--warn', '#854F0B') }
  const inkColor = cssVar('--ink-2', '#4A4A46')
  const gridColor = cssVar('--line', '#EBE8E0')

  const data = {
    labels: reps,
    datasets: pipelineOrder.map(p => ({
      label: pipelineLabel(p),
      data: reps.map(r => repMap.get(r)[p] || 0),
      backgroundColor: pipelineColor[p],
      borderRadius: 4,
      maxBarThickness: 28,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (evt, elements) => {
      if (!elements.length) return
      const repKey = reps[elements[0].index]
      onDrilldown({ rep: [...repMap.get(repKey).rawValues], flagId: [] })
    },
    onHover: (evt, elements) => {
      evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: pipelineOrder.length > 1, position: 'top', labels: { color: inkColor, font: { size: 12 } } },
    },
    scales: {
      x: { ticks: { color: inkColor, font: { size: 12 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: inkColor, precision: 0 }, grid: { color: gridColor } },
    },
  }

  return (
    <div style={{ height: 340 }}>
      <Bar data={data} options={options} />
    </div>
  )
}

function flagCellStep(count, maxCount) {
  if (count === 0 || maxCount === 0) return -1
  return Math.min(HEAT_RAMP.length - 1, Math.floor((count / maxCount) * (HEAT_RAMP.length - 1)))
}

function FlagHeatmap({ flatFlags, onDrilldown, flagOrder, flagLabels }) {
  const repMap = new Map()
  flatFlags.forEach(f => {
    const repKey = f.repName || 'Unknown'
    if (!repMap.has(repKey)) repMap.set(repKey, { counts: {}, rawValues: new Set() })
    const entry = repMap.get(repKey)
    entry.counts[f.flagId] = (entry.counts[f.flagId] || 0) + 1
    entry.rawValues.add(f.repName)
  })

  const rows = [...repMap.entries()].map(([repKey, entry]) => ({
    repKey,
    entry,
    total: flagOrder.reduce((sum, fid) => sum + (entry.counts[fid] || 0), 0),
  })).sort((a, b) => b.total - a.total)

  if (rows.length === 0) {
    return <Empty title="Nothing to show" body="No flags match the current filters." />
  }

  const maxCellCount = Math.max(1, ...rows.flatMap(r => flagOrder.map(fid => r.entry.counts[fid] || 0)))
  const headCellStyle = { padding: '8px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--surface)', textAlign: 'center' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...headCellStyle, textAlign: 'left', position: 'sticky', left: 0 }}>REP</th>
            {flagOrder.map(fid => (
              <th key={fid} style={headCellStyle} title={flagLabels[fid]}>{fid.toUpperCase()}</th>
            ))}
            <th style={{ ...headCellStyle, fontWeight: 700 }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ repKey, entry, total }) => (
            <tr key={repKey}>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                {repKey}
              </td>
              {flagOrder.map(fid => {
                const count = entry.counts[fid] || 0
                const step = flagCellStep(count, maxCellCount)
                const bg = step === -1 ? 'transparent' : HEAT_RAMP[step]
                const textColor = step >= 4 ? '#FFFFFF' : 'var(--ink-1)'
                return (
                  <td
                    key={fid}
                    onClick={count > 0 ? () => onDrilldown({ rep: [...entry.rawValues], flagId: [fid] }) : undefined}
                    title={`${repKey} · ${flagLabels[fid]}: ${count}`}
                    style={{
                      padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid var(--line)',
                      background: bg, color: textColor, fontWeight: count > 0 ? 600 : 400,
                      cursor: count > 0 ? 'pointer' : 'default',
                    }}
                  >
                    {count > 0 ? count : ''}
                  </td>
                )
              })}
              <td
                onClick={total > 0 ? () => onDrilldown({ rep: [...entry.rawValues], flagId: [] }) : undefined}
                style={{
                  padding: '6px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--line)',
                  background: 'var(--surface-2)', color: 'var(--ink-1)', cursor: total > 0 ? 'pointer' : 'default',
                }}
              >
                {total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportsView({ flatFlags, onDrilldown, flagOrder, flagLabels, isRepRole, filterFlag, filterRep, repOptions, updateParams }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelectFilter
          label="flags"
          options={flagOrder.map(f => ({ value: f, label: f.toUpperCase() }))}
          selected={filterFlag}
          onChange={vals => updateParams({ flags: vals.length ? vals : null })}
        />
        <MultiSelectFilter
          label="reps"
          options={repOptions.map(r => ({ value: r, label: r }))}
          selected={filterRep}
          onChange={vals => updateParams({ reps: vals.length ? vals : null })}
        />
      </div>
      {!isRepRole && (
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 12, fontSize: 14 }}>Flags per rep by pipeline</div>
          <RepPipelineBarChart flatFlags={flatFlags} onDrilldown={onDrilldown} />
        </div>
      )}
      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 12, fontSize: 14 }}>Flag count per rep by flag type</div>
        {isRepRole && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 12px' }}>
            This shows how many of each flag type you currently have. Darker cells mean more of that issue — use this to spot patterns and prioritize what to fix first. Click a cell (or a Total) to jump straight to those flags in the table.
          </p>
        )}
        <FlagHeatmap flatFlags={flatFlags} onDrilldown={onDrilldown} flagOrder={flagOrder} flagLabels={flagLabels} />
      </div>
      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 12, fontSize: 14 }}>Flag reference</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>ID</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}>What it means</th>
              </tr>
            </thead>
            <tbody>
              {flagOrder.map(fid => (
                <tr key={fid}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)' }}>{fid.toUpperCase()}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--ink-2)', borderBottom: '1px solid var(--line)' }}>{flagLabels[fid]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function NeedAttention() {
  const navigate = useNavigate()
  const { authFetch, role, isAdmin } = useAuth()
  const { deals, loading, error, refetch } = useDeals()
  usePageTitle('Need Attention')
  const [searchParams, setSearchParams] = useSearchParams()

  const defaultPipeline =
    role === ROLES.MDE || role === ROLES.SALES_LEAD_MIDMARKET ? 'Mid-Market' :
    role === ROLES.AE || role === ROLES.SALES_LEAD_ENTERPRISE ? 'Enterprise' :
    'all'
  const activePipeline = searchParams.get('pipeline') || defaultPipeline
  const isRepRole = role === ROLES.MDE || role === ROLES.AE

  const updateParams = useCallback((updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        next.delete(k)
      } else {
        next.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    })
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const [teamEmails, setTeamEmails] = useState([])

  useEffect(() => {
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => {
        if (d.users && d.users.length > 0) {
          const emails = d.users.map(u => u.email)
          emails.push('shikhar.gupta@eshopbox.com')
          setTeamEmails(emails)
        }
      })
      .catch(() => {})
  }, [])

  const [ruleMeta, setRuleMeta] = useState([])

  useEffect(() => {
    authFetch('/api/settings/flags')
      .then(r => r.json())
      .then(d => setRuleMeta(d.flags || []))
      .catch(() => {})
  }, [])

  const flaggedDeals = deals
    .filter(d =>
      d.flags?.length > 0 &&
      (teamEmails.length === 0 || teamEmails.includes(d.repEmail)) &&
      (d.pipeline === 'Mid-market' || d.pipeline === 'Enterprise 2.0')
    )
    .filter(d => {
      if (activePipeline === 'all') return true
      if (activePipeline === 'Mid-Market') return d.pipeline === 'Mid-market'
      if (activePipeline === 'Enterprise') return d.pipeline === 'Enterprise 2.0'
      return true
    })
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 }
      const aMax = Math.min(...(a.flags.map(f => sev[f.severity] ?? 3)))
      const bMax = Math.min(...(b.flags.map(f => sev[f.severity] ?? 3)))
      return aMax - bMax
    })

  const flatFlags = []
  flaggedDeals.forEach(deal => {
    ;(deal.flags || []).forEach(flag => {
      const flagId = flag.id || flag.flag
      flatFlags.push({
        flagId,
        flagTitle: flag.title || flag.message || flag.id,
        flagSeverity: flag.severity,
        dealId: deal.id,
        brandName: deal.brandName || deal.dealName,
        repName: deal.repName,
        stage: deal.stage,
        pipeline: deal.pipeline,
        daysInStage: flag.daysCount ?? 0,
        daysTooltip: DAYS_TOOLTIPS[flagId] || 'Days since deal entered current stage',
      })
    })
  })

  flatFlags.sort((a, b) => {
    const order = { high: 0, medium: 1 }
    return (order[a.flagSeverity] ?? 2) - (order[b.flagSeverity] ?? 2)
  })

  const searchQuery = searchParams.get('q') || ''
  const filterFlag = useMemo(() => {
    try { return JSON.parse(searchParams.get('flags') || '[]') }
    catch { return [] }
  }, [searchParams.get('flags')])
  const filterRep = useMemo(() => {
    try { return JSON.parse(searchParams.get('reps') || '[]') }
    catch { return [] }
  }, [searchParams.get('reps')])
  const filterSeverity = searchParams.get('severity') || 'all'
  const [resolveFlag, setResolveFlag] = useState(null)
  const tab = searchParams.get('tab') || 'table'

  const filteredFlags = flatFlags.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!f.brandName?.toLowerCase().includes(q) &&
          !f.repName?.toLowerCase().includes(q)) return false
    }
    if (filterFlag.length > 0 && !filterFlag.includes(f.flagId)) return false
    if (filterRep.length > 0 && !filterRep.includes(f.repName)) return false
    if (filterSeverity !== 'all' && f.flagSeverity !== filterSeverity) return false
    return true
  })

  const repOptions = [...new Set(flatFlags.map(f => f.repName).filter(Boolean))].sort()

  const flagLabels = ruleMeta.length > 0
    ? Object.fromEntries(ruleMeta.map(r => [r.id.toLowerCase(), r.title]))
    : FALLBACK_FLAG_LABELS

  const resolveInstructions = ruleMeta.length > 0
    ? Object.fromEntries(ruleMeta.map(r => [r.id.toLowerCase(), r.description]))
    : FALLBACK_RESOLVE_INSTRUCTIONS

  const flagOrder = ruleMeta.length > 0
    ? ruleMeta.map(r => r.id.toLowerCase())
    : FALLBACK_FLAG_ORDER

  const pipelineScopeLabel =
    activePipeline === 'Mid-Market' ? 'in Mid-Market' :
    activePipeline === 'Enterprise' ? 'in Enterprise 2.0' :
    'across all pipelines'

  const handleDrilldown = ({ rep, flagId }) => {
    updateParams({
      reps: rep.length ? rep : null,
      flags: flagId.length ? flagId : null,
      tab: null,
    })
  }

  const handleExportExcel = () => {
    if (filteredFlags.length === 0) return
    const rows = filteredFlags.map(f => ({
      Flag: f.flagTitle,
      Brand: f.brandName,
      Rep: f.repName,
      Pipeline: pipelineLabel(f.pipeline),
      Stage: f.stage,
      Days: f.daysInStage,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Need Attention')
    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `need-attention-flags-${today}.xlsx`)
  }

  if (loading) return <div className="main"><SkeletonTable rows={6} cols={6} /></div>
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
        subtitle={`${flatFlags.length} flags across ${flaggedDeals.length} deals ${pipelineScopeLabel}`}
      />

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 20px' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'table' ? 'active' : ''}`} onClick={() => updateParams({ tab: null })}>Table</button>
          <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => updateParams({ tab: 'reports' })}>Reports</button>
        </div>

        {tab === 'table' && (
        <div style={{ padding: '0 0 24px' }}>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search brand or rep..."
              value={searchQuery}
              onChange={e => updateParams({ q: e.target.value || null })}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)', minWidth: 200 }}
            />
            <select value={filterSeverity} onChange={e => updateParams({ severity: e.target.value === 'all' ? null : e.target.value })}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink-1)' }}>
              <option value="all">All severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <MultiSelectFilter
              label="flags"
              options={flagOrder.map(f => ({ value: f, label: f.toUpperCase() }))}
              selected={filterFlag}
              onChange={vals => updateParams({ flags: vals.length ? vals : null })}
            />
            <MultiSelectFilter
              label="reps"
              options={repOptions.map(r => ({ value: r, label: r }))}
              selected={filterRep}
              onChange={vals => updateParams({ reps: vals.length ? vals : null })}
            />
            {isAdmin && (
              <div style={{ flexShrink: 0 }}>
                <ToggleGroup
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'Mid-Market', label: 'Mid-Market' },
                    { value: 'Enterprise', label: 'Enterprise' },
                  ]}
                  value={activePipeline}
                  onChange={v => updateParams({ pipeline: v === 'all' ? null : v })}
                />
              </div>
            )}
            {(searchQuery || filterFlag.length > 0 || filterRep.length > 0 || filterSeverity !== 'all') && (
              <button onClick={() => updateParams({ q: null, flags: null, reps: null, severity: null })}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, cursor: 'pointer', background: 'transparent', color: 'var(--ink-3)' }}>
                Clear filters
              </button>
            )}
            <button onClick={refetch}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, cursor: 'pointer', background: 'transparent', color: 'var(--ink-2)', marginLeft: 'auto' }}>
              ↻ Refresh
            </button>
            <button
              className="btn btn-sm"
              onClick={handleExportExcel}
              disabled={filteredFlags.length === 0}
              title={filteredFlags.length === 0 ? 'No flags to export' : 'Download the current view as an Excel file'}
              style={{ opacity: filteredFlags.length === 0 ? 0.5 : 1, cursor: filteredFlags.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              ⬇ Download as Excel
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
                      <span className={`pill ${pipelinePillClass(f.pipeline)}`} style={{ fontSize: 11 }}>
                        {pipelineLabel(f.pipeline)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)', fontSize: 12 }}>
                      {f.stage}
                    </td>
                    <td style={{ padding: '10px 12px' }} title={f.daysTooltip}>
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
        )}

        {tab === 'reports' && (
          <div style={{ padding: '16px 0 24px' }}>
            <ReportsView
              flatFlags={filteredFlags}
              onDrilldown={handleDrilldown}
              flagOrder={flagOrder}
              flagLabels={flagLabels}
              isRepRole={isRepRole}
              filterFlag={filterFlag}
              filterRep={filterRep}
              repOptions={repOptions}
              updateParams={updateParams}
            />
          </div>
        )}
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
              {resolveInstructions[resolveFlag.flagId] || 'Open the deal and investigate the issue.'}
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
