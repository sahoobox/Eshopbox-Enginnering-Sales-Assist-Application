import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'

const SATYA_EMAIL = 'satyanarayan.sahoo@eshopbox.com'

export default function ApiLog() {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()
  usePageTitle('API Logs')
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState('all')
  const [successFilter, setSuccessFilter] = useState('false')

  // Guard — only Satya can access
  useEffect(() => {
    if (user && user.email !== SATYA_EMAIL) {
      navigate('/')
    }
  }, [user])

  useEffect(() => {
    loadLogs()
  }, [service, successFilter])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '200',
        ...(service !== 'all' && { service }),
        ...(successFilter !== 'all' && { success: successFilter })
      })
      const res = await authFetch(
        `/api/admin/api-log?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setSummary(data.summary || [])
    } catch (err) {
      console.error('Failed to load API logs:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(ms) {
    if (!ms) return '—'
    if (ms < 1000) return ms + 'ms'
    return (ms / 1000).toFixed(1) + 's'
  }

  function formatTime(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })
  }

  function serviceColor(s) {
    if (s === 'zoho') return 'var(--info)'
    if (s === 'claude') return 'var(--brand)'
    if (s === 'gmail') return '#EA4335'
    return 'var(--ink-3)'
  }

  if (user?.email !== SATYA_EMAIL) return null

  return (
    <div style={{
      padding: '24px 32px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexShrink: 0
      }}>
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            color: 'var(--ink)'
          }}>
            API Logs
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            marginTop: 4
          }}>
            Track all external API calls — Zoho, Claude, Gmail
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={loadLogs}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        flexShrink: 0
      }}>
        {['zoho', 'claude', 'gmail'].map(svc => {
          const s = summary.find(x => x.service === svc)
          const failures = s?.failures || 0
          const isActive = service === svc
          return (
            <div
              key={svc}
              className="card card-pad clickable"
              onClick={() => setService(isActive ? 'all' : svc)}
              style={{
                flex: 1,
                cursor: 'pointer',
                borderLeft: `3px solid ${serviceColor(svc)}`,
                background: isActive ? 'var(--surface-2)' : undefined,
                boxShadow: isActive
                  ? `0 0 0 1px ${serviceColor(svc)}, var(--shadow-1)`
                  : undefined
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: serviceColor(svc),
                marginBottom: 8
              }}>
                {svc.toUpperCase()} API
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
              }}>
                <div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: failures > 0
                      ? 'var(--danger)'
                      : 'var(--ok)',
                    lineHeight: 1
                  }}>
                    {failures}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    marginTop: 4
                  }}>
                    failures (24h)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)'
                  }}>
                    {s?.total || 0} total
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--ink-3)'
                  }}>
                    avg {formatDuration(s?.avg_duration_ms)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        alignItems: 'center',
        flexShrink: 0
      }}>
        <select
          className="form-select"
          value={service}
          onChange={e => setService(e.target.value)}
          style={{ fontSize: 13 }}
        >
          <option value="all">All Services</option>
          <option value="zoho">Zoho</option>
          <option value="claude">Claude</option>
          <option value="gmail">Gmail</option>
        </select>

        <select
          className="form-select"
          value={successFilter}
          onChange={e => setSuccessFilter(e.target.value)}
          style={{ fontSize: 13 }}
        >
          <option value="all">All Status</option>
          <option value="false">Failed only</option>
          <option value="true">Success only</option>
        </select>

        <span style={{
          fontSize: 12,
          color: 'var(--ink-3)',
          marginLeft: 'auto'
        }}>
          {logs.length} records
        </span>
      </div>

      {/* Table — fixed-height, independently-scrollable area.
          Root above is now a flex column with a bounded height (height:'100%' —
          same trick .main/NeedAttention use); header/cards/filters are
          flexShrink:0 so they keep their natural size and stay pinned. This div
          is the single flex:1 child, so it absorbs all remaining vertical space;
          minHeight:0 lets it actually shrink below its content height instead of
          pushing the root taller (the classic flex-scroll-container gotcha).
          overflowX + overflowY: auto give it its own scrollbar on both axes,
          independent of the page-level .main scroll. thead gets `t-thead-sticky`
          (index.css) so column headers stay pinned to the top of THIS container
          as rows scroll underneath. Reuse this shape — flex-column root +
          flexShrink:0 chrome + one flex:1/minHeight:0/overflow:auto child +
          .t-thead-sticky — on any other page that wants a genuinely contained
          scrolling table instead of NeedAttention's "whole content area scrolls"
          or Pipeline's JS-measured fake sticky header. */}
      {loading ? (
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: 48
        }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="table-wrap" style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto'
        }}>
          <table className="t" style={{ width: '100%' }}>
            <thead className="t-thead-sticky">
              <tr>
                <th>Time</th>
                <th>Service</th>
                <th>Action</th>
                <th>Brand</th>
                <th>Rep</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--ink-3)'
                  }}>
                    No logs found
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={{
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTime(log.created_at)}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: serviceColor(log.service),
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {log.service}
                    </span>
                  </td>
                  <td style={{
                    fontSize: 12,
                    whiteSpace: 'nowrap'
                  }}>
                    {log.request_summary || log.endpoint}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {log.brand_name ? (
                      <span style={{ fontWeight: 500 }}>
                        {log.brand_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{
                    fontSize: 12,
                    color: 'var(--ink-2)'
                  }}>
                    {log.actor_name || log.actor_email || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: log.success
                        ? 'var(--ok-bg)'
                        : 'var(--danger-bg)',
                      color: log.success
                        ? 'var(--ok)'
                        : 'var(--danger)'
                    }}>
                      {log.success ? '✓ Success' : '✕ Failed'}
                    </span>
                  </td>
                  <td style={{
                    fontSize: 12,
                    color: log.duration_ms > 3000
                      ? 'var(--warn)'
                      : 'var(--ink-3)',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatDuration(log.duration_ms)}
                  </td>
                  <td style={{
                    fontSize: 11,
                    color: 'var(--danger)',
                    whiteSpace: 'nowrap'
                  }}>
                    {log.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
