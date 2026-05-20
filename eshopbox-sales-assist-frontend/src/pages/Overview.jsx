import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { computeAttentionFlags, getAttentionLevel } from "../utils/attentionRules";
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

const OPEN_STAGES = [
  "Qualified To Buy", "Demo Call Scheduled", "Demo Done",
  "Proposal Sent", "Follow up Meeting Done", "Deal Approved",
];

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: V2.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 600, color: subColor || V2.ink3, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: V2.ink, margin: 0 }}>{title}</h2>
      {count != null && <span style={{ fontSize: 12, color: V2.ink3 }}>{count}</span>}
    </div>
  );
}

const SEV_CFG = {
  high:   { label: "Critical", bg: "#FCEBEB", text: "#991F1F", bar: "#F95253" },
  medium: { label: "Warning",  bg: "#FAEEDA", text: "#854F0B", bar: "#E5850B" },
  info:   { label: "Advisory", bg: "#E6F1FB", text: "#185FA5", bar: "#185FA5" },
};

function FlagQueueItem({ flag, deal, onOpen, showRep }) {
  const cfg = SEV_CFG[flag.severity] || SEV_CFG.info;
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 8, overflow: "hidden", marginBottom: 6 }}>
      <div style={{ width: 4, flexShrink: 0, background: cfg.bar }} />
      <div style={{ flex: 1, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap", flexShrink: 0 }}>
          {cfg.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: V2.ink }}>{flag.title}</div>
          <div style={{ fontSize: 11, color: V2.ink3, marginTop: 1 }}>
            {deal.brandName}{showRep && deal.repName ? ` · ${deal.repName}` : ""} · {flag.desc}
          </div>
        </div>
        <button
          onClick={() => onOpen(deal.id)}
          style={{ fontSize: 12, fontWeight: 600, color: V2.brand, background: "none", border: `1px solid ${V2.brand}40`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          Open deal →
        </button>
      </div>
    </div>
  );
}

const GRADE_CHIP = {
  A: { bg: "#E1F5EE", text: "#0F6E56" },
  B: { bg: "#E6F1FB", text: "#185FA5" },
  C: { bg: "#FAEEDA", text: "#854F0B" },
  D: { bg: "#FCEBEB", text: "#991F1F" },
};

function GradeChip({ grade }) {
  const c = GRADE_CHIP[grade] || GRADE_CHIP.D;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: c.bg, color: c.text, fontSize: 11, fontWeight: 800 }}>
      {grade || "?"}
    </span>
  );
}

const STAGE_PILL_COLORS = {
  "Demo Done":              { bg: "#E6F1FB", text: "#185FA5" },
  "Proposal Sent":          { bg: "#E6F1FB", text: "#185FA5" },
  "Follow up Meeting Done": { bg: "#FAEEDA", text: "#854F0B" },
  "Deal Approved":          { bg: "#E1F5EE", text: "#0F6E56" },
  "Qualified To Buy":       { bg: "#F4F2EC", text: "#4A4A46" },
  "Demo Call Scheduled":    { bg: "#F4F2EC", text: "#4A4A46" },
  "Won/Payment Received":   { bg: "#E1F5EE", text: "#0F6E56" },
};

const STAGE_SHORT = {
  "Demo Done": "Demo done", "Proposal Sent": "Proposal sent",
  "Follow up Meeting Done": "Mtg done", "Deal Approved": "Approved",
  "Qualified To Buy": "Qualified", "Demo Call Scheduled": "Demo sched.",
  "Won/Payment Received": "Won",
};

function StagePillV2({ stage }) {
  const c = STAGE_PILL_COLORS[stage] || { bg: V2.surface2, text: V2.ink3 };
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: c.bg, color: c.text, whiteSpace: "nowrap" }}>
      {STAGE_SHORT[stage] || stage}
    </span>
  );
}

const SOL_LABELS = { shipping: "Shipping", warehousing: "Warehousing", both: "Full-stack" };

// Kept as named export for backward compatibility
export function ManagerOverview() { return null; }

function MyDayContent({ scopedDeals, isManager, repName }) {
  const navigate = useNavigate();
  const [showAllFlags, setShowAllFlags] = useState(false);

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  const dealsWithFlags = useMemo(() => scopedDeals.map(d => {
    const flags = computeAttentionFlags(d);
    return { ...d, flags, attentionLevel: getAttentionLevel(flags) };
  }), [scopedDeals]);

  const demosThisMonth = useMemo(() => scopedDeals.filter(d => {
    if (!d.saLogged) return false;
    const ref = d.demoDate || d.stageChangedOn;
    if (!ref) return false;
    const dt = new Date(ref);
    return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear;
  }).length, [scopedDeals, thisMonth, thisYear]);

  const allFlags = useMemo(() => {
    const out = [];
    dealsWithFlags.forEach(d => d.flags.forEach(f => out.push({ flag: f, deal: d })));
    const order = { high: 0, medium: 1, info: 2 };
    return out.sort((a, b) => (order[a.flag.severity] ?? 3) - (order[b.flag.severity] ?? 3));
  }, [dealsWithFlags]);

  const criticalDeals = dealsWithFlags.filter(d => d.attentionLevel === "high").length;
  const dealsWithAnyFlag = dealsWithFlags.filter(d => d.flags.length > 0).length;
  const openDeals = dealsWithFlags.filter(d => OPEN_STAGES.includes(d.stage));
  const wonCount = scopedDeals.filter(d => d.stage === "Won/Payment Received").length;
  const closeRate = scopedDeals.length > 0 ? Math.round((wonCount / scopedDeals.length) * 100) : 0;

  const demosNotLogged = useMemo(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return scopedDeals.filter(d => {
      if (d.saLogged || d.stage !== "Demo Done") return false;
      const anchor = d.stageChangedOn || d.demoDate;
      if (!anchor) return true; // no timestamp — show it (safe default)
      return new Date(anchor) < cutoff;
    });
  }, [scopedDeals]);

  const upcomingDeals = useMemo(() =>
    scopedDeals.filter(d =>
      d.stage === "Qualified To Buy" || d.stage === "Demo Call Scheduled"
    ),
    [scopedDeals]
  );

  const portfolioDeals = useMemo(() =>
    openDeals.filter(d => d.stage !== "Qualified To Buy" && d.stage !== "Demo Call Scheduled").slice(0, 10),
    [openDeals]
  );

  const visibleFlags = showAllFlags ? allFlags : allFlags.slice(0, 8);
  const hiddenCount = Math.max(0, allFlags.length - 8);
  const dateStr = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 36px 60px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: V2.ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>My day</h1>
        <div style={{ fontSize: 13, color: V2.ink3 }}>
          {dateStr} · {repName}, here's what needs your attention.
        </div>
      </div>

      {/* 6 metric cards — 3 col × 2 rows */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
        <MetricCard label="Demos this month" value={demosThisMonth} sub="Logged in Sales Assist" />
        <MetricCard
          label="Tasks due today"
          value={dealsWithAnyFlag}
          sub={dealsWithAnyFlag > 0 ? "Deals with open flags" : "All clear"}
          subColor={dealsWithAnyFlag > 0 ? V2.danger : V2.ok}
        />
        <MetricCard
          label="Attention flags"
          value={allFlags.length}
          sub={criticalDeals > 0 ? `${criticalDeals} critical` : "No critical flags"}
          subColor={criticalDeals > 0 ? V2.danger : V2.ok}
        />
        <MetricCard label="Pipeline (open)" value={openDeals.length} sub="Active deals" />
        <MetricCard
          label={isManager ? "Demo → close rate" : "Demo → close (mine)"}
          value={`${closeRate}%`}
          sub="Target 25%"
          subColor={closeRate >= 25 ? V2.ok : V2.danger}
        />
        <MetricCard label="F2F this month" value={0} sub="In-person meetings" />
      </div>

      {/* Needs your attention */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          title="Needs your attention"
          count={allFlags.length > 0 ? `${allFlags.length} flag${allFlags.length !== 1 ? "s" : ""}` : null}
        />
        {allFlags.length === 0 ? (
          <div style={{ background: V2.okBg, border: `1px solid ${V2.ok}30`, borderRadius: 10, padding: "18px 20px", fontSize: 14, fontWeight: 600, color: V2.ok }}>
            Nothing needs your attention. Nice.
          </div>
        ) : (
          <>
            {visibleFlags.map((item, i) => (
              <FlagQueueItem
                key={i}
                flag={item.flag}
                deal={item.deal}
                showRep={isManager}
                onOpen={id => navigate(`/deals/${id}`)}
              />
            ))}
            {!showAllFlags && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllFlags(true)}
                style={{ fontSize: 12, fontWeight: 600, color: V2.brand, background: "none", border: `1px solid ${V2.brand}30`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", marginTop: 2 }}
              >
                Show {hiddenCount} more flag{hiddenCount !== 1 ? "s" : ""}
              </button>
            )}
          </>
        )}
      </div>

      {/* Upcoming demos */}
      {upcomingDeals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Upcoming demos"
            count={`${upcomingDeals.length} deal${upcomingDeals.length !== 1 ? "s" : ""}`}
          />
          <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: V2.surface2 }}>
                  {["Brand", "Stage", "Demo on", "Days in stage", ...(isManager ? ["Rep"] : []), ""].map((h, i) => (
                    <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${V2.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingDeals.map((d, i) => {
                  const daysInStage = d.stageChangedOn
                    ? Math.floor((Date.now() - new Date(d.stageChangedOn)) / 86400000)
                    : null;
                  return (
                    <tr
                      key={d.id}
                      style={{ borderBottom: i < upcomingDeals.length - 1 ? `1px solid ${V2.line}` : "none", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = V2.surface2}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      onClick={() => navigate(`/deals/${d.id}`)}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: V2.ink }}>{d.brandName}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {d.stage === "Demo Call Scheduled"
                          ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: "#E6F1FB", color: "#185FA5" }}>Scheduled</span>
                          : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: "#FAEEDA", color: "#854F0B" }}>Qualified</span>
                        }
                      </td>
                      <td style={{ padding: "10px 14px", color: d.demoDate ? V2.ink2 : V2.ink3 }}>
                        {d.demoDate
                          ? new Date(d.demoDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "Not scheduled"}
                      </td>
                      <td style={{ padding: "10px 14px", color: V2.ink3 }}>
                        {daysInStage != null ? `${daysInStage}d` : "—"}
                      </td>
                      {isManager && <td style={{ padding: "10px 14px", color: V2.ink2 }}>{d.repName || "—"}</td>}
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/deals/${d.id}`); }}
                          style={{ fontSize: 12, fontWeight: 600, color: V2.ink2, background: "none", border: `1px solid ${V2.line}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demos not logged */}
      {demosNotLogged.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Demos not logged"
            count={`${demosNotLogged.length} deal${demosNotLogged.length !== 1 ? "s" : ""}`}
          />
          <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: V2.surface2 }}>
                  {["Brand", "Stage", "Demo date", "Volume", ""].map((h, i) => (
                    <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${V2.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demosNotLogged.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < demosNotLogged.length - 1 ? `1px solid ${V2.line}` : "none" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: V2.ink }}>{d.brandName}</td>
                    <td style={{ padding: "10px 14px" }}><StagePillV2 stage={d.stage} /></td>
                    <td style={{ padding: "10px 14px", color: V2.ink2 }}>{fmtDate(d.demoDate)}</td>
                    <td style={{ padding: "10px 14px", color: V2.ink2 }}>{d.orderVolume || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => navigate("/form")}
                        style={{ fontSize: 12, fontWeight: 600, color: V2.brand, background: V2.brand + "10", border: `1px solid ${V2.brand}30`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        + Log demo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portfolio */}
      <div>
        <SectionHeader
          title={isManager ? "Team's active deals" : "My portfolio · post-demo"}
          count={`${portfolioDeals.length} deal${portfolioDeals.length !== 1 ? "s" : ""}`}
        />
        {portfolioDeals.length === 0 ? (
          <div style={{ fontSize: 13, color: V2.ink3, padding: "20px 0" }}>No active deals in your portfolio.</div>
        ) : (
          <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: V2.surface2 }}>
                  {["Grade", "Brand · Solution", "Stage", "Demo", "Follow-up", "Flags", ""].map((h, i) => (
                    <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${V2.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolioDeals.map((d, i) => (
                  <tr
                    key={d.id}
                    style={{ borderBottom: i < portfolioDeals.length - 1 ? `1px solid ${V2.line}` : "none", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = V2.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => navigate(`/deals/${d.id}`)}
                  >
                    <td style={{ padding: "10px 14px" }}><GradeChip grade={d.grade} /></td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, color: V2.ink }}>{d.brandName}</div>
                      <div style={{ fontSize: 11, color: V2.ink3, marginTop: 1 }}>
                        {SOL_LABELS[d.solutionInterest] || "—"}{isManager && d.repName ? ` · ${d.repName}` : ""}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}><StagePillV2 stage={d.stage} /></td>
                    <td style={{ padding: "10px 14px", color: V2.ink2, whiteSpace: "nowrap" }}>{fmtDate(d.demoDate)}</td>
                    <td style={{ padding: "10px 14px", color: d.followupMeetingDate ? V2.ink2 : V2.ink3, whiteSpace: "nowrap" }}>{fmtDate(d.followupMeetingDate)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {d.flags.length > 0 ? (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: d.attentionLevel === "high" ? "#FCEBEB" : d.attentionLevel === "medium" ? "#FAEEDA" : "#E6F1FB", color: d.attentionLevel === "high" ? "#991F1F" : d.attentionLevel === "medium" ? "#854F0B" : "#185FA5" }}>
                          {d.flags.length}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: V2.ok, fontWeight: 600 }}>✓</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/deals/${d.id}`); }}
                        style={{ fontSize: 12, fontWeight: 600, color: V2.ink2, background: "none", border: `1px solid ${V2.line}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const { deals, user, role, repName } = useAppContext();

  const scopedDeals = useMemo(() => {
    if (role === "manager") return deals;
    return deals.filter(d => d.repEmail === user?.email);
  }, [deals, role, user?.email]);

  return (
    <MyDayContent
      scopedDeals={scopedDeals}
      isManager={role === "manager"}
      repName={repName || user?.name?.split(" ")[0] || "there"}
    />
  );
}
