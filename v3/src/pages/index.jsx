import { Empty } from '../components/ui'

// ── My Day ───────────────────────────────────────────────
export { default as MyDay } from './MyDay'

// ── Need Attention ───────────────────────────────────────
export { default as NeedAttention } from './NeedAttention'

// ── Lead Inbox ───────────────────────────────────────────
export { default as LeadInbox } from './LeadInbox'

// ── Accounts ─────────────────────────────────────────────
export { default as Accounts } from './Accounts'

// ── Tasks ────────────────────────────────────────────────
export { default as Tasks } from './Tasks'

// ── Performance ──────────────────────────────────────────
export { default as Performance } from './Performance'

// ── Reports ──────────────────────────────────────────────
export { default as Reports } from './Reports'

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
