import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/ui'
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
  const [convertError, setConvertError] = useState(null)
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
  const [cadences, setCadences] = useState([])
  const [cadencesLoading, setCadencesLoading] = useState(false)
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
    if (tab !== 'cadence' || !lead?.id) return
    setCadencesLoading(true)
    authFetch(`/api/leads/${lead.id}/cadences`)
      .then(r => r.json())
      .then(d => setCadences(d.cadences || []))
      .catch(() => setCadences([]))
      .finally(() => setCadencesLoading(false))
  }, [tab, lead?.id])

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
    setConvertError(null)
    try {
      const res = await authFetch(`/api/leads/${leadId}/convert`, {
        method: 'POST'
      })
      const contentType = res.headers.get('content-type')
      let data
      if (contentType && contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        throw new Error(`Server error: ${res.status} ${text.slice(0, 100)}`)
      }

      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed')
      }

      if (!data.success) {
        throw new Error(data.error || 'Conversion failed')
      }

      navigate(`/pipeline/${data.dealId}`)
    } catch (err) {
      setConvertError(err.message || 'Conversion failed. Please try again.')
    } finally {
      setConverting(false)
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
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {(isAdmin || isSalesLead) && (
                  <button className="btn btn-sm" onClick={() => setShowReassign(true)}>Reassign</button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => setShowDisqualify(true)} disabled={disqualifying}>
                  {disqualifying ? 'Disqualifying…' : 'Disqualify'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={handleConvert} disabled={converting}>
                  {converting ? 'Converting…' : 'Convert to deal →'}
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
              { id: 'timeline', label: 'Timeline' },
              { id: 'activities', label: 'Activities' },
              { id: 'cadence', label: 'Cadence' },
              { id: 'notes', label: 'Notes' },
              { id: 'utm', label: 'UTM & Tracking' },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'timeline' && (
            <LeadTimelineTab leadId={leadId} lead={lead} />
          )}

          {tab === 'activities' && (
            <LeadActivitiesTab leadId={leadId} />
          )}

          {tab === 'cadence' && (
            <div style={{ padding: '16px 0' }}>
              {cadencesLoading ? (
                <div style={{
                  textAlign: 'center', padding: 40,
                  color: 'var(--ink-3)', fontSize: 13
                }}>Loading cadences...</div>
              ) : cadences.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: 40,
                  color: 'var(--ink-3)', fontSize: 13
                }}>No cadences enrolled for this lead</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: 12
                  }}>
                    <thead>
                      <tr>
                        {['Cadence Name', 'Start Date',
                          'Enrolled By', 'Status',
                          'Member Status', 'Last Follow-up',
                          'Last Follow-up Date', 'Next Follow-up',
                          'Last Type', 'Completed Date'
                        ].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontSize: 11, fontWeight: 600,
                            color: 'var(--ink-3)',
                            borderBottom: '1px solid var(--line)',
                            whiteSpace: 'nowrap',
                            background: 'var(--surface)'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cadences.map(cad => (
                        <tr key={cad.id} style={{
                          borderBottom: '0.5px solid var(--line)'
                        }}>
                          <td style={{
                            padding: '10px 12px',
                            fontWeight: 600,
                            color: 'var(--ink-1)'
                          }}>{cad.cadenceName || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.startDate
                              ? new Date(cad.startDate).toLocaleDateString('en-IN')
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.enrolledBy || '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 20, fontSize: 11,
                              fontWeight: 600,
                              background: cad.cadenceStatus === 'Ongoing' ? '#EEF2FF' : '#F0FFF4',
                              color: cad.cadenceStatus === 'Ongoing' ? '#3B5BDB' : '#2F9E44'
                            }}>
                              {cad.cadenceStatus || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 20, fontSize: 11,
                              fontWeight: 500,
                              background: '#F5F5F5',
                              color: 'var(--ink-2)'
                            }}>
                              {cad.memberStatus || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.lastFollowUpResponse || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.lastFollowUpDate
                              ? new Date(cad.lastFollowUpDate).toLocaleDateString('en-IN')
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.nextFollowUp || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.lastFollowUpType || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                            {cad.completedDate
                              ? new Date(cad.completedDate).toLocaleDateString('en-IN')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <LeadNotesTab leadId={leadId} lead={lead} />
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
                          else alert('Save failed: ' + (data.error || 'Unknown error'))
                        } catch (e) {
                          alert('Failed to save: ' + e.message)
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
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to deal →'}
              </button>
              {convertError && (
                <div style={{
                  color: '#E5484D', fontSize: 12,
                  marginTop: 6, textAlign: 'center'
                }}>
                  {convertError}
                </div>
              )}
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
            else alert(json.error || 'Failed to create task')
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
    </div>
  )
}

function LeadTimelineTab({ leadId, lead }) {
  const { authFetch } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      authFetch(`/api/leads/${leadId}/tasks`).then(r => r.json()).catch(() => ({ tasks: [] })),
      authFetch(`/api/leads/${leadId}/meetings`).then(r => r.json()).catch(() => ({ meetings: [] })),
      authFetch(`/api/leads/${leadId}/calls`).then(r => r.json()).catch(() => ({ calls: [] })),
    ]).then(([tData, mData, cData]) => {
      const taskEvents = (tData.tasks || []).map(t => ({
        id: `task-${t.id}`,
        event_type: 'task_created',
        description: t.subject || 'Task',
        actor_name: t.ownerName || '',
        created_at: t.dueDate || t.createdTime || '',
        source: 'zoho',
      }))
      const meetingEvents = (mData.meetings || []).map(m => ({
        id: `meeting-${m.id}`,
        event_type: 'meeting_created',
        description: m.title || 'Meeting',
        actor_name: m.createdBy || '',
        created_at: m.from || '',
        source: 'zoho',
      }))
      const callEvents = (cData.calls || []).map(c => ({
        id: `call-${c.id}`,
        event_type: c.status === 'Scheduled' ? 'call_scheduled' : 'call_logged',
        description: c.subject || (c.purpose && c.purpose !== 'None' ? c.purpose : 'Call'),
        actor_name: c.createdBy || '',
        created_at: c.timing || '',
        source: 'zoho',
      }))
      const noteEvents = (lead?.notes || []).map((n, i) => ({
        id: `note-${n.id || i}`,
        event_type: 'note_added',
        description: (n.Note_Content || n.content || '').slice(0, 120) || 'Note added',
        actor_name: n.Created_By?.name || n.createdBy || '',
        created_at: n.Created_Time || n.date || '',
        source: 'zoho',
      }))
      const all = [...taskEvents, ...meetingEvents, ...callEvents, ...noteEvents]
        .filter(e => e.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setEvents(all)
    }).finally(() => setLoading(false))
  }, [leadId])

  const iconMap = {
    task_created:    <CheckSquare size={14} />,
    meeting_created: <Calendar size={14} />,
    call_logged:     <Phone size={14} />,
    call_scheduled:  <Phone size={14} />,
    note_added:      <StickyNote size={14} />,
  }
  const colorMap = {
    task_created:    '#3B5BDB',
    meeting_created: '#2F9E44',
    call_logged:     '#C2255C',
    call_scheduled:  '#C2255C',
    note_added:      '#6B7280',
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
                  <span style={{ marginLeft: 6, fontSize: 10, background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Zoho CRM</span>
                </div>
              )}
              {!event.actor_name && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  <span style={{ fontSize: 10, background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Zoho CRM</span>
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
