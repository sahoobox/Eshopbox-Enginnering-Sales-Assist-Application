import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, ROLES, ROLE_LABELS } from '../../context/AuthContext'
import {
  Layers, AlertCircle, Inbox, Building2, CheckSquare, TrendingUp,
  BarChart3, Users, Settings, Terminal, Plus, LayoutDashboard, Gauge,
} from 'lucide-react'

const NAV_ICON = {
  pipeline: Layers,
  'need-attention': AlertCircle,
  'lead-inbox': Inbox,
  accounts: Building2,
  tasks: CheckSquare,
  performance: TrendingUp,
  reports: BarChart3,
  'bulk-assign': Users,
  settings: Settings,
  'api-log': Terminal,
  'central-dashboard': LayoutDashboard,
  'test-dashboard': Gauge,
}

const NAV_ICON_COLOR = {
  pipeline: 'var(--info)',
  'need-attention': 'var(--danger)',
  'lead-inbox': 'var(--teal)',
  accounts: 'var(--indigo)',
  tasks: 'var(--green)',
  performance: 'var(--orange)',
  reports: 'var(--purple)',
  'bulk-assign': 'var(--cyan)',
  settings: 'var(--slate)',
  'api-log': 'var(--rose)',
  'central-dashboard': 'var(--indigo)',
  'test-dashboard': 'var(--darkgreen)',
}

// Nav config per role
function getNavItems(role, counts = {}) {
  const base = []

  if (role === ROLES.MDE || role === ROLES.AE) {
    base.push(
      { id: 'my-day',        label: 'My Day',       path: '/',                 section: null },
      { id: 'pipeline',      label: role === ROLES.AE ? 'My deals · Enterprise' : 'My deals',
                                                      path: '/pipeline',         section: null,
        count: counts.activeDeals },
      { id: 'need-attention', label: 'Need Attention', path: '/need-attention', section: null,
        count: counts.totalFlags || 0 },
      { id: 'lead-inbox',    label: 'Lead Inbox',    path: '/leads',            section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null,
        count: counts.tasksToday },
    )
  }

  if (role === ROLES.SALES_LEAD_MIDMARKET) {
    base.push(
      { id: 'pipeline',       label: 'Mid-Market Pipeline', path: '/pipeline',      section: null,
        count: counts.activeDeals },
      { id: 'need-attention', label: 'Need Attention',      path: '/need-attention', section: null,
        count: counts.totalFlags || 0 },
      { id: 'lead-inbox',     label: 'Lead Inbox',          path: '/leads',          section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'bulk-assign',    label: 'Bulk Assign',         path: '/bulk-assign',    section: null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance',label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',    label: 'Reports',       path: '/reports',     section: null },
      { id: 'settings',   label: 'Settings',      path: '/settings',    section: 'Team' },
    )
  }

  if (role === ROLES.SALES_LEAD_ENTERPRISE) {
    base.push(
      { id: 'pipeline',       label: 'Enterprise Pipeline', path: '/pipeline',      section: null,
        count: counts.activeDeals },
      { id: 'need-attention', label: 'Need Attention',      path: '/need-attention', section: null,
        count: counts.totalFlags || 0 },
      { id: 'lead-inbox',     label: 'Lead Inbox',          path: '/leads',          section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'bulk-assign',    label: 'Bulk Assign',         path: '/bulk-assign',    section: null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance',label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',    label: 'Reports',       path: '/reports',     section: null },
      { id: 'settings',   label: 'Settings',      path: '/settings',    section: 'Team' },
    )
  }

  if (role === ROLES.ADMIN) {
    base.push(
      { id: 'pipeline',       label: 'All Deals',      path: '/pipeline',      section: null,
        count: counts.activeDeals },
      { id: 'need-attention', label: 'Need Attention', path: '/need-attention', section: null,
        count: counts.totalFlags || 0 },
      { id: 'lead-inbox',     label: 'Lead Inbox',     path: '/leads',          section: null,
        count: counts.leads },
      { id: 'accounts',    label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',       label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance', label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',     label: 'Reports',       path: '/reports',     section: null },
      { id: 'bulk-assign', label: 'Bulk Assign',   path: '/bulk-assign', section: 'Admin' },
      { id: 'settings',    label: 'Settings',      path: '/settings',    section: 'Admin' },
    )
  }

  return base
}

// Avatar color by role
const ROLE_AV = {
  [ROLES.ADMIN]: 'av-red',
  [ROLES.SALES_LEAD_MIDMARKET]: 'av-purple',
  [ROLES.SALES_LEAD_ENTERPRISE]: 'av-purple',
  [ROLES.MDE]: 'av-teal',
  [ROLES.AE]: 'av-amber',
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Sidebar({ counts = {} }) {
  const { user, role, devRole, setDevRole, logout, authFetch } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [apiFailures, setApiFailures] = useState(0)

  useEffect(() => {
    if (user?.email !== 'satyanarayan.sahoo@eshopbox.com') return
    authFetch('/api/admin/api-log?success=false&limit=200')
      .then(r => r.json())
      .then(d => setApiFailures(d.total || d.logs?.length || 0))
      .catch(() => {})
  }, [user])

  const navItems = getNavItems(role, counts)
  if (user?.email === 'satyanarayan.sahoo@eshopbox.com') {
    navItems.push({
      id: 'api-log',
      label: 'API Logs',
      path: '/admin/api-log',
      section: 'Admin',
      count: apiFailures,
      badge: apiFailures > 0 ? 'danger' : null,
    })
  }
  navItems.push({
    id: 'central-dashboard',
    label: 'Central Dashboard',
    path: '/central-dashboard',
    section: null,
  })
  if (['satyanarayan.sahoo@eshopbox.com', 'nitiksha@eshopbox.com'].includes(user?.email)) {
    navItems.push({
      id: 'test-dashboard',
      label: 'Test Dashboard',
      path: '/test-dashboard',
      section: null,
    })
  }

  // Group nav items by section
  const sections = []
  let currentSection = null
  let currentItems = []
  for (const item of navItems) {
    if (item.section !== currentSection) {
      if (currentItems.length) sections.push({ label: currentSection, items: currentItems })
      currentSection = item.section
      currentItems = []
    }
    currentItems.push(item)
  }
  if (currentItems.length) sections.push({ label: currentSection, items: currentItems })

  const isActive = (path) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const isDev = import.meta.env.DEV

  const adminToken = localStorage.getItem('sa_admin_token')
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('sa_admin_user') || '{}') } catch { return {} }
  })()

  return (
    <aside className="sidebar">
      {adminToken && adminUser?.email === 'satyanarayan.sahoo@eshopbox.com' && (
        <div
          onClick={() => {
            localStorage.setItem('sa_token', adminToken)
            localStorage.setItem('sa_user', localStorage.getItem('sa_admin_user'))
            localStorage.removeItem('sa_admin_token')
            localStorage.removeItem('sa_admin_user')
            window.location.href = '/pipeline'
          }}
          style={{
            background: 'var(--warn)',
            color: 'white',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: 6,
            marginBottom: 8
          }}
        >
          👁 Viewing as {JSON.parse(localStorage.getItem('sa_user') || '{}')?.name} · Click to exit
        </div>
      )}
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">SA</div>
        <div className="sidebar-brand-text">
          <strong>Sales Assist</strong>
          <span>Eshopbox · v3</span>
        </div>
      </div>

      {/* Dev role switcher — only in development */}
      {isDev && (
        <div className="role-switcher">
          <label>Dev · Role</label>
          <select
            value={devRole || role || ''}
            onChange={(e) => setDevRole(e.target.value || null)}
          >
            <option value={ROLES.ADMIN}>Admin</option>
            <option value={ROLES.SALES_LEAD_MIDMARKET}>Sales Lead · Mid-Market</option>
            <option value={ROLES.SALES_LEAD_ENTERPRISE}>Sales Lead · Enterprise</option>
            <option value={ROLES.MDE}>MDE</option>
            <option value={ROLES.AE}>AE-Enterprise</option>
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div className="nav-section">{section.label}</div>
            )}
            {section.items.map((item) => {
              const NavIcon = NAV_ICON[item.id]
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  {NavIcon && <NavIcon size={15} color={NAV_ICON_COLOR[item.id]} />}
                  {item.label}
                  {item.count != null && item.count > 0 && (
                    <span className={`nav-count ${item.badge || ''}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Log demo CTA */}
      <button
        className="btn btn-primary"
        onClick={() => navigate('/form')}
        style={{
          width: '100%',
          marginBottom: 8,
          background: '#F95253',
          borderColor: '#F95253',
          justifyContent: 'center',
          fontWeight: 600
        }}
      >
        <Plus size={14} /> Log demo
      </button>

      {/* User card */}
      <div style={{ position: 'relative' }}>
        <div className="sidebar-user" onClick={() => setShowUserMenu(v => !v)} style={{ cursor: 'pointer' }}>
          <div className={`avatar ${ROLE_AV[role] || ''}`}>
            {initials(user?.name || 'U')}
          </div>
          <div className="sidebar-user-info">
            <strong>{user?.name || 'User'}</strong>
            <span>{ROLE_LABELS[role] || role}</span>
          </div>
        </div>
        {showUserMenu && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: 'var(--surface)', border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)',
            marginBottom: 4, overflow: 'hidden', zIndex: 200
          }}>
            <button
              onClick={() => { setShowUserMenu(false); navigate('/settings/account') }}
              style={{
                width: '100%', padding: '10px 12px', border: 'none',
                background: 'none', textAlign: 'left', fontSize: 13,
                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 500, borderBottom: '1px solid var(--line)'
              }}
              onMouseEnter={e => e.target.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.target.style.background = 'none'}
            >
              ⚙ Account settings
            </button>
            <button
              onClick={() => { setShowUserMenu(false); logout() }}
              style={{
                width: '100%', padding: '10px 12px', border: 'none',
                background: 'none', textAlign: 'left', fontSize: 13,
                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 500
              }}
              onMouseEnter={e => e.target.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.target.style.background = 'none'}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
