import { useNavigate } from 'react-router-dom'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000)
  return diff >= 0 ? diff : null
}

export default function DealCard({ deal }) {
  const navigate = useNavigate()

  const grade = deal.grade || 'D'
  const gradeClass = `kc-grade kc-grade-${grade.toLowerCase()}`
  const labelClass = `kc-label kc-label-grade-${grade.toLowerCase()}`

  const flagCount = deal.flags?.length || 0
  const hasCritical = deal.flags?.some(f => f.level === 'high' || f.severity === 'high')
  const cardClass = `kcard${hasCritical ? ' critical' : flagCount > 0 ? ' stale' : ''}`

  const ownerInitials = deal.repName
    ? deal.repName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const days = daysSince(deal.demoDate || deal.modifiedTime)

  // Build sub line: volume · source · interest
  const subParts = [
    deal.orderVolume,
    deal.leadSource,
    deal.solutionInterest
  ].filter(Boolean)

  // Next action label from stage
  const stageActionMap = {
    'Upcoming Demo': { ico: '📅', text: 'Demo scheduled' },
    'Demo Done': { ico: '📋', text: 'Proposal pending' },
    'Proposal Sent': { ico: '⏳', text: 'Awaiting response' },
    'Follow up Meeting Done': { ico: '✅', text: 'Meeting done' },
    'Account Setup in Progress': { ico: '⚙️', text: 'Setup in progress' },
    'Awaiting First Shipment': { ico: '📦', text: 'Awaiting shipment' },
    'First Shipment Done': { ico: '🚚', text: 'First shipment done' },
    'Active': { ico: '✅', text: 'Active client' },
    'On Hold': { ico: '⏸', text: 'On hold' },
    'Won/Payment Received': { ico: '🏆', text: 'Won' },
    'Lost/Dropped': { ico: '✗', text: 'Lost' },
  }
  const stageAction = stageActionMap[deal.stage]

  return (
    <div className={cardClass} onClick={() => navigate(`/pipeline/${deal.id}`)} style={{ minHeight: 160, display: 'flex', flexDirection: 'column' }}>
      {/* Grade colour strip at top */}
      <div className="kc-labels">
        <div className={labelClass} />
        {deal.saLogged && <div className="kc-label" style={{ background: 'var(--ok)', opacity: 0.5 }} />}
        {flagCount > 0 && <div className="kc-label" style={{ background: hasCritical ? 'var(--danger)' : 'var(--warn)', opacity: 0.7 }} />}
      </div>

      <div className="kc-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Title + grade badge */}
        <div className="kc-title-row">
          <div className="kc-title">{deal.brandName || deal.dealName}</div>
          {grade && <div className={gradeClass}>{grade}</div>}
        </div>

        {/* Sub info */}
        <div className="kc-sub">
          {subParts.length > 0 ? subParts.join(' · ') : '—'}
        </div>

        {/* Stage action row */}
        <div className="kc-stage-row">
          <span>{stageAction?.ico || '•'}</span>
          <span>{stageAction?.text || deal.stage || '—'}</span>
        </div>

        {/* Flag pills */}
        <div className="kc-pills" style={{ minHeight: 22 }}>
          {deal.saLogged && (
            <span className="kc-pill kc-pill-ok">✓ Logged</span>
          )}
          {flagCount > 0 && (
            <span className={`kc-pill ${hasCritical ? 'kc-pill-danger' : 'kc-pill-warn'}`}>
              {flagCount} flag{flagCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Footer: owner + days */}
        <div className="kc-footer" style={{ marginTop: 'auto' }}>
          <div className="kc-owner">
            <div className="avatar av-teal" style={{ width: 20, height: 20, fontSize: 9 }}>
              {ownerInitials}
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deal.repName?.split(' ')[0] || '—'}
            </span>
          </div>
          <div className="kc-meta-right">
            {days != null && (
              <span className={days >= 14 ? 'days-critical' : days >= 7 ? 'days-stale' : ''}>
                {days}d
              </span>
            )}
          </div>
          {!deal.saLogged && (
            <button
              className="btn btn-sm"
              style={{
                background: '#F95253',
                color: '#fff',
                border: 'none',
                fontSize: 10,
                padding: '3px 8px',
                fontWeight: 600,
                flexShrink: 0
              }}
              onClick={e => {
                e.stopPropagation()
                navigate(`/form?dealId=${deal.id}`)
              }}
            >
              + Log
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
