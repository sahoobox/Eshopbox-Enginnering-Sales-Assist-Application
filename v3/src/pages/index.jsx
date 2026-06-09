import { Topbar, Empty } from '../components/ui'

// ── My Day ───────────────────────────────────────────────
export { default as MyDay } from './MyDay'

// ── Lead Inbox ───────────────────────────────────────────
export { default as LeadInbox } from './LeadInbox'

// ── Accounts ─────────────────────────────────────────────
export function Accounts() {
  return (
    <div className="main">
      <Topbar title="Accounts" subtitle="Accounts with active deals" />
      <Empty icon="🏢" title="Accounts — coming in Phase 4"
        body="All accounts linked to your deals, with workspace created status." />
    </div>
  )
}

// ── Tasks ────────────────────────────────────────────────
export { default as Tasks } from './Tasks'

// ── Performance ──────────────────────────────────────────
export function Performance() {
  return (
    <div className="main">
      <Topbar title="Performance" subtitle="Mid-Market and Enterprise pipeline health" />
      <Empty icon="📊" title="Performance — coming in Phase 5"
        body="Funnel, conversion rates, MDE/AE breakdown, and coaching mode." />
    </div>
  )
}

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
