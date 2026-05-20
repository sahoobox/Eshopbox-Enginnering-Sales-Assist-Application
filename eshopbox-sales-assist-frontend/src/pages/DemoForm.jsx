import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { C, FInput, FSelect, FTextarea, Chip, PainCheckbox, ScoreBar } from "../components/ui";
import { useAppContext } from "../AppContext";
import { apiFetch } from "../api.js";

const SECTIONS = ["Deal basics", "In the room", "Current setup", "Pain & fit", "Qualification", "Features", "Notes"];

const SHIPPING_PAINS = [
  { id: "s1", label: "High shipping cost", eg: "Carrier / aggregator rates eating into margins" },
  { id: "s2", label: "Poor on-time delivery / SLA", eg: "Orders delayed, high NDR, customer complaints" },
  { id: "s3", label: "High RTO / return rate", eg: "Fake returns, undelivered shipments, losses" },
  { id: "s4", label: "Limited carrier reach / pin code coverage", eg: "Can't reach certain geographies" },
  { id: "s5", label: "No shipment visibility for customers", eg: "No branded tracking page, WISMO calls piling up" },
  { id: "s6", label: "No insurance / loss coverage", eg: "High-value goods lost or damaged with no recourse" },
];

const WAREHOUSING_PAINS = [
  { id: "w1", label: "High warehousing / fulfillment cost", eg: "Per-unit cost too high to maintain margins" },
  { id: "w2", label: "Single warehouse — slow delivery & high cost", eg: "All orders from one location, long last-mile" },
  { id: "w3", label: "Split inventory — DTC vs marketplace", eg: "Separate stock for website and Amazon / Flipkart" },
  { id: "w4", label: "Manual operations / no WMS", eg: "Spreadsheet tracking, high error rate" },
  { id: "w5", label: "No real-time inventory visibility", eg: "Overselling, stockouts, no cross-channel view" },
  { id: "w6", label: "Scaling to new regions", eg: "Want to expand but no warehouse presence there" },
  { id: "w7", label: "Returns processing & QC", eg: "Returned goods not inspected, reverse logistics broken" },
];

const FEATURES = [
  "On-time delivery guarantee", "RTO Risk Score", "Customer portal",
  "WhatsApp integration", "Secure Plan (insurance)", "Multi-warehouse network",
  "WMS / inventory visibility", "Smart order routing", "Returns management",
  "SDD & NDD (Same Day & Next Day Delivery)", "Multi-Channel Fulfillment",
];

const SYNC_STEPS = [
  { label: 'Saving demo details', duration: 2000 },
  { label: 'Grading deal and computing score', duration: 1000 },
  { label: 'Updating Zoho CRM', duration: 2000 },
  { label: 'Creating follow-up tasks in Zoho', duration: 2000 },
  { label: 'Generating recap email draft', duration: 3000 },
  { label: 'Generating ROI email draft', duration: 3000 },
  { label: 'Generating objection email draft', duration: 3000 },
  { label: 'Generating decision nudge draft', duration: 3000 },
];

function SecHead({ n, title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accent, color: C.white, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>{title}</div>
      </div>
      {sub && <div style={{ fontSize: 13, color: C.muted, paddingLeft: 36, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function AutoBadge() {
  return <span style={{ fontSize: 10, background: C.tealLight, color: C.teal, padding: "1px 7px", borderRadius: 20, fontWeight: 700, marginLeft: 6 }}>AUTO</span>;
}

const taStyle = { width: "100%", padding: "10px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, background: C.white, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" };

function PainList({ pains, selectedIds, onToggle, otherVal, onOtherChange, otherPlaceholder }) {
  return (
    <div>
      {pains.map(item => (
        <PainCheckbox key={item.id} label={item.label} eg={item.eg}
          selected={selectedIds.includes(item.id)} onToggle={() => onToggle(item.id)} />
      ))}
      <div style={{ paddingTop: 12 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Other — describe in your own words</div>
        <textarea placeholder={otherPlaceholder} value={otherVal}
          onChange={e => onOtherChange(e.target.value)} rows={2} style={taStyle} />
      </div>
    </div>
  );
}

function PainSection({ f, set, tog, solutionInterest }) {
  const showS = ["shipping", "both"].includes(solutionInterest);
  const showW = ["warehousing", "both"].includes(solutionInterest);
  const showBoth = showS && showW;
  const [activeTab, setActiveTab] = useState("shipping");

  const sCount = f.shippingPains.length + (f.shippingPainOther ? 1 : 0);
  const wCount = f.warehousingPains.length + (f.warehousingPainOther ? 1 : 0);

  if (!solutionInterest) {
    return (
      <div>
        <div style={{ padding: "12px 14px", background: C.warnLight, borderRadius: 8, fontSize: 13, color: C.warn, marginBottom: 16, lineHeight: 1.5 }}>
          Set the solution interest in Section 1 first — the relevant pain point lists will appear here. Both lists are shown below for preview.
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Shipping pain points</div>
        <PainList pains={SHIPPING_PAINS} selectedIds={f.shippingPains} onToggle={v => tog("shippingPains", v)}
          otherVal={f.shippingPainOther} onOtherChange={v => set("shippingPainOther", v)}
          otherPlaceholder="e.g. Carrier reconciliation taking too much time…" />
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", margin: "20px 0 10px" }}>Warehousing pain points</div>
        <PainList pains={WAREHOUSING_PAINS} selectedIds={f.warehousingPains} onToggle={v => tog("warehousingPains", v)}
          otherVal={f.warehousingPainOther} onOtherChange={v => set("warehousingPainOther", v)}
          otherPlaceholder="e.g. They need specific regional coverage…" />
      </div>
    );
  }

  if (!showBoth) {
    const isShipping = showS;
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>
          {isShipping ? "Shipping" : "Warehousing"} pain points <span style={{ color: C.accent }}>*</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Multi-select — choose all that came up in the demo</div>
        <PainList
          pains={isShipping ? SHIPPING_PAINS : WAREHOUSING_PAINS}
          selectedIds={isShipping ? f.shippingPains : f.warehousingPains}
          onToggle={v => tog(isShipping ? "shippingPains" : "warehousingPains", v)}
          otherVal={isShipping ? f.shippingPainOther : f.warehousingPainOther}
          onOtherChange={v => set(isShipping ? "shippingPainOther" : "warehousingPainOther", v)}
          otherPlaceholder={isShipping ? "e.g. Carrier reconciliation taking too much time…" : "e.g. They need specific regional coverage…"} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Multi-select from each tab — choose all that came up in the demo</div>
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1.5px solid ${C.border}` }}>
        {[
          { key: "shipping", label: `Shipping${sCount > 0 ? ` · ${sCount} selected` : ""}` },
          { key: "warehousing", label: `Warehousing${wCount > 0 ? ` · ${wCount} selected` : ""}` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "8px 16px", border: "none", borderBottom: `2.5px solid ${activeTab === tab.key ? C.accent : "transparent"}`, background: "transparent", fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? C.accent : C.muted, cursor: "pointer", fontFamily: "inherit", marginBottom: -1.5, transition: "all 0.15s" }}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "shipping" ? (
        <PainList pains={SHIPPING_PAINS} selectedIds={f.shippingPains} onToggle={v => tog("shippingPains", v)}
          otherVal={f.shippingPainOther} onOtherChange={v => set("shippingPainOther", v)}
          otherPlaceholder="e.g. Carrier reconciliation taking too much time…" />
      ) : (
        <PainList pains={WAREHOUSING_PAINS} selectedIds={f.warehousingPains} onToggle={v => tog("warehousingPains", v)}
          otherVal={f.warehousingPainOther} onOtherChange={v => set("warehousingPainOther", v)}
          otherPlaceholder="e.g. They need specific regional coverage…" />
      )}
    </div>
  );
}

export default function DemoForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setFormData, setFormScore, fetchDeals } = useAppContext();
  const prefilledDealId = searchParams.get('dealId') || "";
  const [sec, setSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [zohoErr, setZohoErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [syncStarted, setSyncStarted] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncDone, setSyncDone] = useState(false);
  const [syncDraftsWarning, setSyncDraftsWarning] = useState(false);

  const [f, setF] = useState({
    zohoId: "", prospectName: "", prospectEmail: "", brandName: "", orderVolume: "", productCategory: "", solutionInterest: "",
    demoFormat: "", meetingLocation: "",
    dmPresent: "", ccContacts: [{ name: "", role: "", email: "" }], brandType: "", procurementInvolved: "",
    oms: "", shoppingCart: "", shippingSetup: "", warehousingSetup: "",
    shippingPains: [], shippingPainOther: "", warehousingPains: [], warehousingPainOther: "",
    painClarity: "", engagementLevel: "", objections: "", competitorMentioned: "",
    budgetSignal: "", purchaseTimeline: "", championStrength: "", nextStep: "", followupMeetingDate: "", urgencyDriver: "",
    pricingRaisedInDemo: "", featuresShown: [], transcript: "", repNotes: "",
  });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const tog = (k, v) => setF(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));
  const setCC = (i, fld, v) => setF(p => { const a = [...p.ccContacts]; a[i] = { ...a[i], [fld]: v }; return { ...p, ccContacts: a }; });
  const addCC = () => setF(p => ({ ...p, ccContacts: [...p.ccContacts, { name: "", role: "", email: "" }] }));
  const remCC = (i) => setF(p => ({ ...p, ccContacts: p.ccContacts.filter((_, idx) => idx !== i) }));

  useEffect(() => {
    if (prefilledDealId) {
      set("zohoId", prefilledDealId);
      const autoVerify = async () => {
        setLoading(true); setZohoErr("");
        try {
          const token = localStorage.getItem("auth_token");
          const res = await fetch(
            `https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev/api/zoho/deal/${prefilledDealId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          if (!res.ok) { setZohoErr(data.error || "Deal not found in Zoho CRM."); return; }
          const resolvedName = typeof data.prospectName === 'object'
            ? (data.prospectName?.name || '')
            : (data.prospectName || '');
          if (resolvedName) set("prospectName", resolvedName);
          if (data.prospectEmail) set("prospectEmail", data.prospectEmail);
          if (data.brandName) set("brandName", data.brandName);
          if (data.orderVolume) set("orderVolume", data.orderVolume);
          if (data.volumeTooLow) {
            setZohoErr("⚠️ This deal's order volume is below 3,001/month. Sales Assist is designed for deals above this threshold.");
            setVerified(false);
            return;
          }
          setVerified(true);
          if (data.saLogged) {
            setZohoErr("⚠️ This deal has already been logged. Re-logging will overwrite existing data.");
          }
          const authUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
          if (data.repEmail && authUser.email && data.repEmail.toLowerCase() !== authUser.email.toLowerCase()) {
            setZohoErr(`⚠️ This deal belongs to ${data.repName || 'another rep'}. You're logging on their behalf — make sure this is intentional.`);
          }
        } catch {
          setZohoErr("Failed to connect. Try again.");
        } finally {
          setLoading(false);
        }
      };
      autoVerify();
    }
  }, [prefilledDealId]);

  const calcScore = () => {
    let s = 0;
    if (f.painClarity === "clear") s += 3; else if (f.painClarity === "vague") s += 1;
    if (f.dmPresent === "yes") s += 3; else if (f.dmPresent === "champion") s += 1;
    if (f.budgetSignal === "confirmed") s += 2; else if (f.budgetSignal === "implied") s += 1;
    if (f.purchaseTimeline === "month") s += 3; else if (f.purchaseTimeline === "quarter") s += 2; else if (f.purchaseTimeline === "6m") s += 1;
    if (f.engagementLevel === "high") s += 2; else if (f.engagementLevel === "medium") s += 1;
    if (f.brandType === "enterprise") { if (f.championStrength === "strong") s += 2; else if (f.championStrength === "weak") s += 1; }
    else { if (f.procurementInvolved === "no") s += 2; else if (f.procurementInvolved === "likely") s += 1; }
    if (f.nextStep === "booked") s += 2; else if (f.nextStep === "vague") s += 1;
    if (f.demoFormat === "inperson") {
      if (f.meetingLocation === "warehouse") s += 3;
      else s += 2;
    }
    return s;
  };

  const score = calcScore();

  const validate = (section) => {
    if (section === 0) {
      if (!f.zohoId.trim()) { alert("Please enter and verify a Zoho Deal ID."); return false; }
      if (!verified) { alert("Please verify the Zoho Deal ID first."); return false; }
      if (!f.prospectName.trim()) { alert("Prospect name is required."); return false; }
      if (!f.prospectEmail.trim()) { alert("Prospect email is required."); return false; }
      if (!f.brandName.trim()) { alert("Brand name is required."); return false; }
      if (!f.orderVolume) { alert("Please select monthly order volume."); return false; }
      if (!f.productCategory) { alert("Please select product category."); return false; }
      if (!f.solutionInterest) { alert("Please select solution interest."); return false; }
    }
    if (section === 1) {
      if (!f.dmPresent) { alert("Please select whether the decision maker was present."); return false; }
      if (!f.brandType) { alert("Please select brand type."); return false; }
      if (!f.procurementInvolved) { alert("Please select procurement involvement."); return false; }
      if (!f.demoFormat) { alert("Please select demo format."); return false; }
    }
    if (section === 2) {
      if (!f.oms) { alert("Please select the OMS."); return false; }
      if (!f.shoppingCart) { alert("Please select shopping cart / platform."); return false; }
      if (!f.shippingSetup) { alert("Please select current shipping setup."); return false; }
      if (!f.warehousingSetup) { alert("Please select current warehousing setup."); return false; }
    }
    if (section === 4) {
      if (!f.budgetSignal) { alert("Please select budget signal."); return false; }
      if (!f.purchaseTimeline) { alert("Please select purchase timeline."); return false; }
      if (!f.nextStep) { alert("Please select next step."); return false; }
      if (!f.followupMeetingDate) { alert("Please enter the follow-up meeting date."); return false; }
    }
    return true;
  };

  const go = (i) => {
    if (i > sec && !validate(sec)) return;
    setSec(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const inpSt = { width: "100%", padding: "10px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, background: C.white, outline: "none", boxSizing: "border-box" };

  const verify = async () => {
    if (!f.zohoId.trim()) return;
    setLoading(true); setZohoErr("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev/api/zoho/deal/${f.zohoId.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) { setZohoErr(data.error || "Deal not found in Zoho CRM."); return; }
      const resolvedName = typeof data.prospectName === 'object'
        ? (data.prospectName?.name || '')
        : (data.prospectName || '');
      if (resolvedName) set("prospectName", resolvedName);
      if (data.prospectEmail) set("prospectEmail", data.prospectEmail);
      if (data.brandName) set("brandName", data.brandName);
      if (data.orderVolume) set("orderVolume", data.orderVolume);
      if (data.volumeTooLow) {
        setZohoErr("⚠️ This deal's order volume is below 3,001/month. Sales Assist is designed for deals above this threshold.");
        setVerified(false);
        return;
      }
      setVerified(true);
      if (data.saLogged) {
        setZohoErr("⚠️ This deal has already been logged. Re-logging will overwrite existing data.");
      }
      const authUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
      if (data.repEmail && authUser.email && data.repEmail.toLowerCase() !== authUser.email.toLowerCase()) {
        setZohoErr(`⚠️ This deal belongs to ${data.repName || 'another rep'}. You're logging on their behalf — make sure this is intentional.`);
      }
    } catch {
      setZohoErr("Failed to connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate(sec)) return;
    setSyncStarted(true);
    setSyncStep(0);
    setSyncError(null);
    setSyncDone(false);
    setSyncDraftsWarning(false);
    let step = 0;
    const advanceStep = () => {
      step++;
      if (step < SYNC_STEPS.length) {
        setSyncStep(step);
        setTimeout(advanceStep, SYNC_STEPS[step].duration);
      }
    };
    setTimeout(advanceStep, SYNC_STEPS[0].duration);

    // Phase 1: critical sync — form data, Zoho update, tasks
    let syncResult;
    try {
      syncResult = await apiFetch('/api/deals/sync', { method: 'POST', body: JSON.stringify(f) });
    } catch (err) {
      setSyncError(err.message.includes('already logged')
        ? '⚠️ This deal has already been logged via Sales Assist. To update it, use the Re-engagement or Log F2F meeting options from the Deal Detail page.'
        : 'Failed to sync: ' + err.message);
      return;
    }

    setFormData({ ...f, ...syncResult });
    setFormScore(syncResult.score || score);
    fetchDeals();

    // Phase 2: Claude content generation (non-critical)
    let draftsWarning = false;
    try {
      await apiFetch(`/api/deals/${syncResult.dealId}/generate-content`, { method: 'POST' });
    } catch {
      draftsWarning = true;
      setSyncDraftsWarning(true);
    }

    setSyncStep(SYNC_STEPS.length - 1);
    setSyncDone(true);
    setTimeout(() => navigate(`/deals/${syncResult.dealId}`), draftsWarning ? 2000 : 1500);
  };

  const chipField = (label, key, required, opts) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
        {label}{required && <span style={{ color: C.accent }}> *</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {opts.map(o => <Chip key={o.v} label={o.l} selected={f[key] === o.v} onClick={() => set(key, o.v)} col={o.col} />)}
      </div>
    </div>
  );

  const sections = [
    // S1 — Deal basics
    <div key="s1">
      <SecHead n={1} title="Deal basics" sub="Enter the Zoho Deal ID — we'll pull contact details automatically." />
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Zoho Deal ID <span style={{ color: C.accent }}>*</span></div>
          <div style={{ position: "relative", display: "inline-block" }}
            onMouseEnter={e => e.currentTarget.querySelector('.tooltip').style.display = 'block'}
            onMouseLeave={e => e.currentTarget.querySelector('.tooltip').style.display = 'none'}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.info, color: C.white, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "help" }}>i</div>
            <div className="tooltip" style={{ display: "none", position: "absolute", left: 0, top: 22, width: 300, background: C.ink, borderRadius: 10, padding: "14px", zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 10 }}>How to find your Zoho Deal ID</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ADE80", marginBottom: 4 }}>Easiest way — from the deal list</div>
              <div style={{ fontSize: 11, color: "#CCC", lineHeight: 1.7, marginBottom: 10 }}>
                1. Find the deal in "All deals"<br/>
                2. Click "View deal"<br/>
                3. Hit "+ Log demo" — ID auto-fills ✓
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FCD34D", marginBottom: 4 }}>Manual way — from Zoho CRM</div>
              <div style={{ fontSize: 11, color: "#CCC", lineHeight: 1.7, marginBottom: 8 }}>
                1. Open the deal in Zoho CRM<br/>
                2. Look at the URL — it ends with a long number<br/>
                3. That number is your Deal ID
              </div>
              <div style={{ fontSize: 10, color: "#AAA", marginBottom: 4 }}>Example URL:</div>
              <div style={{ background: "#1A1A1A", borderRadius: 6, padding: "8px 10px", fontSize: 10, color: "#666", fontFamily: "monospace", wordBreak: "break-all", marginBottom: 6, lineHeight: 1.8 }}>
                crmplus.zoho.com/.../Potentials/<div style={{ marginTop: 4, background: "#FCD34D20", border: "1px dashed #FCD34D", borderRadius: 4, padding: "3px 8px", display: "inline-block" }}>
                  <span style={{ color: "#FCD34D", fontWeight: 700 }}>6483035000073049116</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#FCD34D", fontWeight: 600 }}>
                ↑ This is your Deal ID — copy only this part from the URL
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="e.g. 6483035000071371021" value={f.zohoId}
            onChange={e => { set("zohoId", e.target.value); setVerified(false); setZohoErr(""); }}
            onKeyDown={e => e.key === "Enter" && verify()} style={{ ...inpSt, flex: 1 }} />
          <button onClick={verify} disabled={!f.zohoId.trim() || loading}
            style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: verified ? C.teal : C.accent, color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: !f.zohoId.trim() ? 0.5 : 1 }}>
            {loading ? "Checking…" : verified ? "✓ Verified" : "Look up"}
          </button>
        </div>
        {zohoErr && <div style={{ fontSize: 12, color: C.danger, marginTop: 5 }}>{zohoErr}</div>}
        {verified && <div style={{ fontSize: 12, color: C.teal, marginTop: 5, fontWeight: 500 }}>Deal found — fields auto-filled. Edit if needed.</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Prospect name <span style={{ color: C.accent }}>*</span><AutoBadge /></div>
          <input value={f.prospectName} onChange={e => set("prospectName", e.target.value)} placeholder="Full name" style={inpSt} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Prospect email <span style={{ color: C.accent }}>*</span><AutoBadge /></div>
          <input value={f.prospectEmail} onChange={e => set("prospectEmail", e.target.value)} placeholder="email@brand.com" style={inpSt} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Brand name <span style={{ color: C.accent }}>*</span><AutoBadge /></div>
          <input value={f.brandName} onChange={e => set("brandName", e.target.value)} placeholder="Brand name" style={inpSt} />
        </div>
        <FSelect label="Monthly order volume" required value={f.orderVolume} onChange={v => set("orderVolume", v)} placeholder="Select volume…"
          options={[
            { v: "Less than 500 orders/month", l: "Less than 500 orders/month" },
            { v: "501 - 2,000 orders/month", l: "501 - 2,000 orders/month" },
            { v: "2,001 - 3,000 orders/month", l: "2,001 - 3,000 orders/month" },
            { v: "3,001 - 10,000 orders/month", l: "3,001 - 10,000 orders/month" },
            { v: "More than 10,000 orders/month", l: "More than 10,000 orders/month" },
          ]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        <FSelect label="Product category" required value={f.productCategory} onChange={v => set("productCategory", v)} placeholder="Select category…"
          options={["Fashion & Apparel","Electronics","Beauty & Personal Care","Home & Kitchen","Health & Wellness","Sports & Fitness","Toys & Kids","Food & Beverages","Auto & Industrial","Other"]} />
        <FSelect label="Solution interest" required value={f.solutionInterest} onChange={v => set("solutionInterest", v)} placeholder="What did they come for?"
          options={[{ v: "shipping", l: "Shipping only" },{ v: "warehousing", l: "Warehousing only" },{ v: "both", l: "Both — full-stack fulfillment" }]} />
      </div>
    </div>,

    // S2 — In the room
    <div key="s2">
      <SecHead n={2} title="Who was in the room" sub="Determines the buying motion and follow-up sequence." />
      {chipField("Was the decision maker present?", "dmPresent", true, [
        { v: "yes", l: "Yes — DM was there", col: "teal" },
        { v: "champion", l: "Champion only", col: "accent" },
        { v: "unknown", l: "Unknown", col: "warn" },
      ])}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Brand type <span style={{ color: C.accent }}>*</span></div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {[{ v: "small", l: "Small growing brand" },{ v: "scaling", l: "Fast scaling brand" },{ v: "enterprise", l: "Enterprise brand" }].map(o =>
            <Chip key={o.v} label={o.l} selected={f.brandType === o.v} onClick={() => set("brandType", o.v)} />)}
        </div>
        {f.brandType && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, padding: "7px 11px", background: C.paperDark, borderRadius: 6 }}>
          {f.brandType === "small" && "Below 5,000 orders/month · Founder-led · No formal procurement"}
          {f.brandType === "scaling" && "5,000–20,000 orders/month · Ops team present · May have procurement"}
          {f.brandType === "enterprise" && "20,000+ orders/month · Multiple stakeholders · Formal vendor approval"}
        </div>}
      </div>
      {chipField("Will procurement / legal be involved?", "procurementInvolved", true, [
        { v: "no", l: "No", col: "teal" },{ v: "likely", l: "Likely" },
        { v: "definitely", l: "Definitely", col: "warn" },{ v: "unknown", l: "Unknown" },
      ])}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>CC contacts <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Other attendees to CC on follow-up emails.</div>
        {f.ccContacts.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr auto", gap: 7, marginBottom: 7 }}>
            <input placeholder="Name" value={c.name} onChange={e => setCC(i, "name", e.target.value)} style={{ ...inpSt, padding: "8px 11px" }} />
            <input placeholder="Role" value={c.role} onChange={e => setCC(i, "role", e.target.value)} style={{ ...inpSt, padding: "8px 11px" }} />
            <input placeholder="Email" value={c.email} onChange={e => setCC(i, "email", e.target.value)} style={{ ...inpSt, padding: "8px 11px" }} />
            <button onClick={() => remCC(i)} style={{ padding: "8px 10px", border: `1.5px solid ${C.border}`, borderRadius: 7, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 15, fontFamily: "inherit" }}>×</button>
          </div>
        ))}
        <button onClick={addCC} style={{ fontSize: 13, color: C.accent, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>+ Add person</button>
      </div>
      <div style={{ marginTop: 18 }}>
        {chipField("Demo format", "demoFormat", true, [
          { v: "inperson", l: "In-person meeting", col: "teal" },
          { v: "virtual", l: "Virtual call", col: "accent" },
          { v: "hybrid", l: "Hybrid", col: "accent" },
        ])}
        {f.demoFormat === "inperson" && (
          <div style={{ marginTop: -8 }}>
            {chipField("Meeting location", "meetingLocation", true, [
              { v: "warehouse", l: "Eshopbox warehouse visit", col: "teal" },
              { v: "theiroffice", l: "Their office", col: "accent" },
              { v: "other", l: "Other", col: "accent" },
            ])}
            {f.meetingLocation === "warehouse" && (
              <div style={{ marginTop: -6, marginBottom: 14, padding: "8px 12px", background: C.tealLight, borderRadius: 7, fontSize: 12, color: C.teal, fontWeight: 500 }}>
                Warehouse visit adds +3 pts to deal score — strongest buying signal.
              </div>
            )}
          </div>
        )}
      </div>
    </div>,

    // S3 — Current setup
    <div key="s3">
      <SecHead n={3} title="Current setup" sub="How they operate today — used to tailor integration messaging in follow-up." />
      {[
        { label: "Order management system (OMS)", key: "oms", opts: ["Unicommerce","Easyecom","Vinculum","None","Other"] },
        { label: "Shopping cart / platform", key: "shoppingCart", opts: ["Shopify","WooCommerce","Magento","Custom built","None / Not applicable"] },
        { label: "How do they ship currently?", key: "shippingSetup", opts: ["Own carrier accounts","Aggregator (Shiprocket etc.)","Mix of both","Not shipping yet"] },
        { label: "How do they handle warehousing?", key: "warehousingSetup", opts: ["Own warehouse (self-operated)","3PL","Mix of both","No warehousing yet"] },
      ].map(field => (
        <div key={field.key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>{field.label} <span style={{ color: C.accent }}>*</span></div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {field.opts.map(o => <Chip key={o} label={o} selected={f[field.key] === o} onClick={() => set(field.key, o)} />)}
          </div>
        </div>
      ))}
    </div>,

    // S4 — Pain & fit
    <div key="s4">
      <SecHead n={4} title="Pain & fit" sub="What problems are they trying to solve? Select all that came up." />
      <PainSection f={f} set={set} tog={tog} solutionInterest={f.solutionInterest} />
      <div style={{ marginTop: 20 }}>
        {chipField("How clearly was the pain articulated?", "painClarity", true, [
          { v: "clear", l: "Crystal clear — they named it", col: "teal" },
          { v: "vague", l: "Vague — implied not stated" },
          { v: "none", l: "Not really articulated", col: "warn" },
        ])}
        {chipField("Engagement level during demo", "engagementLevel", true, [
          { v: "high", l: "High — asked detailed questions", col: "teal" },
          { v: "medium", l: "Medium — engaged but passive" },
          { v: "low", l: "Low — mostly listening", col: "warn" },
        ])}
        <FTextarea label="Objections raised" hint="What pushed back — pricing, ops concerns, competitor comparison?" value={f.objections} onChange={v => set("objections", v)} placeholder="e.g. Rates must match their direct Blue Dart contract. Also asked about SLA guarantees." />
        <FInput label="Competitor or current vendor mentioned" value={f.competitorMentioned} onChange={v => set("competitorMentioned", v)} placeholder="e.g. Shiprocket, Blue Dart, Ecom Express, Delhivery" />
      </div>
    </div>,

    // S5 — Qualification
    <div key="s5">
      <SecHead n={5} title="Qualification signals" sub="These drive the deal grade and forecast probability." />
      {chipField("Budget signal", "budgetSignal", true, [
        { v: "confirmed", l: "Confirmed — specific number mentioned", col: "teal" },
        { v: "implied", l: "Implied — likely spending" },
        { v: "none", l: "Not discussed", col: "warn" },
      ])}
      {chipField("Purchase timeline", "purchaseTimeline", true, [
        { v: "month", l: "This month", col: "teal" },
        { v: "quarter", l: "This quarter" },
        { v: "6m", l: "6+ months" },
        { v: "unknown", l: "Unknown / exploring", col: "warn" },
      ])}
      {chipField("Champion strength", "championStrength", true, [
        { v: "strong", l: "Strong — asked for internal materials", col: "teal" },
        { v: "weak", l: "Weak — passive supporter" },
        { v: "none", l: "None identified", col: "warn" },
      ])}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Next step agreed before demo ended? <span style={{ color: C.accent }}>*</span></div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {[{ v: "booked", l: "Yes — specific action agreed", col: "teal" },{ v: "vague", l: "Vague — will follow up" },{ v: "none", l: "Nothing agreed", col: "warn" }].map(o =>
            <Chip key={o.v} label={o.l} selected={f.nextStep === o.v} onClick={() => set("nextStep", o.v)} col={o.col} />)}
        </div>
        {f.nextStep === "none" && <div style={{ marginTop: 7, padding: "8px 11px", background: C.dangerLight, borderRadius: 6, fontSize: 12, color: C.danger }}>No next step is the leading indicator of a deal going quiet. Consider calling back to set one.</div>}
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Follow-up meeting date <span style={{ color: C.accent }}>*</span></div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 7 }}>Must be booked before the demo call ends. Anchors all post-meeting email scheduling.</div>
        <input type="date" value={f.followupMeetingDate} onChange={e => set("followupMeetingDate", e.target.value)}
          style={{ ...inpSt, borderColor: f.followupMeetingDate ? C.teal : C.border }} />
        {!f.followupMeetingDate && <div style={{ marginTop: 6, fontSize: 12, color: C.warn }}>No meeting booked yet — this is the most important next step from the demo.</div>}
      </div>
      <FInput label="Internal urgency driver" hint="Peak season, contract ending, new channel launch?" value={f.urgencyDriver} onChange={v => set("urgencyDriver", v)} placeholder="e.g. Peak season in 6 weeks, 3PL contract ending next month" />
      {chipField("Was pricing raised in the demo?", "pricingRaisedInDemo", true, [
        { v: "yes", l: "Yes — discussed in demo", col: "teal" },
        { v: "no", l: "No — not discussed" },
      ])}
      <ScoreBar score={score} />
    </div>,

    // S6 — Features shown
    <div key="s6">
      <SecHead n={6} title="Features shown" sub="What did you actually demo? Claude references these in the Day 1 recap email." />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Features shown in demo</div>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {FEATURES.map(feat => <Chip key={feat} label={feat} selected={f.featuresShown.includes(feat)} onClick={() => tog("featuresShown", feat)} />)}
        </div>
      </div>
      <ScoreBar score={score} />
    </div>,

    // S7 — Transcript & notes
    <div key="s7">
      <SecHead n={7} title="Transcript & notes" sub="The richer the input, the more personalised the follow-up emails Claude generates." />
      <FTextarea label="Demo transcript" hint="Paste from Gong, Zoom, or Otter. Claude extracts objections, buying signals, and exact phrases." value={f.transcript} onChange={v => set("transcript", v)} placeholder="Paste transcript here…" rows={8} />
      <FTextarea label="Rep's own notes" hint="Anything not captured above — gut feel, side conversations, post-call observations." value={f.repNotes} onChange={v => set("repNotes", v)} placeholder="e.g. Raj seemed genuinely interested in the warehouse visit…" rows={4} />
      <ScoreBar score={score} />
    </div>,
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 60px" }}>
      <style>{`@keyframes sa-spin{to{transform:rotate(360deg)}}@keyframes sa-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      {syncStarted && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, background: C.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>SA</div>
            </div>
            {syncDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, color: '#22c55e', marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>Demo logged successfully!</div>
                {syncDraftsWarning ? (
                  <div style={{ fontSize: 13, color: C.warn, lineHeight: 1.6 }}>
                    Email drafts are being generated —<br />check the Emails tab in a few minutes.
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted }}>Redirecting you now…</div>
                )}
              </div>
            ) : syncError ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: C.danger, marginBottom: 16, lineHeight: 1.6 }}>{syncError}</div>
                <button onClick={() => { setSyncStarted(false); setSyncError(null); setSyncStep(0); setSyncDone(false); }}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: C.accent, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Logging demo…</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>This takes about 60 seconds — Claude is generating 4 personalised email drafts</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: '#f8f8f8', borderRadius: 10 }}>
                  <div style={{ width: 20, height: 20, border: `2.5px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'sa-spin 0.7s linear infinite', flexShrink: 0 }} />
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{SYNC_STEPS[syncStep]?.label}</div>
                </div>
                <div style={{ width: '100%', height: 6, background: '#f0f0f0', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.accent, borderRadius: 3, width: `${((syncStep + 1) / SYNC_STEPS.length) * 100}%`, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                  {SYNC_STEPS.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {i < syncStep ? (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>
                        </div>
                      ) : i === syncStep ? (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.accent, flexShrink: 0, animation: 'sa-pulse 1.2s ease-in-out infinite' }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
                      )}
                      <div style={{ fontSize: 13, fontWeight: i === syncStep ? 600 : 400, color: i < syncStep ? '#9ca3af' : i === syncStep ? C.ink : '#9ca3af' }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 12px', background: C.warnLight, borderRadius: 8, fontSize: 12, color: C.warn, textAlign: 'center', fontWeight: 500 }}>
                  Don't close this tab
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Log post-demo</h1>
        <div style={{ fontSize: 13, color: C.muted }}>Fill in immediately after the demo while it's fresh.</div>
      </div>
      <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: `1px solid ${C.border}`, marginBottom: 22 }}>
        {SECTIONS.map((s, i) => (
          <button key={i} onClick={() => go(i)} style={{ padding: "7px 12px", border: "none", borderBottom: `2.5px solid ${i === sec ? C.accent : "transparent"}`, background: "transparent", fontSize: 12, fontWeight: i === sec ? 700 : 400, color: i === sec ? C.accent : i < sec ? C.teal : C.muted, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s", marginBottom: -1 }}>
            {i < sec ? "✓ " : ""}{s}
          </button>
        ))}
      </div>
      <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: "28px 26px 22px" }}>
        {sections[sec]}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => go(Math.max(sec - 1, 0))} disabled={sec === 0}
            style={{ padding: "9px 18px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 13, fontWeight: 600, color: C.muted, cursor: sec === 0 ? "not-allowed" : "pointer", opacity: sec === 0 ? 0.3 : 1, fontFamily: "inherit" }}>
            ← Back
          </button>
          <span style={{ fontSize: 12, color: C.muted }}>{sec + 1} / {SECTIONS.length}</span>
          {sec < SECTIONS.length - 1
            ? <button onClick={() => go(sec + 1)} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.accent, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>Continue →</button>
            : <button onClick={handleSubmit}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.teal, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>
              Analyse & grade →
            </button>}
        </div>
      </div>
    </div>
  );
}