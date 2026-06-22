import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { useLeads } from '../../hooks/useLeads'
import { Topbar, Loading } from '../../components/ui'

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  return diff >= 0 ? diff : null
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Reassign Modal ────────────────────────────────────────
function ReassignModal({ module, count, assignableUsers, onConfirm, onClose, assigning }) {
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
          <button className="btn btn-sm" onClick={onClose} disabled={assigning}>Cancel</button>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }}
            disabled={!selectedUser || assigning}
            onClick={() => selectedUser && onConfirm(selectedUser)}
          >
            {assigning ? 'Reassigning…' : `Confirm Reassign →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Deals Tab ─────────────────────────────────────────────
function DealsTab({ deals, selectedIds, setSelectedIds }) {
  const [search, setSearch] = useState('')
  const [pipeline, setPipeline] = useState('all')
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
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(x =>
        (x.brandName || x.dealName || '').toLowerCase().includes(q) ||
        (x.repName || '').toLowerCase().includes(q)
      )
    }
    return [...d].sort((a, b) => {
      const da = new Date(a.modifiedTime || a.demoDate || 0)
      const db = new Date(b.modifiedTime || b.demoDate || 0)
      return sort === 'desc' ? db - da : da - db
    })
  }, [deals, search, pipeline, stageFilter, ownerFilter, sort])

  const allSelected = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(d => next.delete(d.id))
        return next
      })
    } else {
      setSelectedIds(prev => new Set([...prev, ...filtered.map(d => d.id)]))
    }
  }

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="pipeline-searchbar-input"
          placeholder="Search brand or owner…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <div className="seg">
          {[['all','All'],['midmarket','Mid-Market'],['enterprise','Enterprise']].map(([v,l]) => (
            <button key={v} className={pipeline === v ? 'is-on' : ''} onClick={() => setPipeline(v)}>{l}</button>
          ))}
        </div>
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
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 36, background: 'white' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
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
function LeadsTab({ leads, selectedIds, setSelectedIds }) {
  const [search, setSearch] = useState('')
  const [pipeline, setPipeline] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sort, setSort] = useState('desc')

  const AE_EMAILS = ['taufeeq.ahmad@eshopbox.com','afzal.maknoo@eshopbox.com','gautam@eshopbox.com','jeevan.more@eshopbox.com']

  const statuses = useMemo(() => [...new Set(leads.map(l => l.leadStatus).filter(Boolean))].sort(), [leads])
  const owners = useMemo(() => [...new Set(leads.map(l => l.ownerName).filter(Boolean))].sort(), [leads])

  const filtered = useMemo(() => {
    let d = leads
    if (pipeline === 'enterprise') d = d.filter(l => AE_EMAILS.includes(l.ownerEmail))
    else if (pipeline === 'midmarket') d = d.filter(l => !AE_EMAILS.includes(l.ownerEmail))
    if (statusFilter !== 'all') d = d.filter(l => l.leadStatus === statusFilter)
    if (ownerFilter !== 'all') d = d.filter(l => l.ownerName === ownerFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(l =>
        (l.company || '').toLowerCase().includes(q) ||
        (l.fullName || '').toLowerCase().includes(q) ||
        (l.ownerName || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      )
    }
    return [...d].sort((a, b) => {
      const da = new Date(a.createdAt || 0)
      const db = new Date(b.createdAt || 0)
      return sort === 'desc' ? db - da : da - db
    })
  }, [leads, search, pipeline, statusFilter, ownerFilter, sort])

  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(l => next.delete(l.id))
        return next
      })
    } else {
      setSelectedIds(prev => new Set([...prev, ...filtered.map(l => l.id)]))
    }
  }

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="pipeline-searchbar-input"
          placeholder="Search brand, contact, or owner…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <div className="seg">
          {[['all','All'],['midmarket','Mid-Market'],['enterprise','Enterprise']].map(([v,l]) => (
            <button key={v} className={pipeline === v ? 'is-on' : ''} onClick={() => setPipeline(v)}>{l}</button>
          ))}
        </div>
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
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 36, background: 'white' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
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
  const { deals, loading: dealsLoading } = useDeals()
  const { leads, loading: leadsLoading } = useLeads()

  const [activeModule, setActiveModule] = useState('deals')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showModal, setShowModal] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState([])
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [toast, setToast] = useState(null)

  const allowedRoles = [ROLES.ADMIN, ROLES.SALES_LEAD_MIDMARKET, ROLES.SALES_LEAD_ENTERPRISE]
  if (!allowedRoles.includes(role)) {
    return (
      <div className="main">
        <Topbar title="Bulk Assign" />
        <div className="callout danger">You don't have permission to access this page.</div>
      </div>
    )
  }

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await authFetch('/api/bulk-assign/history')
      const data = await res.json()
      setHistory(data.history || [])
    } catch (_) {}
    setLoadingHistory(false)
  }, [authFetch])

  useEffect(() => {
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => setAssignableUsers(d.users || []))
      .catch(() => {})
    fetchHistory()
  }, [authFetch, fetchHistory])

  useEffect(() => { setSelectedIds(new Set()) }, [activeModule])

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleConfirmReassign = async ({ name: newOwnerName, email: newOwnerEmail }) => {
    setAssigning(true)
    try {
      const ids = [...selectedIds]
      const endpoint = activeModule === 'deals'
        ? '/api/deals/bulk-reassign'
        : '/api/leads/bulk-reassign'
      const bodyKey = activeModule === 'deals' ? 'dealIds' : 'leadIds'

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: ids, newOwnerEmail, newOwnerName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reassign failed')

      setSelectedIds(new Set())
      setShowModal(false)
      showToast(`${data.updated} ${activeModule} reassigned to ${newOwnerName}`)
      await fetchHistory()
    } catch (err) {
      showToast(err.message, 'danger')
    } finally {
      setAssigning(false)
    }
  }

  const loading = activeModule === 'deals' ? dealsLoading : leadsLoading

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

      {loading
        ? <Loading text={`Fetching ${activeModule}…`} />
        : activeModule === 'deals'
          ? <DealsTab deals={deals} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
          : <LeadsTab leads={leads} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      }

      <HistorySection history={history} loadingHistory={loadingHistory} />

      {/* Selection bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink-1)', color: '#fff',
          borderRadius: 32, padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)', zIndex: 500,
          fontSize: 14, fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          <span>{selectedIds.size} {activeModule === 'deals' ? 'deal' : 'lead'}{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}
          >
            Clear
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: '#fff', color: 'var(--ink-1)', border: 'none',
              borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 700 }}
          >
            Reassign Selected →
          </button>
        </div>
      )}

      {showModal && (
        <ReassignModal
          module={activeModule === 'deals' ? 'Deals' : 'Leads'}
          count={selectedIds.size}
          assignableUsers={assignableUsers}
          onConfirm={handleConfirmReassign}
          onClose={() => setShowModal(false)}
          assigning={assigning}
        />
      )}
    </div>
  )
}
