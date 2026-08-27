import { useNavigate } from 'react-router-dom'
import { MessageCircle, Phone, Mail, Globe, Calendar, Building2 } from 'lucide-react'
import { leadSourcePill, conversionMediumPill } from '../../lib/fieldColors'

export const CONVERSION_MEDIUM_MAP = {
  'WhatsApp Messaging': { icon: MessageCircle, label: 'WhatsApp' },
  'Phone Call': { icon: Phone, label: 'Call' },
  'Email': { icon: Mail, label: 'Email' },
  'Workspace Signup': { icon: Globe, label: 'Signup' },
  'Cal.com': { icon: Calendar, label: 'Cal.com' },
}

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

  const grade = deal.grade
  const gradeClass = grade ? `kc-grade kc-grade-${grade.toLowerCase()}` : ''
  const labelClass = grade ? `kc-label kc-label-grade-${grade.toLowerCase()}` : ''

  const flagCount = deal.flags?.length || 0
  const hasCritical = deal.flags?.some(f => f.level === 'high' || f.severity === 'high')
  const cardClass = `kcard${hasCritical ? ' critical' : flagCount > 0 ? ' stale' : ''}`

  const ownerInitials = deal.repName
    ? deal.repName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const days = daysSince(deal.demoDate || deal.modifiedTime)

  const conversionMedium = deal.conversionMedium ? CONVERSION_MEDIUM_MAP[deal.conversionMedium] : null

  // Build sub line: volume · interest (source moved to its own pill below)
  const subParts = [
    deal.orderVolume,
    deal.solutionInterest
  ].filter(Boolean)

  return (
    <div className={cardClass} onClick={() => window.open(`/pipeline/${deal.id}`, '_blank')} style={{ minHeight: 160, display: 'flex', flexDirection: 'column' }}>
      {/* Grade colour strip at top */}
      <div className="kc-labels">
        {grade && <div className={labelClass} />}
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
          {deal.leadSource && (
            <span className={`kc-pill ${leadSourcePill(deal.leadSource)}`} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap'
            }}>
              {deal.leadSource}
            </span>
          )}
          {conversionMedium && (
            <span className={`kc-pill ${conversionMediumPill(deal.conversionMedium)}`} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}>
              <conversionMedium.icon size={10} />
              {conversionMedium.label}
            </span>
          )}
          {deal.workspaceAccountSlug && (
            <span className="kc-pill pill-slate" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}>
              <Building2 size={10} />
              {deal.workspaceAccountSlug}
            </span>
          )}
          {deal.demoScheduledDateTime && (
            <span style={{
              fontSize: 10,
              background: 'var(--info-bg)',
              color: 'var(--info)',
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}>
              Demo: {new Date(deal.demoScheduledDateTime)
                .toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
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
