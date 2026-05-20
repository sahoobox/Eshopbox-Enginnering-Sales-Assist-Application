import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, GradeBadge, StagePill, GRADE_COLORS } from "../components/ui";
import { useAppContext } from "../AppContext";

const API = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";

const SHIPPING_PAINS = [
  { id: "s1", label: "High shipping cost" }, { id: "s2", label: "Poor on-time delivery / SLA" },
  { id: "s3", label: "High RTO / return rate" }, { id: "s4", label: "Limited carrier reach" },
  { id: "s5", label: "No shipment visibility" }, { id: "s6", label: "No insurance / loss coverage" },
];
const WAREHOUSING_PAINS = [
  { id: "w1", label: "High warehousing cost" }, { id: "w2", label: "Single warehouse — slow & costly" },
  { id: "w3", label: "Split inventory — DTC vs marketplace" }, { id: "w4", label: "Manual operations / no WMS" },
  { id: "w5", label: "No real-time inventory visibility" }, { id: "w6", label: "Scaling to new regions" },
  { id: "w7", label: "Returns processing & QC" },
];

function getGrade(score) {
  if (score >= 14) return { g: "A", label: "Strong fit", prob: "55–70%", c: C.teal, bg: C.tealLight };
  if (score >= 9) return { g: "B", label: "Qualified", prob: "30–50%", c: C.blue, bg: C.blueLight };
  if (score >= 5) return { g: "C", label: "Uncertain", prob: "10–25%", c: C.warn, bg: C.warnLight };
  return { g: "D", label: "Weak fit", prob: "<10%", c: C.danger, bg: C.dangerLight };
}

function getSegment(f) {
  if (f.championStrength === "strong" && f.dmPresent !== "yes") return "Warm champion";
  if (f.brandType === "enterprise") return "Enterprise";
  return "SMB";
}

const SEQ_MAP = {
  "Warm champion": "Champion sequence · 14 days",
  "Enterprise": "Enterprise sequence · 14 days",
  "SMB": "SMB sequence · 10 days",
};

function EmailDraft({ draft, index, dealId, emailType }) {
  const [open, setOpen] = useState(index === 0);
  const [copied, setCopied] = useState(false);
  const [draftCreated, setDraftCreated] = useState(false);
  const [draftCreating, setDraftCreating] = useState(false);
  const [draftError, setDraftError] = useState("");
  const typeColor = draft.type === "Auto-sent" ? { bg: C.successLight, text: C.success } : { bg: C.blueLight, text: C.blue };
  const zohoUrl = `https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${dealId}`;

  const handleCreateDraft = async () => {
    setDraftCreating(true);
    setDraftError("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/api/deals/${dealId}/emails/${emailType}/create-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDraftCreated(true);
        window.open(zohoUrl, "_blank");
      } else {
        setDraftError(data.error || "Failed to create draft.");
      }
    } catch {
      setDraftError("Network error. Please try again.");
    }
    setDraftCreating(false);
  };

  const copy = () => {
    navigator.clipboard?.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.paperDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{draft.day}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{draft.label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{draft.subject.slice(0, 55)}{draft.subject.length > 55 ? "…" : ""}</div>
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: typeColor.bg, color: typeColor.text }}>{draft.type}</span>
        <span style={{ fontSize: 14, color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>
      {open && (
        <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Subject</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{draft.subject}</div>
          </div>
          <div style={{ background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit", marginBottom: 10 }}>{draft.body}</div>
         <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <button onClick={copy} style={{ fontSize: 12, color: C.info, fontWeight: 600, background: "transparent", border: `1px solid ${C.info}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
    {copied ? "✓ Copied" : "Copy"}
  </button>
  {draft.type === "Rep sends" && (
    draftCreated ? (
      <>
        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: C.tealLight, color: C.teal, fontWeight: 700 }}>✓ Draft created in Zoho</span>
        <button onClick={() => window.open(zohoUrl, "_blank")}
          style={{ fontSize: 12, color: C.info, fontWeight: 600, background: "transparent", border: `1px solid ${C.info}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          Open Zoho →
        </button>
      </>
    ) : (
      <button onClick={handleCreateDraft} disabled={draftCreating}
        style={{ fontSize: 12, color: C.white, fontWeight: 700, background: draftCreating ? C.border : C.accent, border: "none", borderRadius: 6, padding: "5px 12px", cursor: draftCreating ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
        {draftCreating ? "Creating draft…" : "Create Zoho draft →"}
      </button>
    )
  )}
</div>
{draftError && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{draftError}</div>}
        </div>
      )}
    </div>
  );
}

export default function FormResult() {
  const { formData, formScore: score } = useAppContext();
  const navigate = useNavigate();
  const onNewDemo = () => navigate('/form');
  const onViewDeals = () => navigate('/deals');
  const grade = getGrade(score);
  const segment = getSegment(formData);
const drafts = [
  {
    day: "Day 1",
    label: "Personalised recap",
    type: "Rep sends",
    emailType: "day1",
    subject: formData.drafts?.recap?.subject || `Great speaking today, ${formData.prospectName} — next steps`,
    body: formData.drafts?.recap?.body || "",
  },
  {
    day: "Day 3",
    label: "ROI value email",
    type: "Rep sends",
    emailType: "day3",
    subject: formData.drafts?.roi?.subject || `Something worth sharing internally — ${formData.brandName}`,
    body: formData.drafts?.roi?.body || "",
  },
  {
    day: "Day 4",
    label: "Objection handling",
    type: "Auto-sent",
    emailType: "day4",
    subject: formData.drafts?.objection?.subject || `Re: Pricing proposal — one more thing, ${formData.brandName}`,
    body: formData.drafts?.objection?.body || "",
  },
];  const allPains = [
    ...formData.shippingPains.map(id => SHIPPING_PAINS.find(p => p.id === id)?.label).filter(Boolean),
    ...formData.warehousingPains.map(id => WAREHOUSING_PAINS.find(p => p.id === id)?.label).filter(Boolean),
    ...(formData.shippingPainOther ? [formData.shippingPainOther] : []),
    ...(formData.warehousingPainOther ? [formData.warehousingPainOther] : []),
  ];

  const zohoFields = [
    { field: "Deal Grade", value: `Grade ${grade.g} — ${grade.label}` },
    { field: "Forecast Probability", value: grade.prob },
    { field: "Segment", value: segment },
    { field: "Solution Interest", value: formData.solutionInterest || "—" },
    { field: "Brand Type", value: formData.brandType || "—" },
    { field: "Pain Points", value: allPains.join(", ") || "—" },
    { field: "OMS", value: formData.oms || "—" },
    { field: "Shopping Cart", value: formData.shoppingCart || "—" },
    { field: "Current Shipping", value: formData.shippingSetup || "—" },
    { field: "Current Warehousing", value: formData.warehousingSetup || "—" },
    { field: "Follow-up Meeting Date", value: formData.followupMeetingDate || "Not booked" },
    { field: "Pricing Raised in Demo", value: formData.pricingRaisedInDemo === "yes" ? "Yes" : "No" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 60px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13L9 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Demo logged</div>
          <div style={{ fontSize: 13, color: C.muted }}>{formData.brandName || "Brand"} · {formData.prospectName || "Prospect"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>

        {/* Grade card */}
        <div style={{ background: grade.bg, border: `1.5px solid ${grade.c}25`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: grade.c, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>Deal grade</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: grade.c, lineHeight: 1, marginBottom: 4 }}>{grade.g}</div>
          <div style={{ fontSize: 14, color: grade.c, fontWeight: 500 }}>{grade.label}</div>
          <div style={{ fontSize: 12, color: grade.c, opacity: 0.8, marginTop: 2 }}>{grade.prob} estimated close probability</div>
        </div>

          {/* Grade breakdown */}
<div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Grade breakdown</div>
  {[
    { label: "Pain clarity", value: formData.painClarity, pts: formData.painClarity === 'clear' ? 3 : formData.painClarity === 'vague' ? 1 : 0, max: 3 },
    { label: "DM present", value: formData.dmPresent, pts: formData.dmPresent === 'yes' ? 3 : formData.dmPresent === 'champion' ? 1 : 0, max: 3 },
    { label: "Budget signal", value: formData.budgetSignal, pts: formData.budgetSignal === 'confirmed' ? 2 : formData.budgetSignal === 'implied' ? 1 : 0, max: 2 },
    { label: "Purchase timeline", value: formData.purchaseTimeline, pts: formData.purchaseTimeline === 'month' ? 3 : formData.purchaseTimeline === 'quarter' ? 2 : formData.purchaseTimeline === '6m' ? 1 : 0, max: 3 },
    { label: "Engagement level", value: formData.engagementLevel, pts: formData.engagementLevel === 'high' ? 2 : formData.engagementLevel === 'medium' ? 1 : 0, max: 2 },
    { label: "Next step", value: formData.nextStep, pts: formData.nextStep === 'booked' ? 2 : formData.nextStep === 'vague' ? 1 : 0, max: 2 },
    { label: "Demo format", value: formData.demoFormat, pts: formData.demoFormat === 'inperson' ? (formData.meetingLocation === 'warehouse' ? 3 : 2) : 0, max: 3 },
    { label: "Procurement / Champion", value: formData.procurementInvolved || formData.championStrength, pts: formData.brandType === 'enterprise' ? (formData.championStrength === 'strong' ? 2 : formData.championStrength === 'weak' ? 1 : 0) : (formData.procurementInvolved === 'no' ? 2 : formData.procurementInvolved === 'likely' ? 1 : 0), max: 2 },
  ].map((row, i) => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: C.muted, width: 160, flexShrink: 0 }}>{row.label}</div>
      <div style={{ flex: 1, height: 4, background: C.paperDark, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(row.pts / row.max) * 100}%`, background: row.pts === row.max ? C.teal : row.pts > 0 ? C.blue : C.border, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: row.pts === row.max ? C.teal : row.pts > 0 ? C.blue : C.muted, width: 40, textAlign: "right" }}>{row.pts}/{row.max}</div>
    </div>
  ))}
  <div style={{ borderTop: `0.5px solid ${C.border}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
    <span style={{ color: C.muted }}>Total score</span>
    <span style={{ fontWeight: 700, color: grade.c }}>{score}/20 → Grade {grade.g}</span>
  </div>
</div>

        {/* Segment + pain summary */}
        <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Segment</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{segment}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{SEQ_MAP[segment]}</div>
          </div>
          {allPains.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Pain points ({allPains.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {allPains.map((p, i) => <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: C.paperDark, color: C.muted, fontWeight: 500 }}>{p}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email drafts */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          4 email drafts generated
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>Review, edit if needed, then copy or push to Zoho</span>
        </div>
          {drafts.map((d, i) => <EmailDraft key={i} draft={d} index={i} dealId={formData.zohoId} emailType={d.emailType} />)}
      </div>
      {/* Zoho sync preview */}
      <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "11px 16px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Fields to sync to Zoho CRM
        </div>
        <div style={{ padding: "10px 16px" }}>
          {zohoFields.map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < zohoFields.length - 1 ? `0.5px solid ${C.border}` : "none", gap: 16 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{row.field}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <button onClick={onNewDemo} style={{ padding: "12px", borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 13, fontWeight: 700, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>
          Log another demo
        </button>
        <button onClick={onViewDeals} style={{ padding: "12px", borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, fontSize: 13, fontWeight: 700, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>
          View all deals
        </button>
      </div>
    </div>
  );
}
