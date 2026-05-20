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

const PRE_DEMO_STAGES = ["Qualified To Buy", "Demo Call Scheduled"];

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: V2.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 600, color: subColor || V2.ink3, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

const SEV_CFG = {
  high:   { label: "Critical", bg: "#FCEBEB", text: "#991F1F", bar: "#F95253" },
  medium: { label: "Warning",  bg: "#FAEEDA", text: "#854F0B", bar: "#E5850B" },
  info:   { label: "Advisory", bg: "#E6F1FB", text: "#185FA5", bar: "#185FA5" },
};

function FlagQueueItem({ flag, deal, onOpen }) {
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
            {deal.brandName}{deal.repName ? ` · ${deal.repName}` : ""} · {flag.desc}
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

export default function Performance() {
  const { deals } = useAppContext();
  const navigate = useNavigate();
  const [flagsOpen, setFlagsOpen] = useState(false);

  const dealsWithFlags = useMemo(() => deals.map(d => {
    const flags = computeAttentionFlags(d);
    return { ...d, flags, attentionLevel: getAttentionLevel(flags) };
  }), [deals]);

  const upcomingDemos = deals.filter(d => PRE_DEMO_STAGES.includes(d.stage)).length;
  const wonDeals = deals.filter(d => d.stage === "Won/Payment Received");
  const loggedDeals = deals.filter(d => d.saLogged).length;
  const closeRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const criticalDeals = dealsWithFlags.filter(d => d.attentionLevel === "high").length;

  const allFlags = useMemo(() => {
    const out = [];
    dealsWithFlags.forEach(d => d.flags.forEach(f => out.push({ flag: f, deal: d })));
    const order = { high: 0, medium: 1, info: 2 };
    return out.sort((a, b) => (order[a.flag.severity] ?? 3) - (order[b.flag.severity] ?? 3));
  }, [dealsWithFlags]);

  // Funnel — cumulative counting
  const funnelSteps = useMemo(() => {
    const definitions = [
      { key: "upcoming", label: "Upcoming",      test: s => PRE_DEMO_STAGES.includes(s) },
      { key: "demo",     label: "Demo done",      test: s => ["Demo Done","Proposal Sent","Follow up Meeting Done","Deal Approved","Won/Payment Received"].includes(s) },
      { key: "proposal", label: "Proposal sent",  test: s => ["Proposal Sent","Follow up Meeting Done","Deal Approved","Won/Payment Received"].includes(s) },
      { key: "mtg",      label: "Mtg done",       test: s => ["Follow up Meeting Done","Deal Approved","Won/Payment Received"].includes(s) },
      { key: "won",      label: "Won",            test: s => s === "Won/Payment Received" },
    ];
    return definitions.map((def, i, arr) => {
      const count = deals.filter(d => def.test(d.stage)).length;
      const prevCount = i > 0 ? deals.filter(d => arr[i - 1].test(d.stage)).length : null;
      const conv = prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
      return { ...def, count, conv };
    });
  }, [deals]);

  // Rep stats sorted by conversion % desc
  const repStats = useMemo(() => {
    const reps = {};
    dealsWithFlags.forEach(d => {
      const name = d.repName || "Unknown";
      if (!reps[name]) reps[name] = { name, active: 0, won: 0, total: 0, flags: 0 };
      reps[name].total++;
      if (OPEN_STAGES.includes(d.stage)) reps[name].active++;
      if (d.stage === "Won/Payment Received") reps[name].won++;
      if (d.flags.length > 0) reps[name].flags++;
    });
    return Object.values(reps)
      .map(r => ({
        ...r,
        initials: r.name.split(" ").map(w => w[0]).slice(0, 2).join(""),
        convRate: r.total > 0 ? Math.round((r.won / r.total) * 100) : 0,
      }))
      .sort((a, b) => b.convRate - a.convRate);
  }, [dealsWithFlags]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 36px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: V2.ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Performance</h1>
        <div style={{ fontSize: 13, color: V2.ink3 }}>Team pipeline health, conversion vs target, deals at risk.</div>
      </div>

      {/* 6 metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
        <MetricCard label="Upcoming demos" value={upcomingDemos} sub="Qualified + scheduled" />
        <MetricCard
          label="Demo → close rate"
          value={`${closeRate}%`}
          sub="Target 25%"
          subColor={closeRate >= 25 ? V2.ok : V2.danger}
        />
        <MetricCard
          label="Won this month"
          value={wonDeals.length}
          sub={`${loggedDeals} demo${loggedDeals !== 1 ? "s" : ""} logged`}
          subColor={wonDeals.length > 0 ? V2.ok : V2.ink3}
        />
        <MetricCard
          label="Attention flags"
          value={allFlags.length}
          sub={criticalDeals > 0 ? `${criticalDeals} critical` : "No critical flags"}
          subColor={criticalDeals > 0 ? V2.danger : V2.ok}
        />
        <MetricCard label="F2F → close rate" value="0%" sub="In-person data coming" subColor={V2.ink3} />
        <MetricCard label="Virtual → close rate" value="0%" sub="Virtual data coming" subColor={V2.ink3} />
      </div>

      {/* Funnel */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: V2.ink, margin: "0 0 14px" }}>Funnel · this month</h2>
        <div style={{ display: "flex", background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
          {funnelSteps.map((step, i) => {
            const isWon = step.key === "won";
            const isUpcoming = step.key === "upcoming";
            return (
              <div
                key={step.key}
                style={{ flex: 1, padding: "18px 14px", textAlign: "center", background: isWon ? V2.okBg : isUpcoming ? V2.infoBg : V2.surface, borderRight: i < funnelSteps.length - 1 ? `1px solid ${V2.line}` : "none" }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: isWon ? V2.ok : isUpcoming ? V2.info : V2.ink }}>{step.count}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: isWon ? V2.ok : isUpcoming ? V2.info : V2.ink2, marginTop: 4 }}>{step.label}</div>
                {step.conv !== null && <div style={{ fontSize: 10, color: V2.ink3, marginTop: 3 }}>{step.conv}% conv.</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance by rep */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: V2.ink, margin: "0 0 14px" }}>Performance by rep</h2>
        {repStats.length === 0 ? (
          <div style={{ fontSize: 13, color: V2.ink3 }}>No rep data available.</div>
        ) : (
          <div style={{ background: V2.surface, border: `1px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: V2.surface2 }}>
                  {["Rep", "Active", "Won", "Conversion", "Attainment vs 25% target", "Flags"].map((h, i) => (
                    <th key={i} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: V2.ink3, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${V2.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repStats.map((r, i) => {
                  const barColor = r.convRate >= 25 ? V2.ok : r.convRate >= 15 ? V2.warn : V2.danger;
                  return (
                    <tr key={r.name} style={{ borderBottom: i < repStats.length - 1 ? `1px solid ${V2.line}` : "none" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: V2.surface2, border: `1px solid ${V2.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: V2.ink2, flexShrink: 0 }}>
                            {r.initials}
                          </div>
                          <span style={{ fontWeight: 600, color: V2.ink }}>{r.name.split(" ")[0]}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: V2.ink2 }}>{r.active}</td>
                      <td style={{ padding: "10px 14px", color: V2.ink2 }}>{r.won}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: barColor }}>{r.convRate}%</td>
                      <td style={{ padding: "10px 14px", minWidth: 160 }}>
                        <div style={{ height: 6, background: V2.surface2, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min((r.convRate / 25) * 100, 100)}%`, background: barColor, borderRadius: 3, transition: "width 0.5s" }} />
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {r.flags > 0
                          ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: "#FCEBEB", color: "#991F1F" }}>{r.flags}</span>
                          : <span style={{ fontSize: 11, color: V2.ok, fontWeight: 600 }}>✓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Critical flags — team (collapsible) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: flagsOpen ? 12 : 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: V2.ink, margin: 0 }}>
            Critical flags — team{allFlags.length > 0 ? ` (${allFlags.length})` : ""}
          </h2>
          <button
            onClick={() => setFlagsOpen(o => !o)}
            style={{ fontSize: 12, fontWeight: 600, color: V2.ink3, background: "none", border: `1px solid ${V2.line}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            {flagsOpen ? "Hide" : "Show"}
          </button>
        </div>
        {flagsOpen && (
          allFlags.length === 0 ? (
            <div style={{ background: V2.okBg, border: `1px solid ${V2.ok}30`, borderRadius: 10, padding: "18px 20px", fontSize: 14, fontWeight: 600, color: V2.ok, marginTop: 12 }}>
              No flags across the team. Great work.
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {allFlags.map((item, i) => (
                <FlagQueueItem key={i} flag={item.flag} deal={item.deal} onOpen={id => navigate(`/deals/${id}`)} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
