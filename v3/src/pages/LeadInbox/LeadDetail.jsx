import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Loading } from '../../components/ui'

export default function LeadDetail() {
  const { leadId } = useParams()
  const navigate = useNavigate()
  const { authFetch } = useAuth()

  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('activity')
  const [disqualifying, setDisqualifying] = useState(false)

  useEffect(() => {
    authFetch(`/api/leads/${leadId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setLead(data)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [leadId, authFetch])

  if (loading) return <div className="main"><Loading text="Loading lead…" /></div>
  if (error || !lead) return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/leads')} style={{ marginBottom: 10 }}>← Back to Lead Inbox</button>
      <div className="callout danger">{error || 'Lead not found'}</div>
    </div>
  )

  const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'
  const company = lead.companyName || lead.company || fullName

  async function handleDisqualify() {
    if (!confirm(`Disqualify ${company}?`)) return
    setDisqualifying(true)
    try {
      await authFetch(`/api/leads/${leadId}/disqualify`, { method: 'POST' })
      navigate('/leads')
    } catch {
      alert('Failed to disqualify. Please try again.')
      setDisqualifying(false)
    }
  }

  const fields = [
    { k: 'Full Name', v: fullName },
    { k: 'Email', v: lead.email || '—' },
    { k: 'Phone', v: lead.phone || '—' },
    { k: 'Company', v: company },
    { k: 'Volume', v: lead.orderVolume || '—' },
    { k: 'Source', v: lead.leadSource || '—' },
    { k: 'Lead Type', v: lead.leadType || '—' },
    { k: 'Status', v: lead.leadStatus || '—' },
    { k: 'Owner', v: lead.ownerName || '—' },
    { k: 'Created', v: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—' },
  ]

  return (
    <div className="main">
      <button className="btn btn-ghost" onClick={() => navigate('/leads')} style={{ marginBottom: 10 }}>
        ← Back to Lead Inbox
      </button>

      <div className="hdr-strip">
        <div>
          <h2 className="deal-name">{company}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{fullName !== company ? fullName : lead.email}</div>
        </div>
        {lead.leadStatus && <span className="pill pill-neutral">{lead.leadStatus}</span>}
        {lead.leadSource && <span className="pill pill-info">{lead.leadSource}</span>}
      </div>

      <div className="ws-grid" style={{ marginTop: 14 }}>
        <div className="ws-main">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => alert('Coming soon')}>Log Call</button>
            <button
              className="btn btn-danger"
              onClick={handleDisqualify}
              disabled={disqualifying}
            >
              {disqualifying ? 'Disqualifying…' : 'Disqualify'}
            </button>
            <button className="btn btn-primary" onClick={() => alert('Coming soon')}>Convert →</button>
          </div>

          <div className="tabs">
            {[
              { id: 'activity', label: 'Activity' },
              { id: 'notes', label: 'Notes' },
            ].map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'activity' && (
            <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
              No activity yet. Log a call to start.
            </div>
          )}
          {tab === 'notes' && (
            <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
              No notes yet.
            </div>
          )}
        </div>

        <div className="ws-side">
          <div className="card">
            <div className="ws-side-head"><h4>Lead fields</h4></div>
            <div className="ws-side-body">
              {fields.map(row => (
                <div key={row.k} className="ws-side-row">
                  <span className="k">{row.k}</span>
                  <span className="v">{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
