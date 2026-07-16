import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/ui'
import { toast } from '../../components/ui/Toast'
import { SkeletonCard, SkeletonLine } from '../../components/ui/Skeleton'
import { TaskModal } from '../Tasks'
import { StickyNote, Phone, Calendar, CheckSquare, RefreshCw } from 'lucide-react'

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}

function formatDateTime(dt) {
  if (!dt) return ''
  try { return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) } catch { return dt }
}

function formatSentDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch { return dateStr }
}

function formatActivityDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    })
  } catch { return dateStr }
}

const DAY_LABELS = ['Day 1', 'Day 2', 'Day 4', 'Day 7']

const DAY_HEADINGS = {
  'Day 1': 'Welcome & Introduction',
  'Day 2': 'Shipping Benefits',
  'Day 4': 'Fulfilment & Delivery',
  'Day 7': 'Final Follow-up',
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

function ConvertLeadModal({ lead, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [step, setStep] = useState('question')
  // 'question' | 'datetime' | 'warning'
  const [dateTime, setDateTime] = useState('')
  const [saving, setSaving] = useState(false)

  async function doConvert(demoScheduled, demoDateTime) {
    setSaving(true)
    try {
      const res = await authFetch(
        `/api/leads/${lead.id}/convert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demoScheduled,
            demoScheduledDateTime: demoDateTime || null
          })
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Conversion failed')
        setSaving(false)
        return
      }
      const data = await res.json()
      if (data.success) {
        toast.success('Lead converted to deal successfully')
        onSuccess(data)
      } else {
        toast.error(data.error || 'Conversion failed')
        setSaving(false)
      }
    } catch (err) {
      toast.error('Conversion failed — please try again')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box"
        style={{ maxWidth: 460 }}
        onClick={e => e.stopPropagation()}
      >

        {/* STEP 1 — Is demo scheduled? */}
        {step === 'question' && (
          <>
            <div className="modal-head">
              <h3>Convert to Deal</h3>
              <button className="btn-close" onClick={onClose}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{
                fontSize: 14,
                color: 'var(--ink-2)',
                marginBottom: 20,
                lineHeight: 1.6
              }}>
                Converting <strong>{lead.company || lead.fullName}</strong> to
                a deal. Has the demo been scheduled?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setStep('datetime')}
                >
                  ✓ Yes, scheduled
                </button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setStep('warning')}
                >
                  Not yet
                </button>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* STEP 2 — Date/time picker */}
        {step === 'datetime' && (
          <>
            <div className="modal-head">
              <h3>Schedule Demo</h3>
              <button className="btn-close" onClick={onClose}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{
                fontSize: 14,
                color: 'var(--ink-2)',
                marginBottom: 16,
                lineHeight: 1.6
              }}>
                Select the demo date and time:
              </p>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={e => setDateTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1.5px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 14,
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                  outline: 'none'
                }}
              />
            </div>
            <div className="modal-foot">
              <button className="btn"
                onClick={() => setStep('question')}>
                ← Back
              </button>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={saving || !dateTime}
                onClick={() => doConvert(true, dateTime)}
              >
                {saving ? 'Converting...' : 'Convert →'}
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — Warning: no demo scheduled */}
        {step === 'warning' && (
          <>
            <div className="modal-head">
              <h3>No Demo Scheduled</h3>
              <button className="btn-close" onClick={onClose}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{
                fontSize: 14,
                color: 'var(--ink-2)',
                marginBottom: 12,
                lineHeight: 1.6
              }}>
                You're converting without a scheduled demo date.
                The deal will be created in
                <strong> Upcoming Demo</strong> stage.
              </p>
              <div style={{
                fontSize: 13,
                color: 'var(--ink-3)',
                background: 'var(--surface-2)',
                padding: '10px 14px',
                borderRadius: 8,
                lineHeight: 1.5
              }}>
                Are you sure you want to continue without scheduling?
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn"
                onClick={() => setStep('question')}>
                ← Go back
              </button>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={saving}
                onClick={() => doConvert(false, null)}
              >
                {saving ? 'Converting...' : 'Convert anyway'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

function ChangeStatusModal({ lead, targetStatus, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!description.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(
        `/api/leads/${lead.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: targetStatus,
            description: description.trim()
          })
        }
      )
      const data = await res.json()
      if (data.success) {
        toast.success(`Status changed to ${targetStatus}`)
        onSuccess(targetStatus)
      } else {
        toast.error(data.error || 'Failed to update status')
        setSaving(false)
      }
    } catch (err) {
      toast.error('Failed to update status')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box"
        style={{ maxWidth: 460 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>Change Status to {targetStatus}</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            marginBottom: 12,
            lineHeight: 1.5
          }}>
            Please describe the reason for changing
            the status to <strong>{targetStatus}</strong>
          </p>
          <textarea
            className="form-textarea"
            placeholder="Describe the reason for this status change..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            style={{ width: '100%', resize: 'vertical' }}
            autoFocus
          />
          {!description.trim() && (
            <p style={{
              fontSize: 12,
              color: 'var(--danger)',
              marginTop: 6
            }}>
              Description is required
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || !description.trim()}
            onClick={submit}
          >
            {saving ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LeadDetail() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const { authFetch, user, isAdmin, isSalesLead } = useAuth()

  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('leadfields')
  const tabDataCache = useRef({})
  const [disqualifying, setDisqualifying] = useState(false)
  const [showDisqualify, setShowDisqualify] = useState(false)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [targetStatus, setTargetStatus] = useState(null)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showActivityDropdown, setShowActivityDropdown] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const [dedup, setDedup] = useState(null)
  const [dedupOpen, setDedupOpen] = useState({ domain: false, phone: false, brand: false })
  const [merging, setMerging] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState(null)
  const [mergeError, setMergeError] = useState(null)
  const [showReassign, setShowReassign] = useState(false)
  const [leadEmails, setLeadEmails] = useState({ mails: [], drafts: [], scheduled: [] })
  const [leadEmailsLoading, setLeadEmailsLoading] = useState(false)
  const [expandedEmails, setExpandedEmails] = useState({})
  const [emailBodies, setEmailBodies] = useState({})
  const [editingFields, setEditingFields] = useState(false)
  const [fieldsForm, setFieldsForm] = useState({ phone: '', email: '', company: '', city: '', website: '' })
  const [savingFields, setSavingFields] = useState(false)
  const [fieldsError, setFieldsError] = useState('')

  const validateFields = () => {
    if (fieldsForm.email && !fieldsForm.email.includes('@')) {
      setFieldsError('Please enter a valid email address')
      return false
    }
    if (fieldsForm.phone) {
      const digits = fieldsForm.phone.replace(/\D/g, '')
      if (digits.length !== 10) {
        setFieldsError('Phone number must be exactly 10 digits')
        return false
      }
    }
    return true
  }

  useEffect(() => {
    authFetch(`/api/leads/${leadId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setLead(data)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [leadId])

  useEffect(() => {
    if (lead) setFieldsForm({
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      city: lead.city || '',
      website: lead.website || '',
    })
  }, [lead])

  useEffect(() => {
    if (!leadId) return
    authFetch(`/api/leads/${leadId}/dedup-check`)
      .then(r => r.json())
      .then(d => setDedup(d))
      .catch(() => {})
  }, [leadId])

  useEffect(() => {
    if (tab !== 'emails' || !lead?.id) return
    setLeadEmailsLoading(true)
    authFetch(`/api/leads/${lead.id}/emails`)
      .then(r => r.json())
      .then(d => setLeadEmails(d))
      .catch(() => setLeadEmails({ mails: [], drafts: [], scheduled: [] }))
      .finally(() => setLeadEmailsLoading(false))
  }, [tab, lead?.id])

  useEffect(() => {
    if (!showStatusDropdown) return
    const handler = () => setShowStatusDropdown(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showStatusDropdown])

  async function handleExpand(emailId) {
    const isCurrentlyExpanded = expandedEmails[emailId]
    setExpandedEmails(prev => ({ ...prev, [emailId]: !isCurrentlyExpanded }))

    if (!isCurrentlyExpanded && !emailBodies[emailId]) {
      try {
        const res = await authFetch(`/api/leads/${lead.id}/emails/${emailId}`)
        const data = await res.json()
        setEmailBodies(prev => ({ ...prev, [emailId]: data.content || data.subject || '' }))
      } catch (err) {
        console.error('Failed to fetch email body', err)
        toast.error('Failed to load email content')
      }
    }
  }

  async function handleDisqualify() {
    if (!disqualifyReason) return toast.warn('Please select a reason')
    setDisqualifying(true)
    try {
      await authFetch(`/api/leads/${leadId}/disqualify`, {
        method: 'POST',
        body: JSON.stringify({ reason: disqualifyReason })
      })
      setShowDisqualify(false)
      toast.success('Lead disqualified')
      navigate('/leads')
    } catch {
      toast.error('Failed to disqualify. Please try again.')
      setDisqualifying(false)
    }
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

  const statusOptions = (() => {
    const current = lead.leadStatus || ''
    const all = ['Connecting', 'Connected', 'Bad Timing']
    return all.filter(s => s !== current)
  })()

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
              {lead.converted && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  gap: 4, padding: '3px 10px',
                  borderRadius: 20, fontSize: 11,
                  fontWeight: 700, background: '#2F9E44',
                  color: 'white'
                }}>
                  ✓ Converted
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!lead.converted && (
              <>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowActivityDropdown(s => !s)}
                    style={{
                      padding: '7px 14px', borderRadius: 8,
                      border: '1.5px solid var(--line)',
                      background: 'var(--surface)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', color: 'var(--ink-2)'
                    }}
                  >
                    + Log Activity ▾
                  </button>
                  {showActivityDropdown && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                        onClick={() => setShowActivityDropdown(false)}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0,
                        marginTop: 4, background: 'var(--surface)',
                        border: '1.5px solid var(--line)',
                        borderRadius: 8, zIndex: 100,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        minWidth: 140, overflow: 'hidden'
                      }}>
                        {['Task', 'Meeting', 'Call'].map(type => (
                          <div key={type}
                            className="dropdown-item"
                            onClick={() => {
                              setShowActivityDropdown(false)
                              if (type === 'Task') setShowTaskModal(true)
                              if (type === 'Meeting') setShowMeetingModal(true)
                              if (type === 'Call') setShowCallModal(true)
                            }}
                            style={{
                              padding: '10px 16px', fontSize: 13,
                              cursor: 'pointer', color: 'var(--ink-1)',
                              borderBottom: '0.5px solid var(--line)'
                            }}
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn"
                    onClick={() => setShowStatusDropdown(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: lead.leadStatus === 'Connected'
                        ? 'var(--ok)'
                        : lead.leadStatus === 'Bad Timing'
                        ? 'var(--warn)'
                        : 'var(--info)',
                      flexShrink: 0
                    }} />
                    {lead.leadStatus || 'Status'} ▾
                  </button>

                  {showStatusDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      minWidth: 160,
                      overflow: 'hidden'
                    }}>
                      {statusOptions.map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setShowStatusDropdown(false)
                            setTargetStatus(s)
                            setShowStatusModal(true)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: 'var(--ink)',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--line)'
                          }}
                          onMouseEnter={e =>
                            e.currentTarget.style.background = 'var(--surface-2)'
                          }
                          onMouseLeave={e =>
                            e.currentTarget.style.background = 'none'
                          }
                        >
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: s === 'Connected'
                              ? 'var(--ok)'
                              : s === 'Bad Timing'
                              ? 'var(--warn)'
                              : 'var(--info)',
                            flexShrink: 0
                          }} />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(isAdmin || isSalesLead) && (
                  <button className="btn btn-sm" onClick={() => setShowReassign(true)}>Reassign</button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => setShowDisqualify(true)} disabled={disqualifying}>
                  {disqualifying ? 'Disqualifying…' : 'Disqualify'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setShowConvertModal(true)}>
                  Convert to deal →
                </button>
              </>
            )}
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
              { id: 'emails', label: 'Sequence' },
              { id: 'notes', label: 'Notes' },
              { id: 'utm', label: 'UTM & Tracking' },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'activity' && (
            <ActivityTab leadId={leadId} lead={lead} tabDataCache={tabDataCache} />
          )}

          {tab === 'emails' && (
            <div>
              {leadEmailsLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading emails...</div>
              ) : (() => {
                const sentMails = [...(leadEmails.mails || [])]
                  .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
                if (sentMails.length === 0) return (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    color: 'var(--ink-3)',
                    fontSize: 16,
                    fontStyle: 'italic'
                  }}>
                    No emails sent yet from cadence
                  </div>
                )
                return sentMails.map((e, i) => {
                  const dayLabel = DAY_LABELS[i] || `Day ${i + 1}`
                  const dayHeading = DAY_HEADINGS[dayLabel] || ''
                  const dayCircle = dayLabel.replace('Day ', 'D')
                  const isExpanded = expandedEmails[e.id] || false

                  return (
                    <div key={e.id} style={{
                      border: '1.5px solid var(--line)',
                      borderRadius: 12,
                      background: '#F0FFF4',
                      marginBottom: 12,
                      overflow: 'hidden'
                    }}>
                      {/* Header */}
                      <div style={{
                        background: '#E6F9ED',
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12
                      }}>
                        {/* Left — circle + title + subject + date */}
                        <div style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start'
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: '#2F9E44', color: '#fff',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700, fontSize: 13, flexShrink: 0
                          }}>
                            {dayCircle}
                          </div>
                          <div>
                            <div style={{
                              fontWeight: 600, fontSize: 15,
                              color: 'var(--ink-1)'
                            }}>
                              {dayLabel} · {dayHeading}
                            </div>
                            <div style={{
                              fontSize: 13, color: 'var(--ink-3)',
                              marginTop: 3
                            }}>
                              {e.subject}
                            </div>
                            <div style={{
                              fontSize: 12, color: 'var(--ink-3)',
                              marginTop: 4
                            }}>
                              Sent on {formatSentDate(e.date)}
                            </div>
                          </div>
                        </div>
                        {/* Right — Sent badge */}
                        <div style={{
                          background: '#2F9E44', color: '#fff',
                          padding: '4px 12px', borderRadius: 20,
                          fontSize: 13, fontWeight: 500, flexShrink: 0
                        }}>
                          ✓ Sent
                        </div>
                      </div>

                      {/* Body expand area */}
                      <div style={{ padding: '0 20px 16px' }}>
                        <div style={{
                          maxHeight: isExpanded ? 'none' : 72,
                          overflow: 'hidden',
                          marginTop: 12,
                          fontSize: 14,
                          color: 'var(--ink-2)',
                          lineHeight: 1.6
                        }}
                          dangerouslySetInnerHTML={{
                            __html: emailBodies[e.id] || e.subject
                          }}
                        />
                        <button
                          onClick={() => handleExpand(e.id)}
                          style={{
                            marginTop: 8, background: 'none',
                            border: 'none', cursor: 'pointer',
                            color: 'var(--accent)', fontSize: 13,
                            padding: 0
                          }}
                        >
                          {isExpanded ? '▲ Collapse' : '▼ Expand'}
                        </button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {tab === 'notes' && (
            <LeadNotesTab leadId={leadId} lead={lead} tabDataCache={tabDataCache} />
          )}

          {tab === 'leadfields' && (
            <div className="card">
              <div className="ws-side-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4>Lead Fields</h4>
                {!editingFields && (
                  <button onClick={() => setEditingFields(true)} style={{
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
                {/* Read-only fields */}
                {[
                  { k: 'Lead Name', v: lead.fullName || '—' },
                  { k: 'Lead Owner', v: lead.ownerName || '—' },
                  { k: 'Lead Status', v: lead.leadStatus ? <span className="pill pill-neutral">{lead.leadStatus}</span> : '—' },
                  { k: 'Lead Source', v: lead.leadSource || '—' },
                ].map((row, i) => (
                  <div key={i} className="ws-side-row">
                    <span className="k">{row.k}</span>
                    <span className="v">{row.v}</span>
                  </div>
                ))}
                {/* Editable fields */}
                {[
                  { k: 'Phone', field: 'phone' },
                  { k: 'Email', field: 'email' },
                  { k: 'Company', field: 'company' },
                  { k: 'City', field: 'city' },
                  { k: 'Website', field: 'website' },
                ].map(({ k, field }) => (
                  <div key={field} className="ws-side-row">
                    <span className="k">{k}</span>
                    {editingFields ? (
                      <input
                        value={fieldsForm[field]}
                        onChange={e => { setFieldsError(''); setFieldsForm(f => ({ ...f, [field]: e.target.value })) }}
                        style={{
                          width: '100%', padding: '6px 10px',
                          border: '1.5px solid var(--line)',
                          borderRadius: 6, fontSize: 13,
                          fontFamily: 'inherit', color: 'var(--ink-1)',
                          background: 'var(--surface)',
                        }}
                      />
                    ) : (
                      <span className="v">{lead[field] || '—'}</span>
                    )}
                  </div>
                ))}
                {/* Read-only picklist fields */}
                {[
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
                {editingFields && (
                  <div style={{ marginTop: 16 }}>
                    {fieldsError && (
                      <div style={{
                        fontSize: 12, color: '#E5484D',
                        marginBottom: 8, padding: '6px 10px',
                        background: '#FFF0F0', borderRadius: 6,
                        border: '1px solid #E5484D',
                      }}>
                        {fieldsError}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={async () => {
                        if (!validateFields()) return
                        setSavingFields(true)
                        try {
                          const res = await authFetch(`/api/leads/${leadId}/fields`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(fieldsForm),
                          })
                          const data = await res.json()
                          if (data.success) { setEditingFields(false); window.location.reload() }
                          else toast.error('Save failed: ' + (data.error || 'Unknown error'))
                        } catch (e) {
                          toast.error('Failed to save: ' + e.message)
                        } finally {
                          setSavingFields(false)
                        }
                      }}
                      disabled={savingFields}
                      style={{
                        padding: '8px 16px', borderRadius: 8,
                        border: 'none', background: '#3B5BDB',
                        color: 'white', fontSize: 13, fontWeight: 600,
                        cursor: savingFields ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: savingFields ? 0.6 : 1,
                      }}
                    >
                      {savingFields ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingFields(false)
                        setFieldsForm({
                          phone: lead.phone || '',
                          email: lead.email || '',
                          company: lead.company || '',
                          city: lead.city || '',
                          website: lead.website || '',
                        })
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
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowConvertModal(true)}>
                Convert to deal →
              </button>
              <div style={{ marginTop: 12 }}>
                {dedup === null ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking for existing records…</div>
                ) : (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
                    {/* Email Domain Section */}
                    {(() => {
                      const emailTotal = (dedup?.emailDomainMatches?.length || 0) + (dedup?.emailContactMatches?.length || 0)
                      const canExpand = !dedup?.isPersonalEmail && emailTotal > 0
                      return (
                        <div>
                          <div
                            onClick={() => canExpand && setDedupOpen(p => ({ ...p, domain: !p.domain }))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: canExpand ? 'pointer' : 'default', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {dedup?.isPersonalEmail ? (
                                <span style={{ color: 'var(--ink-3)' }}>ℹ Email domain</span>
                              ) : emailTotal > 0 ? (
                                <span style={{ color: '#C2410C', fontWeight: 600 }}>⚠ {emailTotal} record(s) with same email/domain (@{dedup.emailDomain})</span>
                              ) : (
                                <span style={{ color: '#2F9E44' }}>✓ No records with same email domain{dedup?.emailDomain ? ` (@${dedup.emailDomain})` : ''}</span>
                              )}
                            </div>
                            {canExpand && (
                              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{dedupOpen.domain ? '▲' : '▼'}</span>
                            )}
                          </div>
                          {dedup?.isPersonalEmail && (
                            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--ink-3)', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                              {dedup.emailDomain} is a personal email domain — duplicate check skipped. Use phone or brand to verify.
                            </div>
                          )}
                          {dedupOpen.domain && emailTotal > 0 && (
                            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(dedup?.emailDomainMatches || []).map(m => (
                                <div key={m.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                                    {m.fullName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Lead)</span>
                                    {m.converted && <span style={{ marginLeft: 6, color: '#2F9E44', fontWeight: 400 }}>✓ Converted</span>}
                                  </div>
                                  <div>{m.email}</div>
                                  <div>📞 {m.phone || '—'}</div>
                                  <div>Status: <strong>{m.leadStatus}</strong></div>
                                  {!m.converted && (
                                    <button onClick={() => { setMergeConfirm(m.id); setMergeError(null) }}
                                      style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1.5px solid #C2410C', background: 'transparent', fontSize: 11, cursor: 'pointer', color: '#C2410C', fontFamily: 'inherit', fontWeight: 600 }}>
                                      Merge with this lead →
                                    </button>
                                  )}
                                </div>
                              ))}
                              {(dedup?.emailContactMatches || []).map(m => (
                                <div key={m.id} style={{ padding: '8px 10px', background: '#EEF2FF', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                                  <div style={{ fontWeight: 600, color: '#3B5BDB' }}>
                                    {m.fullName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Contact)</span>
                                  </div>
                                  <div>{m.email}</div>
                                  <div>📞 {m.phone || '—'}</div>
                                  <div>Account: {m.accountName || '—'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    {/* Phone Section */}
                    {(() => {
                      const phoneTotal = (dedup?.phoneMatches?.length || 0) + (dedup?.phoneContactMatches?.length || 0)
                      const canExpand = lead?.phone && phoneTotal > 0
                      return (
                        <div>
                          <div
                            onClick={() => canExpand && setDedupOpen(p => ({ ...p, phone: !p.phone }))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: canExpand ? 'pointer' : 'default', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}
                          >
                            <div>
                              {!lead?.phone ? (
                                <span style={{ color: 'var(--ink-3)' }}>ℹ No phone number on this lead</span>
                              ) : phoneTotal > 0 ? (
                                <span style={{ color: '#C2410C', fontWeight: 600 }}>⚠ {phoneTotal} record(s) with same phone number</span>
                              ) : (
                                <span style={{ color: '#2F9E44' }}>✓ No records with same phone number</span>
                              )}
                            </div>
                            {canExpand && (
                              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{dedupOpen.phone ? '▲' : '▼'}</span>
                            )}
                          </div>
                          {dedupOpen.phone && phoneTotal > 0 && (
                            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(dedup?.phoneMatches || []).map(m => (
                                <div key={m.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                                    {m.fullName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Lead)</span>
                                    {m.converted && <span style={{ marginLeft: 6, color: '#2F9E44', fontWeight: 400 }}>✓ Converted</span>}
                                  </div>
                                  <div>{m.email}</div>
                                  <div>🏢 {m.company || '—'}</div>
                                  <div>Status: <strong>{m.leadStatus}</strong></div>
                                  {!m.converted && (
                                    <button onClick={() => { setMergeConfirm(m.id); setMergeError(null) }}
                                      style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1.5px solid #C2410C', background: 'transparent', fontSize: 11, cursor: 'pointer', color: '#C2410C', fontFamily: 'inherit', fontWeight: 600 }}>
                                      Merge with this lead →
                                    </button>
                                  )}
                                </div>
                              ))}
                              {(dedup?.phoneContactMatches || []).map(m => (
                                <div key={m.id} style={{ padding: '8px 10px', background: '#EEF2FF', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                                  <div style={{ fontWeight: 600, color: '#3B5BDB' }}>
                                    {m.fullName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Contact)</span>
                                  </div>
                                  <div>{m.email}</div>
                                  <div>🏢 Account: {m.accountName || '—'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    {/* Brand Section */}
                    <div>
                      <div
                        onClick={() => {
                          const total = (dedup?.brandLeadMatches?.length || 0) + (dedup?.brandDealMatches?.length || 0)
                          if (total > 0) setDedupOpen(p => ({ ...p, brand: !p.brand }))
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: ((dedup?.brandLeadMatches?.length || 0) + (dedup?.brandDealMatches?.length || 0)) > 0 ? 'pointer' : 'default', background: 'var(--surface)' }}
                      >
                        <div>
                          {((dedup?.brandLeadMatches?.length || 0) + (dedup?.brandDealMatches?.length || 0)) > 0 ? (
                            <span style={{ color: '#C2410C', fontWeight: 600 }}>⚠ {(dedup?.brandLeadMatches?.length || 0) + (dedup?.brandDealMatches?.length || 0)} existing record(s) — brand name match</span>
                          ) : (
                            <span style={{ color: '#2F9E44' }}>✓ No existing leads or deals — brand name match</span>
                          )}
                        </div>
                        {((dedup?.brandLeadMatches?.length || 0) + (dedup?.brandDealMatches?.length || 0)) > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{dedupOpen.brand ? '▲' : '▼'}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '6px 14px', background: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>
                        Searching for brand name: <strong>"{lead.company}"</strong> — exact company name match
                      </div>
                      {dedupOpen.brand && (
                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(dedup?.brandLeadMatches || []).map(m => (
                            <div key={m.id} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                              <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                                {m.fullName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Lead)</span>
                                {m.converted && <span style={{ marginLeft: 6, color: '#2F9E44', fontWeight: 400 }}>✓ Converted</span>}
                              </div>
                              <div>{m.email}</div>
                              <div>Status: <strong>{m.leadStatus}</strong></div>
                              <div style={{ color: 'var(--ink-3)' }}>Matched on: Company name "{m.company}"</div>
                            </div>
                          ))}
                          {(dedup?.brandDealMatches || []).map(m => (
                            <div key={m.id} style={{ padding: '8px 10px', background: '#EEF2FF', borderRadius: 6, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                              <div style={{ fontWeight: 600, color: '#3B5BDB' }}>
                                {m.dealName} <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--ink-3)' }}>(Deal)</span>
                              </div>
                              <div>Stage: {m.stage}</div>
                              <div>Pipeline: {m.pipeline || '—'}</div>
                              <div>Account: {m.accountName || '—'}</div>
                              <div>Rep: {m.ownerName}</div>
                              <div style={{ color: 'var(--ink-3)' }}>Matched on: Deal name contains "{lead.company}"</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {mergeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Merge Duplicate Lead</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20, lineHeight: 1.6 }}>
              The older lead will be kept as master. The newer lead will be merged into it and disappear. Non-empty fields from the newer lead will be preserved if the older lead's field is empty.
              <br /><br />
              <strong>This action cannot be undone.</strong>
            </div>
            {mergeError && (
              <div style={{ color: '#E5484D', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: '#FEF2F2', borderRadius: 6 }}>
                {mergeError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setMergeConfirm(null); setMergeError(null) }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                disabled={merging}
                onClick={async () => {
                  setMerging(true)
                  setMergeError(null)
                  try {
                    const res = await authFetch(`/api/leads/${lead.id}/merge`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ duplicateLeadId: mergeConfirm }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      setMergeConfirm(null)
                      navigate('/leads')
                    } else {
                      setMergeError(data.error || 'Merge failed')
                    }
                  } catch (e) {
                    setMergeError(e.message || 'Merge failed')
                  } finally {
                    setMerging(false)
                  }
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#E5484D', fontSize: 13, fontWeight: 700, cursor: merging ? 'not-allowed' : 'pointer', color: 'white', fontFamily: 'inherit', opacity: merging ? 0.6 : 1 }}>
                {merging ? 'Merging…' : 'Yes, Merge →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          dealId={lead.id}
          onClose={() => setShowTaskModal(false)}
          onSubmit={async (data) => {
            const res = await authFetch(`/api/leads/${lead.id}/tasks`, { method: 'POST', body: JSON.stringify(data) })
            const json = await res.json()
            if (json.success) setShowTaskModal(false)
            else toast.error(json.error || 'Failed to create task')
          }}
        />
      )}

      {showMeetingModal && (
        <LeadMeetingModal
          leadId={lead.id}
          onClose={() => setShowMeetingModal(false)}
          onSuccess={() => setShowMeetingModal(false)}
        />
      )}

      {showCallModal && (
        <LeadCallModal
          leadId={lead.id}
          onClose={() => setShowCallModal(false)}
          onSuccess={() => setShowCallModal(false)}
        />
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

      {showConvertModal && (
        <ConvertLeadModal
          lead={lead}
          onClose={() => setShowConvertModal(false)}
          onSuccess={(data) => {
            setShowConvertModal(false)
            navigate(`/pipeline/${data.dealId}`)
          }}
        />
      )}

      {showStatusModal && targetStatus && (
        <ChangeStatusModal
          lead={lead}
          targetStatus={targetStatus}
          onClose={() => {
            setShowStatusModal(false)
            setTargetStatus(null)
          }}
          onSuccess={(newStatus) => {
            setShowStatusModal(false)
            setTargetStatus(null)
            setLead(prev => ({ ...prev, leadStatus: newStatus }))
            if (tabDataCache?.current) {
              delete tabDataCache.current.activity
              delete tabDataCache.current.notes
            }
          }}
        />
      )}
    </div>
  )
}

function ActivityTab({ leadId, lead, tabDataCache }) {
  const { authFetch } = useAuth()
  const cached = tabDataCache?.current?.activity
  const [loading, setLoading] = useState(!cached)
  const [tasks, setTasks] = useState(cached?.tasks || [])
  const [meetings, setMeetings] = useState(cached?.meetings || [])
  const [calls, setCalls] = useState(cached?.calls || [])
  const [systemEvents, setSystemEvents] = useState(cached?.systemEvents || [])
  const [localCompleted, setLocalCompleted] = useState(cached?.localCompleted || new Set())
  const [confirmModal, setConfirmModal] = useState(null)
  const [activeChip, setActiveChip] = useState('All')
  const [expandedDesc, setExpandedDesc] = useState({})
  const [showDropdown, setShowDropdown] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

  const fetchAll = useCallback(async (signal) => {
    setLoading(true)
    try {
      const [tRes, mRes, cRes, evRes] = await Promise.all([
        authFetch(`/api/leads/${leadId}/tasks`, { signal }).then(r => r.json()),
        authFetch(`/api/leads/${leadId}/meetings`, { signal }).then(r => r.json()),
        authFetch(`/api/leads/${leadId}/calls`, { signal }).then(r => r.json()),
        authFetch(`/api/leads/${leadId}/timeline`, { signal }).then(r => r.json()),
      ])
      const newTasks = tRes.tasks || []
      const newMeetings = mRes.meetings || []
      const newCalls = cRes.calls || []
      const newEvents = evRes.events || []
      setTasks(newTasks)
      setMeetings(newMeetings)
      setCalls(newCalls)
      setSystemEvents(newEvents)
      if (tabDataCache) {
        tabDataCache.current.activity = {
          tasks: newTasks, meetings: newMeetings, calls: newCalls,
          systemEvents: newEvents, localCompleted: new Set(),
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [leadId, authFetch, tabDataCache])

  useEffect(() => {
    if (tabDataCache?.current?.activity) return // already hydrated from cache — skip the network fetch
    const controller = new AbortController()
    fetchAll(controller.signal)
    return () => controller.abort()
  }, [fetchAll, tabDataCache])

  useEffect(() => {
    if (!showDropdown) return
    const handler = (e) => {
      if (!e.target.closest('[data-activity-dropdown]')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  function toggleTask(taskId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/leads/${leadId}/tasks/${taskId}`, { method: 'PATCH' })
        setTasks(prev => {
          const next = prev.map(t => t.id === taskId ? { ...t, status: 'Completed' } : t)
          if (tabDataCache?.current?.activity) {
            tabDataCache.current.activity = { ...tabDataCache.current.activity, tasks: next }
          }
          return next
        })
        toast.success('Task marked complete')
      }
    })
  }

  function completeMeeting(meetingId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/leads/${leadId}/meeting/${meetingId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => {
          const next = new Set([...prev, meetingId])
          if (tabDataCache?.current?.activity) {
            tabDataCache.current.activity = { ...tabDataCache.current.activity, localCompleted: next }
          }
          return next
        })
      }
    })
  }

  function completeCall(callId) {
    setConfirmModal({
      onConfirm: async () => {
        setConfirmModal(null)
        await authFetch(`/api/leads/${leadId}/call/${callId}/complete`, { method: 'PATCH' })
        setLocalCompleted(prev => {
          const next = new Set([...prev, callId])
          if (tabDataCache?.current?.activity) {
            tabDataCache.current.activity = { ...tabDataCache.current.activity, localCompleted: next }
          }
          return next
        })
      }
    })
  }

  // Normalize tasks/meetings/calls/notes/system events into one shape
  const items = [
    ...tasks.map(t => ({
      id: `task-${t.id}`, type: 'task', title: t.subject || 'Task',
      status: t.status === 'Completed' ? 'completed' : 'open',
      dueDate: t.dueDate || '', priority: t.priority || '', ownerName: t.ownerName || '',
      description: t.description || '',
      createdAt: t.dueDate || '', raw: t,
    })),
    ...meetings.map(m => ({
      id: `meeting-${m.id}`, type: 'meeting', title: m.title || 'Meeting',
      status: ((m.to && new Date(m.to) < new Date()) || localCompleted.has(m.id)) ? 'completed' : 'scheduled',
      dueDate: m.from || '', priority: '', ownerName: m.createdBy || '',
      description: m.description || '',
      createdAt: m.from || '', raw: m,
    })),
    ...calls.map(c => ({
      id: `call-${c.id}`, type: 'call', title: c.subject || (c.purpose && c.purpose !== 'None' ? c.purpose : 'Call'),
      status: ((c.status !== 'Scheduled' && c.status !== 'scheduled' && c.status !== '' && c.status != null) || localCompleted.has(c.id)) ? 'completed' : 'scheduled',
      dueDate: c.timing || '', priority: '', ownerName: c.createdBy || '',
      description: [
        c.agenda && `Agenda: ${c.agenda}`,
        c.result && `Result: ${c.result}`,
        c.description && `Notes: ${c.description}`
      ].filter(Boolean).join('\n') || '',
      createdAt: c.timing || '', raw: c,
    })),
    ...(lead?.notes || []).map((n, i) => ({
      id: `note-${n.id || i}`, type: 'note',
      title: (() => {
        const raw = n.Note_Content || n.content || ''
        const stripped = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        return stripped.slice(0, 120) || 'Note added'
      })(),
      status: 'completed', dueDate: '', priority: '',
      ownerName: n.Created_By?.name || n.createdBy || '',
      createdAt: n.Created_Time || n.date || '', raw: n,
    })),
    ...systemEvents.map(e => ({
      id: `system-${e.id}`, type: 'system', title: e.description || 'Update',
      status: 'completed', dueDate: '', priority: '', ownerName: e.actor || 'System',
      createdAt: e.createdAt || '', raw: e,
    })),
  ]

  const openItems = items
    .filter(i => (i.type === 'task' || i.type === 'meeting' || i.type === 'call') && i.status !== 'completed')
    .sort((a, b) => {
      const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return av - bv
    })

  const historyItems = items
    .filter(i => i.status === 'completed' && i.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const CHIPS = ['All', 'Tasks', 'Calls', 'Meetings', 'Notes', 'System']
  const CHIP_TYPE = { Tasks: 'task', Calls: 'call', Meetings: 'meeting', Notes: 'note', System: 'system' }
  const filteredHistory = activeChip === 'All' ? historyItems : historyItems.filter(i => i.type === CHIP_TYPE[activeChip])

  const TYPE_ICON = {
    task: <CheckSquare size={12} />, meeting: <Calendar size={12} />,
    call: <Phone size={12} />, note: <StickyNote size={12} />, system: <RefreshCw size={12} />,
  }
  const TYPE_COLOR = { task: '#2F9E44', call: '#C2410C', meeting: '#3B5BDB', note: '#9333EA', system: '#6B7280' }
  const TYPE_PILL_STYLE = {
    task:    { background: '#F0F4FF', color: '#3B5BDB' },
    meeting: { background: '#F0FFF4', color: '#2F9E44' },
    call:    { background: '#FFF0F6', color: '#C2255C' },
  }
  const typePill = (type) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block', textTransform: 'capitalize', ...(TYPE_PILL_STYLE[type] || {}) }}>{type}</span>
  )

  function dueBadge(dueDate) {
    if (!dueDate) return null
    const dateOnly = dueDate.slice(0, 10)
    if (dateOnly < todayStr) return <span style={{ fontSize: 11, fontWeight: 700, color: '#E5484D' }}>Overdue</span>
    if (dateOnly === todayStr) return <span style={{ fontSize: 11, fontWeight: 700, color: '#C2410C' }}>Due today</span>
    return <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{formatActivityDate(dueDate)}</span>
  }

  function renderDescription(item, { lines, borderColor, background, marginTop, marginBottom }) {
    if (!item.description) return null
    const isLong = item.description.length > 50 ||
                   item.description.includes('\n')
    const expanded = expandedDesc[item.id]
    return (
      <div
        onClick={() => isLong && setExpandedDesc(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
        style={{ cursor: isLong ? 'pointer' : 'default' }}
      >
        <div style={{
          marginTop, marginBottom,
          padding: '8px 10px', background, borderRadius: 8,
          borderLeft: `2.5px solid ${borderColor}`,
          fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6,
          whiteSpace: 'pre-line',
          ...(expanded ? {} : { maxHeight: `${lines * 20}px`, overflow: 'hidden' }),
        }}>
          {item.description}
        </div>
        {isLong && (
          <span style={{ fontSize: 11, color: 'var(--info)', cursor: 'pointer', display: 'block', marginTop: 4 }}>
            {expanded ? 'Show less ▲' : 'Show more ▼'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* OPEN · NEXT STEPS */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink-3)' }}>OPEN · NEXT STEPS</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setShowTaskModal(true)}>+ New task</button>
            <div data-activity-dropdown style={{ position: 'relative' }}>
              <button className="btn btn-sm btn-primary" onClick={() => setShowDropdown(v => !v)}>Log Activity ▾</button>
              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 200,
                  background: 'var(--surface)', border: '1px solid var(--line-2)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)',
                  marginTop: 4, minWidth: 140, overflow: 'hidden'
                }}>
                  {['Task', 'Meeting', 'Call'].map(item => (
                    <button key={item}
                      className="dropdown-item"
                      onClick={() => {
                        setShowDropdown(false)
                        if (item === 'Task') setShowTaskModal(true)
                        else if (item === 'Meeting') setShowMeetingModal(true)
                        else setShowCallModal(true)
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--ink)', fontFamily: 'inherit' }}
                    >{item}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <SkeletonCard key={i} rows={2} />
            ))}
          </div>
        ) : openItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '20px 0' }}>
            No open tasks. Use "+ New task" to add one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openItems.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={false}
                  onChange={() => {
                    if (item.type === 'task') toggleTask(item.raw.id)
                    else if (item.type === 'meeting') completeMeeting(item.raw.id)
                    else completeCall(item.raw.id)
                  }}
                  style={{ cursor: 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{item.title}</span>
                    {typePill(item.type)}
                    {dueBadge(item.dueDate)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {[item.priority && `Priority: ${item.priority}`, item.ownerName && `Assigned: ${item.ownerName}`].filter(Boolean).join(' · ')}
                  </div>
                  {renderDescription(item, { lines: 3, borderColor: 'var(--info)', background: 'var(--bg)', marginTop: 8, marginBottom: 0 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORY */}
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink-3)' }}>HISTORY</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map(chip => (
              <button key={chip} onClick={() => setActiveChip(chip)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: activeChip === chip ? 'var(--ink)' : 'var(--surface-2)',
                  color: activeChip === chip ? 'var(--surface)' : 'var(--ink-2)',
                  border: activeChip === chip ? '0.5px solid var(--ink)' : '0.5px solid var(--line)',
                  fontWeight: activeChip === chip ? 500 : 400,
                }}
              >{chip}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine width={i % 2 === 0 ? '50%' : '35%'} height={13} />
                  <SkeletonLine width="25%" height={11} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '20px 0' }}>No history yet.</div>
        ) : (
          <div>
            {filteredHistory.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i === filteredHistory.length - 1 ? 0 : 16 }}>
                {i !== filteredHistory.length - 1 && (
                  <div style={{ position: 'absolute', left: 9, top: 20, bottom: 0, width: 2, background: 'var(--line)' }} />
                )}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: (TYPE_COLOR[item.type] || '#6B7280') + '18',
                  color: TYPE_COLOR[item.type] || '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, zIndex: 1,
                }}>
                  {TYPE_ICON[item.type]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{item.title}</div>
                  {renderDescription(item, { lines: 2, borderColor: 'var(--line-2)', background: 'var(--surface-2)', marginTop: 6, marginBottom: 4 })}
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                    {[item.ownerName, formatActivityDate(item.createdAt)].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          dealId={leadId}
          onClose={() => setShowTaskModal(false)}
          onSubmit={async (data) => {
            const res = await authFetch(`/api/leads/${leadId}/tasks`, { method: 'POST', body: JSON.stringify(data) })
            const json = await res.json()
            if (json.success) { setShowTaskModal(false); fetchAll() }
            else toast.error(json.error || 'Failed to create task')
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '28px 32px', maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>Mark as completed?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>This action cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={confirmModal.onConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#E5484D', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#FFFFFF', fontFamily: 'inherit' }}>Yes, mark complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadNotesTab({ leadId, lead, tabDataCache }) {
  const { authFetch } = useAuth()
  const cachedNotes = tabDataCache?.current?.notes
  const [d1Notes, setD1Notes] = useState(cachedNotes || [])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(!cachedNotes)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tabDataCache?.current?.notes) return // already hydrated from cache — skip the network fetch
    authFetch(`/api/leads/${leadId}/notes`)
      .then(r => r.json())
      .then(d => {
        const notes = d.notes || []
        setD1Notes(notes)
        if (tabDataCache) tabDataCache.current.notes = notes
      })
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
        setD1Notes(prev => {
          const next = [data.note, ...prev]
          if (tabDataCache) tabDataCache.current.notes = next
          return next
        })
        setNewNote('')
        toast.success('Note saved')
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
  const d1Times = new Set(d1Notes.map(n => (n.created_at || n.createdAt || '').slice(0, 16)))
  const zohoNotes = (lead?.notes || []).map(n => ({
    id: n.id,
    content: n.Note_Content || n.description || n.content,
    authorName: n.Created_By?.name || n.createdBy,
    date: n.Created_Time || n.date,
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
      date: n.created_at || n.createdAt,
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
            {(() => {
              const isHTML = (text) => /<[a-z][\s\S]*>/i.test(text || '')
              return isHTML(note.content)
                ? <div
                    style={{ fontSize: 13, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
                  />
                : <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {note.content}
                  </div>
            })()}
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

function LeadMeetingModal({ leadId, onClose, onSuccess }) {
  const { authFetch } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', venue: 'Online', from: '', to: '', description: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.title.trim() || !form.from || !form.to) return toast.warn('Title, From and To are required')
    if (form.to <= form.from) return toast.warn('End time must be after start time')
    setSaving(true)
    try {
      const res = await authFetch(`/api/leads/${leadId}/meeting`, {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else toast.error(data.error || 'Failed to create meeting')
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
    if (!form.callTiming) return toast.warn('Call timing is required')
    setSaving(true)
    try {
      const endpoint = callMode === 'log' ? 'log-call' : 'schedule-call'
      const res = await authFetch(`/api/leads/${leadId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else toast.error(data.error || 'Failed to log call')
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
      if (data.success) { toast.success('Lead reassigned'); onSuccess() }
      else toast.error(data.error || 'Failed to reassign lead')
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
