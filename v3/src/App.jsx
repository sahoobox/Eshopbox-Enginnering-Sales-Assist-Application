import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, ROLES } from './context/AuthContext'
import Sidebar from './components/layout/Sidebar'
import { useDeals } from './hooks/useDeals'
import Login from './pages/Auth/Login'
import AcceptInvite from './pages/Auth/AcceptInvite'
import Pipeline from './pages/Pipeline'
import LeadDetail from './pages/LeadInbox/LeadDetail'
import DemoForm from './pages/DemoForm'
import AccountSettings from './pages/AccountSettings'
import {
  MyDay, LeadInbox, Accounts,
  Tasks, Performance, Reports, Settings, NotFound, NeedAttention, BulkAssign,
} from './pages'
import { Loading } from './components/ui'
import { ToastContainer } from './components/ui/Toast'

// Protected layout wrapper
function AppLayout() {
  const { role, authFetch } = useAuth()
  const { deals } = useDeals()
  const [totalFlags, setTotalFlags] = useState(0)

  useEffect(() => {
    if (!deals.length) return
    authFetch('/api/team/assignable-users')
      .then(r => r.json())
      .then(d => {
        const teamEmails = (d.users || []).map(u => u.email)
        teamEmails.push('shikhar.gupta@eshopbox.com')
        const count = deals
          .filter(deal =>
            deal.flags?.length > 0 &&
            teamEmails.includes(deal.repEmail) &&
            (deal.pipeline === 'Mid-market' || deal.pipeline === 'Enterprise 2.0')
          )
          .reduce((sum, d) => sum + (d.flags?.length || 0), 0)
        setTotalFlags(count)
      })
      .catch(() => {})
  }, [deals])

  const counts = {
    activeDeals: 0,
    leads: 0,
    slaBreaches: 0,
    tasksToday: 0,
    totalFlags,
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
          <Route path="/need-attention" element={<NeedAttention />} />
          <Route path="/leads" element={<LeadInbox />} />
          <Route path="/leads/:leadId" element={<LeadDetail />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:accountId" element={<Accounts />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/form" element={<DemoForm />} />
          <Route path="/form/:dealId" element={<DemoForm />} />
          <Route path="/settings/account" element={<AccountSettings />} />

          {/* Performance + Reports — Sales Lead and Admin only */}
          {(role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE ||
            role === ROLES.ADMIN) && (
            <Route path="/performance" element={<Performance />} />
          )}
          {(role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE ||
            role === ROLES.ADMIN) && (
            <Route path="/reports" element={<Reports />} />
          )}

          {/* Bulk Assign — Admin and Sales Leads */}
          {(role === ROLES.ADMIN ||
            role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE) && (
            <Route path="/bulk-assign" element={<BulkAssign />} />
          )}

          {/* Settings — Admin and Sales Lead */}
          {(role === ROLES.ADMIN ||
            role === ROLES.SALES_LEAD_MIDMARKET ||
            role === ROLES.SALES_LEAD_ENTERPRISE) && (
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
    <>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/accept-invite"
          element={<AcceptInvite />}
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
      <ToastContainer />
    </>
  )
}
