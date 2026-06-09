import { Topbar, Empty, Loading } from '../components/ui'
import { useAuth, ROLES } from '../context/AuthContext'

// ── My Day ───────────────────────────────────────────────
export function MyDay() {
  const { user } = useAuth()
  return (
    <div className="main">
      <Topbar
        title={`Good morning, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle="Here's what needs your attention today."
      />
      <Empty icon="☀️" title="My Day — coming in Phase 3"
        body="KPI tiles, attention flags, tasks, and upcoming demos will appear here." />
    </div>
  )
}

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
export function Tasks() {
  return (
    <div className="main">
      <Topbar title="Tasks" subtitle="All open tasks across your deals" />
      <Empty icon="✅" title="Tasks — coming in Phase 4"
        body="Tasks from Zoho CRM across all your deals. Tick here to complete in Zoho." />
    </div>
  )
}

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
