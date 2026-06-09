import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, ROLES } from './context/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Auth/Login'
import Pipeline from './pages/Pipeline'
import LeadDetail from './pages/LeadInbox/LeadDetail'
import {
  MyDay, LeadInbox, Accounts,
  Tasks, Performance, Settings, NotFound,
} from './pages'
import { Loading } from './components/ui'

// Protected layout wrapper
function AppLayout() {
  const { role } = useAuth()

  // Counts — will be fetched from API in Phase 1+
  // For now, static zeros so sidebar renders correctly
  const counts = {
    activeDeals: 0,
    leads: 0,
    slaBreaches: 0,
    tasksToday: 0,
  }

  return (
    <div className="app">
      <Sidebar counts={counts} />
      <main>
        <Routes>
          {/* My Day — only for MDE and AE */}
          {(role === ROLES.MDE || role === ROLES.AE) && (
            <Route path="/" element={<MyDay />} />
          )}

          {/* For Sales Lead and Admin, default to pipeline */}
          {(role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE ||
            role === ROLES.ADMIN) && (
            <Route path="/" element={<Navigate to="/pipeline" replace />} />
          )}

          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/pipeline/:dealId" element={<Pipeline />} />
          <Route path="/leads" element={<LeadInbox />} />
          <Route path="/leads/:leadId" element={<LeadDetail />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:accountId" element={<Accounts />} />
          <Route path="/tasks" element={<Tasks />} />

          {/* Performance — Sales Lead and Admin only */}
          {(role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE ||
            role === ROLES.ADMIN) && (
            <Route path="/performance" element={<Performance />} />
          )}

          {/* Settings — Admin only */}
          {role === ROLES.ADMIN && (
            <Route path="/settings" element={<Settings />} />
          )}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

// Auth guard
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loading text="Loading Sales Assist…" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loading text="Loading Sales Assist…" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
