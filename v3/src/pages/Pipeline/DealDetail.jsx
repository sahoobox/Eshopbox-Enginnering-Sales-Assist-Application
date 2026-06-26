import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Mail, FileText, Send, ClipboardList, StickyNote, Phone, Calendar, CheckSquare, XCircle, PauseCircle, RefreshCw, Star, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDeal } from '../../hooks/useDeals'
import { useAuth } from '../../context/AuthContext'
import { Loading, Empty, Pill } from '../../components/ui'
import { MID_MARKET_STAGES, ENT_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo } from '../../lib/stageConfig'
import { TaskModal } from '../Tasks'

function formatDateTime(dt) {
  if (!dt) return ''
  try {
    return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return dt }
}

export default function DealDetail({ dealId }) {
  const navigate = useNavigate()
  const { deal, emails, loading, error, refetch: refetchDeal } = useDeal(dealId)
  const { authFetch, isAdmin, isSalesLead } = useAuth()
  const [tab, setTab] = useState('activity')
  const [showF2FForm, setShowF2FForm] = useState(false)
  const [showMarkLost, setShowMarkLost] = useState(false)
  const [showMarkOnHold, setShowMarkOnHold] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [movingStage, setMovingStage] = useState(null)
  const [stageDropdown, setStageDropdown] = useState(false)

  useEffect(() => {
    if (!stageDropdown) return
    const handler = (e) => {
      if (!e.target.closest('[data-stage-dropdown]')) setStageDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [stageDropdown])

  if (loading) return <div className="main"><Loading text="Loading deal…" /></div>
  if (error || !deal) return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/pipeline')} style={{ marginBottom: 10 }}>← Back to pipeline</button>
      <div className="callout danger">{error || 'Deal not found'}</div>
    </div>
  )

  console.log('Stage tracker debug:', { dealName: deal.dealName, pipeline: deal.pipeline, stage: deal.stage, match: deal.pipeline === 'Enterprise 2.0' })
  const stages = deal.pipeline === 'Enterprise 2.0' ? ENT_STAGES : MID_MARKET_STAGES
  const currentIdx = stages.indexOf(deal.stage)
  const isTerminal = deal.pipeline === 'Enterprise 2.0'
    ? ['Won/Payment Received', 'Lost/Dropped', 'On Hold'].includes(deal.stage)
    : ['Active', 'Lost/Dropped', 'On Hold'].includes(deal.stage)
  const mainStages = stages.filter(s =>
    !['Won/Payment Received', 'Lost/Dropped', 'On Hold'].includes(s)
  )
  const endStages = deal.pipeline === 'Enterprise 2.0'
    ? ['On Hold', 'Won/Payment Received', 'Lost/Dropped']
    : ['On Hold', 'Lost/Dropped']
  const moveableStages = deal.pipeline === 'Enterprise 2.0'
    ? ['Follow up Meeting Done', 'Demo Approved', 'Active', 'Won/Payment Received']
    : ['Account Setup in Progress', 'Awaiting First Shipment',
       'First Shipment Done', 'Active']
  const availableStages = moveableStages.filter(s => s !== deal.stage)
  const flagLevel = deal.attentionLevel || 'ok'
  const gradeColor = { A: 'ok', B: 'info', C: 'warn', D: 'danger' }[deal.grade] || 'neutral'

  const moveToStage = async (stage) => {
    if (stage === deal.stage || movingStage) return
    if (stage === 'Lost/Dropped') {
      setShowMarkLost(true)
      return
    }
    if (stage === 'On Hold') {
      setShowMarkOnHold(true)
      return
    }
    if (!confirm(`Move deal to "${stage}"?`)) return
    setMovingStage(stage)
    try {
      const res = await authFetch(`/api/deals/${deal.id}/stage`, {
        method: 'POST',
        body: JSON.stringify({ stage })
      })
      const data = await res.json()
      if (data.success) refetchDeal()
      else alert(data.error || 'Failed to move stage')
    } catch {
      alert('Network error. Try again.')
    } finally {
      setMovingStage(null)
    }
  }

  return (
    <div className="main">
      {/* Back */}
      <button className="btn btn-ghost" onClick={() => navigate('/pipeline')} style={{ marginBottom: 10 }}>
        ← Back to pipeline
      </button>

      {/* Header strip */}
      <div className="hdr-strip">
        {deal.grade && (
          <div className={`kc-grade kc-grade-${deal.grade.toLowerCase()}`} style={{ width: 36, height: 36, fontSize: 15, borderRadius: 9 }}>
            {deal.grade}
          </div>
        )}
        <div>
          <h2 className="deal-name">{deal.brandName || deal.dealName}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {deal.solutionInterest && `${deal.solutionInterest} · `}
            {deal.repName && `${deal.repName} · `}
            {deal.orderVolume && deal.orderVolume}
          </div>
        </div>
        <span className={`pill ${getStagePill(deal.stage)}`}>{deal.stage}</span>
        {deal.flags?.length > 0 && (
          <span className={`pill ${flagLevel === 'high' ? 'pill-danger' : 'pill-warn'}`}>
            {deal.flags.length} flag{deal.flags.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="hdr-meta">
          {!isTerminal && (
            <>
              {!deal.saLogged && (
                <button className="btn btn-sm btn-primary" onClick={() => navigate(`/form?dealId=${deal.id}`)}>+ Log Demo</button>
              )}
              {deal.saLogged && (
                <button className="btn btn-sm" onClick={() => setShowF2FForm(true)}>+ Log F2F</button>
              )}
              <div data-stage-dropdown style={{ position: 'relative' }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setStageDropdown(v => !v)}
                >
                  Move stage ▾
                </button>
                {stageDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--line-2)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)',
                    marginTop: 4, minWidth: 220, overflow: 'hidden'
                  }}>
                    {availableStages.map(stage => (
                      <button key={stage}
                        onClick={() => {
                          setStageDropdown(false)
                          moveToStage(stage)
                        }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none', background: 'none',
                          fontSize: 13, cursor: 'pointer', color: 'var(--ink)',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={e => e.target.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                      >
                        {stage}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--line)', padding: '4px 0' }}>
                      <button key="on-hold"
                        onClick={() => { setStageDropdown(false); setShowMarkOnHold(true) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none', background: 'none',
                          fontSize: 13, cursor: 'pointer', color: 'var(--warn)',
                          fontFamily: 'inherit', fontWeight: 500
                        }}
                        onMouseEnter={e => e.target.style.background = 'var(--warn-bg)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                      >
                        ⏸ On Hold…
                      </button>
                      <button key="lost"
                        onClick={() => { setStageDropdown(false); setShowMarkLost(true) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none', background: 'none',
                          fontSize: 13, cursor: 'pointer', color: 'var(--danger)',
                          fontFamily: 'inherit', fontWeight: 500
                        }}
                        onMouseEnter={e => e.target.style.background = 'var(--danger-bg)'}
                        onMouseLeave={e => e.target.style.background = 'none'}
                      >
                        ✗ Lost / Dropped…
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => setShowMarkLost(true)}>Mark Lost</button>
              <button className="btn btn-sm" onClick={() => setShowMarkOnHold(true)}>Mark on Hold</button>
            </>
          )}
          {(isAdmin || isSalesLead) && (
            <button className="btn btn-sm" onClick={() => setShowReassign(true)}>Reassign</button>
          )}
        </div>
      </div>

      {/* Attention flags banner */}
      {deal.flags?.length > 0 && (
        <div className={`callout ${flagLevel === 'high' ? 'danger' : 'warn'}`} style={{ marginTop: 10 }}>
          <b>{deal.flags[0].title}</b> · {deal.flags[0].desc}
          {deal.flags.length > 1 && ` (+${deal.flags.length - 1} more)`}
        </div>
      )}

      {/* Stage tracker */}
      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14 }}>Stage tracker</h3>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Pipeline · {mainStages.length} stages</div>
          </div>
        </div>
        <div className="stages">
          {(() => {
            const LOCKED_STAGES = ['Upcoming Demo', 'Demo Done', 'Proposal Sent']
            return mainStages.map((s, idx) => {
              const sIdx = stages.indexOf(s)
              const isLocked = LOCKED_STAGES.includes(s)
              let cls = 'future'
              if (isTerminal) {
                cls = 'future'
              } else if (sIdx < currentIdx) {
                cls = 'done'
              } else if (sIdx === currentIdx) {
                cls = 'current'
              }
              return (
                <div key={s} className={`stage-step ${cls}`}
                  onClick={isLocked || s === deal.stage ? undefined : () => moveToStage(s)}
                  style={{ cursor: isLocked || s === deal.stage ? 'default' : 'pointer' }}
                  title={
                    s === deal.stage ? 'Current stage'
                    : isLocked ? 'This stage is set automatically'
                    : `Move to ${s}`
                  }
                >
                  <div className="ord">{idx + 1}/{mainStages.length}</div>
                  <div className="sname">
                    {s === 'Active' && deal.pipeline !== 'Enterprise 2.0' ? 'Active / Won' : s}
                    {movingStage === s && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}> …</span>}
                  </div>
                </div>
              )
            })
          })()}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          {endStages.map(s => {
            const isActive = deal.stage === s
            const color = s === 'Won/Payment Received' ? 'ok' : s === 'Lost/Dropped' ? 'danger' : 'warn'
            return (
              <div key={s}
                onClick={() => moveToStage(s)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  border: `1.5px solid var(--${isActive ? color : 'line'})`,
                  background: isActive ? `var(--${color}-bg)` : 'transparent',
                  cursor: isActive ? 'default' : 'pointer',
                  fontSize: 11.5, fontWeight: isActive ? 600 : 400,
                  color: isActive ? `var(--${color})` : 'var(--ink-3)',
                  textAlign: 'center'
                }}
                title={isActive ? 'Current stage' : `Move to ${s}`}
              >
                {s}
                {movingStage === s && <span> …</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main grid */}
      <div className="ws-grid">
        {/* Left — tabs */}
        <div className="ws-main">
          <div className="tabs">
            {[
              { id: 'activity', label: 'Timeline', count: deal.activities?.length },
              { id: 'tasks', label: 'Activities', count: (deal.tasks?.length || 0) + (deal.meetings?.length || 0) + (deal.calls?.length || 0) },
              { id: 'flags', label: 'Flags', count: deal.flags?.length },
              { id: 'demo', label: 'Demo Info' },
              { id: 'sequence', label: 'Sequence' },
              { id: 'coach', label: 'Coach' },
              { id: 'notes', label: 'Notes' },
              { id: 'contact', label: 'Contact' },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count > 0 && <span className="count">{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'activity' && <TimelineTab dealId={deal.id} />}
          {tab === 'tasks' && <ActivitiesTab dealId={deal.id} deal={deal} onRefresh={refetchDeal} />}
          {tab === 'flags' && <FlagsTab deal={deal} />}
          {tab === 'demo' && <DemoInfoTab deal={deal} />}
          {tab === 'sequence' && <SequenceTab emails={emails} deal={deal} onRetryGenerate={async () => {
            const res = await authFetch(`/api/deals/${deal.id}/generate-content`, { method: 'POST' })
            if (!res.ok) {
              const body = await res.json().catch(() => ({}))
              throw new Error(body.error || `Generation failed (${res.status})`)
            }
            await refetchDeal()
          }} />}
          {tab === 'coach' && <CoachTab deal={deal} />}
          {tab === 'notes' && <NotesTab dealId={deal.id} deal={deal} />}
          {tab === 'contact' && <ContactTab deal={deal} />}
        </div>

        {/* Right — side panel */}
        <div className="ws-side">
          {deal.dealSummary && (
            <div className="card">
              <div className="ws-side-head"><h4>Brand Summary</h4></div>
              <div className="ws-side-body" style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                {deal.dealSummary}
              </div>
            </div>
          )}

          <div className="card">
            <div className="ws-side-head"><h4>Deal fields</h4></div>
            <div className="ws-side-body">
              {[
                { k: 'Owner', v: deal.repName },
                { k: 'Solution', v: deal.solutionInterest },
                { k: 'Volume', v: deal.orderVolume },
                { k: 'Grade', v: deal.grade ? <span className={`kc-grade kc-grade-${deal.grade.toLowerCase()}`}>{deal.grade}</span> : '—' },
                { k: 'Demo date', v: formatDate(deal.demoDate) },
                { k: 'Follow-up mtg', v: formatDate(deal.followupMeetingDate) },
                { k: 'Days in stage', v: daysAgo(deal.stageChangedOn) != null ? `${daysAgo(deal.stageChangedOn)}d` : '—' },
                { k: 'Demo logged', v: deal.saLogged ? <span className="pill pill-ok">✓ Yes</span> : <span className="pill pill-neutral">No</span> },
                { k: 'Lost reason', v: deal.lostReason || '—' },
              ].map(row => (
                <div key={row.k} className="ws-side-row">
                  <span className="k">{row.k}</span>
                  <span className="v">{row.v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showF2FForm && <F2FModal deal={deal} onClose={() => setShowF2FForm(false)} />}
      {showMarkLost && <MarkLostModal deal={deal} onClose={() => setShowMarkLost(false)} onSuccess={() => { setShowMarkLost(false); window.location.reload() }} />}
      {showMarkOnHold && <MarkOnHoldModal deal={deal} onClose={() => setShowMarkOnHold(false)} onSuccess={() => { setShowMarkOnHold(false); window.location.reload() }} />}
      {showReassign && <ReassignDealModal deal={deal} onClose={() => setShowReassign(false)} onSuccess={() => { setShowReassign(false); refetchDeal() }} />}
    </div>
  )
}

// ── Tab components ─────────────────────────────────────────

function TimelineTab({ dealId }) {
  const { authFetch } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch(`/api/deals/${dealId}/timeline`)
      .then(r => r.json())
      .then(d => setEvents(d.timeline || []))
      .finally(() => setLoading(false))
  }, [dealId])

  const iconMap = {
    stage_changed:       <ArrowRight size={14} />,
    stage_changed_zoho:  <ArrowRight size={14} />,
    emails_generated:    <Mail size={14} />,
    gmail_draft_created: <FileText size={14} />,
    email_sent:          <Send size={14} />,
    demo_logged:         <ClipboardList size={14} />,
    note_added:          <StickyNote size={14} />,
    call_logged:         <Phone size={14} />,
    call_scheduled:      <Phone size={14} />,
    meeting_created:     <Calendar size={14} />,
    task_created:        <CheckSquare size={14} />,
    mark_lost:            <XCircle size={14} />,
    mark_on_hold:         <PauseCircle size={14} />,
    deal_created:         <Star size={14} />,
    task_completed:       <CheckSquare size={14} />,
    meeting_completed:    <Calendar size={14} />,
    call_completed:       <Phone size={14} />,
    gmail_draft_recreated:<RefreshCw size={14} />,
    deal_reassigned:       <UserCheck size={14} />,
  }

  const colorMap = {
    stage_changed:        '#3B5BDB',
    stage_changed_zoho:   '#7C3AED',
    emails_generated:     '#0EA5E9',
    gmail_draft_created:  '#0EA5E9',
    email_sent:           '#2F9E44',
    demo_logged:          '#F59E0B',
    note_added:           '#6B7280',
    call_logged:          '#C2255C',
    call_scheduled:       '#C2255C',
    meeting_created:      '#2F9E44',
    task_created:         '#3B5BDB',
    mark_lost:            '#E5484D',
    mark_on_hold:         '#F59E0B',
    deal_created:         '#F59E0B',
    task_completed:       '#2F9E44',
    meeting_completed:    '#2F9E44',
    call_completed:       '#2F9E44',
    gmail_draft_recreated:'#0EA5E9',
    deal_reassigned:      '#7C3AED',
  }

  if (loading) return (
    <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Loading timeline...</div>
  )

  if (events.length === 0) return (
    <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>No timeline events yet.</div>
  )

  return (
    <div style={{ padding: '4px 0' }}>
      {events.map((event, i) => {
        const color = colorMap[event.event_type] || '#6B7280'
        const icon = iconMap[event.event_type] || <RefreshCw size={14} />
        const meta = (() => { try { return JSON.parse(event.metadata || '{}') } catch { return {} } })()

        return (
          <div key={event.id || i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>
                {event.description}
              </div>
              {event.actor_name && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {event.actor_name}
                  {event.source === 'zoho' && (
                    <span style={{ marginLeft: 6, fontSize: 10, background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Zoho CRM</span>
                  )}
                  {event.source === 'salesassist' && (
                    <span style={{ marginLeft: 6, fontSize: 10, background: '#F0FFF4', color: '#2F9E44', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Sales Assist</span>
                  )}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                {new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmailsTab({ emails, deal }) {
  const typeLabel = { day1: 'Day 1 · Recap', day2: 'Day 2 · Proposal', day3: 'Day 3 · ROI', day4: 'Day 4 · Objection', nudge: 'Mtg +7 · Nudge' }
  const statusPill = { sent: 'pill-ok', scheduled: 'pill-info', draft: 'pill-neutral', failed: 'pill-danger' }

  if (!deal.saLogged) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        Log the demo to generate email drafts.
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        No email drafts yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {emails.map(email => (
        <div key={email.id} className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <b style={{ fontSize: 13.5 }}>{typeLabel[email.email_type] || email.email_type}</b>
            <span className={`pill ${statusPill[email.status] || 'pill-neutral'}`}>{email.status}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(email.scheduled_for)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>{email.subject}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
            {email.body?.replace(/<[^>]+>/g, '').slice(0, 200)}…
          </div>
          {email.status === 'draft' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary">Create Gmail Draft</button>
              <button className="btn btn-sm">Edit</button>
            </div>
          )}
          {email.status === 'draft' && email.email_type === 'day2' && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-sm btn-ok">Mark as Sent</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ActivitiesTab({ dealId, deal, onRefresh }) {
  const { authFetch } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [localCompleted, setLocalCompleted] = useState(new Set())
  const [confirmModal, setConfirmModal] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!showDropdown) return
    const handler = (e) => {
      if (!e.target.closest('[data-activity-dropdown]')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/deals/${dealId}/tasks`)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [dealId, authFetch])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function toggleTask(taskId, isComplete) {
    if (!isComplete) {
      setConfirmModal({
        onConfirm: async () => {
          setConfirmModal(null)
          await authFetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' })
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: true, status: 'Completed' } : t))
        }
      })
      return
    }
    await authFetch(`/api/tasks/${taskId}/reopen`, { method: 'PATCH' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: false, status: 'Not Started' } : t))
  }

  const meetings = deal?.meetings || []
  const calls = deal?.calls || []

  const allActivities = [
    ...tasks.map(t => ({ id: t.id, type: 'Task', date: t.dueDate, taskStatus: t.status, done: t.status === 'Completed', _t: t })),
    ...meetings.map(m => ({ id: m.id, type: 'Meeting', date: m.from, status: m.status, done: (m.to && new Date(m.to) < new Date()) || localCompleted.has(m.id), _m: m })),
    ...calls.map(c => ({ id: c.id, type: 'Call', date: c.timing, status: c.status, done: (c.status !== 'Scheduled' && c.status !== 'scheduled' && c.status !== '' && c.status !== null) || localCompleted.has(c.id), _c: c })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  const TYPE_PILL_STYLE = {
    Task:    { background: '#F0F4FF', color: '#3B5BDB' },
    Meeting: { background: '#F0FFF4', color: '#2F9E44' },
    Call:    { background: '#FFF0F6', color: '#C2255C' },
  }
  const typePill = (type) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block', ...(TYPE_PILL_STYLE[type] || {}) }}>{type}</span>
  )
  const typeBadge = (label) => (
    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--ink-3)', flexShrink: 0 }}>{label}</span>
  )

  function completeMeeting(meetingId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/deals/${dealId}/meeting/${meetingId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => new Set([...prev, meetingId]))
        onRefresh?.()
      }
    })
  }

  function completeCall(callId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/deals/${dealId}/call/${callId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => new Set([...prev, callId]))
        onRefresh?.()
      }
    })
  }

  if (loading) return <div className="card card-pad" style={{ color: 'var(--ink-3)' }}>Loading activities…</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div data-activity-dropdown style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowDropdown(v => !v)}>
            + New Activity ▾
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--line-2)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)',
              marginTop: 4, minWidth: 140, overflow: 'hidden'
            }}>
              {['Task', 'Meeting', 'Call'].map(item => (
                <button key={item}
                  onClick={() => {
                    setShowDropdown(false)
                    if (item === 'Task') setShowTaskModal(true)
                    else if (item === 'Meeting') setShowMeetingModal(true)
                    else setShowCallModal(true)
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', background: 'none',
                    fontSize: 13, cursor: 'pointer', color: 'var(--ink)',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {allActivities.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No activities on this deal.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allActivities.map((item, idx) => {
            if (item.type === 'Task') {
              const t = item._t
              const isOverdue = t.dueDate && t.dueDate < todayStr && !item.done
              return (
                <div key={item.id || idx} className="card card-pad"
                  style={{ opacity: item.done ? 0.75 : 1, color: item.done ? 'var(--ink-3)' : 'inherit' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={item.done} onChange={() => toggleTask(t.id, item.done)}
                      style={{ cursor: 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.subject}</span>
                        {typePill('Task')}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', marginBottom: t.description ? 6 : 0 }}>
                        {t.dueDate && <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--ink-3)' }}>Due: {formatDate(t.dueDate)}</span>}
                        {t.priority && <span>Priority: {t.priority}</span>}
                        <span>Status: {t.status || 'Not Started'}</span>
                        {t.ownerName && <span>Assigned: {t.ownerName}</span>}
                      </div>
                      {t.description && <div style={{ fontSize: 12.5, color: item.done ? 'var(--ink-3)' : 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>{t.description}</div>}
                    </div>
                  </div>
                </div>
              )
            }

            if (item.type === 'Meeting') {
              const m = item._m
              return (
                <div key={item.id || idx} className="card card-pad" style={{ opacity: item.done ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={item.done}
                      onChange={item.done ? () => {} : () => completeMeeting(m.id)}
                      style={{ cursor: item.done ? 'default' : 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</span>
                        {typePill('Meeting')}
                        {m.status && typeBadge(m.status)}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', marginBottom: m.description ? 6 : 0 }}>
                        {m.venue && <span>Venue: {m.venue}</span>}
                        {m.from && <span>From: {formatDateTime(m.from)}</span>}
                        {m.to && <span>To: {formatDateTime(m.to)}</span>}
                        {m.createdBy && <span>By: {m.createdBy}</span>}
                      </div>
                      {m.description && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>{m.description}</div>}
                    </div>
                  </div>
                </div>
              )
            }

            if (item.type === 'Call') {
              const c = item._c
              return (
                <div key={item.id || idx} className="card card-pad" style={{ opacity: item.done ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={item.done}
                      onChange={item.done ? () => {} : () => completeCall(c.id)}
                      style={{ cursor: item.done ? 'default' : 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.subject}</span>
                        {typePill('Call')}
                        {typeBadge(c.status === 'Scheduled' ? 'Scheduled' : 'Completed')}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', marginBottom: (c.agenda || c.description) ? 6 : 0 }}>
                        {c.timing && <span>{formatDateTime(c.timing)}</span>}
                        {c.purpose && c.purpose !== 'None' && <span>Purpose: {c.purpose}</span>}
                        {c.result && c.result !== 'None' && <span>Result: {c.result}</span>}
                        {c.createdBy && <span>By: {c.createdBy}</span>}
                      </div>
                      {c.agenda && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>Agenda: {c.agenda}</div>}
                      {c.description && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>{c.description}</div>}
                    </div>
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          dealId={dealId}
          onClose={() => setShowTaskModal(false)}
          onSubmit={async (data) => {
            const res = await authFetch('/api/tasks', { method: 'POST', body: JSON.stringify(data) })
            const json = await res.json()
            if (json.success) { setShowTaskModal(false); fetchTasks() }
            else alert(json.error || 'Failed to create task')
          }}
        />
      )}
      {showMeetingModal && (
        <MeetingModal
          dealId={dealId}
          onClose={() => setShowMeetingModal(false)}
          onSuccess={() => { setShowMeetingModal(false); onRefresh?.() }}
        />
      )}
      {showCallModal && (
        <CallModal
          dealId={dealId}
          onClose={() => setShowCallModal(false)}
          onSuccess={() => { setShowCallModal(false); onRefresh?.() }}
        />
      )}

      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            padding: '28px 32px',
            maxWidth: 380, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>
              Mark as completed?
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: '1.5px solid var(--line)',
                  background: 'transparent', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                  color: 'var(--ink-2)', fontFamily: 'inherit'
                }}>
                Cancel
              </button>
              <button onClick={confirmModal.onConfirm}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: 'none',
                  background: '#E5484D', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer',
                  color: '#FFFFFF', fontFamily: 'inherit'
                }}>
                Yes, mark complete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FlagsTab({ deal }) {
  const flags = deal.flags || []
  const sevColor = { high: 'danger', critical: 'danger', medium: 'warn', info: 'info' }
  if (flags.length === 0) {
    return <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ok)' }}>✓ No attention flags on this deal.</div>
  }
  return (
    <div className="queue">
      {flags.map((flag, i) => (
        <div key={i} className="q-item">
          <div className={`q-accent ${sevColor[flag.severity] || 'info'}`} />
          <div className="q-body">
            <div>
              <div className="label">{flag.title}</div>
              <div className="desc">{flag.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DemoInfoTab({ deal }) {
  const d = deal.demoInfo
  if (!deal.saLogged || !d) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        {deal.saLogged ? 'Demo info not found.' : 'No demo logged yet. Click "+ Log Demo" to log a demo.'}
        {deal.saLogged && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>This demo was logged before V3.</div>}
      </div>
    )
  }

  const sections = [
    {
      title: 'Deal Info',
      rows: [
        { k: 'Stage', v: deal.stage },
        { k: 'Solution Interest', v: d.solutionInterest || deal.solutionInterest },
        { k: 'Order Volume', v: d.orderVolume || deal.orderVolume },
        { k: 'Follow-up Meeting', v: formatDate(d.followupMeetingDate || deal.followupMeetingDate) },
        { k: 'Demo Date', v: formatDate(deal.demoDate) },
        { k: 'Pricing Raised', v: d.pricingRaised === 'yes' || deal.pricingRaised ? 'Yes' : 'No' },
        { k: 'OMS', v: d.oms },
        { k: 'Shopping Cart', v: d.shoppingCart },
        { k: 'Current Shipping', v: d.shippingSetup },
        { k: 'Current Warehousing', v: d.warehousingSetup },
        { k: 'Brand Type', v: d.brandType },
        { k: 'Demo Format', v: d.demoFormat },
        { k: 'Meeting Location', v: d.meetingLocation },
        { k: 'City', v: deal.city },
        { k: 'Support Needed', v: deal.supportNeeded },
        { k: 'Product Type', v: deal.productType },
      ]
    },
    {
      title: 'Qualification',
      rows: [
        { k: 'DM Present', v: d.dmPresent },
        { k: 'Engagement Level', v: d.engagementLevel },
        { k: 'Pain Clarity', v: d.painClarity },
        { k: 'Budget Signal', v: d.budgetSignal },
        { k: 'Purchase Timeline', v: d.purchaseTimeline },
        { k: 'Champion Strength', v: d.championStrength },
        { k: 'Next Step', v: d.nextStep },
        { k: 'Urgency Driver', v: d.urgencyDriver },
        { k: 'Competitor Mentioned', v: d.competitorMentioned },
        { k: 'Objections', v: d.objections },
      ]
    },
    {
      title: 'Prospect',
      rows: [
        { k: 'Prospect Name', v: d.prospectName },
        { k: 'Prospect Email', v: d.prospectEmail },
      ]
    },
    {
      title: 'Pain Points',
      rows: [
        { k: 'Shipping Pains', v: d.shippingPains?.join(', ') },
        { k: 'Warehousing Pains', v: d.warehousingPains?.join(', ') },
      ]
    },
    {
      title: 'Demo Notes',
      rows: [
        { k: 'Features Shown', v: d.featuresShown?.join(', ') },
        { k: 'Rep Notes', v: d.repNotes },
        { k: 'Transcript', v: d.transcript || 'No transcript was logged for this demo.' },
      ]
    },
    {
      title: 'Grading',
      rows: [
        { k: 'Grade', v: d.grade || deal.grade },
        { k: 'Score', v: `${d.score || deal.score || 0}/22` },
        { k: 'Logged At', v: d.createdAt ? formatDate(d.createdAt) : 'Logged before V3' },
      ]
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sections.map(section => (
        <div key={section.title} className="card">
          <div className="ws-side-head"><h4>{section.title}</h4></div>
          <div className="ws-side-body">
            {section.rows.filter(r => r.v).map(row => (
              <div key={row.k} className="ws-side-row">
                <span className="k">{row.k}</span>
                <span className="v" style={{ maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SequenceTab({ emails, deal, onRetryGenerate }) {
  const typeLabel = {
    day1: 'Day 1 · Personalised Recap',
    day2: 'Day 2 · Pricing Proposal',
    day3: 'Day 3 · ROI Value',
    day4: 'Day 4 · Objection Handling',
    nudge: 'Mtg +7 · Nudge'
  }
  const statusPill = { sent: 'pill-ok', scheduled: 'pill-info', draft: 'pill-neutral', failed: 'pill-danger' }
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState(null)

  if (!deal.saLogged) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        Log the demo to generate email sequence.
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        <div style={{ marginBottom: 12 }}>No email drafts yet. Generation may have failed after logging the demo.</div>
        {retryError && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--danger)' }}>{retryError}</div>
        )}
        <button
          className="btn btn-sm btn-primary"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true)
            setRetryError(null)
            try {
              await onRetryGenerate()
            } catch (e) {
              setRetryError(e.message || 'Generation failed — please try again')
            } finally {
              setRetrying(false)
            }
          }}
        >
          {retrying ? 'Generating…' : '↻ Retry email generation'}
        </button>
      </div>
    )
  }

  function EmailCard({ email }) {
    const { authFetch, user } = useAuth()
    const isDev = user?.email === 'satyanarayan.sahoo@eshopbox.com'
    const [expanded, setExpanded] = useState(false)
    const [creating, setCreating] = useState(false)
    const [draftCreated, setDraftCreated] = useState(!!email.gmail_draft_id)
    const [gmailDraftId, setGmailDraftId] = useState(email.gmail_draft_id || null)
    const [recreating, setRecreating] = useState(false)
    const [markingSent, setMarkingSent] = useState(false)
    const [showMarkSentModal, setShowMarkSentModal] = useState(false)
    const [showUndoConfirm, setShowUndoConfirm] = useState(false)
    const [undoing, setUndoing] = useState(false)
    const [draftDeleted, setDraftDeleted] = useState(false)
    const [repGmailNotConnected, setRepGmailNotConnected] = useState(false)

    useEffect(() => {
      if (!email.gmail_draft_id || email.status === 'sent') return
      const interval = setInterval(async () => {
        if (email.status === 'sent') {
          clearInterval(interval)
          return
        }
        const res = await authFetch(`/api/deals/${deal.id}/emails/${email.email_type}/mark-sent`, { method: 'POST' })
        const data = await res.json()
        if (data.sent) {
          clearInterval(interval)
          window.location.reload()
        }
      }, 30000)
      return () => clearInterval(interval)
    }, [email.gmail_draft_id, email.status])

    useEffect(() => {
      if (!email.gmail_draft_id || email.status === 'sent') return
      authFetch(`/api/deals/${deal.id}/emails/${email.email_type}/check-draft`)
        .then(r => r.json())
        .then(d => {
          if (d.repGmailNotConnected) { setRepGmailNotConnected(true); return }
          if (d.deleted) setDraftDeleted(true)
        })
        .catch(() => {})
    }, [email.gmail_draft_id, email.status])

    async function createGmailDraft() {
      if (draftCreated && !draftDeleted && gmailDraftId) {
        window.open(`https://mail.google.com/mail/#drafts/${gmailDraftId}`, '_blank')
        return
      }
      setCreating(true)
      try {
        const res = await authFetch(`/api/deals/${deal.id}/emails/${email.email_type}/gmail-draft`, {
          method: 'POST'
        })
        const data = await res.json()
        if (data.success) {
          setDraftCreated(true)
          setGmailDraftId(data.draftId)
          if (data.draftId) {
            window.open(`https://mail.google.com/mail/#drafts/${data.draftId}`, '_blank')
          }
        } else alert(data.error || 'Failed to create Gmail draft')
      } finally { setCreating(false) }
    }

    async function recreateDraft() {
      setRecreating(true)
      try {
        await authFetch(`/api/deals/${deal.id}/emails/${email.email_type}/draft`, { method: 'DELETE' })
        setDraftCreated(false)
        setGmailDraftId(null)
      } finally { setRecreating(false) }
    }

    const handleMarkSent = async () => {
      setMarkingSent(true)
      try {
        const res = await authFetch(
          `/api/deals/${deal.id}/${email.email_type}/mark-sent`,
          { method: 'POST' }
        )
        const data = await res.json()
        if (data.success) {
          window.location.reload()
        } else {
          alert('Failed: ' + (data.error || 'Unknown error'))
        }
      } catch (e) {
        alert('Failed: ' + e.message)
      } finally {
        setMarkingSent(false)
        setShowMarkSentModal(false)
      }
    }

    return (
      <div style={{
        border: '1.5px solid var(--line)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        background: email.status === 'sent' ? '#F0FFF4' : 'var(--surface)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--line)',
          background: email.status === 'sent' ? '#E6F9ED' : 'var(--surface-2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: email.status === 'sent' ? '#2F9E44' : '#EEF2FF',
              color: email.status === 'sent' ? 'white' : '#3B5BDB',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>
              {email.email_type === 'nudge' ? '★' : email.email_type.replace('day', 'D')}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
                {typeLabel[email.email_type] || email.email_type}
              </div>
              {email.scheduled_for && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  Scheduled: {formatDate(email.scheduled_for)}
                </div>
              )}
            </div>
          </div>
          <div>
            {email.status === 'sent' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 700,
                background: '#2F9E44', color: 'white'
              }}>✓ Sent</span>
            ) : draftCreated ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: '#EEF2FF', color: '#3B5BDB'
              }}>Draft ready</span>
            ) : (
              <span style={{
                padding: '4px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: 'var(--surface-2)', color: 'var(--ink-3)'
              }}>Not started</span>
            )}
          </div>
        </div>

        {/* Subject + Body */}
        {(email.subject || email.body) && (
          <div style={{ padding: '12px 16px' }}>
            {email.subject && (
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--ink-2)', marginBottom: 6
              }}>
                {email.subject}
              </div>
            )}
            {email.body && (
              <div style={{
                fontSize: 12, color: 'var(--ink-3)',
                lineHeight: 1.6,
                maxHeight: expanded ? 'none' : 72,
                overflow: 'hidden'
              }}
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            )}
            {email.body && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{
                  marginTop: 6, fontSize: 11,
                  color: 'var(--ink-3)', background: 'none',
                  border: 'none', cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit'
                }}
              >
                {expanded ? '▲ Collapse' : '▼ Expand'}
              </button>
            )}
          </div>
        )}

        {/* Action area */}
        {email.status !== 'sent' && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface)',
            display: 'flex', flexDirection: 'column', gap: 10
          }}>
            {repGmailNotConnected ? (
              <div style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 12, color: 'var(--ink-3)',
                textAlign: 'center'
              }}>
                ℹ Deal owner's Gmail is not connected to Sales Assist
              </div>
            ) : !draftCreated ? (
              email.email_type === 'day2' ? (
                <button
                  onClick={handleMarkSent}
                  disabled={markingSent}
                  style={{
                    padding: '10px 16px', borderRadius: 8,
                    border: 'none', background: '#3B5BDB',
                    color: 'white', fontSize: 13, fontWeight: 600,
                    cursor: markingSent ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: markingSent ? 0.7 : 1
                  }}
                >
                  {markingSent ? 'Marking...' : '✓ Mark Proposal Sent'}
                </button>
              ) : (
                <button
                  onClick={createGmailDraft}
                  disabled={creating}
                  style={{
                    padding: '10px 16px', borderRadius: 8,
                    border: 'none', background: '#3B5BDB',
                    color: 'white', fontSize: 13, fontWeight: 600,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: creating ? 0.7 : 1
                  }}
                >
                  {creating ? 'Creating draft...' : '✉ Create Gmail Draft'}
                </button>
              )
            ) : draftDeleted ? (
              <div style={{
                padding: '10px 12px', background: '#FFF7ED',
                borderRadius: 8, border: '1px solid #C2410C',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12, color: '#C2410C' }}>
                  ⚠ Draft was deleted from Gmail
                </span>
                <button
                  onClick={createGmailDraft}
                  style={{
                    padding: '6px 12px', borderRadius: 6,
                    border: '1.5px solid #C2410C',
                    background: 'transparent',
                    fontSize: 12, color: '#C2410C',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
                  }}
                >
                  Recreate Draft →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {email.email_type === 'day2' ? (
                  <button
                    onClick={handleMarkSent}
                    disabled={markingSent}
                    style={{
                      padding: '10px 16px', borderRadius: 8,
                      border: 'none', background: '#3B5BDB',
                      color: 'white', fontSize: 13, fontWeight: 600,
                      cursor: markingSent ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', opacity: markingSent ? 0.7 : 1
                    }}
                  >
                    {markingSent ? 'Marking...' : '✓ Mark Proposal Sent'}
                  </button>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href={`https://mail.google.com/mail/#drafts/${gmailDraftId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flex: 1, padding: '10px 16px',
                          borderRadius: 8, textAlign: 'center',
                          border: '1.5px solid #3B5BDB',
                          background: '#EEF2FF',
                          fontSize: 13, fontWeight: 600,
                          color: '#3B5BDB', textDecoration: 'none',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 6
                        }}
                      >
                        ↗ Open in Gmail
                      </a>
                      <button
                        onClick={() => setShowMarkSentModal(true)}
                        style={{
                          flex: 1, padding: '10px 16px',
                          borderRadius: 8,
                          border: '1.5px solid #2F9E44',
                          background: '#F0FFF4',
                          fontSize: 13, fontWeight: 600,
                          color: '#2F9E44', cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        ✓ Mark as Sent
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
                      💡 Open in Gmail to send — avoid using Gmail Drafts folder directly
                    </div>
                    <button
                      onClick={recreateDraft}
                      disabled={recreating}
                      style={{
                        padding: '6px 12px', borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        fontSize: 11, color: 'var(--ink-3)',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                    >
                      {recreating ? 'Creating...' : '↻ Recreate Draft'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sent footer */}
        {email.status === 'sent' && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid #C3E6CB',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: 12, color: '#2F9E44', fontWeight: 500 }}>
              ✓ Sent on {formatDate(email.sent_at)}
            </span>
            {isDev && (
              <button
                onClick={() => setShowUndoConfirm(true)}
                style={{
                  fontSize: 11, color: '#E5484D',
                  background: 'transparent',
                  border: '1px solid #E5484D',
                  borderRadius: 6, padding: '3px 8px',
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                Undo (dev)
              </button>
            )}
          </div>
        )}
        {showMarkSentModal && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2000
          }} onClick={() => setShowMarkSentModal(false)}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: 12, padding: '28px 32px',
              maxWidth: 400, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
            }} onClick={e => e.stopPropagation()}>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--ink-1)', marginBottom: 8
              }}>
                Mark as Sent
              </div>
              <div style={{
                fontSize: 13, color: 'var(--ink-3)',
                marginBottom: 24, lineHeight: 1.6
              }}>
                Confirm that you have sent the{' '}
                <strong>{email.email_type}</strong> email
                to the prospect from Gmail.
                <br/><br/>
                Only mark as sent if you have actually
                sent the email.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowMarkSentModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1.5px solid var(--line)',
                    background: 'transparent', fontSize: 13,
                    cursor: 'pointer', color: 'var(--ink-2)',
                    fontFamily: 'inherit'
                  }}>Cancel</button>
                <button
                  disabled={markingSent}
                  onClick={handleMarkSent}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: 'none', background: '#2F9E44',
                    fontSize: 13, fontWeight: 700,
                    cursor: markingSent ? 'not-allowed' : 'pointer',
                    color: 'white', fontFamily: 'inherit',
                    opacity: markingSent ? 0.6 : 1
                  }}>
                  {markingSent ? 'Marking...' : '✓ Yes, I sent this email'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showUndoConfirm && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2000
          }} onClick={() => setShowUndoConfirm(false)}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: 12, padding: '28px 32px',
              maxWidth: 400, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
            }} onClick={e => e.stopPropagation()}>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--ink-1)', marginBottom: 8
              }}>
                Undo Sent — Are you sure?
              </div>
              <div style={{
                fontSize: 13, color: 'var(--ink-3)',
                marginBottom: 24, lineHeight: 1.6
              }}>
                This will reset the {email.email_type} email
                back to draft state and clear all Gmail
                draft data. The prospect may have already
                received this email.
                <br/><br/>
                <strong>This action cannot be undone.</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowUndoConfirm(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1.5px solid var(--line)',
                    background: 'transparent', fontSize: 13,
                    cursor: 'pointer', color: 'var(--ink-2)',
                    fontFamily: 'inherit'
                  }}>Cancel</button>
                <button
                  disabled={undoing}
                  onClick={async () => {
                    setUndoing(true)
                    try {
                      const res = await authFetch(
                        `/api/deals/${deal.id}/emails/${email.email_type}/undo-sent`,
                        { method: 'POST' }
                      )
                      const data = await res.json()
                      if (data.success) {
                        setShowUndoConfirm(false)
                        window.location.reload()
                      } else {
                        alert('Failed: ' + data.error)
                      }
                    } catch (e) {
                      alert('Failed: ' + e.message)
                    } finally {
                      setUndoing(false)
                    }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: 'none', background: '#E5484D',
                    fontSize: 13, fontWeight: 700,
                    cursor: undoing ? 'not-allowed' : 'pointer',
                    color: 'white', fontFamily: 'inherit',
                    opacity: undoing ? 0.6 : 1
                  }}>
                  {undoing ? 'Undoing...' : 'Yes, Undo Sent'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const ORDER = ['day1', 'day2', 'day3', 'day4', 'nudge']

  const EMAIL_LABELS = {
    day1: 'Day 1 · Personalised Recap',
    day2: 'Day 2 · Pricing Proposal',
    day3: 'Day 3 · ROI Value',
    day4: 'Day 4 · Objection Handling',
    nudge: 'Mtg +7 · Nudge',
  }

  const isEmailSent = (type) => {
    const email = emails.find(e => e.email_type === type)
    return email?.status === 'sent'
  }

  const isLocked = (type) => {
    if (type === 'day1') return false
    if (type === 'day2') return !isEmailSent('day1')
    if (type === 'day3') return !isEmailSent('day1')
    if (type === 'day4') return !isEmailSent('day3')
    if (type === 'nudge') return !isEmailSent('day4')
    return false
  }

  function Day2Placeholder() {
    const { authFetch } = useAuth()
    const [marking, setMarking] = useState(false)

    async function markSent() {
      setMarking(true)
      try {
        await authFetch(`/api/deals/${deal.id}/day2/mark-sent`, { method: 'POST' })
        window.location.reload()
      } catch {
        alert('Failed to mark as sent. Please try again.')
        setMarking(false)
      }
    }

    return (
      <div className="card card-pad" style={{ borderLeft: '3px solid var(--line-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <b style={{ fontSize: 13.5 }}>{typeLabel['day2']}</b>
          <span className="pill pill-neutral">manual</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
          Send your pricing proposal to the prospect — mark it here once sent
        </div>
        <button className="btn btn-sm btn-primary" onClick={markSent} disabled={marking}>
          {marking ? 'Marking…' : 'Mark Proposal Sent'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ORDER.map(type => {
        const emailData = emails.find(e => e.email_type === type)
        if (type === 'day2') {
          if (!emailData) return <Day2Placeholder key="day2" />
          if (emailData.status === 'sent') {
            return (
              <div key="day2" className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <b style={{ fontSize: 13.5 }}>{typeLabel['day2']}</b>
                  <span className="pill pill-ok">sent</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 4 }}>
                  ✓ Sent{emailData.sent_at ? ` on ${formatDate(emailData.sent_at)}` : ''}
                </div>
              </div>
            )
          }
          return <EmailCard key={emailData.id} email={emailData} />
        }
        if (isLocked(type)) {
          return (
            <div key={type} style={{
              border: '1.5px solid var(--line)',
              borderRadius: 12,
              padding: '16px',
              marginBottom: 0,
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: 0.6
            }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'var(--line)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: 'var(--ink-3)', flexShrink: 0
              }}>
                {type === 'nudge' ? '★' : type.replace('day', 'D')}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
                  {EMAIL_LABELS[type] || type}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  🔒 Send {
                    type === 'day2' ? 'Day 1' :
                    type === 'day3' ? 'Day 1' :
                    type === 'day4' ? 'Day 3' :
                    type === 'nudge' ? 'Day 4' : 'previous'
                  } email first to unlock
                </div>
              </div>
            </div>
          )
        }
        if (!emailData) return null
        return <EmailCard key={emailData.id} email={emailData} />
      })}
    </div>
  )
}

function scoreField(field, value, demoInfo) {
  const v = value || ''
  switch(field) {
    case 'painClarity':
      return v === 'clear' ? 3 : v === 'vague' ? 1 : 0
    case 'dmPresent':
      return v === 'yes' ? 3 : v === 'champion' ? 1 : 0
    case 'budgetSignal':
      return v === 'confirmed' ? 2 : v === 'implied' ? 1 : 0
    case 'purchaseTimeline':
      return v === 'month' ? 3 : v === 'quarter' ? 2 :
             v === '6m' ? 1 : 0
    case 'engagementLevel':
      return v === 'high' ? 2 : v === 'medium' ? 1 : 0
    case 'championStrength':
      return v === 'strong' ? 2 : v === 'weak' ? 1 : 0
    case 'nextStep':
      return v === 'booked' ? 2 : v === 'vague' ? 1 : 0
    case 'f2f': {
      const fmt = demoInfo?.demoFormat || ''
      const loc = demoInfo?.meetingLocation || ''
      if (fmt === 'inperson' && loc === 'warehouse') return 3
      if (fmt === 'inperson') return 2
      return 0
    }
    default:
      return 0
  }
}

function CoachTab({ deal }) {
  const d = deal.demoInfo
  const gradeColor = { A: 'ok', B: 'info', C: 'warn', D: 'danger' }

  const scoreItems = [
    { label: 'Pain Clarity', score: scoreField('painClarity', d?.painClarity ?? deal.demoInfo?.painClarity), max: 3 },
    { label: 'DM Present', score: scoreField('dmPresent', d?.dmPresent ?? deal.demoInfo?.dmPresent), max: 3 },
    { label: 'Budget Signal', score: scoreField('budgetSignal', d?.budgetSignal ?? deal.demoInfo?.budgetSignal), max: 2 },
    { label: 'Purchase Timeline', score: scoreField('purchaseTimeline', d?.purchaseTimeline ?? deal.demoInfo?.purchaseTimeline), max: 3 },
    { label: 'Engagement', score: scoreField('engagementLevel', d?.engagementLevel ?? deal.demoInfo?.engagementLevel), max: 2 },
    { label: 'Champion Strength', score: scoreField('championStrength', d?.championStrength ?? deal.demoInfo?.championStrength), max: 2 },
    { label: 'Next Step', score: scoreField('nextStep', d?.nextStep ?? deal.demoInfo?.nextStep), max: 2 },
    { label: 'In-person Meeting', score: scoreField('f2f', '', d ?? deal.demoInfo), max: 3 },
  ]
  const breakdown = [
    scoreField('painClarity', d?.painClarity ?? deal.demoInfo?.painClarity),
    scoreField('dmPresent', d?.dmPresent ?? deal.demoInfo?.dmPresent),
    scoreField('budgetSignal', d?.budgetSignal ?? deal.demoInfo?.budgetSignal),
    scoreField('purchaseTimeline', d?.purchaseTimeline ?? deal.demoInfo?.purchaseTimeline),
    scoreField('engagementLevel', d?.engagementLevel ?? deal.demoInfo?.engagementLevel),
    scoreField('championStrength', d?.championStrength ?? deal.demoInfo?.championStrength),
    scoreField('nextStep', d?.nextStep ?? deal.demoInfo?.nextStep),
    scoreField('f2f', '', d ?? deal.demoInfo),
  ]
  const computedScore = breakdown.reduce((a, b) => a + b, 0)
  const totalScore = computedScore
  const grade = d?.grade || deal.grade || 'D'

  if (!deal.saLogged) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        Log the demo to see coach recommendations.
      </div>
    )
  }

  let parsedAnalysis = null
  try {
    const raw = d?.aiAnalysis || deal.aiAnalysis || ''
    if (raw) parsedAnalysis = typeof raw === 'string'
      ? JSON.parse(raw) : raw
  } catch(e) {
    parsedAnalysis = null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Grade + Score tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card card-pad" style={{ borderLeft: `3px solid var(--${gradeColor[grade] || 'neutral'})` }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Deal Grade</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span className={`kc-grade kc-grade-${grade.toLowerCase()}`} style={{ width: 32, height: 32, fontSize: 15 }}>{grade}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {grade === 'A' ? '55–70% close probability' : grade === 'B' ? '30–50% close probability' : grade === 'C' ? '10–25% close probability' : '<10% close probability'}
            </span>
          </div>
        </div>
        <div className="card card-pad">
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Score</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>
            {totalScore}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}> / 22</span>
          </div>
        </div>
      </div>

      {/* Score breakdown - graphical */}
      <div className="card">
        <div className="ws-side-head"><h4>Score Breakdown</h4></div>
        <div style={{ padding: '8px 16px 16px' }}>
          {scoreItems.map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{item.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: item.score === 0 ? 'var(--ink-3)' : 'var(--ink)' }}>
                  {item.score}/{item.max}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(item.score / item.max) * 100}%`,
                  background: item.score === item.max ? 'var(--ok)' : item.score > 0 ? 'var(--brand)' : 'var(--surface-2)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Coach Recommendations */}
      <div className="card card-pad">
        <div className="ws-side-head" style={{ marginBottom: 12 }}><h4>Coach Recommendations</h4></div>
        {parsedAnalysis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {parsedAnalysis.strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700,
                  color: 'var(--teal)', letterSpacing: '0.08em',
                  marginBottom: 8 }}>STRENGTHS</div>
                {parsedAnalysis.strengths.map((s, i) => (
                  <div key={i} style={{ fontSize: 13,
                    color: 'var(--ink-2)', lineHeight: 1.6,
                    padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    ✓ {s}
                  </div>
                ))}
              </div>
            )}
            {parsedAnalysis.risks?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700,
                  color: 'var(--accent)', letterSpacing: '0.08em',
                  marginBottom: 8 }}>RISKS</div>
                {parsedAnalysis.risks.map((r, i) => (
                  <div key={i} style={{ fontSize: 13,
                    color: 'var(--ink-2)', lineHeight: 1.6,
                    padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    ⚠ {r}
                  </div>
                ))}
              </div>
            )}
            {parsedAnalysis.nextMeeting?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700,
                  color: 'var(--info)', letterSpacing: '0.08em',
                  marginBottom: 8 }}>NEXT MEETING AGENDA</div>
                {parsedAnalysis.nextMeeting.map((n, i) => (
                  <div key={i} style={{ fontSize: 13,
                    color: 'var(--ink-2)', lineHeight: 1.6,
                    padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    → {n}
                  </div>
                ))}
              </div>
            )}
            {parsedAnalysis.repAdvice?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700,
                  color: 'var(--ink-1)', letterSpacing: '0.08em',
                  marginBottom: 8 }}>REP ADVICE</div>
                {parsedAnalysis.repAdvice.map((a, i) => (
                  <div key={i} style={{ fontSize: 13,
                    color: 'var(--ink-2)', lineHeight: 1.6,
                    padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    • {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            No coaching analysis available. Log the demo to generate.
          </div>
        )}
      </div>
    </div>
  )
}

function NotesTab({ dealId, deal }) {
  const { authFetch } = useAuth()
  const [d1Notes, setD1Notes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch(`/api/deals/${dealId}/notes`)
      .then(r => r.json())
      .then(d => setD1Notes(d.notes || []))
      .catch(err => console.error('Notes fetch failed:', err))
      .finally(() => setLoading(false))
  }, [dealId])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${dealId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: newNote })
      })
      const data = await res.json()
      if (data.success) {
        setD1Notes(prev => [data.note, ...prev])
        setNewNote('')
      }
    } finally { setSaving(false) }
  }

  function normalizeContent(str) {
    return (str || '')
      .toLowerCase()
      .replace(/^sales assist note:?\s*/i, '')
      .replace(/^\[note\]\s*/i, '')
      .trim()
      .slice(0, 80)
  }
  const d1Contents = new Set(d1Notes.map(n => normalizeContent(n.content)))
  const d1Times = new Set(d1Notes.map(n => (n.createdAt || '').slice(0, 16)))
  const zohoNotes = (deal?.notes || []).map(n => ({
    id: n.id,
    content: n.description,
    authorName: n.createdBy,
    date: n.date,
    source: 'zoho',
  }))
  const dedupedZohoNotes = zohoNotes.filter(n => {
    const minute = (n.date || '').slice(0, 16)
    const contentMatch = d1Contents.has(normalizeContent(n.content))
    return !d1Times.has(minute) && !contentMatch
  })
  const allNotes = [
    ...(d1Notes || []).map(n => ({
      id: n.id,
      content: n.content,
      authorName: n.authorName,
      date: n.createdAt,
      source: 'salesassist',
    })),
    ...dedupedZohoNotes,
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  if (loading) return <div className="card card-pad" style={{ color: 'var(--ink-3)' }}>Loading notes…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card card-pad">
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Add a note…"
          style={{ width: '100%', minHeight: 80, border: 'none', outline: 'none', resize: 'vertical', fontSize: 13, fontFamily: 'inherit', background: 'transparent' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={addNote} disabled={saving || !newNote.trim()}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>
      {allNotes.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No notes yet.</div>
      ) : (
        allNotes.map((note, i) => (
          <div key={note.id || i} className="card card-pad">
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{note.content}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {note.authorName && `${note.authorName} · `}{formatDate(note.date)}
              </span>
              {note.source === 'salesassist' ? (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--ok-bg, #e6f4ea)', color: 'var(--ok, #1a7f37)', letterSpacing: '0.04em' }}>
                  Sales Assist
                </span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--info-bg, #e8f0fe)', color: 'var(--info, #1a56db)', letterSpacing: '0.04em' }}>
                  Zoho CRM
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ContactTab({ deal }) {
  const { authFetch } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: deal.contactName || '',
    email: deal.contactEmail || '',
    phone: deal.contactPhone || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validateContact = () => {
    if (!form.email || !form.email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }
    if (!form.phone || form.phone.replace(/[\s\-\+\(\)]/g, '').length < 10) {
      setError('Please enter a valid phone number (minimum 10 digits)')
      return false
    }
    return true
  }

  const inputStyle = {
    width: '100%', padding: '6px 10px',
    border: '1.5px solid var(--line)',
    borderRadius: 6, fontSize: 13,
    fontFamily: 'inherit', color: 'var(--ink-1)',
    background: 'var(--surface)',
  }

  return (
    <div className="card">
      <div className="ws-side-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>Contact Details</h4>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{
            padding: '5px 12px', borderRadius: 6,
            border: '1.5px solid var(--line)',
            background: 'transparent', fontSize: 12,
            cursor: 'pointer', color: 'var(--ink-2)',
            fontFamily: 'inherit',
          }}>
            ✏ Edit
          </button>
        )}
      </div>
      <div className="ws-side-body">
        <div className="ws-side-row">
          <span className="k">Name</span>
          {editing ? (
            <input value={form.name} onChange={e => { setError(''); setForm(f => ({ ...f, name: e.target.value })) }} style={inputStyle} />
          ) : (
            <span className="v">{deal.demoInfo?.prospectName || deal.contactName || '—'}</span>
          )}
        </div>
        <div className="ws-side-row">
          <span className="k">Email</span>
          {editing ? (
            <input value={form.email} onChange={e => { setError(''); setForm(f => ({ ...f, email: e.target.value })) }} style={inputStyle} />
          ) : (
            <span className="v">{deal.contactEmail || deal.demoInfo?.prospectEmail || '—'}</span>
          )}
        </div>
        <div className="ws-side-row">
          <span className="k">Phone</span>
          {editing ? (
            <input value={form.phone} onChange={e => { setError(''); setForm(f => ({ ...f, phone: e.target.value })) }} style={inputStyle} />
          ) : (
            <span className="v">{deal.contactPhone || '—'}</span>
          )}
        </div>
        <div className="ws-side-row">
          <span className="k">Company</span>
          <span className="v">{deal.accountName || deal.brandName || '—'}</span>
        </div>
        <div className="ws-side-row">
          <span className="k">Rep Owner</span>
          <span className="v">{deal.repName || '—'}</span>
        </div>
        {editing && (
          <div style={{ marginTop: 16 }}>
            {error && (
              <div style={{
                fontSize: 12, color: '#E5484D',
                marginBottom: 8, padding: '6px 10px',
                background: '#FFF0F0', borderRadius: 6,
                border: '1px solid #E5484D',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                if (!validateContact()) return
                setSaving(true)
                try {
                  const res = await authFetch(`/api/deals/${deal.id}/contact`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                  })
                  const data = await res.json()
                  if (data.success) { setEditing(false); window.location.reload() }
                  else alert('Save failed: ' + (data.error || 'Unknown error'))
                } catch (e) {
                  alert('Failed to save: ' + e.message)
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: 'none', background: '#3B5BDB',
                color: 'white', fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setForm({ name: deal.contactName || '', email: deal.contactEmail || '', phone: deal.contactPhone || '' })
              }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1.5px solid var(--line)',
                background: 'transparent', fontSize: 13,
                cursor: 'pointer', color: 'var(--ink-2)',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal components ────────────────────────────────────────

function MarkLostModal({ deal, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason.trim()) return alert('Please enter a reason')
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${deal.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'Lost/Dropped', reason })
      })
      const data = await res.json()
      console.log('Mark lost response:', data)
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to mark lost')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>Mark as Lost</h3><button className="btn-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Loss Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input" style={{ width: '100%' }}>
              <option value="">Select a reason...</option>
              <option value="B2B Dealings only">B2B Dealings only</option>
              <option value="Business model Misaligned">Business model Misaligned</option>
              <option value="Chose competitor">Chose competitor</option>
              <option value="Could not connect/Couldn't reach decision maker">Could not connect/Couldn't reach decision maker</option>
              <option value="Duplicate opportunity">Duplicate opportunity</option>
              <option value="Duplicate or Existing account">Duplicate or Existing account</option>
              <option value="Franchise Requirement">Franchise Requirement</option>
              <option value="No business/requirement">No business/requirement</option>
              <option value="Not shipping yet / too early">Not shipping yet / too early</option>
              <option value="Others (Mandatory Notes Required)">Others (Mandatory Notes Required)</option>
              <option value="Out of serviceable region">Out of serviceable region</option>
              <option value="Pricing — too expensive">Pricing — too expensive</option>
              <option value="Project cancelled">Project cancelled</option>
              <option value="Renewed with existing vendor">Renewed with existing vendor</option>
              <option value="Timeline misalignment">Timeline misalignment</option>
            </select>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={saving || !reason}>
            {saving ? 'Saving…' : 'Mark Lost'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MarkOnHoldModal({ deal, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason.trim()) return alert('Please enter a reason')
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${deal.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'On Hold', reason })
      })
      const data = await res.json()
      console.log('Mark on hold response:', data)
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to mark on hold')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>Mark as On Hold</h3><button className="btn-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Hold Reason *</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter reason for hold…"
              className="input"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !reason}>
            {saving ? 'Saving…' : 'Mark On Hold'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DemoFormModal({ deal, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    zohoId: deal.id,
    demoDate: today,
    solutionInterest: '',
    orderVolume: deal.orderVolume || '',
    brandType: '',
    painClarity: '',
    dmPresent: '',
    budgetSignal: '',
    purchaseTimeline: '',
    engagementLevel: '',
    championStrength: '',
    nextStep: '',
    demoFormat: 'virtual',
    pricingRaisedInDemo: 'no',
    followupMeetingDate: '',
    shippingPains: [],
    warehousingPains: [],
    oms: '',
    shoppingCart: '',
    shippingSetup: '',
    warehousingSetup: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    setSaving(true)
    try {
      const res = await authFetch('/api/deals/sync', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to log demo')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560, width: '90vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Log Demo · Step {step}/3</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Demo Date *
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, marginLeft: 6 }}>
                    ⚠ Please ensure this is the actual date of your meeting
                  </span>
                </label>
                <input
                  type="date"
                  value={form.demoDate}
                  max={today}
                  onChange={e => set('demoDate', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Solution Interest *</label>
                <select value={form.solutionInterest} onChange={e => set('solutionInterest', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="shipping">Shipping</option>
                  <option value="warehousing">Warehousing</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Order Volume</label>
                <select value={form.orderVolume} onChange={e => set('orderVolume', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option>New store / not shipping orders yet</option>
                  <option>1 - 500 orders/month</option>
                  <option>501 - 3,000 orders/month</option>
                  <option>3,001 - 10,000 orders/month</option>
                  <option>More than 10,000 orders/month</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Demo Format</label>
                <select value={form.demoFormat} onChange={e => set('demoFormat', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="virtual">Virtual</option>
                  <option value="inperson">In-person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Pain Clarity</label>
                <select value={form.painClarity} onChange={e => set('painClarity', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="3">Clear (3)</option>
                  <option value="1">Vague (1)</option>
                  <option value="0">None (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Decision Maker Present</label>
                <select value={form.dmPresent} onChange={e => set('dmPresent', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="3">Yes (3)</option>
                  <option value="1">Champion (1)</option>
                  <option value="0">Unknown (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Budget Signal</label>
                <select value={form.budgetSignal} onChange={e => set('budgetSignal', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="2">Confirmed (2)</option>
                  <option value="1">Implied (1)</option>
                  <option value="0">None (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Purchase Timeline</label>
                <select value={form.purchaseTimeline} onChange={e => set('purchaseTimeline', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="3">This month (3)</option>
                  <option value="2">This quarter (2)</option>
                  <option value="1">6 months (1)</option>
                  <option value="0">Unknown (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Engagement Level</label>
                <select value={form.engagementLevel} onChange={e => set('engagementLevel', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="2">High (2)</option>
                  <option value="1">Medium (1)</option>
                  <option value="0">Low (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Pricing Raised in Demo?</label>
                <select value={form.pricingRaisedInDemo} onChange={e => set('pricingRaisedInDemo', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Next Step</label>
                <select value={form.nextStep} onChange={e => set('nextStep', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="2">Booked (2)</option>
                  <option value="1">Vague (1)</option>
                  <option value="0">None (0)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Follow-up Meeting Date</label>
                <input
                  type="date"
                  value={form.followupMeetingDate}
                  onChange={e => set('followupMeetingDate', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>OMS Used</label>
                <input value={form.oms} onChange={e => set('oms', e.target.value)} placeholder="e.g. Unicommerce" className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Shopping Cart</label>
                <input value={form.shoppingCart} onChange={e => set('shoppingCart', e.target.value)} placeholder="e.g. Shopify" className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Brand Type</label>
                <select value={form.brandType} onChange={e => set('brandType', e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  <option value="small">Small</option>
                  <option value="scaling">Scaling</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          )}

        </div>
        <div className="modal-foot">
          {step > 1 && <button className="btn" onClick={() => setStep(s => s - 1)}>← Back</button>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            {step < 3
              ? <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>Next →</button>
              : <button className="btn btn-primary" onClick={submit} disabled={saving}>
                  {saving ? 'Logging…' : 'Log Demo ✓'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

const CALL_PURPOSE_OPTIONS = [
  'None', 'Intro/first contact', 'Discovery call', 'Request for demo',
  'Follow-up Call', 'Pricing Discussion', 'Proposal Review',
  'Negotiations', 'Contract Review/Signature',
]

const CALL_RESULT_OPTIONS = [
  'None', 'Connected', 'No answer/busy', 'Requested Callback',
  'Requested more info', 'Not interested', 'No business/brand',
]

function MeetingModal({ dealId, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', venue: 'Online', from: '', to: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.title.trim() || !form.from || !form.to) return alert('Title, From and To are required')
    if (form.to <= form.from) return alert('End time must be after start time')
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${dealId}/meeting`, {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to create meeting')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>Log Meeting</h3><button className="btn-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Meeting title" className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Meeting Venue</label>
              <select value={form.venue} onChange={e => set('venue', e.target.value)} className="input" style={{ width: '100%' }}>
                <option value="In-office">In-office</option>
                <option value="Client location">Client location</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>From *</label>
              <input type="datetime-local" value={form.from} onChange={e => set('from', e.target.value)} min={new Date().toISOString().slice(0, 16)} className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>To *</label>
              <input type="datetime-local" value={form.to} onChange={e => set('to', e.target.value)} className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" className="input" style={{ width: '100%', minHeight: 70, resize: 'vertical' }} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Log Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CallModal({ dealId, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [callMode, setCallMode] = useState('log')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    callPurpose: 'None',
    callAgenda: '',
    callResult: 'None',
    callTiming: '',
    description: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.callTiming) return alert('Call timing is required')
    setSaving(true)
    try {
      const endpoint = callMode === 'log' ? 'log-call' : 'schedule-call'
      const res = await authFetch(`/api/deals/${dealId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to log call')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>Log Call</h3><button className="btn-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              className={`btn btn-sm${callMode === 'log' ? ' btn-primary' : ''}`}
              onClick={() => setCallMode('log')}
            >Log a Call</button>
            <button
              className={`btn btn-sm${callMode === 'schedule' ? ' btn-primary' : ''}`}
              onClick={() => setCallMode('schedule')}
            >Schedule a Call</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Call Purpose *</label>
              <select value={form.callPurpose} onChange={e => set('callPurpose', e.target.value)} className="input" style={{ width: '100%' }}>
                {CALL_PURPOSE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Call Agenda</label>
              <input value={form.callAgenda} onChange={e => set('callAgenda', e.target.value)} placeholder="Agenda…" className="input" style={{ width: '100%' }} />
            </div>
            {callMode === 'log' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Call Result *</label>
                <select value={form.callResult} onChange={e => set('callResult', e.target.value)} className="input" style={{ width: '100%' }}>
                  {CALL_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                {callMode === 'log' ? 'Call Timing *' : 'Scheduled For *'}
              </label>
              <input type="datetime-local" value={form.callTiming} onChange={e => set('callTiming', e.target.value)}
                {...(callMode === 'log' ? { max: new Date().toISOString().slice(0, 16) } : { min: new Date().toISOString().slice(0, 16) })}
                className="input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" className="input" style={{ width: '100%', minHeight: 70, resize: 'vertical' }} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : callMode === 'log' ? 'Log Call' : 'Schedule Call'}
          </button>
        </div>
      </div>
    </div>
  )
}

function F2FModal({ deal, onClose }) {
  const { authFetch } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  async function submit() {
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${deal.id}/f2f`, {
        method: 'POST',
        body: JSON.stringify({ date, notes })
      })
      const data = await res.json()
      if (data.success) onClose()
      else alert(data.error || 'Failed to log F2F')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3>Log F2F Meeting</h3><button className="btn-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Meeting Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Meeting notes…" className="input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Log F2F'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReassignDealModal({ deal, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false))
  }, [])

  const options = users.filter(u => u.email !== deal.repEmail)
  const selected = options.find(u => u.email === selectedEmail)

  async function submit() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/deals/${deal.id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ newOwnerEmail: selected.email, newOwnerName: selected.name })
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to reassign deal')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Reassign Deal</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Assign to
          </label>
          {loadingUsers ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading team members…</div>
          ) : (
            <select
              value={selectedEmail}
              onChange={e => setSelectedEmail(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            >
              <option value="">Select a team member…</option>
              {options.map(u => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !selectedEmail}>
            {saving ? 'Reassigning…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}
