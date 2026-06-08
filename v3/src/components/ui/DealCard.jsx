import { useNavigate } from 'react-router-dom'
import { initials, daysAgo, formatDate } from '../../lib/stageConfig'

export default function DealCard({ deal }) {
  const navigate = useNavigate()
  const flagLevel = deal.attentionLevel || 'ok'
  const cardClass = `kcard ${flagLevel === 'high' ? 'flag-critical' : flagLevel === 'medium' ? 'flag-medium' : ''}`

  const gradeClass = `kc-grade kc-grade-${(deal.grade || 'D').toLowerCase()}`
  const ownerInitials = initials(deal.repName || '')
  const days = daysAgo(deal.stageChangedOn)

  const isMismatch = deal.mismatch

  return (
    <div className={cardClass} onClick={() => navigate(`/pipeline/${deal.id}`)}>
      <div className="kc-body">
        <div className="kc-title-row">
          <div className="kc-title">{deal.brandName || deal.dealName}</div>
          {deal.grade && <div className={gradeClass}>{deal.grade}</div>}
        </div>
        <div className="kc-sub">
          <b>{deal.repName}</b>
          {deal.orderVolume ? ` · ${deal.orderVolume}` : ''}
          {deal.solutionInterest ? ` · ${deal.solutionInterest}` : ''}
        </div>

        <div className="kc-pills">
          {deal.saLogged && (
            <span className="kc-pill kc-pill-ok">✓ Demo logged</span>
          )}
          {deal.flags?.length > 0 && (
            <span className={`kc-pill ${flagLevel === 'high' ? 'kc-pill-danger' : 'kc-pill-warn'}`}>
              {deal.flags.length} flag{deal.flags.length > 1 ? 's' : ''}
            </span>
          )}
          {isMismatch && (
            <span className="kc-pill kc-pill-warn">⚠ {deal.mismatchLabel}</span>
          )}
          {deal.followupMeetingDate && (
            <span className="kc-pill kc-pill-info">📅 {formatDate(deal.followupMeetingDate)}</span>
          )}
        </div>

        <div className="kc-footer">
          <div className="kc-owner">
            <div className={`avatar ${ownerInitials ? 'av-teal' : ''}`} style={{ width: 20, height: 20, fontSize: 9 }}>
              {ownerInitials}
            </div>
            <span className="name">{deal.repName?.split(' ')[0]}</span>
          </div>
          <div className="kc-meta-right">
            {days != null && (
              <span className={days >= 14 ? 'days-critical' : days >= 7 ? 'days-stale' : ''}>
                {days}d
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
