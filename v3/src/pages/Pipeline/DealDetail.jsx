import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeal } from '../../hooks/useDeals'
import { Loading, Empty, Pill } from '../../components/ui'
import { SME_STAGES, getStagePill, stageColor, initials, formatDate, daysAgo } from '../../lib/stageConfig'

export default function DealDetail({ dealId }) {
  const navigate = useNavigate()
  const { deal, emails, loading, error } = useDeal(dealId)
  const [tab, setTab] = useState('activity')

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
              <button className="btn btn-sm btn-danger">Mark Lost</button>
              <button className="btn btn-sm">Mark on Hold</button>
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
              { id: 'emails', label: 'Emails', count: emails.length },
              { id: 'tasks', label: 'Tasks', count: deal.tasks?.length },
              { id: 'flags', label: 'Flags', count: deal.flags?.length },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count > 0 && <span className="count">{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'activity' && <ActivityTab deal={deal} />}
          {tab === 'emails' && <EmailsTab emails={emails} deal={deal} />}
          {tab === 'tasks' && <TasksTab deal={deal} />}
          {tab === 'flags' && <FlagsTab deal={deal} />}
        </div>

        {/* Right — side panel */}
        <div className="ws-side">
          {deal.dealSummary && (
            <div className="card">
              <div className="ws-side-head"><h4>AI Summary</h4></div>
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
        No activity yet on this deal.
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

function TasksTab({ deal }) {
  const tasks = deal.tasks || []
  if (tasks.length === 0) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        No tasks on this deal.
        <button className="btn btn-sm btn-primary" style={{ marginLeft: 8 }}>+ Add task</button>
      </div>
    )
  }
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>Task</th><th>Due</th><th>Status</th><th>Priority</th></tr></thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id || task.Subject}>
              <td><b>{task.Subject || task.subject}</b></td>
              <td>{formatDate(task.Due_Date || task.due_date)}</td>
              <td><span className={`pill ${task.Status === 'Completed' ? 'pill-ok' : 'pill-neutral'}`}>{task.Status || task.status}</span></td>
              <td>{task.Priority || task.priority || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
