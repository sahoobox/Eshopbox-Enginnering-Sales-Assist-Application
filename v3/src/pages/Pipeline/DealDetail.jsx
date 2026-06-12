import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeal } from '../../hooks/useDeals'
import { useAuth } from '../../context/AuthContext'
import { Loading, Empty, Pill } from '../../components/ui'
import { SME_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo } from '../../lib/stageConfig'
import { TaskModal } from '../Tasks'

export default function DealDetail({ dealId }) {
  const navigate = useNavigate()
  const { deal, emails, loading, error } = useDeal(dealId)
  const [tab, setTab] = useState('activity')
  const [showDemoForm, setShowDemoForm] = useState(false)
  const [showF2FForm, setShowF2FForm] = useState(false)
  const [showMarkLost, setShowMarkLost] = useState(false)
  const [showMarkOnHold, setShowMarkOnHold] = useState(false)

  if (loading) return <div className="main"><Loading text="Loading deal…" /></div>
  if (error || !deal) return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/pipeline')} style={{ marginBottom: 10 }}>← Back to pipeline</button>
      <div className="callout danger">{error || 'Deal not found'}</div>
    </div>
  )

  const stages = SME_STAGES
  const currentIdx = stages.indexOf(deal.stage)
  const isTerminal = ['Won/Payment Received', 'Lost/Dropped', 'On Hold'].includes(deal.stage)
  const flagLevel = deal.attentionLevel || 'ok'
  const gradeColor = { A: 'ok', B: 'info', C: 'warn', D: 'danger' }[deal.grade] || 'neutral'

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
                <button className="btn btn-sm btn-primary" onClick={() => setShowDemoForm(true)}>+ Log Demo</button>
              )}
              {deal.saLogged && (
                <button className="btn btn-sm" onClick={() => setShowF2FForm(true)}>+ Log F2F</button>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => setShowMarkLost(true)}>Mark Lost</button>
              <button className="btn btn-sm" onClick={() => setShowMarkOnHold(true)}>Mark on Hold</button>
            </>
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
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Pipeline · {stages.length} stages</div>
          </div>
        </div>
        <div className="stages">
          {stages.map((s, idx) => {
            let cls = 'future'
            if (idx < currentIdx) cls = 'done'
            else if (idx === currentIdx && !isTerminal) cls = 'current'
            return (
              <div key={s} className={`stage-step ${cls}`}>
                <div className="ord">{idx + 1}/{stages.length}</div>
                <div className="sname">{s}</div>
              </div>
            )
          })}
          {isTerminal && (
            <div className={`stage-step ${deal.stage === 'Lost/Dropped' ? 'gate' : 'current'}`}
              style={{ borderColor: `var(--${stageColor(deal.stage)})`, background: `var(--${stageColor(deal.stage)}-bg)`, flex: '0 0 130px' }}>
              <div className="ord">END</div>
              <div className="sname" style={{ color: `var(--${stageColor(deal.stage)})` }}>{deal.stage}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="ws-grid">
        {/* Left — tabs */}
        <div className="ws-main">
          <div className="tabs">
            {[
              { id: 'activity', label: 'Activity', count: deal.activities?.length },
              { id: 'tasks', label: 'Tasks', count: deal.tasks?.length },
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

          {tab === 'activity' && <ActivityTab deal={deal} />}
          {tab === 'tasks' && <TasksTab dealId={deal.id} />}
          {tab === 'flags' && <FlagsTab deal={deal} />}
          {tab === 'demo' && <DemoInfoTab deal={deal} />}
          {tab === 'sequence' && <SequenceTab emails={emails} deal={deal} />}
          {tab === 'coach' && <CoachTab deal={deal} />}
          {tab === 'notes' && <NotesTab dealId={deal.id} />}
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
      {showDemoForm && <DemoFormModal deal={deal} onClose={() => setShowDemoForm(false)} onSuccess={() => { setShowDemoForm(false); window.location.reload() }} />}
      {showF2FForm && <F2FModal deal={deal} onClose={() => setShowF2FForm(false)} />}
      {showMarkLost && <MarkLostModal deal={deal} onClose={() => setShowMarkLost(false)} onSuccess={() => { setShowMarkLost(false); window.location.reload() }} />}
      {showMarkOnHold && <MarkOnHoldModal deal={deal} onClose={() => setShowMarkOnHold(false)} onSuccess={() => { setShowMarkOnHold(false); window.location.reload() }} />}
    </div>
  )
}

// ── Tab components ─────────────────────────────────────────

function ActivityTab({ deal }) {
  const activities = deal.activities || []
  const iconMap = {
    demo: '🎯', email: '✉', note: '✎', meeting: '◉', call: '☏', task: '✓', stage: '→', flag: '⚑', webhook: '⇄',
  }

  if (activities.length === 0) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        {deal.saLogged
          ? 'Activities are loaded from Zoho CRM. If none appear, there may be no logged activities in Zoho for this deal.'
          : 'No activity yet on this deal.'}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="tl">
        {activities.map((act, i) => (
          <div key={i} className="tl-row">
            <div className="time">{formatDate(act.date)}</div>
            <div className="tl-icon">{iconMap[act.type?.toLowerCase()] || '·'}</div>
            <div className="act" dangerouslySetInnerHTML={{ __html: act.description || '' }} />
          </div>
        ))}
      </div>
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

function TasksTab({ dealId }) {
  const { authFetch } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

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

  async function completeTask(taskId) {
    await authFetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: true, status: 'Completed' } : t))
  }

  async function reopenTask(taskId) {
    await authFetch(`/api/tasks/${taskId}/reopen`, { method: 'PATCH' })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: false, status: 'Not Started' } : t))
  }

  if (loading) return <div className="card card-pad" style={{ color: 'var(--ink-3)' }}>Loading tasks…</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>+ Add task</button>
      </div>
      {tasks.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No tasks on this deal.</div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th style={{ width: 32 }}></th><th>Task</th><th>Due</th><th>Priority</th><th></th></tr></thead>
            <tbody>
              {tasks.map(task => {
                const isOverdue = task.dueDate && task.dueDate < todayStr && !task.isComplete
                return (
                  <tr key={task.id} style={{ opacity: task.isComplete ? 0.5 : 1 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={task.isComplete}
                        onChange={() => task.isComplete ? reopenTask(task.id) : completeTask(task.id)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                    <td><b style={{ textDecoration: task.isComplete ? 'line-through' : 'none' }}>{task.subject}</b></td>
                    <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--ink-2)', fontWeight: isOverdue ? 600 : 400, fontSize: 13 }}>
                      {task.dueDate ? formatDate(task.dueDate) : '—'}
                    </td>
                    <td>{task.priority || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!task.isComplete && (
                        <button className="btn btn-sm" onClick={() => completeTask(task.id)}>Mark done</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <TaskModal
          dealId={dealId}
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            const res = await authFetch('/api/tasks', { method: 'POST', body: JSON.stringify(data) })
            const json = await res.json()
            if (json.success) { setShowModal(false); fetchTasks() }
            else alert(json.error || 'Failed to create task')
          }}
        />
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

function SequenceTab({ emails, deal }) {
  const typeLabel = {
    day1: 'Day 1 · Personalised Recap',
    day2: 'Day 2 · Pricing Proposal',
    day3: 'Day 3 · ROI Value',
    day4: 'Day 4 · Objection Handling',
    nudge: 'Mtg +7 · Nudge'
  }
  const statusPill = { sent: 'pill-ok', scheduled: 'pill-info', draft: 'pill-neutral', failed: 'pill-danger' }

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
        No email drafts yet. They will be generated after logging demo.
      </div>
    )
  }

  function EmailCard({ email }) {
    const { authFetch } = useAuth()
    const [expanded, setExpanded] = useState(false)
    const [creating, setCreating] = useState(false)
    const [draftCreated, setDraftCreated] = useState(false)

    async function createGmailDraft() {
      setCreating(true)
      try {
        const res = await authFetch(`/api/deals/${deal.id}/emails/${email.email_type}/gmail-draft`, {
          method: 'POST'
        })
        const data = await res.json()
        if (data.success) setDraftCreated(true)
        else alert(data.error || 'Failed to create Gmail draft')
      } finally { setCreating(false) }
    }

    return (
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <b style={{ fontSize: 13.5 }}>{typeLabel[email.email_type] || email.email_type}</b>
          <span className={`pill ${statusPill[email.status] || 'pill-neutral'}`}>{email.status}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(email.scheduled_for)}</span>
        </div>
        {email.subject && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>{email.subject}</div>}
        {email.body && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, maxHeight: expanded ? 'none' : 60, overflow: expanded ? 'visible' : 'hidden' }}>
            {email.body?.replace(/<[^>]+>/g, '')}
          </div>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {email.status === 'draft' && (
            !draftCreated ? (
              <button className="btn btn-sm btn-primary" onClick={createGmailDraft} disabled={creating}>
                {creating ? 'Creating…' : 'Create Gmail Draft'}
              </button>
            ) : (
              <span className="pill pill-ok">✓ Draft created in Gmail</span>
            )
          )}
          <button className="btn btn-sm" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {email.status === 'sent' && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ok)' }}>✓ Sent {formatDate(email.sent_at)}</div>
        )}
      </div>
    )
  }

  const ORDER = ['day1', 'day2', 'day3', 'day4', 'nudge']
  const sortedEmails = [...emails].sort((a, b) =>
    ORDER.indexOf(a.email_type) - ORDER.indexOf(b.email_type)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sortedEmails.map(email => (
        <EmailCard key={email.id} email={email} />
      ))}
    </div>
  )
}

function CoachTab({ deal }) {
  const d = deal.demoInfo
  const gradeColor = { A: 'ok', B: 'info', C: 'warn', D: 'danger' }

  const scoreItems = [
    { label: 'Pain Clarity', score: parseInt(d?.painClarity) || 0, max: 3 },
    { label: 'DM Present', score: parseInt(d?.dmPresent) || 0, max: 3 },
    { label: 'Budget Signal', score: parseInt(d?.budgetSignal) || 0, max: 2 },
    { label: 'Purchase Timeline', score: parseInt(d?.purchaseTimeline) || 0, max: 3 },
    { label: 'Engagement', score: parseInt(d?.engagementLevel) || 0, max: 2 },
    { label: 'Champion Strength', score: parseInt(d?.championStrength) || 0, max: 2 },
    { label: 'Next Step', score: parseInt(d?.nextStep) || 0, max: 2 },
    { label: 'In-person Meeting', score: deal.f2fCount > 0 ? 2 : 0, max: 2 },
  ]
  const totalScore = d?.score || deal.score || 0
  const grade = d?.grade || deal.grade || 'D'

  if (!deal.saLogged) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        Log the demo to see coach recommendations.
      </div>
    )
  }

  const aiAnalysis = d?.aiAnalysis || ''

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
      {aiAnalysis ? (
        <div className="card card-pad">
          <div className="ws-side-head" style={{ marginBottom: 12 }}><h4>Coach Recommendations</h4></div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
            {aiAnalysis}
          </div>
        </div>
      ) : (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          No coach recommendations stored for this demo.
        </div>
      )}
    </div>
  )
}

function NotesTab({ dealId }) {
  const { authFetch } = useAuth()
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch(`/api/deals/${dealId}/notes`)
      .then(r => r.json())
      .then(d => setNotes(d.notes || []))
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
        setNotes(prev => [data.note, ...prev])
        setNewNote('')
      }
    } finally { setSaving(false) }
  }

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
      {notes.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No notes yet.</div>
      ) : (
        notes.map((note, i) => (
          <div key={i} className="card card-pad">
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{note.content}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              {note.authorName} · {formatDate(note.createdAt)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ContactTab({ deal }) {
  return (
    <div className="card">
      <div className="ws-side-head"><h4>Contact Details</h4></div>
      <div className="ws-side-body">
        {[
          { k: 'Name', v: deal.demoInfo?.prospectName || '—' },
          { k: 'Email', v: deal.demoInfo?.prospectEmail || '—' },
          { k: 'Company', v: deal.brandName || deal.dealName || '—' },
          { k: 'Rep Owner', v: deal.repName || '—' },
        ].map(row => (
          <div key={row.k} className="ws-side-row">
            <span className="k">{row.k}</span>
            <span className="v">{row.v}</span>
          </div>
        ))}
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
              <option value="">Select reason…</option>
              <option>No business/requirement</option>
              <option>Price too high</option>
              <option>Chose competitor</option>
              <option>No response</option>
              <option>Low order volume</option>
              <option>Other</option>
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
