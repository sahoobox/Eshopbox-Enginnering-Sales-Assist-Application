import { useState, useEffect, useCallback } from 'react'

// Global toast state
let toastListeners = []
let toastId = 0

export function toast(message, type = 'success', duration = 3500) {
  const id = ++toastId
  toastListeners.forEach(fn => fn({ id, message, type, duration }))
  return id
}

toast.success = (msg, duration) => toast(msg, 'success', duration)
toast.error = (msg, duration) => toast(msg, 'error', duration)
toast.warn = (msg, duration) => toast(msg, 'warn', duration)
toast.info = (msg, duration) => toast(msg, 'info', duration)

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, t.duration)
    }
    toastListeners.push(handler)
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== handler)
    }
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 10,
            background: t.type === 'error' ? 'var(--danger)'
              : t.type === 'warn' ? '#854F0B'
              : t.type === 'info' ? 'var(--info)'
              : '#0F6E56',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            cursor: 'pointer',
            maxWidth: 360,
            lineHeight: 1.4,
            animation: 'toastIn 0.25s var(--ease) both',
            userSelect: 'none',
            letterSpacing: '0.01em'
          }}
        >
          {/* Icon */}
          <span style={{
            fontSize: 15,
            flexShrink: 0,
            lineHeight: 1
          }}>
            {t.type === 'error' ? '✕'
              : t.type === 'warn' ? '⚠'
              : t.type === 'info' ? 'ℹ'
              : '✓'}
          </span>

          {/* Message */}
          <span style={{ flex: 1 }}>
            {t.message}
          </span>

          {/* Dismiss */}
          <span style={{
            fontSize: 12,
            opacity: 0.7,
            flexShrink: 0,
            marginLeft: 4
          }}>
            ✕
          </span>
        </div>
      ))}
    </div>
  )
}
