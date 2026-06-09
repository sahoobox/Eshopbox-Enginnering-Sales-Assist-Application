import { Empty } from '../components/ui'

// ── My Day ───────────────────────────────────────────────
export { default as MyDay } from './MyDay'

// ── Lead Inbox ───────────────────────────────────────────
export { default as LeadInbox } from './LeadInbox'

// ── Accounts ─────────────────────────────────────────────
export { default as Accounts } from './Accounts'

// ── Tasks ────────────────────────────────────────────────
export { default as Tasks } from './Tasks'

// ── Performance ──────────────────────────────────────────
export { default as Performance } from './Performance'

// ── Settings ─────────────────────────────────────────────
export { default as Settings } from './Settings'

// ── 404 ──────────────────────────────────────────────────
export function NotFound() {
  return (
    <div className="main">
      <Empty icon="🔍" title="Page not found"
        body="The page you're looking for doesn't exist." />
    </div>
  )
}
