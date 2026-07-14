export function SkeletonLine({ width = '100%', height = 13, style = {} }) {
  return (
    <div className="skeleton" style={{
      width,
      height,
      borderRadius: 6,
      ...style
    }} />
  )
}

export function SkeletonCard({ rows = 3, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      ...style
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="skeleton" style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0
        }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonLine width="60%" height={13} />
          <SkeletonLine width="40%" height={11} />
        </div>
      </div>
      {rows > 1 && Array.from({ length: rows - 1 }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? '80%' : '55%'} height={12} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
        padding: '10px 16px',
        background: 'var(--surface-2)',
        borderRadius: '8px 8px 0 0'
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="60%" height={11} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)'
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine
              key={c}
              width={c === 0 ? '75%' : c === cols - 1 ? '40%' : '60%'}
              height={12}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
