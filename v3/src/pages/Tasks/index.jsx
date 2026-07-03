import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTasks } from '../../hooks/useTasks'
import { Topbar, Loading } from '../../components/ui'
import { formatDate } from '../../lib/stageConfig'

function taskType(subject = '') {
  const s = subject.toLowerCase()
  if (s.includes('email')) return 'Email'
  if (s.includes('call')) return 'Call'
  if (s.includes('meeting') || s.includes('demo')) return 'Meeting'
  return 'Follow-up'
}

const typePill = { Email: 'pill-info', Call: 'pill-warn', Meeting: 'pill-ok', 'Follow-up': 'pill-neutral' }

export default function Tasks() {
  const { role, isMDE, isAE } = useAuth()
  const { tasks, loading, error, refetch, completeTask, reopenTask, createTask } = useTasks()
  const [showModal, setShowModal] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const open = tasks.filter(t => !t.isComplete)
  const overdue = open.filter(t => t.dueDate && t.dueDate < todayStr)
  const dueToday = open.filter(t => t.dueDate === todayStr)
  const upcoming = open.filter(t => !t.dueDate || t.dueDate > todayStr)

  const title = (isMDE || isAE) ? 'My tasks' : 'Team tasks'

  if (loading) return <div className="main"><Loading text="Fetching tasks from Zoho CRM…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title={title} />
      <div className="callout danger">Failed to load tasks: {error}</div>
    </div>
  )

  return (
    <div className="main">
      <Topbar
        title={title}
        subtitle="Daily task queue across all your deals · auto-created by sequences and rule engine + your manual tasks."
        actions={<button className="btn btn-sm btn-danger" onClick={() => setShowModal(true)}>+ New task</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiTile label="OVERDUE" value={overdue.length} warn={overdue.length > 0} sub="past due date" />
        <KpiTile label="DUE TODAY" value={dueToday.length} sub="due today" />
        <KpiTile label="UPCOMING" value={upcoming.length} sub="future tasks" />
        <KpiTile label="TOTAL OPEN" value={open.length} sub="all open tasks" />
      </div>

      {overdue.length > 0 && (
        <TaskSection title="Overdue" tasks={overdue} todayStr={todayStr} completeTask={completeTask} reopenTask={reopenTask} showOwner showDeal danger />
      )}
      {dueToday.length > 0 && (
        <TaskSection title="Today" tasks={dueToday} todayStr={todayStr} completeTask={completeTask} reopenTask={reopenTask} showOwner showDeal />
      )}
      {upcoming.length > 0 && (
        <TaskSection title="Upcoming" tasks={upcoming} todayStr={todayStr} completeTask={completeTask} reopenTask={reopenTask} showOwner showDeal />
      )}
      {open.length === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          No open tasks — all clear!
        </div>
      )}

      {showModal && (
        <TaskModal
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            const res = await createTask(data)
            if (res.success) setShowModal(false)
            else alert(res.error || 'Failed to create task')
          }}
        />
      )}
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────
function KpiTile({ label, value, sub, warn }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: warn ? 'var(--danger)' : 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ── Task Section ──────────────────────────────────────────
function TaskSection({ title, tasks, todayStr, completeTask, reopenTask, showOwner, showDeal, danger }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: danger ? 'var(--danger)' : 'var(--ink-1)' }}>{title}</h3>
        <span className="pill pill-neutral" style={{ fontSize: 11 }}>{tasks.length}</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Task</th>
              {showDeal && <th>Deal</th>}
              <th>Type</th>
              <th>Due</th>
              {showOwner && <th>Owner</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                todayStr={todayStr}
                completeTask={completeTask}
                reopenTask={reopenTask}
                showOwner={showOwner}
                showDeal={showDeal}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Task Row ──────────────────────────────────────────────
function TaskRow({ task, todayStr, completeTask, reopenTask, showOwner, showDeal }) {
  const [busy, setBusy] = useState(false)
  const isOverdue = task.dueDate && task.dueDate < todayStr && !task.isComplete
  const type = taskType(task.subject)

  async function toggle() {
    setBusy(true)
    try {
      if (task.isComplete) await reopenTask(task.id)
      else await completeTask(task.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr style={{ opacity: task.isComplete ? 0.5 : 1 }}>
      <td>
        <input
          type="checkbox"
          checked={task.isComplete}
          disabled={busy}
          onChange={toggle}
          style={{ cursor: 'pointer', width: 16, height: 16 }}
        />
      </td>
      <td><b style={{ textDecoration: task.isComplete ? 'line-through' : 'none' }}>{task.subject}</b></td>
      {showDeal && (
        <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {task.linkedType === 'deal' ? (
            <>{task.dealName || '—'} <span className="pill pill-info" style={{ fontSize: 10 }}>Deal</span></>
          ) : task.linkedType === 'lead' ? (
            <>{task.leadName || '—'} <span className="pill pill-purple" style={{ fontSize: 10 }}>Lead</span></>
          ) : '—'}
        </td>
      )}
      <td><span className={`pill ${typePill[type]}`} style={{ fontSize: 11 }}>{type}</span></td>
      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--ink-2)', fontWeight: isOverdue ? 600 : 400, fontSize: 13 }}>
        {task.dueDate ? formatDate(task.dueDate) : '—'}
      </td>
      {showOwner && <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{task.ownerName || '—'}</td>}
    </tr>
  )
}

// ── Task Modal ────────────────────────────────────────────
export function TaskModal({ onClose, onSubmit, dealId }) {
  const [form, setForm] = useState({ subject: '', due_date: '', priority: 'Normal', description: '', deal_id: dealId || '' })
  const [submitting, setSubmitting] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 460, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>New task</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Subject *</label>
            <input
              className="search-input"
              style={{ width: '100%' }}
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="Task subject"
              required
            />
          </div>
          {!dealId && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Deal ID (optional)</label>
              <input
                className="search-input"
                style={{ width: '100%' }}
                value={form.deal_id}
                onChange={e => set('deal_id', e.target.value)}
                placeholder="Zoho deal ID"
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Due date</label>
            <input
              type="date"
              className="search-input"
              style={{ width: '100%' }}
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Priority</label>
            <select
              className="search-input"
              style={{ width: '100%' }}
              value={form.priority}
              onChange={e => set('priority', e.target.value)}
            >
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Description (optional)</label>
            <textarea
              className="search-input"
              style={{ width: '100%', minHeight: 72, resize: 'vertical' }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Additional notes…"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
