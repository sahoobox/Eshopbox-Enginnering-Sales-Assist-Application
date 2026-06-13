import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, ROLES, ROLE_LABELS } from '../../context/AuthContext'

// Nav config per role
function getNavItems(role, counts = {}) {
  const base = []

  if (role === ROLES.MDE || role === ROLES.AE) {
    base.push(
      { id: 'my-day',     label: 'My Day',       path: '/',            section: null },
      { id: 'pipeline',   label: role === ROLES.AE ? 'My deals · Enterprise' : 'My deals',
                                                   path: '/pipeline',    section: null,
        count: counts.activeDeals },
      { id: 'lead-inbox', label: 'Lead Inbox',    path: '/leads',       section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null,
        count: counts.tasksToday },
    )
  }

  if (role === ROLES.SALES_LEAD_MIDMARKET) {
    base.push(
      { id: 'pipeline',   label: 'Mid-Market Pipeline', path: '/pipeline', section: null,
        count: counts.activeDeals },
      { id: 'lead-inbox', label: 'Lead Inbox',    path: '/leads',       section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance',label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',    label: 'Reports',       path: '/reports',     section: null },
      { id: 'settings',   label: 'Settings',      path: '/settings',    section: 'Team' },
    )
  }

  if (role === ROLES.SALES_LEAD_ENTERPRISE) {
    base.push(
      { id: 'pipeline',   label: 'Enterprise Pipeline', path: '/pipeline', section: null,
        count: counts.activeDeals },
      { id: 'lead-inbox', label: 'Lead Inbox',    path: '/leads',       section: null,
        count: counts.leads, badge: counts.slaBreaches > 0 ? 'danger' : null },
      { id: 'accounts',   label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',      label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance',label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',    label: 'Reports',       path: '/reports',     section: null },
      { id: 'settings',   label: 'Settings',      path: '/settings',    section: 'Team' },
    )
  }

  if (role === ROLES.ADMIN) {
    base.push(
      { id: 'pipeline',    label: 'All Deals',     path: '/pipeline',    section: null,
        count: counts.activeDeals },
      { id: 'lead-inbox',  label: 'Lead Inbox',    path: '/leads',       section: null,
        count: counts.leads },
      { id: 'accounts',    label: 'Accounts',      path: '/accounts',    section: null },
      { id: 'tasks',       label: 'Tasks',         path: '/tasks',       section: null },
      { id: 'performance', label: 'Performance',   path: '/performance', section: null },
      { id: 'reports',     label: 'Reports',       path: '/reports',     section: null },
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
  const { user, role, devRole, setDevRole, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = getNavItems(role, counts)

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

  return (
    <aside className="sidebar">
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
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-dot" />
                {item.label}
                {item.count != null && item.count > 0 && (
                  <span className={`nav-count ${item.badge || ''}`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
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
        + Log demo
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
