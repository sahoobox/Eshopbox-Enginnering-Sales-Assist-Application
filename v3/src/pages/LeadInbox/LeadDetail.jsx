import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/ui'
import { TaskModal } from '../Tasks'

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}

function formatDateTime(dt) {
  if (!dt) return ''
  try { return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) } catch { return dt }
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

export default function LeadDetail() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const { authFetch, user, isAdmin, isSalesLead } = useAuth()

  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('leadfields')
  const [disqualifying, setDisqualifying] = useState(false)
  const [showDisqualify, setShowDisqualify] = useState(false)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [converting, setConverting] = useState(false)
  const [showLogCall, setShowLogCall] = useState(false)
  const [logSubject, setLogSubject] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [dedup, setDedup] = useState(null)
  const [showReassign, setShowReassign] = useState(false)

  useEffect(() => {
    authFetch(`/api/leads/${leadId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setLead(data)
        setLoading(false)
        if (data.email || data.company) {
          checkDedup(data.email, data.company)
        }
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [leadId])

  async function checkDedup(email, company) {
    try {
      const res = await authFetch(`/api/deals/search?q=${encodeURIComponent(company || email || '')}`)
      const data = await res.json()
      setDedup({
        existingContact: false,
        existingAccount: data.deals?.length > 0,
        existingDeals: data.deals || []
      })
    } catch {
      setDedup({ existingContact: false, existingAccount: false, existingDeals: [] })
    }
  }

  async function handleDisqualify() {
    if (!disqualifyReason) return alert('Please select a reason')
    setDisqualifying(true)
    try {
      await authFetch(`/api/leads/${leadId}/disqualify`, {
        method: 'POST',
        body: JSON.stringify({ reason: disqualifyReason })
      })
      setShowDisqualify(false)
      navigate('/leads')
    } catch {
      alert('Failed to disqualify. Please try again.')
      setDisqualifying(false)
    }
  }

  async function handleConvert() {
    if (!confirm(`Convert ${lead.company || lead.fullName} to a deal?`)) return
    setConverting(true)
    try {
      const res = await authFetch(`/api/leads/${leadId}/convert`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        if (data.dealId) {
          navigate(`/pipeline/${data.dealId}`)
        } else {
          navigate('/leads')
        }
      } else {
        alert(data.error || 'Conversion failed. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  async function saveLogCall() {
    if (!logSubject.trim()) return
    setLogSaving(true)
    try {
      await authFetch(`/api/leads/${leadId}/activity`, {
        method: 'POST',
        body: JSON.stringify({ type: 'Call', subject: logSubject, description: logNotes })
      })
      setShowLogCall(false)
      setLogSubject('')
      setLogNotes('')
      const r = await authFetch(`/api/leads/${leadId}`)
      const d = await r.json()
      setLead(d)
    } catch { alert('Failed to log call') }
    finally { setLogSaving(false) }
  }

  if (loading) return <div className="main"><Loading text="Loading lead…" /></div>
  if (error || !lead) return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/leads')}>← Back to lead inbox</button>
      <div className="callout danger" style={{ marginTop: 12 }}>{error || 'Lead not found'}</div>
    </div>
  )

  const company = lead.company || lead.fullName || '—'
  const isToday = lead.createdAt?.startsWith(new Date().toISOString().split('T')[0])
  const needsSameDay = isToday && lead.leadStatus === 'New'

  const getRouting = () => {
    const vol = lead.orderVolume || ''
    if (vol.includes('500') && !vol.includes('501')) return { label: 'Self-Serve / Dormant', color: 'var(--ink-3)', desc: 'Volume < 500 → no MDE assignment' }
    if (vol.includes('More than 10,000') || vol.includes('10,000+')) return { label: 'AE-Enterprise', color: 'var(--purple)', desc: `Volume > 10,000 → assigned to AE` }
    return { label: 'Round-robin to MDE', color: 'var(--info)', desc: `Volume ${vol} + Contact Sales → MDE` }
  }
  const routing = getRouting()

  const createdTime = lead.createdAt
    ? (isToday
        ? `Today ${new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
        : new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }))
    : '—'

  return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/leads')} style={{ marginBottom: 12 }}>
        ← Back to lead inbox
      </button>

      {/* Header */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div className="avatar av-teal" style={{ width: 44, height: 44, fontSize: 15, flexShrink: 0 }}>
            {(company[0] || '?').toUpperCase()}{(company[1] || '').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{company}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
              {lead.fullName} · {lead.email}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {needsSameDay && <span className="pill pill-warn">Same-day · today by 6pm</span>}
              {lead.leadStatus && <span className="pill pill-neutral">{lead.leadStatus}</span>}
              {lead.leadSource && <span className="pill pill-info">{lead.leadSource}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-sm" onClick={() => setShowLogCall(true)}>Log call</button>
            {(isAdmin || isSalesLead) && (
              <button className="btn btn-sm" onClick={() => setShowReassign(true)}>Reassign</button>
            )}
            <button className="btn btn-sm btn-danger" onClick={() => setShowDisqualify(true)} disabled={disqualifying}>
              {disqualifying ? 'Disqualifying…' : 'Disqualify'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting…' : 'Convert to deal →'}
            </button>
          </div>
        </div>
      </div>

      <div className="ws-grid">
        {/* Left */}
        <div className="ws-main">

          {/* Tabs */}
          <div className="tabs">
            {[
              { id: 'leadfields', label: 'Lead Fields' },
              { id: 'activity', label: 'Activity' },
              { id: 'activities', label: 'Activities' },
              { id: 'notes', label: 'Notes' },
              { id: 'utm', label: 'UTM & Tracking' },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'activity' && (
            <div>
              {(!lead.activities || lead.activities.length === 0) ? (
                <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                  No activity yet. Log a call to start the conversation.
                </div>
              ) : (
                <div className="card">
                  {lead.activities.map((a, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: i < lead.activities.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.Subject || a.description || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
                        {a.Activity_Type || a.type || 'Activity'} · {a.Created_Time ? new Date(a.Created_Time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'activities' && (
            <LeadActivitiesTab leadId={leadId} />
          )}

          {tab === 'notes' && (
            <LeadNotesTab leadId={leadId} lead={lead} />
          )}

          {tab === 'leadfields' && (
            <div className="card">
              <div className="ws-side-body">
                {[
                  { k: 'Lead Name', v: lead.fullName || '—' },
                  { k: 'Lead Owner', v: lead.ownerName || '—' },
                  { k: 'Lead Status', v: lead.leadStatus
                    ? <span className="pill pill-neutral">{lead.leadStatus}</span>
                    : '—'
                  },
                  { k: 'Phone', v: lead.phone || '—' },
                  { k: 'Company', v: lead.company || '—' },
                  { k: 'Lead Source', v: lead.leadSource || '—' },
                  { k: 'City', v: lead.city || '—' },
                  { k: 'Website', v: lead.website || '—' },
                  { k: 'How many orders do you ship in a month?', v: lead.orderVolume || '—' },
                  { k: 'How can Eshopbox support your business?', v: lead.supportNeeded || '—' },
                  { k: 'What type of products do you sell?', v: lead.productType || '—' },
                  { k: 'Shipping Setup', v: lead.shippingSetup || '—' },
                  { k: 'Current Fulfillment Setup', v: lead.fulfillmentSetup || '—' },
                  { k: 'Inventory Move Timeline', v: lead.inventoryTimeline || '—' },
                ].map((row, i) => (
                  <div key={i} className="ws-side-row">
                    <span className="k">{row.k}</span>
                    <span className="v">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'utm' && (
            <div className="card">
              <div className="ws-side-body">
                {[
                  { k: 'UTM Source', v: lead.utmSource || '—' },
                  { k: 'UTM Medium', v: lead.utmMedium || '—' },
                  { k: 'UTM Campaign', v: lead.utmCampaign || '—' },
                  { k: 'Same-day contact', v: needsSameDay
                    ? <span className="pill pill-warn">Same-day · today by 6pm</span>
                    : <span style={{ color: 'var(--ink-3)' }}>—</span>
                  },
                ].map((row, i) => (
                  <div key={i} className="ws-side-row">
                    <span className="k">{row.k}</span>
                    <span className="v">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="ws-side">
          {/* Owner */}
          <div className="card">
            <div className="ws-side-head"><h4>Owner</h4></div>
            <div className="ws-side-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar av-teal" style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                {(lead.ownerName || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.ownerName || '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>MDE</div>
              </div>
            </div>
          </div>

          {/* Conversion panel */}
          <div className="card">
            <div className="ws-side-head"><h4>Conversion</h4></div>
            <div className="ws-side-body">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to deal →'}
              </button>
              <div style={{ marginTop: 12 }}>
                {dedup === null ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking for existing records…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12.5, color: dedup.existingContact ? 'var(--warn)' : 'var(--ok)' }}>
                      {dedup.existingContact ? '⚠ Existing contact with this email' : '✓ No existing contact'}
                    </div>
                    <div style={{ fontSize: 12.5, color: dedup.existingAccount ? 'var(--warn)' : 'var(--ok)' }}>
                      {dedup.existingAccount ? `⚠ ${dedup.existingDeals.length} existing deal(s) for this brand` : '✓ No existing account'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Log Call Modal */}
      {showLogCall && (
        <div className="modal-overlay" onClick={() => setShowLogCall(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Log Call</h3>
              <button className="btn-close" onClick={() => setShowLogCall(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>SUBJECT *</label>
                <input className="input" style={{ width: '100%' }} placeholder="What happened..."
                  value={logSubject} onChange={e => setLogSubject(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>NOTES</label>
                <textarea className="input" style={{ width: '100%', minHeight: 80 }} placeholder="Detail..."
                  value={logNotes} onChange={e => setLogNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowLogCall(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLogCall}
                disabled={logSaving || !logSubject.trim()}>
                {logSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisqualify && (
        <div className="modal-overlay" onClick={() => setShowDisqualify(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Disqualify Lead</h3>
              <button className="btn-close" onClick={() => setShowDisqualify(false)}>×</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                DISQUALIFICATION REASON *
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={disqualifyReason}
                onChange={e => setDisqualifyReason(e.target.value)}
              >
                <option value="">Select reason…</option>
                <option>Job Seeker / Career Inquiry</option>
                <option>Investor / vendor / partner enquiry</option>
                <option>Hyper Local Delivery</option>
                <option>Duplicate or Existing account</option>
                <option>Wrong number / can't reach decision maker</option>
                <option>Not an E-commerce Brand</option>
                <option>Outside Service Geography</option>
                <option>Volume / Business size mismatch</option>
                <option>Business Model Misaligned</option>
                <option>Duplicate Lead</option>
                <option>Service we don't offer (courier / packaging only)</option>
                <option>Language Barrier</option>
                <option>Looking for boxes</option>
                <option>No budget / decision delayed</option>
                <option>Just searching - no immediate need</option>
                <option>Chose a competitor</option>
                <option>Invalid / spam / test entry</option>
                <option>Submitted by mistake / email bounced</option>
              </select>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowDisqualify(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={handleDisqualify}
                disabled={disqualifying || !disqualifyReason}
              >
                {disqualifying ? 'Disqualifying…' : 'Disqualify'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showReassign && (
        <ReassignLeadModal
          lead={lead}
          onClose={() => setShowReassign(false)}
          onSuccess={() => {
            setShowReassign(false)
            authFetch(`/api/leads/${leadId}`).then(r => r.json()).then(setLead)
          }}
        />
      )}
    </div>
  )
}

function LeadNotesTab({ leadId, lead }) {
  const { authFetch } = useAuth()
  const [d1Notes, setD1Notes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch(`/api/leads/${leadId}/notes`)
      .then(r => r.json())
      .then(d => setD1Notes(d.notes || []))
      .finally(() => setLoading(false))
  }, [leadId])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/leads/${leadId}/notes`, {
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

  const allNotes = [
    ...(d1Notes || []).map(n => ({
      id: n.id,
      content: n.content,
      authorName: n.authorName,
      date: n.created_at || n.createdAt,
      source: 'salesassist',
    })),
    ...(lead?.notes || []).map(n => ({
      id: n.id,
      content: n.Note_Content || n.description || n.content,
      authorName: n.Created_By?.name || n.createdBy,
      date: n.Created_Time || n.date,
      source: 'zoho',
    })),
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

function LeadActivitiesTab({ leadId }) {
  const { authFetch } = useAuth()
  const [tasks, setTasks] = useState([])
  const [meetings, setMeetings] = useState([])
  const [calls, setCalls] = useState([])
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

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, mRes, cRes] = await Promise.all([
        authFetch(`/api/leads/${leadId}/tasks`).then(r => r.json()),
        authFetch(`/api/leads/${leadId}/meetings`).then(r => r.json()),
        authFetch(`/api/leads/${leadId}/calls`).then(r => r.json()),
      ])
      setTasks(tRes.tasks || [])
      setMeetings(mRes.meetings || [])
      setCalls(cRes.calls || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [leadId, authFetch])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function toggleTask(taskId, isComplete) {
    if (!isComplete) {
      setConfirmModal({
        onConfirm: async () => {
          setConfirmModal(null)
          await authFetch(`/api/leads/${leadId}/tasks/${taskId}`, { method: 'PATCH' })
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isComplete: true, status: 'Completed' } : t))
        }
      })
    }
  }

  function completeMeeting(meetingId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/leads/${leadId}/meeting/${meetingId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => new Set([...prev, meetingId]))
      }
    })
  }

  function completeCall(callId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/leads/${leadId}/call/${callId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => new Set([...prev, callId]))
      }
    })
  }

  const allActivities = [
    ...tasks.map(t => ({ id: t.id, type: 'Task', date: t.dueDate, done: t.status === 'Completed', _t: t })),
    ...meetings.map(m => ({ id: m.id, type: 'Meeting', date: m.from, done: (m.to && new Date(m.to) < new Date()) || localCompleted.has(m.id), _m: m })),
    ...calls.map(c => ({ id: c.id, type: 'Call', date: c.timing, done: (c.status !== 'Scheduled' && c.status !== 'scheduled' && c.status !== '' && c.status !== null) || localCompleted.has(c.id), _c: c })),
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
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No activities on this lead.</div>
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
                      style={{ cursor: item.done ? 'default' : 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
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
          dealId={leadId}
          onClose={() => setShowTaskModal(false)}
          onSubmit={async (data) => {
            const res = await authFetch(`/api/leads/${leadId}/tasks`, { method: 'POST', body: JSON.stringify(data) })
            const json = await res.json()
            if (json.success) { setShowTaskModal(false); fetchAll() }
            else alert(json.error || 'Failed to create task')
          }}
        />
      )}
      {showMeetingModal && (
        <LeadMeetingModal
          leadId={leadId}
          onClose={() => setShowMeetingModal(false)}
          onSuccess={() => { setShowMeetingModal(false); fetchAll() }}
        />
      )}
      {showCallModal && (
        <LeadCallModal
          leadId={leadId}
          onClose={() => setShowCallModal(false)}
          onSuccess={() => { setShowCallModal(false); fetchAll() }}
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

function LeadMeetingModal({ leadId, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', venue: 'Online', from: '', to: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.title.trim() || !form.from || !form.to) return alert('Title, From and To are required')
    if (form.to <= form.from) return alert('End time must be after start time')
    setSaving(true)
    try {
      const res = await authFetch(`/api/leads/${leadId}/meeting`, {
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
              <input type="datetime-local" value={form.from} onChange={e => set('from', e.target.value)} className="input" style={{ width: '100%' }} />
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

function LeadCallModal({ leadId, onClose, onSuccess }) {
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
      const res = await authFetch(`/api/leads/${leadId}/${endpoint}`, {
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

function ReassignLeadModal({ lead, onClose, onSuccess }) {
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

  const currentOwnerEmail = lead.ownerEmail || lead.owner?.email || ''
  const options = users.filter(u => u.email !== currentOwnerEmail)
  const selected = options.find(u => u.email === selectedEmail)

  async function submit() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/leads/${lead.id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ newOwnerEmail: selected.email, newOwnerName: selected.name })
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else alert(data.error || 'Failed to reassign lead')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Reassign Lead</h3>
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
