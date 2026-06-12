import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, ROLES } from './context/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Auth/Login'
import Pipeline from './pages/Pipeline'
import LeadDetail from './pages/LeadInbox/LeadDetail'
import DemoForm from './pages/DemoForm'
import AccountSettings from './pages/AccountSettings'
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
          <Route path="/form" element={<DemoForm />} />
          <Route path="/form/:dealId" element={<DemoForm />} />
          <Route path="/settings/account" element={<AccountSettings />} />

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

// Zoho OAuth callback
function ZohoCallback() {
  const { authFetch } = useAuth()
  const [status, setStatus] = useState('Connecting to Zoho CRM…')

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setStatus('Error: No code received from Zoho.')
      return
    }
    authFetch('/auth/zoho/connect', {
      method: 'POST',
      body: JSON.stringify({ code })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus('Zoho CRM connected! Redirecting…')
          setTimeout(() => window.location.href = '/settings', 1500)
        } else {
          setStatus('Failed to connect Zoho: ' + (data.error || 'Unknown error'))
        }
      })
      .catch(err => setStatus('Error: ' + err.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>{status}</div>
      </div>
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
        path="/zoho-callback"
        element={
          <RequireAuth>
            <ZohoCallback />
          </RequireAuth>
        }
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
