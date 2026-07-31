// ── Topbar ──────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }) {
  return (
    <div className="topbar">
      <div className="topbar-title-block">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </div>
  )
}

// ── Avatar ───────────────────────────────────────────────
export function Avatar({ name = '', colorClass = '', size = 'sm' }) {
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={`avatar ${colorClass} ${size === 'lg' ? 'lg' : ''}`}>
      {initials}
    </div>
  )
}

// ── Pill / Badge ─────────────────────────────────────────
export function Pill({ children, variant = 'neutral', dot = false }) {
  return (
    <span className={`pill pill-${variant}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

// TODO: use .modal-overlay/.modal-box pattern

// ── KPI Tile ─────────────────────────────────────────────
export function KpiTile({ label, value, meta, valueClass = '' }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  )
}

// ── Loading ──────────────────────────────────────────────
export function Loading({ text = 'Loading…' }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {text}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────
export function Empty({ icon = '—', title = 'Nothing here', body }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <strong>{title}</strong>
      {body && <p>{body}</p>}
    </div>
  )
}

// ── Toggle group ─────────────────────────────────────────
export function ToggleGroup({ options, value, onChange }) {
  const activeIndex = Math.max(0, options.findIndex(o => o.value === value))
  const active = options[activeIndex] || options[0]
  return (
    <div className="toggle-group">
      <div
        className="toggle-thumb"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
          background: active?.activeBg || 'var(--ink)',
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`toggle-btn ${value === opt.value ? 'active' : ''}`}
          style={{ color: value === opt.value ? (opt.activeColor || '#fff') : undefined }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Form group ───────────────────────────────────────────
export function FormGroup({ label, children, required }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

// ── Mismatch tag ─────────────────────────────────────────
export function MismatchTag({ label }) {
  return <span className="mismatch-tag">⚠ {label}</span>
}

// ── Card ─────────────────────────────────────────────────
export function Card({ children, pad = true, style }) {
  return (
    <div className={`card ${pad ? 'card-pad' : ''}`} style={style}>
      {children}
    </div>
  )
}

// ── Section head ─────────────────────────────────────────
export function SectionHead({ title, meta, actions }) {
  return (
    <div className="section-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3>{title}</h3>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
