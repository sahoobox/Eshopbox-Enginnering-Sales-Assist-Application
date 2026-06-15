import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'https://eshopbox-sales-assist-v3-backend.satyanarayan-sahoo.workers.dev'

// Role definitions
export const ROLES = {
  ADMIN: 'admin',
  SALES_LEAD_MIDMARKET: 'lead-midmarket',
  SALES_LEAD_ENTERPRISE: 'lead-enterprise',
  MDE: 'mde',
  AE: 'ae',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SALES_LEAD_MIDMARKET]: 'Sales Lead · Mid-Market',
  [ROLES.SALES_LEAD_ENTERPRISE]: 'Sales Lead · Enterprise',
  [ROLES.MDE]: 'MDE',
  [ROLES.AE]: 'AE-Enterprise',
}

// Which roles can see which group's data
export const canSeeMidMarket = (role) =>
  [ROLES.ADMIN, ROLES.SALES_LEAD_MIDMARKET, ROLES.MDE].includes(role)

export const canSeeEnterprise = (role) =>
  [ROLES.ADMIN, ROLES.SALES_LEAD_ENTERPRISE, ROLES.AE].includes(role)

export const isAdmin = (role) => role === ROLES.ADMIN
export const isSalesLead = (role) =>
  [ROLES.SALES_LEAD_MIDMARKET, ROLES.SALES_LEAD_ENTERPRISE].includes(role)
export const isRep = (role) => [ROLES.MDE, ROLES.AE].includes(role)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Dev override for role switching
  const [devRole, setDevRole] = useState(null)

  const effectiveRole = devRole || user?.role

  useEffect(() => {
    const token = localStorage.getItem('sa_token')
    if (!token) {
      setLoading(false)
      return
    }
    // Verify token with backend
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Invalid token')
        return r.json()
      })
      .then((data) => {
        const roleMap = {
          'Admin': 'admin',
          'Sales Lead Mid-Market': 'lead-midmarket',
          'Sales Lead Enterprise': 'lead-enterprise',
          'Sales rep': 'mde',
          'Manager': 'lead-midmarket',
        }
        const mappedRole = roleMap[data.user?.role] || 'mde'
        setUser({ ...data.user, role: mappedRole, token })
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('sa_token')
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_user')
    localStorage.setItem('sa_token', data.token)
    setUser({ ...data.user, role: data.user?.role || 'mde', token: data.token })
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sa_token')
    setUser(null)
    setDevRole(null)
  }, [])

  const authFetch = useCallback(
    async (path, options = {}) => {
      const token = user?.token || localStorage.getItem('sa_token')
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-app-version': 'v3',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      })
      if (res.status === 401) {
        try {
          const body = await res.clone().json()
          if (body.code === 'SESSION_INVALIDATED') {
            localStorage.removeItem('sa_token')
            localStorage.removeItem('sa_user')
            window.location.href = '/login'
            return res
          }
        } catch {}
        logout()
        throw new Error('Session expired')
      }
      return res
    },
    [user, logout]
  )

  const value = {
    user,
    role: effectiveRole,
    devRole,
    setDevRole,
    loading,
    login,
    logout,
    authFetch,
    API_BASE,
    // Role helpers
    isAdmin: isAdmin(effectiveRole),
    isSalesLead: isSalesLead(effectiveRole),
    isRep: isRep(effectiveRole),
    isMDE: effectiveRole === ROLES.MDE,
    isAE: effectiveRole === ROLES.AE,
    isMidMarketLead: effectiveRole === ROLES.SALES_LEAD_MIDMARKET,
    isEnterpriseLead: effectiveRole === ROLES.SALES_LEAD_ENTERPRISE,
    canSeeMidMarket: canSeeMidMarket(effectiveRole),
    canSeeEnterprise: canSeeEnterprise(effectiveRole),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
