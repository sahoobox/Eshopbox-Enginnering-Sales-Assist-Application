import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../AppContext";

const V2 = {
  brand: "#F95253", brandDark: "#D63E3F",
  ink: "#1D1D1D", ink2: "#4A4A46", ink3: "#8A8A85",
  bg: "#FAFAF7", surface: "#FFFFFF", surface2: "#F4F2EC",
  line: "#EBE8E0",
  ok: "#0F6E56", okBg: "#E1F5EE",
  warn: "#854F0B", warnBg: "#FAEEDA",
  danger: "#991F1F", dangerBg: "#FCEBEB",
  info: "#185FA5", infoBg: "#E6F1FB",
};

const STAGES_LIST = [
  "All stages", "Qualified To Buy", "Demo Call Scheduled", "Demo Done",
  "Proposal Sent", "Follow up Meeting Done", "Deal Approved",
  "Won/Payment Received", "Lost/Dropped",
];

const CONDUCTED_STAGES = ['Demo Done', 'Proposal Sent', 'Follow up Meeting Done', 'Deal Approved'];
const UPCOMING_STAGES = ['Qualified To Buy', 'Demo Call Scheduled'];
const INBOX_STAGES = [...CONDUCTED_STAGES, ...UPCOMING_STAGES];

const PIPELINE_COLS = [
  { key: "upcoming",               label: "Upcoming",          stages: ["Qualified To Buy", "Demo Call Scheduled"] },
  { key: "Demo Done",              label: "Demo Done" },
  { key: "Proposal Sent",          label: "Proposal Sent" },
  { key: "Follow up Meeting Done", label: "Follow-up Mtg Done" },
  { key: "Deal Approved",          label: "Deal Approved" },
  { key: "Won/Payment Received",   label: "Won" },
  { key: "Lost/Dropped",           label: "Lost / Dropped" },
];

const STAGE_PILL_CFG = {
  "Demo Done":              { bg: "#E6F1FB", text: "#185FA5" },
  "Proposal Sent":          { bg: "#E6F1FB", text: "#185FA5" },
  "Follow up Meeting Done": { bg: "#FAEEDA", text: "#854F0B" },
  "Deal Approved":          { bg: "#E1F5EE", text: "#0F6E56" },
  "Qualified To Buy":       { bg: "#F4F2EC", text: "#4A4A46" },
  "Demo Call Scheduled":    { bg: "#F4F2EC", text: "#4A4A46" },
  "Won/Payment Received":   { bg: "#E1F5EE", text: "#0F6E56" },
  "Deal lost":              { bg: "#FCEBEB", text: "#991F1F" },
};

const STAGE_SHORT = {
  "Demo Done": "Demo done", "Proposal Sent": "Proposal sent",
  "Follow up Meeting Done": "Mtg done", "Deal Approved": "Approved",
  "Qualified To Buy": "Qualified", "Demo Call Scheduled": "Demo sched.",
  "Won/Payment Received": "Won", "Deal lost": "Lost",
};

const GRADE_CFG = {
  A: { bg: "#E1F5EE", text: "#0F6E56" },
  B: { bg: "#E6F1FB", text: "#185FA5" },
  C: { bg: "#FAEEDA", text: "#854F0B" },
  D: { bg: "#FCEBEB", text: "#991F1F" },
};

const SEV_PILL_CFG = {
  high:   { bg: "#FCEBEB", text: "#991F1F" },
  medium: { bg: "#FAEEDA", text: "#854F0B" },
  info:   { bg: "#E6F1FB", text: "#185FA5" },
};

const SOL_LABELS = { shipping: "Shipping", warehousing: "Warehousing", both: "Full-stack" };

const SORT_LABELS = {
  daysInStage: 'Days in stage',
  demoDate: 'Demo date',
  grade: 'Grade',
  flags: 'Flags',
  brandName: 'Brand',
};

const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3 };

const HEALTH_CARD_LABELS = {
  inbox: 'Inbox',
  conducted: 'Conducted',
  upcoming: 'Upcoming',
  logged: 'Demo logged',
  not_logged: 'Not logged',
  won: 'Won',
  all: 'All deals',
};

const CARD_SUBTITLES = {
  inbox: "Needs your attention today",
  conducted: "Demo done, sequence running",
  upcoming: "Scheduled, not yet done",
  logged: "Form filled, drafts ready",
  not_logged: "Form pending, drafts blocked",
  won: "Closed and payment confirmed",
  all: "Every deal across all stages",
};

const CARD_TOOLTIPS = {
  inbox: "Active deals in a conducted or upcoming stage that need action — your working pipeline.",
  conducted: "Deals where the demo has been completed and the follow-up email sequence is in progress.",
  upcoming: "Deals with a demo scheduled but not yet marked done.",
  logged: "Deals where the demo form has been submitted and AI email drafts have been generated.",
  not_logged: "Conducted deals where the demo form hasn't been filled yet — drafts are blocked until logged.",
  won: "Deals closed and confirmed with payment received.",
  all: "Every deal in your pipeline, regardless of stage or status.",
};

// ── Shared sub-components ────────────────────────────────────────────────────

function GradeChip({ grade }) {
  const c = GRADE_CFG[grade] || GRADE_CFG.D;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: c.bg, color: c.text, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
      {grade || "?"}
    </span>
  );
}

function StagePill({ stage }) {
  const isWon = stage === "Won/Payment Received";
  const isLost = stage === "Lost/Dropped" || stage === "Deal lost";
  const bg = isWon ? 'var(--ok-bg)' : isLost ? 'var(--danger-bg)' : 'var(--surface-2)';
  const color = isWon ? 'var(--ok)' : isLost ? 'var(--danger)' : 'var(--ink-2)';
  const border = isWon || isLost ? 'none' : '1px solid var(--line-2)';
  return (
    <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, fontWeight: 500, background: bg, color, border, whiteSpace: "nowrap" }}>
      {STAGE_SHORT[stage] || stage}
    </span>
  );
}

function FlagPill({ level, count }) {
  if (!count || level === "ok") return <span style={{ fontSize: 12, color: V2.ink3 }}>—</span>;
  const c = SEV_PILL_CFG[level] || SEV_PILL_CFG.info;
  return (
    <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: c.bg, color: c.text }}>
      {count}
    </span>
  );
}

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysInStage(deal) {
  const ref = deal.stageChangedOn || deal.demoDate;
  if (!ref) return null;
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - d) / 86400000));
}

function topFlag(flags) {
  if (!flags?.length) return null;
  const order = { high: 0, medium: 1, info: 2 };
  return [...flags].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))[0];
}

const AVATAR_COLORS = [
  { bg: 'var(--ok-bg)',     color: 'var(--ok)'     },
  { bg: 'var(--info-bg)',   color: 'var(--info)'   },
  { bg: 'var(--warn-bg)',   color: 'var(--warn)'   },
  { bg: 'var(--purple-bg)', color: 'var(--purple)' },
];

function RepAvatar({ repName }) {
  const name = repName || '';
  const parts = name.split(' ');
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  const { bg, color } = AVATAR_COLORS[(name.charCodeAt(0) || 0) % 4];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>
        {initials}
      </div>
      <span style={{ fontSize: '13.5px', color: 'var(--ink-2)' }}>{parts[0] || '—'}</span>
    </div>
  );
}

// ── Table header helper ──────────────────────────────────────────────────────

function TH({ children }) {
  return (
    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 500, color: 'var(--ink-3)', letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: `1px solid ${V2.line}`, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

// ── View: Health ─────────────────────────────────────────────────────────────

function HealthTable({ deals, onOpen }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflowX: 'auto', boxShadow: 'var(--shadow-1)' }}>
      <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <TH>Grade</TH><TH>Brand</TH><TH>Rep</TH><TH>Stage</TH>
            <TH>Demo date</TH><TH>Days in stage</TH><TH>Flags</TH>
            <TH>Solution</TH><TH>Volume</TH>
            <th style={{ width: 40, padding: "7px 8px", borderBottom: `1px solid ${V2.line}` }}></th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 ? (
            <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: V2.ink3 }}>No deals match your filters.</td></tr>
          ) : deals.map((d, i) => {
            const days = daysInStage(d);
            return (
              <tr
                key={d.id}
                onClick={() => onOpen(d.id)}
                style={{ borderBottom: '1px solid var(--line)', cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "14px 14px" }}>
                  {d.stage === "Qualified To Buy" || d.stage === "Demo Call Scheduled" ? (
                    <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, fontWeight: 500,
                      background: 'var(--surface-2)', color: 'var(--ink-2)',
                      border: '1px solid var(--line-2)', whiteSpace: "nowrap"
                    }}>
                      {d.stage === "Demo Call Scheduled" ? "Scheduled" : "Qualified"}
                    </span>
                  ) : (
                    <GradeChip grade={d.grade} />
                  )}
                </td>
                <td style={{ padding: "14px 14px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                      {d.brandName}
                      {d.manuallyLogged && (
                        <span
                          title="Visible because this deal was manually logged in Sales Assist. It falls outside the standard criteria (post Jan 2026, 3000+ orders/month)."
                          style={{ color: "var(--ink-3)", fontSize: 11, marginLeft: 4, cursor: "help" }}
                        >*</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: 1 }}>
                      {SOL_LABELS[d.solutionInterest] || d.solutionInterest || '—'}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 14px" }}><RepAvatar repName={d.repName} /></td>
                <td style={{ padding: "14px 14px" }}><StagePill stage={d.stage} /></td>
                <td style={{ padding: "14px 14px", color: V2.ink2, whiteSpace: "nowrap" }}>{fmtDate(d.demoDate)}</td>
                <td style={{ padding: "14px 14px", whiteSpace: "nowrap", fontWeight: days > 7 ? 600 : 400, color: days > 7 ? V2.warn : V2.ink2 }}>
                  {days !== null ? `${days}d` : "—"}
                </td>
                <td style={{ padding: "14px 14px" }}><FlagPill level={d.attentionLevel} count={d.flags.length} /></td>
                <td style={{ padding: "14px 14px", color: V2.ink3, whiteSpace: "nowrap" }}>{SOL_LABELS[d.solutionInterest] || "—"}</td>
                <td style={{ padding: "14px 14px", color: V2.ink3, whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{d.orderVolume || "—"}</td>
                <td style={{ padding: "8px 8px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in Zoho CRM"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-3)", textDecoration: "none", fontSize: 13, transition: "all 0.15s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-2)"; e.currentTarget.style.color = "var(--ink)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-3)"; }}
                  >↗</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── View: Pipeline (Kanban) ──────────────────────────────────────────────────

function PipelineBoard({ deals, onOpen, onLogDemo, canLogDemo }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
      {PIPELINE_COLS.map(col => {
        const colDeals = deals.filter(d =>
          col.stages ? col.stages.includes(d.stage) : d.stage === col.key
        );
        const dotColors = {
          upcoming: 'var(--ink-3)', 'Demo Done': 'var(--info)',
          'Proposal Sent': 'var(--warn)', 'Follow up Meeting Done': 'var(--purple)',
          'Deal Approved': 'var(--ok)', 'Won/Payment Received': 'var(--ok)', 'Lost/Dropped': 'var(--danger)',
        };
        const dotColor = dotColors[col.key] || 'var(--ink-3)';
        return (
          <div key={col.key} style={{ minWidth: 220, maxWidth: 260, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: '14px 16px 10px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{col.label}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface)', borderRadius: '999px', padding: '1px 8px' }}>{colDeals.length}</span>
            </div>
            <div style={{ padding: 8 }}>
            {colDeals.length === 0 ? (
              <div style={{ padding: "16px 10px", textAlign: "center", color: V2.ink3, fontSize: 12, background: V2.surface2, borderRadius: 8, border: `1px dashed ${V2.line}` }}>
                No deals
              </div>
            ) : colDeals.map(d => {
              const days = daysInStage(d);
              return (
                <div
                  key={d.id}
                  onClick={() => onOpen(d.id)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--shadow-1)', transition: 'all 0.12s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-2)'; e.currentTarget.style.borderColor = 'var(--line-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-1)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    {col.key === "upcoming" ? (
                      <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, fontWeight: 500,
                        background: 'var(--surface-2)', color: 'var(--ink-2)',
                        border: '1px solid var(--line-2)', whiteSpace: "nowrap", flexShrink: 0
                      }}>
                        {d.stage === "Demo Call Scheduled" ? "Scheduled" : "Qualified"}
                      </span>
                    ) : (
                      <GradeChip grade={d.grade} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: V2.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.brandName}</div>
                      <div style={{ fontSize: 11, color: V2.ink3, marginTop: 1 }}>{d.repName?.split(" ")[0] || "—"}</div>
                    </div>
                    {d.flags.length > 0 && <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '999px', padding: '2px 10px', fontSize: 11.5, fontWeight: 500 }}>{d.flags.length}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: V2.ink3 }}>
                    {days !== null ? `${days}d in stage` : fmtDate(d.demoDate)}
                  </div>
                  {!d.saLogged && canLogDemo && (
                    <button
                      onClick={e => { e.stopPropagation(); onLogDemo(d.id); }}
                      style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: V2.brand, background: `${V2.brand}10`, border: `1px solid ${V2.brand}30`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      + Log demo
                    </button>
                  )}
                  <a
                    href={`https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--ink-3)", textDecoration: "none", marginTop: 4, display: "block", textAlign: "right" }}
                    onClick={e => e.stopPropagation()}
                  >Open in Zoho ↗</a>
                </div>
              );
            })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── View: Needs attention ────────────────────────────────────────────────────

function AttentionTable({ deals, onOpen }) {
  const sorted = useMemo(() => {
    const sevOrder = { high: 0, medium: 1, info: 2, ok: 3 };
    return [...deals]
      .filter(d => d.flags.length > 0)
      .sort((a, b) => {
        const diff = (sevOrder[a.attentionLevel] ?? 4) - (sevOrder[b.attentionLevel] ?? 4);
        return diff !== 0 ? diff : b.flags.length - a.flags.length;
      });
  }, [deals]);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflowX: 'auto', boxShadow: 'var(--shadow-1)' }}>
      <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <TH>Grade</TH><TH>Brand</TH><TH>Rep</TH><TH>Stage</TH>
            <TH>Flags</TH><TH>Days in stage</TH>
            <th style={{ width: 40, padding: "7px 8px", borderBottom: `1px solid ${V2.line}` }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: V2.ok, fontWeight: 600 }}>No open flags — all deals are on track.</td></tr>
          ) : sorted.map((d, i) => {
            const days = daysInStage(d);
            return (
              <tr
                key={d.id}
                onClick={() => onOpen(d.id)}
                style={{ borderBottom: '1px solid var(--line)', cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "14px 14px" }}><GradeChip grade={d.grade} /></td>
                <td style={{ padding: "14px 14px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                      {d.brandName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', marginTop: 1 }}>
                      {SOL_LABELS[d.solutionInterest] || d.solutionInterest || '—'}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 14px" }}><RepAvatar repName={d.repName} /></td>
                <td style={{ padding: "14px 14px" }}><StagePill stage={d.stage} /></td>
                <td style={{ padding: "14px 14px" }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {d.flags.map((flag, fi) => (
                      <span key={fi} style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {flag.title}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "14px 14px", whiteSpace: "nowrap", fontWeight: days > 7 ? 600 : 400, color: days > 7 ? V2.warn : V2.ink2 }}>
                  {days !== null ? `${days}d` : "—"}
                </td>
                <td style={{ padding: "8px 8px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in Zoho CRM"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-3)", textDecoration: "none", fontSize: 13, transition: "all 0.15s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-2)"; e.currentTarget.style.color = "var(--ink)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-3)"; }}
                  >↗</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DealsList() {
  const {
    user, canLogDemo, isManagerRole,
    search, setSearch,
    filterStage, setFilterStage, filterGrade, setFilterGrade,
    filterRep, setFilterRep, filterSolution, setFilterSolution,
    filterVolume, setFilterVolume, filterFlags, setFilterFlags,
    filterDays, setFilterDays, healthCard, setHealthCard,
    dateFrom, setDateFrom, dateTo, setDateTo,
    scopedDeals, HEALTH_CARDS, activeFilterCount, clearAllFilters,
  } = useAppContext();
  const navigate = useNavigate();

  const [view, setView] = useState("health");
  const [healthView, setHealthView] = useState("list");
  const [sortBy, setSortBy] = useState('daysInStage');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortDir, setSortDir] = useState('desc');

  const handleSortSelect = (key) => {
    if (key === sortBy) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setSortOpen(false);
  };

  const isManager = isManagerRole;

  // Filtered subset (search + dropdown filters)
  const filtered = useMemo(() => scopedDeals
    .filter(d => filterStage === "All stages" || d.stage === filterStage)
    .filter(d => filterGrade === "All grades" || d.grade === filterGrade)
    .filter(d => !isManager || filterRep === "All reps" || d.repName === filterRep)
    .filter(d => filterSolution === "all" || d.solutionInterest === filterSolution)
    .filter(d => filterVolume === "all" || d.orderVolume === filterVolume)
    .filter(d => filterFlags === "all" || (filterFlags === "has" ? (d.flags?.length > 0) : (d.flags?.length === 0)))
    .filter(d => {
      if (filterDays === "all") return true;
      const days = daysInStage(d);
      if (days === null) return false;
      if (filterDays === "0-3") return days <= 3;
      if (filterDays === "4-7") return days >= 4 && days <= 7;
      if (filterDays === "8-14") return days >= 8 && days <= 14;
      if (filterDays === "14+") return days > 14;
      return true;
    })
    .filter(d => !search ||
      d.brandName?.toLowerCase().includes(search.toLowerCase()) ||
      d.repName?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(d => !dateFrom || (d.demoDate && d.demoDate >= dateFrom))
    .filter(d => !dateTo   || (d.demoDate && d.demoDate <= dateTo)),
    [scopedDeals, filterStage, filterGrade, filterRep, filterSolution, filterVolume, filterFlags, filterDays, search, isManager, dateFrom, dateTo]
  );

  // Health card filter applied on top of filtered, then sorted
  const healthFiltered = useMemo(() => {
    let result;
    if (healthCard === "inbox") result = filtered.filter(d => INBOX_STAGES.includes(d.stage));
    else if (healthCard === "conducted") result = filtered.filter(d => CONDUCTED_STAGES.includes(d.stage));
    else if (healthCard === "upcoming") result = filtered.filter(d => UPCOMING_STAGES.includes(d.stage));
    else if (healthCard === "logged") result = filtered.filter(d => d.saLogged);
    else if (healthCard === "not_logged") {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      result = filtered.filter(d => {
        if (d.saLogged || d.stage !== "Demo Done") return false;
        const anchor = d.stageChangedOn || d.demoDate;
        if (!anchor) return true;
        return new Date(anchor) < cutoff;
      });
    }
    else if (healthCard === "won") result = filtered.filter(d => d.stage === "Won/Payment Received");
    else result = filtered;

    const dirMult = sortDir === 'desc' ? 1 : -1;
    return [...result].sort((a, b) => {
      if (sortBy === 'daysInStage') {
        const da = daysInStage(a) ?? -1, db = daysInStage(b) ?? -1;
        return (db - da) * dirMult;
      }
      if (sortBy === 'demoDate') {
        return (new Date(b.demoDate || 0) - new Date(a.demoDate || 0)) * dirMult;
      }
      if (sortBy === 'grade') {
        return ((GRADE_ORDER[a.grade] ?? 4) - (GRADE_ORDER[b.grade] ?? 4)) * dirMult;
      }
      if (sortBy === 'flags') {
        return ((b.flags?.length || 0) - (a.flags?.length || 0)) * dirMult;
      }
      if (sortBy === 'brandName') {
        return (a.brandName || '').localeCompare(b.brandName || '') * dirMult;
      }
      return 0;
    });
  }, [filtered, healthCard, sortBy, sortDir]);

  const attentionCount = useMemo(() =>
    scopedDeals.filter(d => d.flags.length > 0).length,
    [scopedDeals]
  );

  const activeFilters = useMemo(() => {
    const f = [];
    if (search) f.push({ label: `"${search}"`, clear: () => setSearch('') });
    if (filterStage !== "All stages") f.push({ label: `Stage: ${filterStage}`, clear: () => setFilterStage("All stages") });
    if (filterGrade !== "All grades") f.push({ label: `Grade: ${filterGrade}`, clear: () => setFilterGrade("All grades") });
    if (isManager && filterRep !== "All reps") f.push({ label: `Rep: ${filterRep}`, clear: () => setFilterRep("All reps") });
    if (filterSolution !== "all") f.push({ label: `Solution: ${SOL_LABELS[filterSolution] || filterSolution}`, clear: () => setFilterSolution("all") });
    if (filterVolume !== "all") f.push({ label: `Volume: ${filterVolume}`, clear: () => setFilterVolume("all") });
    if (filterFlags !== "all") f.push({ label: filterFlags === "has" ? "Has flags" : "No flags", clear: () => setFilterFlags("all") });
    if (filterDays !== "all") f.push({ label: `Days: ${filterDays}`, clear: () => setFilterDays("all") });
    if (dateFrom) f.push({ label: `From: ${dateFrom}`, clear: () => setDateFrom('') });
    if (dateTo) f.push({ label: `To: ${dateTo}`, clear: () => setDateTo('') });
    return f;
  }, [search, filterStage, filterGrade, filterRep, filterSolution, filterVolume, filterFlags, filterDays, dateFrom, dateTo, isManager]);

  const VIEW_SUBTITLES = {
    health:    "Grade, stage and flag overview across all your deals",
    attention: "Deals with open flags ranked by severity — critical first",
  };

  const TABS = [
    { key: "health",    label: "Health" },
    { key: "attention", label: "Needs attention", badge: attentionCount },
  ];

  const handleTabChange = (key) => {
    setView(key);
    if (key !== "health") setHealthCard("inbox");
  };

  const onOpen = id => navigate(`/deals/${id}`);
  const onLogDemo = id => navigate(`/form?dealId=${id}`);

  const inputStyle = {
    background: "var(--surface)",
    border: "1px solid var(--line-2)",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12.5,
    fontFamily: "inherit",
    color: "var(--ink)",
    outline: "none",
    boxSizing: "border-box",
  };
  const displayCount = view === "health" ? healthFiltered.length : filtered.length;

  return (
    <>
      <style>{`
        .sa-filter-input:focus { border-color: var(--ink-2) !important; }
        .sa-filter-date:focus  { border-color: var(--ink-2) !important; outline: none !important; }
      `}</style>

      {/* ── Main content ── */}
      <div>
        {/* Page header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: V2.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {user?.role === 'Sales Lead Mid-Market' ? 'Mid-Market Pipeline'
                : user?.role === 'Sales Lead Enterprise' ? 'Enterprise Pipeline'
                : isManagerRole ? 'All deals' : 'My deals'}
            </h1>
            <div style={{ fontSize: 13, color: V2.ink3 }}>{VIEW_SUBTITLES[view]}</div>
            {(user?.role === 'Sales Lead Mid-Market' || user?.role === 'Sales Lead Enterprise') && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                {user?.role === 'Sales Lead Mid-Market'
                  ? 'Showing deals · Shipping only'
                  : 'Showing deals · Warehousing · Shipping + Warehousing'}
              </div>
            )}
          </div>
          {canLogDemo && (
            <button
              onClick={() => navigate('/form')}
              style={{ padding: '8px 18px', borderRadius: 6, background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = V2.brandDark}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--brand)'}
            >+ Log demo</button>
          )}
        </div>

        {/* Health filter cards */}
        {view === "health" && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {HEALTH_CARDS.map(({ key, label, count }) => (
              <div
                key={key}
                onClick={() => setHealthCard(key)}
                onMouseEnter={() => setHoveredCard(key)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{ position: 'relative', overflow: 'visible', flex: 1, minWidth: 100, background: 'var(--surface)', border: healthCard === key ? '2px solid var(--ink)' : '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: healthCard === key ? 'var(--shadow-2)' : 'var(--shadow-1)' }}
              >
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: 240, background: 'var(--ink)', color: '#FFFFFF', fontSize: '12.5px', lineHeight: 1.5, padding: '10px 14px', borderRadius: 'var(--radius-md)', textAlign: 'left', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000, pointerEvents: 'none', whiteSpace: 'normal', opacity: hoveredCard === key ? 1 : 0, transition: 'opacity 0.15s ease', visibility: hoveredCard === key ? 'visible' : 'hidden' }}>
                  {CARD_TOOLTIPS[key]}
                  <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid var(--ink)', borderTop: 'none' }} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.01em' }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontWeight: 400, lineHeight: 1.3 }}>{CARD_SUBTITLES[key]}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + sort + view toggles + count */}
        <div style={{ marginBottom: activeFilters.length > 0 ? 8 : 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brand or rep…"
            className="sa-filter-input"
            style={{ ...inputStyle, flex: 1 }}
          />
          {view === "health" && (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line-2)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)', flexShrink: 0 }}>
                {/* Left part — sort field selector */}
                <button
                  onClick={() => setSortOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', border: 'none', background: 'transparent', fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  <i className="ti ti-arrows-sort" style={{ fontSize: 13 }} aria-hidden="true" />
                  {SORT_LABELS[sortBy]}
                </button>
                {/* Divider */}
                <div style={{ width: 1, height: 20, background: 'var(--line-2)', flexShrink: 0 }} />
                {/* Right part — direction toggle */}
                <button
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  title={sortDir === 'desc' ? 'Descending — click for ascending' : 'Ascending — click for descending'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', border: 'none', background: '#185FA5', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', minWidth: 28 }}
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
              {sortOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <div
                      key={key}
                      onClick={() => handleSortSelect(key)}
                      style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: sortBy === key ? 'var(--surface-2)' : 'transparent', color: sortBy === key ? 'var(--ink)' : 'var(--ink-2)', fontWeight: sortBy === key ? 600 : 400 }}
                      onMouseEnter={e => { if (sortBy !== key) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { if (sortBy !== key) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--brand)', width: 12, flexShrink: 0 }}>{sortBy === key ? '✓' : ''}</span>
                      {label}
                      {key === sortBy && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
                          {sortDir === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {view === "health" && (
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => setHealthView("list")} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: healthView === "list" ? V2.ink : V2.surface2, color: healthView === "list" ? "#FFF" : V2.ink3, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} title="List view">≡</button>
              <button onClick={() => setHealthView("kanban")} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: healthView === "kanban" ? V2.ink : V2.surface2, color: healthView === "kanban" ? "#FFF" : V2.ink3, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} title="Kanban view">⊞</button>
            </div>
          )}
          <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{displayCount} deal{displayCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {activeFilters.map((f, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 999, fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                {f.label}
                <span onClick={f.clear} style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1 }}>×</span>
              </span>
            ))}
          </div>
        )}

        {/* Viewing indicator */}
        {view === "health" && healthCard !== 'all' && (
          <div style={{ fontSize: 12.5, color: 'var(--info, #185FA5)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-filter" style={{ fontSize: 13 }} aria-hidden="true" />
            Viewing: <strong>{HEALTH_CARD_LABELS[healthCard]}</strong>
            &nbsp;·&nbsp;
            <span onClick={() => setHealthCard('all')} style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--info, #185FA5)' }}>
              Show all deals
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${V2.line}` }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 0, border: 'none', background: 'transparent', color: view === tab.key ? 'var(--ink)' : 'var(--ink-3)', fontSize: 13, fontWeight: view === tab.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s', borderBottom: view === tab.key ? '2px solid var(--brand)' : '2px solid transparent', marginBottom: -1 }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink-2)', marginLeft: 2 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === "health" && healthView === "list"   && <HealthTable deals={healthFiltered} onOpen={onOpen} />}
        {view === "health" && healthView === "kanban" && <PipelineBoard deals={healthFiltered} onOpen={onOpen} onLogDemo={onLogDemo} canLogDemo={canLogDemo} />}
        {view === "attention" && <AttentionTable deals={filtered} onOpen={onOpen} />}
      </div>
    </>
  );
}
