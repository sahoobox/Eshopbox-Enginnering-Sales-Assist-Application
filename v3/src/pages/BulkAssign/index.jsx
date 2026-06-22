import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { Topbar } from '../../components/ui'

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  return diff >= 0 ? diff : null
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

const SELECT_LIMIT = 100

// ── Confirmation Modal ────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '28px 32px',
        maxWidth: 400, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--line)',
              background: 'transparent', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit'
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#E5484D', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', color: 'white', fontFamily: 'inherit'
            }}
          >Yes, Reassign</button>
        </div>
      </div>
    </div>
  )
}

// ── Reassign Modal ────────────────────────────────────────
function ReassignModal({ module, count, assignableUsers, onConfirm, onClose }) {
  const [selectedUser, setSelectedUser] = useState(null)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-3)', width: 400, padding: 24
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Reassign {count} {module.slice(0, -1)}{count !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
          Select a team member to assign these {module.toLowerCase()} to.
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
          Assign to
        </label>
        <select
          value={selectedUser ? JSON.stringify(selectedUser) : ''}
          onChange={e => setSelectedUser(e.target.value ? JSON.parse(e.target.value) : null)}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 6,
            border: '1.5px solid var(--line)', fontSize: 13,
            background: 'var(--surface)', color: 'var(--ink-1)', marginBottom: 20
          }}
        >
          <option value="">— Select person —</option>
          {assignableUsers.map(u => (
            <option key={u.email} value={JSON.stringify({ name: u.name, email: u.email })}>
              {u.name} · {u.role}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }}
            disabled={!selectedUser}
            onClick={() => selectedUser && onConfirm(selectedUser)}
          >
            Confirm Reassign →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Deals Tab ─────────────────────────────────────────────
function DealsTab({ deals, searchQuery, setSearchQuery, selectedIds, setSelectedIds }) {
  const { role } = useAuth()
  const defaultPipeline = role === ROLES.SALES_LEAD_MIDMARKET ? 'midmarket' : role === ROLES.SALES_LEAD_ENTERPRISE ? 'enterprise' : 'all'
  const [pipeline, setPipeline] = useState(defaultPipeline)
  const [stageFilter, setStageFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sort, setSort] = useState('desc')

  const stages = useMemo(() => [...new Set(deals.map(d => d.stage).filter(Boolean))].sort(), [deals])
  const owners = useMemo(() => [...new Set(deals.map(d => d.repName).filter(Boolean))].sort(), [deals])

  const filtered = useMemo(() => {
    let d = deals
    if (pipeline === 'midmarket') d = d.filter(x => x.pipeline === 'Mid-market')
    else if (pipeline === 'enterprise') d = d.filter(x => x.pipeline === 'Enterprise 2.0')
    if (stageFilter !== 'all') d = d.filter(x => x.stage === stageFilter)
    if (ownerFilter !== 'all') d = d.filter(x => x.repName === ownerFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      d = d.filter(x =>
        (x.brandName || x.dealName || '').toLowerCase().includes(q) ||
        (x.repName || '').toLowerCase().includes(q) ||
        (x.stage || '').toLowerCase().includes(q)
      )
    }
    return [...d].sort((a, b) => {
      const da = new Date(a.modifiedTime || a.demoDate || 0)
      const db = new Date(b.modifiedTime || b.demoDate || 0)
      return sort === 'desc' ? db - da : da - db
    })
  }, [deals, searchQuery, pipeline, stageFilter, ownerFilter, sort])

  const atLimit = selectedIds.size >= SELECT_LIMIT
  const allSelected = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id))
  const someSelected = filtered.some(d => selectedIds.has(d.id))

  const toggleAll = () => {
    if (allSelected || someSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(d => next.delete(d.id))
        return next
      })
    } else {
      const toAdd = filtered.slice(0, SELECT_LIMIT)
      setSelectedIds(new Set(toAdd.map(d => d.id)))
    }
  }

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < SELECT_LIMIT) {
        next.add(id)
      }
      return next
    })
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search brand, owner, stage..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '8px 12px',
            border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13,
            background: 'var(--surface)', color: 'var(--ink-1)'
          }}
        />
        {role === ROLES.ADMIN && (
          <div className="seg">
            {[['all','All'],['midmarket','Mid-Market'],['enterprise','Enterprise']].map(([v,l]) => (
              <button key={v} className={pipeline === v ? 'is-on' : ''} onClick={() => setPipeline(v)}>{l}</button>
            ))}
          </div>
        )}
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)' }}
        >
          <option value="all">All stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)' }}
        >
          <option value="all">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
          style={{ flexShrink: 0 }}
        >
          Date {sort === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
        {filtered.length} deal{filtered.length !== 1 ? 's' : ''} · {selectedIds.size} selected
        {filtered.length > SELECT_LIMIT && (
          <span style={{ color: 'var(--warn)', marginLeft: 8 }}>
            (select-all limited to first {SELECT_LIMIT})
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 36, background: 'white' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                  onChange={toggleAll}
                />
              </th>
              <th style={{ background: 'white' }}>Brand</th>
              <th style={{ background: 'white' }}>Owner</th>
              <th style={{ background: 'white' }}>Stage</th>
              <th style={{ background: 'white' }}>Pipeline</th>
              <th style={{ background: 'white' }}>Grade</th>
              <th style={{ background: 'white' }}>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No deals match filters</td></tr>
            )}
            {filtered.map(deal => {
              const checked = selectedIds.has(deal.id)
              const days = daysAgo(deal.modifiedTime || deal.demoDate)
              return (
                <tr
                  key={deal.id}
                  onClick={() => toggleOne(deal.id)}
                  style={{ cursor: 'pointer', background: checked ? 'var(--info-bg)' : undefined }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(deal.id)} />
                  </td>
                  <td><b>{deal.brandName || deal.dealName}</b></td>
                  <td>{deal.repName || '—'}</td>
                  <td><span style={{ fontSize: 12 }}>{deal.stage || '—'}</span></td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: deal.pipeline === 'Enterprise 2.0' ? '#EEE5FF' : '#E5F0FF',
                      color: deal.pipeline === 'Enterprise 2.0' ? '#7C3AED' : '#1D4ED8',
                    }}>
                      {deal.pipeline === 'Enterprise 2.0' ? 'Enterprise' : 'Mid-Market'}
                    </span>
                  </td>
                  <td>
                    {deal.grade
                      ? <span className={`kc-grade kc-grade-${deal.grade.toLowerCase()}`}>{deal.grade}</span>
                      : '—'}
                  </td>
                  <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                    {days != null ? `${days}d ago` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Leads Tab ─────────────────────────────────────────────
const AE_EMAILS = ['taufeeq.ahmad@eshopbox.com','afzal.maknoo@eshopbox.com','gautam@eshopbox.com','jeevan.more@eshopbox.com']

function LeadsTab({ leads, searchQuery, setSearchQuery, selectedIds, setSelectedIds }) {
  const { role } = useAuth()
  const defaultPipeline = role === ROLES.SALES_LEAD_MIDMARKET ? 'midmarket' : role === ROLES.SALES_LEAD_ENTERPRISE ? 'enterprise' : 'all'
  const [pipeline, setPipeline] = useState(defaultPipeline)
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sort, setSort] = useState('desc')

  const statuses = useMemo(() => [...new Set(leads.map(l => l.leadStatus).filter(Boolean))].sort(), [leads])
  const owners = useMemo(() => [...new Set(leads.map(l => l.ownerName).filter(Boolean))].sort(), [leads])

  const filtered = useMemo(() => {
    let d = leads
    if (pipeline === 'enterprise') d = d.filter(l => AE_EMAILS.includes(l.ownerEmail))
    else if (pipeline === 'midmarket') d = d.filter(l => !AE_EMAILS.includes(l.ownerEmail))
    if (statusFilter !== 'all') d = d.filter(l => l.leadStatus === statusFilter)
    if (ownerFilter !== 'all') d = d.filter(l => l.ownerName === ownerFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      d = d.filter(l =>
        (l.company || '').toLowerCase().includes(q) ||
        (l.fullName || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.ownerName || '').toLowerCase().includes(q)
      )
    }
    return [...d].sort((a, b) => {
      const da = new Date(a.createdAt || 0)
      const db = new Date(b.createdAt || 0)
      return sort === 'desc' ? db - da : da - db
    })
  }, [leads, searchQuery, pipeline, statusFilter, ownerFilter, sort])

  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))
  const someSelected = filtered.some(l => selectedIds.has(l.id))

  const toggleAll = () => {
    if (allSelected || someSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(l => next.delete(l.id))
        return next
      })
    } else {
      const toAdd = filtered.slice(0, SELECT_LIMIT)
      setSelectedIds(new Set(toAdd.map(l => l.id)))
    }
  }

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < SELECT_LIMIT) {
        next.add(id)
      }
      return next
    })
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search brand, contact, email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '8px 12px',
            border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 13,
            background: 'var(--surface)', color: 'var(--ink-1)'
          }}
        />
        {role === ROLES.ADMIN && (
          <div className="seg">
            {[['all','All'],['midmarket','Mid-Market'],['enterprise','Enterprise']].map(([v,l]) => (
              <button key={v} className={pipeline === v ? 'is-on' : ''} onClick={() => setPipeline(v)}>{l}</button>
            ))}
          </div>
        )}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)' }}
        >
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid var(--line)', fontSize: 13, background: 'var(--surface)' }}
        >
          <option value="all">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
          style={{ flexShrink: 0 }}
        >
          Date {sort === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
        {filtered.length} lead{filtered.length !== 1 ? 's' : ''} · {selectedIds.size} selected
        {filtered.length > SELECT_LIMIT && (
          <span style={{ color: 'var(--warn)', marginLeft: 8 }}>
            (select-all limited to first {SELECT_LIMIT})
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 36, background: 'white' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                  onChange={toggleAll}
                />
              </th>
              <th style={{ background: 'white' }}>Date</th>
              <th style={{ background: 'white' }}>Brand</th>
              <th style={{ background: 'white' }}>Contact</th>
              <th style={{ background: 'white' }}>Status</th>
              <th style={{ background: 'white' }}>Volume</th>
              <th style={{ background: 'white' }}>Source</th>
              <th style={{ background: 'white' }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No leads match filters</td></tr>
            )}
            {filtered.map(lead => {
              const checked = selectedIds.has(lead.id)
              return (
                <tr
                  key={lead.id}
                  onClick={() => toggleOne(lead.id)}
                  style={{ cursor: 'pointer', background: checked ? 'var(--info-bg)' : undefined }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(lead.id)} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(lead.createdAt)}</td>
                  <td><b>{lead.company || '—'}</b></td>
                  <td>
                    <div style={{ fontSize: 13 }}>{lead.fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lead.email || ''}</div>
                  </td>
                  <td>
                    {lead.leadStatus
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{lead.leadStatus}</span>
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>{lead.orderVolume || '—'}</td>
                  <td style={{ fontSize: 12 }}>{lead.leadSource || '—'}</td>
                  <td style={{ fontSize: 12 }}>{lead.ownerName || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── History section ───────────────────────────────────────
function HistorySection({ history, loadingHistory }) {
  if (loadingHistory) return <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '16px 0' }}>Loading history…</div>
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--ink-1)' }}>Assignment History</div>
      {history.length === 0
        ? <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No assignments yet.</div>
        : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th style={{ background: 'white' }}>Date</th>
                  <th style={{ background: 'white' }}>Done by</th>
                  <th style={{ background: 'white' }}>Assigned to</th>
                  <th style={{ background: 'white' }}>Module</th>
                  <th style={{ background: 'white' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontSize: 13 }}>{h.done_by_name}</td>
                    <td style={{ fontSize: 13 }}><b>{h.to_owner_name}</b></td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: h.module === 'Deals' ? '#E5F0FF' : '#F0FFF4',
                        color: h.module === 'Deals' ? '#1D4ED8' : '#2F9E44',
                      }}>{h.module}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.record_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function BulkAssign() {
  const { role, authFetch } = useAuth()

  const [activeModule, setActiveModule] = useState('deals')
  const [deals, setDeals] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState([])
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [toast, setToast] = useState(null)

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await authFetch('/api/bulk-assign/history')
      const data = await res.json()
      setHistory(data.history || [])
    } catch (_) {}
    setLoadingHistory(false)
  }, [authFetch])

  // FIX 1 — fresh data + reset on every tab switch
  useEffect(() => {
    setLoading(true)
    setSelectedIds(new Set())
    setSearchQuery('')
    if (activeModule === 'deals') {
      authFetch('/api/deals?refresh=true')
        .then(r => r.json())
        .then(d => setDeals(d.deals || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      authFetch('/api/leads?refresh=true')
        .then(r => r.json())
        .then(d => setLeads(d.leads || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [activeModule])

  useEffect(() => {
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => setAssignableUsers(d.users || []))
      .catch(() => {})
    fetchHistory()
  }, [authFetch, fetchHistory])

  const allowedRoles = [ROLES.ADMIN, ROLES.SALES_LEAD_MIDMARKET, ROLES.SALES_LEAD_ENTERPRISE]
  if (!allowedRoles.includes(role)) {
    return (
      <div className="main">
        <Topbar title="Bulk Assign" />
        <div className="callout danger">You don't have permission to access this page.</div>
      </div>
    )
  }

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleBulkAssign = async (assignTo) => {
    setAssigning(true)
    try {
      const ids = [...selectedIds]
      const endpoint = activeModule === 'deals' ? '/api/deals/bulk-reassign' : '/api/leads/bulk-reassign'
      const bodyKey = activeModule === 'deals' ? 'dealIds' : 'leadIds'
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: ids, newOwnerEmail: assignTo.email, newOwnerName: assignTo.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reassign failed')
      setSelectedIds(new Set())
      showToast(`${data.updated} ${activeModule} reassigned to ${assignTo.name}`)
      await fetchHistory()
    } catch (err) {
      showToast(err.message, 'danger')
    } finally {
      setAssigning(false)
    }
  }

  // FIX 6 — show confirmation modal before calling API
  const handleReassignModalConfirm = (user) => {
    setShowModal(false)
    setConfirmModal({
      title: 'Confirm Reassignment',
      message: `This will reassign ${selectedIds.size} ${activeModule === 'deals' ? 'deal' : 'lead'}${selectedIds.size !== 1 ? 's' : ''} to ${user.name}. This action will update Zoho CRM immediately.`,
      onConfirm: () => {
        setConfirmModal(null)
        handleBulkAssign(user)
      },
    })
  }

  const overLimit = selectedIds.size > SELECT_LIMIT

  return (
    <div className="main">
      <Topbar
        title="Bulk Assign"
        subtitle="Select deals or leads and reassign them to a team member"
      />

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 2000,
          background: toast.type === 'danger' ? 'var(--danger)' : 'var(--ok)',
          color: '#fff', borderRadius: 8, padding: '10px 18px',
          fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-2)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Module tabs */}
      <div className="seg" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={activeModule === 'deals' ? 'is-on' : ''} onClick={() => setActiveModule('deals')}>Deals</button>
        <button className={activeModule === 'leads' ? 'is-on' : ''} onClick={() => setActiveModule('leads')}>Leads</button>
      </div>

      {/* FIX 2 — inline loading spinner while fetching */}
      {loading ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 60, color: 'var(--ink-3)', fontSize: 14
        }}>
          Loading {activeModule === 'deals' ? 'deals' : 'leads'}...
        </div>
      ) : activeModule === 'deals' ? (
        <DealsTab
          deals={deals}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      ) : (
        <LeadsTab
          leads={leads}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      )}

      <HistorySection history={history} loadingHistory={loadingHistory} />

      {/* Selection bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink-1)', color: '#fff',
          borderRadius: 32, padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)', zIndex: 500,
          fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap'
        }}>
          <span>{selectedIds.size} {activeModule === 'deals' ? 'deal' : 'lead'}{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 13
            }}
          >
            Clear
          </button>
          {/* FIX 5 — warn instead of reassign button when over limit */}
          {overLimit ? (
            <span style={{ color: '#E5484D', fontSize: 13 }}>
              Only {SELECT_LIMIT} records can be assigned at once. Please deselect some ({selectedIds.size - SELECT_LIMIT} over limit).
            </span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={assigning}
              style={{
                background: '#fff', color: 'var(--ink-1)', border: 'none',
                borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
                fontSize: 13, fontWeight: 700
              }}
            >
              {assigning ? 'Reassigning…' : 'Reassign Selected →'}
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ReassignModal
          module={activeModule === 'deals' ? 'Deals' : 'Leads'}
          count={selectedIds.size}
          assignableUsers={assignableUsers}
          onConfirm={handleReassignModalConfirm}
          onClose={() => setShowModal(false)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}
