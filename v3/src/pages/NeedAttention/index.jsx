import { useNavigate } from 'react-router-dom'
import { useDeals } from '../../hooks/useDeals'
import { Topbar, Loading } from '../../components/ui'

export default function NeedAttention() {
  const navigate = useNavigate()
  const { deals, loading, error, refetch } = useDeals()

  const flaggedDeals = deals
    .filter(d => d.flags?.length > 0)
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 }
      const aMax = Math.min(...(a.flags.map(f => sev[f.severity] ?? 3)))
      const bMax = Math.min(...(b.flags.map(f => sev[f.severity] ?? 3)))
      return aMax - bMax
    })

  if (loading) return <div className="main"><Loading text="Fetching deals…" /></div>
  if (error) return (
    <div className="main">
      <Topbar title="Need Attention" />
      <div className="callout danger">Failed to load deals: {error}</div>
    </div>
  )

  return (
    <div className="main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Topbar
        title="Need Attention"
        subtitle={`${flaggedDeals.length} deals with active flags across all pipelines`}
        actions={
          <button className="btn btn-sm" onClick={refetch}>↻ Refresh</button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <table className="t" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 56 }}>Grade</th>
              <th>Brand</th>
              <th>Rep</th>
              <th>Pipeline</th>
              <th>Stage</th>
              <th>Flags</th>
              <th style={{ width: 110 }}>Days in stage</th>
            </tr>
          </thead>
          <tbody>
            {flaggedDeals.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
                  No deals with flags — all clear.
                </td>
              </tr>
            )}
            {flaggedDeals.map(deal => {
              const days = deal.stageChangedOn
                ? Math.floor((Date.now() - new Date(deal.stageChangedOn)) / 86400000)
                : null
              const isEnterprise = deal.pipeline === 'Enterprise 2.0'
              return (
                <tr key={deal.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pipeline/${deal.id}`)}>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 6, fontWeight: 700, fontSize: 12,
                      background: deal.grade === 'A' ? 'var(--ok-bg)' : deal.grade === 'B' ? 'var(--info-bg)' : deal.grade === 'C' ? 'var(--warn-bg)' : 'var(--danger-bg)',
                      color: deal.grade === 'A' ? 'var(--ok)' : deal.grade === 'B' ? 'var(--info)' : deal.grade === 'C' ? 'var(--warn)' : 'var(--danger)',
                    }}>
                      {deal.grade || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{deal.brandName || deal.dealName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{deal.solutionInterest}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{deal.repName?.split(' ')[0] || '—'}</td>
                  <td>
                    <span className={`pill ${isEnterprise ? 'pill-info' : 'pill-neutral'}`} style={{ fontSize: 11 }}>
                      {isEnterprise ? 'Enterprise' : 'Mid-Market'}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-neutral" style={{ fontSize: 11 }}>{deal.stage}</span>
                  </td>
                  <td style={{ maxWidth: 420 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {deal.flags.map((f, i) => (
                        <span
                          key={i}
                          className={`pill ${f.severity === 'critical' ? 'pill-danger' : f.severity === 'warning' ? 'pill-warn' : 'pill-info'}`}
                          style={{ fontSize: 10.5 }}
                        >
                          {f.title}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{
                    fontSize: 13, fontWeight: 600,
                    color: days >= 14 ? 'var(--danger)' : days >= 7 ? 'var(--warn)' : 'var(--ink-2)'
                  }}>
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
