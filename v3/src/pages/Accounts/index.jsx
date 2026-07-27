import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading } from '../../components/ui'
import { getStagePill, daysAgo } from '../../lib/stageConfig'

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
  'arihant.sharma@eshopbox.com',
]

const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'gautam@eshopbox.com',
  'jeevan.more@eshopbox.com',
]

const TERMINAL_STAGES = ['Won/Payment Received', 'Lost/Dropped', 'On Hold']

function pipeline(repEmail) {
  if (MDE_EMAILS.includes(repEmail)) return 'MDE'
  if (AE_EMAILS.includes(repEmail)) return 'Enterprise'
  return '—'
}

export default function Accounts() {
  const { role, user, isMDE, isAE } = useAuth()
  const { deals, loading, error } = useDeals()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const scopedDeals = useMemo(() => {
    if (isMDE || isAE) return deals.filter(d => d.repEmail === user?.email)
    if (role === ROLES.SALES_LEAD_MIDMARKET) return deals.filter(d => MDE_EMAILS.includes(d.repEmail))
    if (role === ROLES.SALES_LEAD_ENTERPRISE) return deals.filter(d => AE_EMAILS.includes(d.repEmail))
    return deals
  }, [deals, role, isMDE, isAE, user])

  // Group by account name, pick best deal per account
  const accounts = useMemo(() => {
    const map = new Map()
    for (const deal of scopedDeals) {
      const key = (deal.brandName || deal.dealName || '').trim()
      if (!key) continue
      const existing = map.get(key)
      if (!existing) { map.set(key, deal); continue }
      const existingTerminal = TERMINAL_STAGES.includes(existing.stage)
      const thisTerminal = TERMINAL_STAGES.includes(deal.stage)
      if (existingTerminal && !thisTerminal) { map.set(key, deal); continue }
      if (!existingTerminal && thisTerminal) continue
      // Both same terminal status — prefer more recent
      if ((deal.stageChangedOn || '') > (existing.stageChangedOn || '')) map.set(key, deal)
    }
    return [...map.entries()].map(([name, deal]) => ({ name, deal }))
  }, [scopedDeals])

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts
    const q = search.toLowerCase()
    return accounts.filter(a => a.name.toLowerCase().includes(q))
  }, [accounts, search])

  const activeCount = accounts.filter(a => !TERMINAL_STAGES.includes(a.deal.stage)).length
  const attentionCount = accounts.filter(a => a.deal.attentionLevel === 'high').length

  if (loading) return <div className="main"><Loading text="Fetching accounts…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Accounts" />
      <div className="callout danger">Failed to load accounts: {error}</div>
    </div>
  )

  return (
    <div className="main">
      <Topbar
        title="Accounts"
        subtitle="All accounts with active deals · owner-based visibility"
        actions={
          <input
            className="search-input"
            placeholder="Search account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile label="TOTAL ACCOUNTS" value={accounts.length} sub="unique companies" />
        <StatTile label="ACTIVE" value={activeCount} sub="non-terminal stage" />
        <StatTile label="NEEDS ATTENTION" value={attentionCount} sub="high-priority flag" warn={attentionCount > 0} />
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Company</th>
              <th>Pipeline</th>
              <th>Stage</th>
              <th>Rep owner</th>
              <th>Grade</th>
              <th>Days in stage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>No accounts found</td></tr>
            )}
            {filtered.map(({ name, deal }) => {
              const days = daysAgo(deal.stageChangedOn)
              const daysColor = days > 21 ? 'var(--danger)' : days > 14 ? 'var(--warn)' : 'var(--ink-2)'
              return (
                <tr
                  key={deal.id}
                  className="clickable"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/pipeline/${deal.id}`)}
                >
                  <td><b>{name}</b></td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{pipeline(deal.repEmail)}</td>
                  <td><span className={`pill ${getStagePill(deal.stage)}`}>{deal.stage}</span></td>
                  <td style={{ fontSize: 13 }}>{deal.repName || '—'}</td>
                  <td>
                    {deal.grade
                      ? <span className={`kc-grade kc-grade-${deal.grade.toLowerCase()}`}>{deal.grade}</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </td>
                  <td style={{ fontWeight: days > 14 ? 600 : 400, color: days != null ? daysColor : 'var(--ink-3)', fontSize: 13 }}>
                    {days != null ? `${days}d` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatTile({ label, value, sub, warn }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: warn ? 'var(--danger)' : 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
