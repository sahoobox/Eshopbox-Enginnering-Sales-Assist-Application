import { useState, useEffect, useMemo, useRef } from "react";
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { C } from "./components/ui";
import Overview from "./pages/Overview";
import DealsList from "./pages/DealsList";
import DealDetail from "./pages/DealDetail";
import DemoForm from "./pages/DemoForm";
import FormResult from "./pages/FormResult";
import Settings from "./pages/Settings";
import Login from "./pages/Login.jsx";
import AcceptInvite from "./pages/AcceptInvite";
import Performance from "./pages/Performance";
import Notifications from "./pages/Notifications";
import { getUser, clearAuth, apiFetch, setViewAsEmail } from "./api.js";
import { AppContext, useAppContext } from "./AppContext.js";
import { computeAttentionFlags, getAttentionLevel } from "./utils/attentionRules";

const LOADING_TIPS = [
  "Grade A deals (16–22 pts) close at 55–70%. Prioritise them every morning.",
  "A warehouse visit adds +3 pts to a deal's score — the strongest buying signal in the system.",
  "Flags auto-resolve when you do the work — send the recap, book the follow-up, update the stage.",
  "The Decision Nudge email (Meeting+7) is auto-generated for every deal you log.",
  "Deals in 'Deal Approved' with no activity for 5+ days get flagged automatically.",
  "Log an F2F meeting to boost a deal's score by +2 or +3 pts and recompute the grade instantly.",
  "The 25% demo→close target is tracked live on your My day page.",
];

function LoadingScreen() {
  const [tipIndex, setTipIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTipIndex(i => (i + 1) % LOADING_TIPS.length);
        setVisible(true);
      }, 350);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @keyframes sa-shimmer {
          0%   { left: -80%; }
          100% { left: 160%; }
        }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, background: "#FAFAF7",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {/* Logo mark */}
        <img
          src="/eshopbox-monogram.jpg"
          alt="Eshopbox"
          style={{
            width: 48, height: 48, borderRadius: 12,
            objectFit: 'contain', background: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: 14,
          }}
        />

        <div style={{ fontSize: 18, fontWeight: 600, color: "#1D1D1D", marginBottom: 28 }}>
          Eshopbox Sales Assist
        </div>

        {/* Shimmer bar */}
        <div style={{
          width: 200, height: 3, borderRadius: 999,
          background: "#EBE8E0", overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "-80%",
            width: "60%", height: "100%", borderRadius: 999,
            background: "linear-gradient(90deg, transparent 0%, #F95253 50%, transparent 100%)",
            animation: "sa-shimmer 1.4s ease-in-out infinite",
          }} />
        </div>

        {/* Did you know card */}
        <div style={{
          position: "fixed", bottom: 60, left: "50%", transform: "translateX(-50%)",
          background: "#fff", borderRadius: 12, padding: "20px 24px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 400,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#F95253",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
          }}>Did you know?</div>
          <div style={{
            fontSize: 13.5, color: "#1D1D1D", lineHeight: 1.65,
            opacity: visible ? 1 : 0,
            transition: "opacity 0.35s ease",
            minHeight: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {LOADING_TIPS[tipIndex]}
          </div>
          {/* Dot indicators */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
            {LOADING_TIPS.map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: i === tipIndex ? "#F95253" : "#EBE8E0",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const V2 = {
  brand: "#F95253",
  brandDark: "#D63E3F",
  accentLight: "#FEECEC",
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surface2: "#F4F2EC",
  line: "#EBE8E0",
  line2: "#D9D5C9",
  ink: "#1D1D1D",
  ink2: "#4A4A46",
  ink3: "#8A8A85",
  white: "#FFFFFF",
  ok: "#0F6E56",
  okBg: "#E1F5EE",
  danger: "#991F1F",
  dangerBg: "#FCEBEB",
  info: "#185FA5",
  infoBg: "#E6F1FB",
  warn: "#854F0B",
  warnBg: "#FAEEDA",
  purple: "#534AB7",
  purpleBg: "#EEEDFE",
};

const PANEL_STAGES = [
  "Qualified To Buy", "Demo Call Scheduled", "Demo Done",
  "Proposal Sent", "Follow up Meeting Done", "Deal Approved",
  "Won/Payment Received", "Lost/Dropped",
];

const CONDUCTED_STAGES = ['Demo Done', 'Proposal Sent', 'Follow up Meeting Done', 'Deal Approved'];
const UPCOMING_STAGES = ['Qualified To Buy', 'Demo Call Scheduled'];
const INBOX_STAGES = [...CONDUCTED_STAGES, ...UPCOMING_STAGES];

function daysInStageApp(deal) {
  const ref = deal.stageChangedOn || deal.demoDate;
  if (!ref) return null;
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - d) / 86400000));
}

function FilterSection({ label, filter, onToggleValue, onToggleMode, options, isActive, collapsed, onToggle, children }) {
  const ref = useRef(null);
  const active = filter ? filter.values.length > 0 : !!isActive;

  useEffect(() => {
    if (!collapsed && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);

  return (
    <div ref={ref}>
      <div
        onClick={onToggle}
        style={{
          padding: '8px 12px',
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: active ? 'var(--brand)' : 'var(--ink-2)',
          cursor: 'pointer',
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--line)',
          borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{label}</span>
          {filter && filter.values.length > 0 && (
            <span style={{
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--brand)', color: 'white',
              fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{filter.values.length}</span>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div style={{ padding: options ? '6px 10px 8px' : '0' }}>
          {filter && filter.values.length > 0 && onToggleMode && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {['is', 'is not'].map(m => (
                <button
                  key={m}
                  onClick={e => { e.stopPropagation(); onToggleMode(); }}
                  style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: filter.mode === m ? '#F95253' : 'var(--surface-2)',
                    color: filter.mode === m ? 'white' : 'var(--ink-2)',
                    transition: 'all 0.12s ease',
                  }}
                >{m}</button>
              ))}
            </div>
          )}
          {options ? options.map(opt => {
            const checked = filter.values.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => onToggleValue(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: checked ? '1.5px solid #F95253' : '1.5px solid var(--line-2)',
                  background: checked ? '#F95253' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <span style={{ color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.count != null && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{opt.count}</span>
                )}
              </div>
            );
          }) : children}
        </div>
      )}
    </div>
  );
}

const NAV_ICONS = {
  '/': 'ti-sun',
  '/deals': 'ti-briefcase',
  '/performance': 'ti-chart-bar',
  '/notifications': 'ti-bell',
  '/settings': 'ti-settings',
};

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user, viewAsUser, deals, handleLogout, sidebarCollapsed, setSidebarCollapsed,
    search, setSearch, filterStage, setFilterStage, filterGrade, setFilterGrade,
    filterRep, setFilterRep, filterSolution, setFilterSolution, filterVolume, setFilterVolume,
    filterFlags, setFilterFlags, filterDays, setFilterDays,
    healthCard, setHealthCard, dateFrom, setDateFrom, dateTo, setDateTo,
    panelCounts, repList, HEALTH_CARDS, activeFilterCount, clearAllFilters, isManagerRole, canLogDemo,
  } = useAppContext();
  const [showSignOut, setShowSignOut] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({ view: false, stage: true, grade: true, rep: true, solution: true, volume: true, flags: true, days: true, demoDate: true });
  const [zohoConnected, setZohoConnected] = useState(null);
  const [zohoConnecting, setZohoConnecting] = useState(false);
  const isDealsPage = location.pathname === '/deals';

  const highFlagsCount = deals.filter(d => d.attentionLevel === "high").length;
  const totalDeals = deals.length;
  const displayUser = viewAsUser || user;
  const effectiveRole = viewAsUser?.role || user?.role;

  const adminSections = [
    {
      label: "OPERATE", items: [
        { label: "Performance", path: "/performance" },
        { label: "All deals", path: "/deals", badge: totalDeals || null, badgeColor: "neutral" },
      ],
    },
    {
      label: "CONFIGURE", items: [
        { label: "Settings", path: "/settings" },
      ],
    },
    {
      label: "ACTIVITY", items: [
        { label: "Notifications", path: "/notifications" },
      ],
    },
  ];

  const navSections = {
    "Sales rep": [
      {
        label: "TODAY", items: [
          { label: "My day", path: "/", badge: highFlagsCount || null, badgeColor: "danger" },
          { label: "My deals", path: "/deals", badge: totalDeals || null, badgeColor: "neutral" },
        ],
      },
      {
        label: "ACTIVITY", items: [
          { label: "Notifications", path: "/notifications" },
        ],
      },
    ],
    "Manager": [
      {
        label: "LEAD", items: [
          { label: "My day", path: "/", badge: highFlagsCount || null, badgeColor: "danger" },
          { label: "Performance", path: "/performance" },
          { label: "All deals", path: "/deals", badge: totalDeals || null, badgeColor: "neutral" },
        ],
      },
      {
        label: "ACTIVITY", items: [
          { label: "Notifications", path: "/notifications" },
        ],
      },
    ],
    "Admin": adminSections,
    "Developer": adminSections,
    "Sales Lead Mid-Market": [
      {
        label: "OPERATE", items: [
          { label: "Performance", path: "/performance" },
          { label: "Mid-Market Pipeline", path: "/deals", badge: totalDeals || null, badgeColor: "neutral" },
        ],
      },
      {
        label: "ACTIVITY", items: [
          { label: "Notifications", path: "/notifications" },
        ],
      },
    ],
    "Sales Lead Enterprise": [
      {
        label: "OPERATE", items: [
          { label: "Performance", path: "/performance" },
          { label: "Enterprise Pipeline", path: "/deals", badge: totalDeals || null, badgeColor: "neutral" },
        ],
      },
      {
        label: "ACTIVITY", items: [
          { label: "Notifications", path: "/notifications" },
        ],
      },
    ],
  };

  const sections = navSections[effectiveRole] || navSections["Sales rep"];
  const isActive = (path) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  const initials = displayUser?.name?.split(" ").map(w => w[0]).slice(0, 2).join("") || "?";
  const isRepOrManager = effectiveRole === "Sales rep" || effectiveRole === "Manager";

  useEffect(() => {
    if (!isRepOrManager) return;
    apiFetch('/auth/zoho/status')
      .then(data => setZohoConnected(data.connected ?? false))
      .catch(() => {});
  }, [effectiveRole]);

  const handleZohoConnect = async () => {
    setZohoConnecting(true);
    try {
      const config = await apiFetch('/auth/zoho/config');
      const scope = "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.send_mail.all.CREATE,ZohoCRM.modules.emails.ALL,Aaaserver.profile.Read";
      const url = `https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(scope)}&client_id=${config.clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(config.redirectUri)}`;
      window.location.href = url;
    } catch {
      setZohoConnecting(false);
    }
  };

  return (
    <div style={{
      width: sidebarCollapsed ? 52 : 240,
      flexShrink: 0,
      position: "sticky",
      top: 0,
      height: "100vh",
      transition: "width 0.2s ease",
    }}>
      {/* Relative wrapper — containing block for the toggle button */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Toggle button */}
      <button
        onClick={() => setSidebarCollapsed(c => !c)}
        onMouseEnter={e => e.currentTarget.style.background = '#0C447C'}
        onMouseLeave={e => e.currentTarget.style.background = '#185FA5'}
        style={{
          position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#185FA5', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#fff', zIndex: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

      {/* Inner sidebar — overflow:hidden clips text during width animation */}
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        display: "flex", flexDirection: "column",
        boxSizing: "border-box",
        overflow: 'hidden',
      }}>
        {/* Fixed top: brand + nav */}
        <div style={{ flexShrink: 0, padding: sidebarCollapsed ? "20px 8px 8px" : "20px 16px 8px" }}>
          {/* Brand block */}
          <div style={{ display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            <img
              src="/eshopbox-monogram.jpg"
              alt="Eshopbox"
              style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'contain', background: '#fff', flexShrink: 0 }}
            />
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: V2.ink, lineHeight: 1.2 }}>Sales Assist</div>
                <div style={{ fontSize: 12, color: V2.ink3, lineHeight: 1.2 }}>Eshopbox</div>
              </div>
            )}
          </div>

          {/* Nav sections */}
          <nav style={{ padding: "4px 0" }}>
            {sections.map((section) => (
              <div key={section.label} style={{ marginBottom: 4 }}>
                {!sidebarCollapsed && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: "0.06em", textTransform: "uppercase", padding: "16px 10px 6px", margin: 0 }}>
                    {section.label}
                  </div>
                )}
                {sidebarCollapsed && <div style={{ height: 8 }} />}
                {section.items.map(item => {
                  const active = isActive(item.path);
                  const icon = NAV_ICONS[item.path] || 'ti-circle';
                  if (sidebarCollapsed) {
                    return (
                      <div
                        key={item.path}
                        title={item.label}
                        onClick={() => navigate(item.path)}
                        style={{
                          width: 36, height: 36, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: active ? 'var(--surface-2)' : 'transparent',
                          cursor: 'pointer', margin: '2px auto',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <i className={`ti ${icon}`} style={{ fontSize: 18, color: active ? 'var(--brand)' : 'var(--ink-3)' }} aria-hidden="true" />
                      </div>
                    );
                  }
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: "none",
                        background: active ? 'var(--surface-2)' : "transparent",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 2,
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--brand)' : 'var(--ink-3)', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 500 : 400, color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{item.label}</span>
                      {item.badge != null && (
                        <span style={{
                          fontSize: 11, padding: "1px 7px", borderRadius: 10, fontWeight: 700, marginLeft: "auto",
                          background: item.badgeColor === "danger" ? "#FDECEA" : item.badgeColor === "warn" ? "#FEF2E0" : V2.surface2,
                          color: item.badgeColor === "danger" ? "#BE3728" : item.badgeColor === "warn" ? "#B05C00" : V2.ink3,
                        }}>{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Scrollable middle: filter panel (always flex:1 to push user card down) */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${V2.line}` }}>
          {isDealsPage && !sidebarCollapsed && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-2)' }}>
                <i className="ti ti-filter" style={{ fontSize: 13 }} aria-hidden="true" />
                Filters
              </div>

              <FilterSection
                label="Stage"
                filter={filterStage}
                onToggleValue={v => setFilterStage(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterStage(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={PANEL_STAGES.map(s => ({ value: s, label: s, count: panelCounts?.stage[s] || 0 }))}
                collapsed={!!collapsedSections.stage}
                onToggle={() => setCollapsedSections(s => ({ ...s, stage: !s.stage }))}
              />

              <FilterSection
                label="Grade"
                filter={filterGrade}
                onToggleValue={v => setFilterGrade(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterGrade(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={["A", "B", "C", "D"].map(g => ({ value: g, label: `Grade ${g}`, count: panelCounts?.grade[g] || 0 }))}
                collapsed={!!collapsedSections.grade}
                onToggle={() => setCollapsedSections(s => ({ ...s, grade: !s.grade }))}
              />

              {isManagerRole && (
                <FilterSection
                  label="Rep"
                  filter={filterRep}
                  onToggleValue={v => setFilterRep(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                  onToggleMode={() => setFilterRep(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                  options={repList.filter(r => r !== "All reps").map(r => ({ value: r, label: r, count: panelCounts?.rep[r] || 0 }))}
                  collapsed={!!collapsedSections.rep}
                  onToggle={() => setCollapsedSections(s => ({ ...s, rep: !s.rep }))}
                />
              )}

              <FilterSection
                label="Solution"
                filter={filterSolution}
                onToggleValue={v => setFilterSolution(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterSolution(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={[
                  { value: "shipping",    label: "Shipping" },
                  { value: "warehousing", label: "Warehousing" },
                  { value: "both",        label: "Full-stack" },
                ].map(o => ({ ...o, count: panelCounts?.solution[o.value] || 0 }))}
                collapsed={!!collapsedSections.solution}
                onToggle={() => setCollapsedSections(s => ({ ...s, solution: !s.solution }))}
              />

              <FilterSection
                label="Volume"
                filter={filterVolume}
                onToggleValue={v => setFilterVolume(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterVolume(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={[
                  { value: "New store / not shipping orders yet", label: "New store" },
                  { value: "1 - 500 orders/month",               label: "1–500/mo" },
                  { value: "501 - 3,000 orders/month",            label: "501–3,000/mo" },
                  { value: "3,001 - 10,000 orders/month",         label: "3,001–10,000/mo" },
                  { value: "More than 10,000 orders/month",       label: "10,000+/mo" },
                ].map(o => ({ ...o, count: panelCounts?.volume[o.value] || 0 }))}
                collapsed={!!collapsedSections.volume}
                onToggle={() => setCollapsedSections(s => ({ ...s, volume: !s.volume }))}
              />

              <FilterSection
                label="Flags"
                filter={filterFlags}
                onToggleValue={v => setFilterFlags(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterFlags(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={[
                  { value: "has",  label: "Has flags", count: panelCounts?.hasFlags },
                  { value: "none", label: "No flags",  count: panelCounts?.noFlags },
                ]}
                collapsed={!!collapsedSections.flags}
                onToggle={() => setCollapsedSections(s => ({ ...s, flags: !s.flags }))}
              />

              <FilterSection
                label="Days in stage"
                filter={filterDays}
                onToggleValue={v => setFilterDays(p => ({ ...p, values: p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v] }))}
                onToggleMode={() => setFilterDays(p => ({ ...p, mode: p.mode === 'is' ? 'is not' : 'is' }))}
                options={[
                  { value: "0-3",  label: "0–3 days",  count: panelCounts?.days?.['0-3']  || 0 },
                  { value: "4-7",  label: "4–7 days",  count: panelCounts?.days?.['4-7']  || 0 },
                  { value: "8-14", label: "8–14 days", count: panelCounts?.days?.['8-14'] || 0 },
                  { value: "14+",  label: "14+ days",  count: panelCounts?.days?.['14+']  || 0 },
                ]}
                collapsed={!!collapsedSections.days}
                onToggle={() => setCollapsedSections(s => ({ ...s, days: !s.days }))}
              />

              <FilterSection label="Demo date" isActive={!!(dateFrom || dateTo)} collapsed={!!collapsedSections.demoDate} onToggle={() => setCollapsedSections(s => ({ ...s, demoDate: !s.demoDate }))}>
                <div style={{ padding: '6px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    max={dateTo || undefined}
                    style={{ appearance: "none", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", color: dateFrom ? "var(--ink)" : "var(--ink-3)", cursor: "pointer", width: "100%", outline: "none", boxSizing: 'border-box' }}
                  />
                  <input
                    type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    min={dateFrom || undefined}
                    style={{ appearance: "none", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", color: dateTo ? "var(--ink)" : "var(--ink-3)", cursor: "pointer", width: "100%", outline: "none", boxSizing: 'border-box' }}
                  />
                </div>
              </FilterSection>

              {activeFilterCount > 0 && (
                <div style={{ padding: '8px 14px 4px' }}>
                  <button
                    onClick={clearAllFilters}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >Clear all filters</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Log Demo button */}
        {canLogDemo && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${V2.line}`, padding: sidebarCollapsed ? "8px" : "10px 14px" }}>
            {sidebarCollapsed ? (
              <div
                onClick={() => navigate('/form')}
                title="Log demo"
                style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 auto', color: '#fff', fontSize: 18, fontWeight: 700 }}
              >+</div>
            ) : (
              <button
                onClick={() => navigate('/form')}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em' }}
              >+ Log demo</button>
            )}
          </div>
        )}

        {/* Fixed bottom: user card */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${V2.line}`, padding: sidebarCollapsed ? "8px" : "8px 14px" }}>
          <div
            style={{
              display: "flex", alignItems: "center",
              gap: sidebarCollapsed ? 0 : 10,
              cursor: "pointer",
              padding: sidebarCollapsed ? "4px 0" : "12px 14px",
              borderRadius: "var(--radius-md)", background: "var(--surface-2)",
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            }}
            onClick={() => !sidebarCollapsed && setShowSignOut(s => !s)}
            title={sidebarCollapsed ? (displayUser?.name || '') : undefined}
          >
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: V2.brand + "20", border: `1.5px solid ${V2.brand}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: V2.brand, flexShrink: 0 }}>
              {initials}
            </div>
            {!sidebarCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: V2.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayUser?.name?.split(" ")[0]}
                  </div>
                  <div style={{ fontSize: 12, color: V2.ink3, lineHeight: 1.2 }}>{effectiveRole}</div>
                </div>
                <span style={{ fontSize: 11, color: V2.ink3, userSelect: "none" }}>⌄</span>
              </>
            )}
          </div>
          {showSignOut && !sidebarCollapsed && (
            <div style={{ marginTop: 4, background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 8, padding: 4, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
              {isRepOrManager && (
                <>
                  <button
                    onClick={() => { navigate("/settings"); setShowSignOut(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", fontSize: 13, color: V2.ink, cursor: "pointer", fontFamily: "inherit", display: "block" }}
                  >
                    Account settings
                  </button>
                  <div style={{ padding: "8px 10px", fontSize: 12 }}>
                    {zohoConnected === null ? (
                      <span style={{ color: V2.ink3 }}>Checking Zoho…</span>
                    ) : zohoConnected ? (
                      <span style={{ color: "#0B6B5A", fontWeight: 500 }}>Zoho ✓ connected</span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#BE3728" }}>Zoho — not connected</span>
                        <button
                          onClick={handleZohoConnect}
                          disabled={zohoConnecting}
                          style={{ fontSize: 11, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: zohoConnecting ? "not-allowed" : "pointer", fontFamily: "inherit", padding: 0 }}
                        >
                          {zohoConnecting ? "…" : "Connect →"}
                        </button>
                      </span>
                    )}
                  </div>
                  <div style={{ height: 1, background: V2.line, margin: "2px 0" }} />
                </>
              )}
              <button
                onClick={handleLogout}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: "transparent", color: V2.ink3, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "block" }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

const API = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";

function ZohoCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setError("No authorization code received from Zoho.");
      return;
    }
    const token = localStorage.getItem("auth_token");
    fetch(`${API}/auth/zoho/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => navigate("/settings"), 2000);
        } else {
          setStatus("error");
          setError(data.error || "Failed to connect Zoho account.");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Network error. Please try again.");
      });
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 20px", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
      {status === "loading" && (
        <div style={{ color: C.muted, fontSize: 15 }}>Connecting your Zoho account…</div>
      )}
      {status === "success" && (
        <div>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Zoho connected successfully</div>
          <div style={{ fontSize: 13, color: C.muted }}>Redirecting to Settings…</div>
        </div>
      )}
      {status === "error" && (
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.danger, marginBottom: 8 }}>Connection failed</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{error}</div>
          <button onClick={() => navigate("/settings")}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Try again in Settings
          </button>
        </div>
      )}
    </div>
  );
}

function ProtectedRoute() {
  const { user } = useAppContext();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function DevPanel() {
  const { viewAsUser, setViewAsUser } = useAppContext();
  const [expanded, setExpanded] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    apiFetch('/api/users/all')
      .then(data => setAllUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded]);

  if (!expanded) {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: '#1D1D1D', color: 'white', borderRadius: 999,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >🛠 Dev</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <div style={{
        background: '#1D1D1D', color: 'white',
        borderRadius: 16, padding: 20, width: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>🛠 Developer Mode</div>
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: '#8A8A85', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ fontSize: 12, color: '#8A8A85', marginBottom: 16 }}>Impersonate any user</div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#8A8A85', padding: '8px 0' }}>Loading users…</div>
          ) : allUsers.map(u => {
            const initials = u.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?';
            const isActive = viewAsUser?.email === u.email;
            return (
              <div
                key={u.id}
                onClick={() => { setViewAsUser(u); setExpanded(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#F95253', color: 'white',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: '#8A8A85' }}>{u.role}</div>
                </div>
                {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
        {viewAsUser && (
          <button
            onClick={() => setViewAsUser(null)}
            style={{
              background: '#F95253', color: 'white', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, fontWeight: 600,
              width: '100%', border: 'none', cursor: 'pointer', marginTop: 12,
            }}
          >Exit impersonation</button>
        )}
      </div>
    </div>
  );
}

function MainLayout() {
  const { viewAsUser, setViewAsUser } = useAppContext();
  return (
    <div style={{ display: "flex", height: "100vh", background: V2.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: V2.ink }}>
      <style>{`
        :root {
          --brand:      #F95253;
          --brand-dark: #D63E3F;
          --bg:         #FAFAF7;
          --surface:    #FFFFFF;
          --surface-2:  #F4F2EC;
          --line:       #EBE8E0;
          --line-2:     #D9D5C9;
          --ink:        #1D1D1D;
          --ink-2:      #4A4A46;
          --ink-3:      #8A8A85;
          --ok:         #0F6E56;
          --ok-bg:      #E1F5EE;
          --danger:     #991F1F;
          --danger-bg:  #FCEBEB;
          --info:       #185FA5;
          --info-bg:    #E6F1FB;
          --warn:       #854F0B;
          --warn-bg:    #FAEEDA;
          --purple:     #534AB7;
          --purple-bg:  #EEEDFE;
          --grade-a:    #0F6E56; --grade-a-bg: #E1F5EE;
          --grade-b:    #185FA5; --grade-b-bg: #E6F1FB;
          --grade-c:    #854F0B; --grade-c-bg: #FAEEDA;
          --grade-d:    #991F1F; --grade-d-bg: #FCEBEB;
          --radius-sm:  6px;
          --radius-md:  8px;
          --radius-lg:  12px;
          --shadow-1:   0 1px 2px rgba(29,29,29,0.04);
          --shadow-2:   0 2px 8px rgba(29,29,29,0.08);
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: var(--bg); }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5;
        }
        button { font-family: inherit; cursor: pointer; transition: all 0.12s ease; }
        input, select, textarea { font-family: inherit; font-size: 14px; transition: all 0.12s ease; }
        a { color: inherit; text-decoration: none; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }
        ::selection { background: #FEECEC; color: var(--ink); }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, zoom: 0.9 }}>
        {viewAsUser && (
          <div style={{
            background: '#FEF3C7', borderBottom: '1px solid #FCD34D',
            padding: '8px 20px', fontSize: 13, color: '#92400E',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <span>👁 Viewing as {viewAsUser.name} ({viewAsUser.role}) — You are in impersonation mode. Actions are disabled.</span>
            <button
              onClick={() => setViewAsUser(null)}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #92400E', color: '#92400E', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
            >Exit</button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: "28px 40px 60px" }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [deals, setDeals] = useState(null);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [formScore, setFormScore] = useState(0);
  const [viewAsUser, setViewAsUser] = useState(null);
  const [impersonationToast, setImpersonationToast] = useState(false);
  const DEVELOPER_EMAIL = 'satyanarayan.sahoo@eshopbox.com';

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (!token || !savedUser) {
      setAuthChecked(true);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setUser(null);
        setAuthChecked(true);
        return;
      }

      setUser(JSON.parse(savedUser));
      setAuthChecked(true);
    } catch (e) {
      console.error('Malformed token cleared:', e.message);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDeals();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setViewAsEmail(viewAsUser?.email || null);
    fetchDeals();
  }, [viewAsUser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!document.getElementById('tabler-icons-css')) {
      const link = document.createElement('link');
      link.id = 'tabler-icons-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
      document.head.appendChild(link);
    }
  }, []);

  async function fetchDeals() {
    setDealsLoading(true);
    try {
      const data = await apiFetch('/api/deals');
      setDeals(data.deals || []);
    } catch (err) {
      console.error('Failed to fetch deals:', err);
    } finally {
      setDealsLoading(false);
    }
  }

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearAuth();
    setUser(null);
    setDeals(null);
  }

  const handleImpersonationAction = () => {
    setImpersonationToast(true);
    setTimeout(() => setImpersonationToast(false), 3000);
  };

  const isManagerRole = user !== null && (user.role === "Admin" || user.role === "Manager" || user.role === "Sales Lead Mid-Market" || user.role === "Sales Lead Enterprise");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState({ values: [], mode: 'is' });
  const [filterGrade, setFilterGrade] = useState({ values: [], mode: 'is' });
  const [filterRep, setFilterRep] = useState({ values: [], mode: 'is' });
  const [filterSolution, setFilterSolution] = useState({ values: [], mode: 'is' });
  const [filterVolume, setFilterVolume] = useState({ values: [], mode: 'is' });
  const [filterFlags, setFilterFlags] = useState({ values: [], mode: 'is' });
  const [filterDays, setFilterDays] = useState({ values: [], mode: 'is' });
  const [healthCard, setHealthCard] = useState("inbox");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const scopedDeals = useMemo(() => {
    if (!deals) return [];
    const base = isManagerRole ? deals : deals.filter(d => d.repEmail === user?.email);
    return base.map(d => {
      const computed = computeAttentionFlags(d);
      const computedRules = new Set(computed.map(f => f.rule));
      const backendOnly = (d.flags || []).filter(f => !computedRules.has(f.rule));
      const flags = [...computed, ...backendOnly];
      return { ...d, flags, attentionLevel: getAttentionLevel(flags) };
    });
  }, [deals, isManagerRole, user?.email]);

  const repList = useMemo(() => {
    const names = [...new Set(scopedDeals.map(d => d.repName).filter(Boolean))].sort();
    return ["All reps", ...names];
  }, [scopedDeals]);

  const panelCounts = useMemo(() => {
    const stage = {}, grade = {}, rep = {}, solution = {}, volume = {};
    let hasFlags = 0, noFlags = 0;
    const days = { '0-3': 0, '4-7': 0, '8-14': 0, '14+': 0 };
    scopedDeals.forEach(d => {
      if (d.stage) stage[d.stage] = (stage[d.stage] || 0) + 1;
      if (d.grade) grade[d.grade] = (grade[d.grade] || 0) + 1;
      if (d.repName) rep[d.repName] = (rep[d.repName] || 0) + 1;
      if (d.solutionInterest) solution[d.solutionInterest] = (solution[d.solutionInterest] || 0) + 1;
      if (d.orderVolume) volume[d.orderVolume] = (volume[d.orderVolume] || 0) + 1;
      if (d.flags?.length > 0) hasFlags++; else noFlags++;
      const n = daysInStageApp(d);
      if (n !== null) {
        if (n <= 3) days['0-3']++;
        else if (n <= 7) days['4-7']++;
        else if (n <= 14) days['8-14']++;
        else days['14+']++;
      }
    });
    return { stage, grade, rep, solution, volume, hasFlags, noFlags, days };
  }, [scopedDeals]);

  const inboxCount = useMemo(() => scopedDeals.filter(d => INBOX_STAGES.includes(d.stage)).length, [scopedDeals]);
  const conductedCount = useMemo(() => scopedDeals.filter(d => CONDUCTED_STAGES.includes(d.stage)).length, [scopedDeals]);
  const upcomingDemoCount = useMemo(() => scopedDeals.filter(d => UPCOMING_STAGES.includes(d.stage)).length, [scopedDeals]);
  const wonCount = useMemo(() => scopedDeals.filter(d => d.stage === "Won/Payment Received").length, [scopedDeals]);
  const loggedCount = useMemo(() => scopedDeals.filter(d => d.saLogged).length, [scopedDeals]);
  const notLoggedCount = useMemo(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return scopedDeals.filter(d => {
      if (d.saLogged || d.stage !== "Demo Done") return false;
      const anchor = d.stageChangedOn || d.demoDate;
      if (!anchor) return true;
      return new Date(anchor) < cutoff;
    }).length;
  }, [scopedDeals]);

  if (!authChecked || (user !== null && deals === null)) return <LoadingScreen />;

  const role = user ? (user.role === "Admin" || user.role === "Manager" ? "manager" : "rep") : null;
  const repName = user ? user.name.split(" ")[0] : null;
  const canLogDemo = user ? ["Admin", "Manager", "Sales rep"].includes(user.role) : false;
  const isDeveloper = user?.email === DEVELOPER_EMAIL;
  const isImpersonating = viewAsUser !== null;

  const HEALTH_CARDS = [
    { key: "inbox",      label: "Inbox",           count: inboxCount },
    { key: "conducted",  label: "Conducted",       count: conductedCount },
    { key: "upcoming",   label: "Upcoming",        count: upcomingDemoCount },
    { key: "logged",     label: "Demo logged",     count: loggedCount },
    { key: "not_logged", label: "Not logged",      count: notLoggedCount },
    { key: "won",        label: "Won",             count: wonCount },
    { key: "all",        label: "All deals",       count: scopedDeals.length },
  ];

  const EMPTY_FILTER = { values: [], mode: 'is' };
  const clearAllFilters = () => {
    setSearch("");
    setFilterStage(EMPTY_FILTER); setFilterGrade(EMPTY_FILTER);
    setFilterRep(EMPTY_FILTER); setFilterSolution(EMPTY_FILTER);
    setFilterVolume(EMPTY_FILTER); setFilterFlags(EMPTY_FILTER);
    setFilterDays(EMPTY_FILTER); setDateFrom(''); setDateTo('');
  };

  const activeFilterCount = [
    search !== '',
    filterStage.values.length > 0,
    filterGrade.values.length > 0,
    isManagerRole && filterRep.values.length > 0,
    filterSolution.values.length > 0,
    filterVolume.values.length > 0,
    filterFlags.values.length > 0,
    filterDays.values.length > 0,
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  const ctx = {
    user, deals: deals || [], dealsLoading, fetchDeals,
    role, repName, canLogDemo,
    formData, setFormData, formScore, setFormScore,
    handleLogout,
    viewAsUser, setViewAsUser, isImpersonating, handleImpersonationAction,
    sidebarCollapsed, setSidebarCollapsed,
    search, setSearch,
    filterStage, setFilterStage,
    filterGrade, setFilterGrade,
    filterRep, setFilterRep,
    filterSolution, setFilterSolution,
    filterVolume, setFilterVolume,
    filterFlags, setFilterFlags,
    filterDays, setFilterDays,
    healthCard, setHealthCard,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    scopedDeals, repList, panelCounts,
    inboxCount, conductedCount, upcomingDemoCount, wonCount, loggedCount, notLoggedCount,
    HEALTH_CARDS, activeFilterCount, clearAllFilters, isManagerRole,
  };

  return (
    <AppContext.Provider value={ctx}>
      {isDeveloper && <DevPanel />}
      {impersonationToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, background: '#1D1D1D', color: 'white',
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          ⚠️ You are in impersonation mode — actions are disabled
        </div>
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/accept-invite" element={<AcceptInvite onLogin={handleLogin} />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/deals" element={<DealsList />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/form" element={canLogDemo ? <DemoForm /> : <Navigate to="/" replace />} />
            <Route path="/result" element={formData ? <FormResult /> : <Navigate to="/" replace />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/zoho-callback" element={<ZohoCallback />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </AppContext.Provider>
  );
}
