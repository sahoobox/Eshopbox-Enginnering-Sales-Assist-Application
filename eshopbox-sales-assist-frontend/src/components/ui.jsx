import { useState } from "react";

export const C = {
  ink: "#0A0A0A", paper: "#F6F4EF", paperDark: "#ECEAE3",
  accent: "#E8440A", accentLight: "#FDF0EB",
  teal: "#0B6B5A", tealLight: "#E5F3F0",
  muted: "#6A6760", border: "#D8D5CD", borderDark: "#B5B2A9",
  white: "#FFFFFF", warn: "#B05C00", warnLight: "#FEF2E0",
  danger: "#BE3728", dangerLight: "#FDECEA",
  blue: "#1A5FA0", blueLight: "#E5EFF9",
  success: "#0B6B5A", successLight: "#E5F3F0",
  info: "#1A5FA0", infoLight: "#E5EFF9",
};

export const GRADE_COLORS = {
  A: { bg: C.successLight, text: C.success, border: "#0B6B5A30" },
  B: { bg: C.blueLight, text: C.blue, border: "#1A5FA030" },
  C: { bg: C.warnLight, text: C.warn, border: "#B05C0030" },
  D: { bg: C.dangerLight, text: C.danger, border: "#BE372830" },
};

export const SEV_COLORS = {
  high: { bg: C.dangerLight, text: C.danger, dot: C.danger, border: "#BE372820" },
  medium: { bg: C.warnLight, text: C.warn, dot: C.warn, border: "#B05C0020" },
  info: { bg: C.infoLight, text: C.info, dot: C.info, border: "#1A5FA020" },
  ok: { bg: C.successLight, text: C.success, dot: C.success, border: "#0B6B5A20" },
};

export const STAGE_COLORS = {
  "Demo done": { bg: "#F0EEFF", text: "#3B2F9E" },
  "Proposal sent": { bg: C.infoLight, text: C.info },
  "Follow-up meeting done": { bg: C.warnLight, text: C.warn },
  "Commercial negotiation": { bg: "#FFF0E0", text: "#8B4500" },
  "Deal won": { bg: C.successLight, text: C.success },
  "Deal lost": { bg: C.dangerLight, text: C.danger },
};

export function Badge({ children, color = "neutral", size = "sm" }) {
  const colors = {
    neutral: { bg: C.paperDark, text: C.muted },
    accent: { bg: C.accentLight, text: C.accent },
    success: { bg: C.successLight, text: C.success },
    danger: { bg: C.dangerLight, text: C.danger },
    warn: { bg: C.warnLight, text: C.warn },
    info: { bg: C.infoLight, text: C.info },
    blue: { bg: C.blueLight, text: C.blue },
  };
  const c = colors[color] || colors.neutral;
  return (
    <span style={{
      display: "inline-block", fontSize: size === "xs" ? 10 : 11,
      padding: size === "xs" ? "1px 6px" : "2px 8px",
      borderRadius: 20, fontWeight: 700,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function GradeBadge({ grade, size = 24 }) {
  const c = GRADE_COLORS[grade] || GRADE_COLORS.D;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.46, fontWeight: 800, flexShrink: 0,
      border: `1.5px solid ${c.border}`,
    }}>{grade}</div>
  );
}

export function StagePill({ stage }) {
  const c = STAGE_COLORS[stage] || { bg: C.paperDark, text: C.muted };
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20,
      fontWeight: 600, background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>{stage}</span>
  );
}

export function AttentionPill({ level, count }) {
  if (level === "ok") return <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>● On track</span>;
  const c = SEV_COLORS[level];
  const labels = { high: "Needs attention", medium: "Review needed", info: "Advisory" };
  return (
    <span style={{
      fontSize: 11, padding: "3px 9px", borderRadius: 20,
      fontWeight: 600, background: c.bg, color: c.text,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {labels[level]}{count > 1 ? ` (${count})` : ""}
    </span>
  );
}

export function FInput({ label, required, value, onChange, placeholder, type = "text", hint, disabled }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "flex", gap: 5 }}>
        {label}{required && <span style={{ color: C.accent }}>*</span>}
      </div>}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{hint}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${focus ? C.accent : C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, background: disabled ? C.paperDark : C.white, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }} />
    </div>
  );
}

export function FSelect({ label, required, value, onChange, options, placeholder, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "flex", gap: 5 }}>
        {label}{required && <span style={{ color: C.accent }}>*</span>}
      </div>}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{hint}</div>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: value ? C.ink : C.muted, background: C.white, outline: "none", cursor: "pointer", appearance: "none", boxSizing: "border-box" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
      </select>
    </div>
  );
}

export function FTextarea({ label, value, onChange, placeholder, rows = 3, hint }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>}
      {hint && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{hint}</div>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${focus ? C.accent : C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, background: C.white, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", transition: "border-color 0.15s" }} />
    </div>
  );
}

export function Chip({ label, selected, onClick, col = "accent" }) {
  const cols = {
    accent: { bg: C.accentLight, b: C.accent, t: C.accent },
    teal: { bg: C.tealLight, b: C.teal, t: C.teal },
    warn: { bg: C.warnLight, b: C.warn, t: C.warn },
  };
  const c = cols[col] || cols.accent;
  return (
    <button onClick={onClick} style={{ padding: "7px 13px", borderRadius: 40, border: `1.5px solid ${selected ? c.b : C.border}`, background: selected ? c.bg : C.white, color: selected ? c.t : C.muted, fontSize: 13, fontWeight: selected ? 600 : 400, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s", marginBottom: 5, marginRight: 5 }}>{label}</button>
  );
}

export function PainCheckbox({ label, eg, selected, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer", alignItems: "flex-start" }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? C.accent : C.borderDark}`, background: selected ? C.accent : "transparent", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, lineHeight: 1.4 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>{eg}</div>
      </div>
    </div>
  );
}

export function ScoreBar({ score, max = 20 }) {
  const pct = Math.round((score / max) * 100);
  const grade = score >= 16 ? { g: "A", l: "Strong fit", c: C.teal } : score >= 11 ? { g: "B", l: "Qualified", c: C.blue } : score >= 6 ? { g: "C", l: "Uncertain", c: C.warn } : { g: "D", l: "Weak fit", c: C.danger };
  const bg = { A: C.tealLight, B: C.blueLight, C: C.warnLight, D: C.dangerLight }[grade.g];
  return (
    <div style={{ background: C.paperDark, borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Live score</span>
        <span style={{ fontSize: 11, fontWeight: 700, background: bg, color: grade.c, padding: "2px 10px", borderRadius: 20 }}>Grade {grade.g} — {grade.l} · {score}/{max}</span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: grade.c, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export function TopBar({ onNav, currentView, dealCount }) {
  return (
    <div style={{ background: C.ink, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, flexShrink: 0, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: "0.08em", textTransform: "uppercase" }}>Eshopbox</span>
        <span style={{ fontSize: 12, color: "#555", margin: "0 4px" }}>/</span>
        <span style={{ fontSize: 12, color: "#888" }}>Sales</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => onNav("list")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: currentView === "list" ? "#1A1A1A" : "transparent", color: currentView === "list" ? C.white : "#888", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          All deals {dealCount > 0 && <span style={{ fontSize: 10, background: C.accent, color: C.white, padding: "1px 5px", borderRadius: 10, marginLeft: 4 }}>{dealCount}</span>}
        </button>
        <button onClick={() => onNav("form")} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: currentView === "form" ? C.accent : "transparent", color: currentView === "form" ? C.white : C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: 4 }}>
          + Log demo
        </button>
      </div>
    </div>
  );
}
