import { Topbar, Empty } from '../components/ui'

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
export function Settings() {
  return (
    <div className="main">
      <Topbar title="Settings" subtitle="Team management · Rules · Templates" />
      <Empty icon="⚙️" title="Settings — coming in Phase 6"
        body="Invite users, manage MDE/AE groups, configure rules and email templates." />
    </div>
  )
}

// ── 404 ──────────────────────────────────────────────────
export function NotFound() {
  return (
    <div className="main">
      <Empty icon="🔍" title="Page not found"
        body="The page you're looking for doesn't exist." />
    </div>
  )
}
