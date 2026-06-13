import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/ui'

export default function LeadDetail() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const { authFetch, user } = useAuth()

  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('activity')
  const [disqualifying, setDisqualifying] = useState(false)
  const [showDisqualify, setShowDisqualify] = useState(false)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [converting, setConverting] = useState(false)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showLogCall, setShowLogCall] = useState(false)
  const [logSubject, setLogSubject] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [dedup, setDedup] = useState(null)

  useEffect(() => {
    authFetch(`/api/leads/${leadId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setLead(data)
        setLoading(false)
        // Dedup check
        if (data.email || data.company) {
          checkDedup(data.email, data.company)
        }
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [leadId])

  async function checkDedup(email, company) {
    try {
      const domain = email?.split('@')[1]
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

  async function saveNote() {
    if (!note.trim()) return
    setSavingNote(true)
    try {
      await authFetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: note })
      })
      setNote('')
      const r = await authFetch(`/api/leads/${leadId}`)
      const d = await r.json()
      setLead(d)
    } catch { alert('Failed to save note') }
    finally { setSavingNote(false) }
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
  const isPast6pm = new Date().getHours() >= 18
  const needsSameDay = isToday && lead.leadStatus === 'New'

  // Routing decision
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
            <button className="btn btn-sm btn-danger" onClick={() => setShowDisqualify(true)} disabled={disqualifying}>
              {disqualifying ? 'Disqualifying…' : 'Disqualify'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting…' : 'Convert to deal →'}
            </button>
          </div>
        </div>
      </div>

      {/* Routing decision */}
      <div className="callout info" style={{ marginBottom: 14 }}>
        <b>Routing decision:</b> Volume {lead.orderVolume || '—'} → {routing.desc}.{' '}
        {lead.ownerName && <b style={{ color: routing.color }}>Assigned to {lead.ownerName}.</b>}
      </div>

      <div className="ws-grid">
        {/* Left */}
        <div className="ws-main">

          {/* Lead details */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ws-side-head"><h4>Lead details</h4></div>
            <div className="ws-side-body">
              {[
                { k: 'Contact', v: lead.fullName || '—' },
                { k: 'Email', v: lead.email || '—' },
                { k: 'Brand', v: company },
                { k: 'Volume submitted', v: lead.orderVolume || '—' },
                { k: 'Form / source', v: lead.leadSource || '—' },
                { k: 'Submitted', v: createdTime },
                { k: 'UTM source', v: lead.utmSource || '—' },
                { k: 'UTM campaign', v: lead.utmCampaign || '—' },
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

          {/* Dedup check */}
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dedup check</div>
            {dedup === null ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking for existing records…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, color: dedup.existingContact ? 'var(--warn)' : 'var(--ok)' }}>
                  {dedup.existingContact ? '⚠ Existing contact with this email' : '✓ No existing contact with this email'}
                </div>
                <div style={{ fontSize: 13, color: dedup.existingAccount ? 'var(--warn)' : 'var(--ok)' }}>
                  {dedup.existingAccount ? `⚠ ${dedup.existingDeals.length} existing deal(s) for this brand` : '✓ No existing account with this domain'}
                </div>
              </div>
            )}
          </div>

          {/* Activity / Notes tabs */}
          <div className="tabs">
            {[{ id: 'activity', label: 'Activity' }, { id: 'notes', label: 'Notes' }].map(t => (
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

          {tab === 'notes' && (
            <div>
              <div className="card card-pad" style={{ marginBottom: 10 }}>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', marginBottom: 8 }}
                  placeholder="Add a note…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={savingNote || !note.trim()}>
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
              </div>
              {(!lead.notes || lead.notes.length === 0) ? (
                <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                  No notes yet.
                </div>
              ) : (
                <div className="card">
                  {lead.notes.map((n, i) => (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: i < lead.notes.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ fontSize: 13 }}>{n.Note_Content || n.content || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
                        {n.Created_Time ? new Date(n.Created_Time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>On convert, creates:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Account', desc: 'deduped by domain' },
                  { label: 'Primary Contact', desc: 'deduped by email' },
                  { label: 'Deal', desc: `SME · Upcoming Demo` },
                ].map((item, i) => (
                  <div key={i} style={{ fontSize: 12.5 }}>
                    <b>{item.label}</b> · <span style={{ color: 'var(--ink-3)' }}>{item.desc}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }} onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to deal →'}
              </button>
            </div>
          </div>

          {/* Lead fields */}
          <div className="card">
            <div className="ws-side-head"><h4>Lead fields</h4></div>
            <div className="ws-side-body">
              {[
                { k: 'Full Name', v: lead.fullName || '—' },
                { k: 'Email', v: lead.email || '—' },
                { k: 'Phone', v: lead.phone || '—' },
                { k: 'Company', v: company },
                { k: 'Volume', v: lead.orderVolume || '—' },
                { k: 'Source', v: lead.leadSource || '—' },
                { k: 'Lead Type', v: lead.leadType || '—' },
                { k: 'Status', v: lead.leadStatus || '—' },
                { k: 'Owner', v: lead.ownerName || '—' },
                { k: 'Created', v: createdTime },
              ].map((row, i) => (
                <div key={i} className="ws-side-row">
                  <span className="k">{row.k}</span>
                  <span className="v">{row.v}</span>
                </div>
              ))}
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
    </div>
  )
}
