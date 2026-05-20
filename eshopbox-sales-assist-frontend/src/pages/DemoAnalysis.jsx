import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { C, GRADE_COLORS } from '../components/ui';

const API = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";

const SHIPPING_PAIN_LABELS = {
  s1: "High shipping cost", s2: "Poor on-time delivery / SLA",
  s3: "High RTO / return rate", s4: "Limited carrier reach / pin code coverage",
  s5: "No shipment visibility for customers", s6: "No insurance / loss coverage",
};
const WAREHOUSING_PAIN_LABELS = {
  w1: "High warehousing / fulfillment cost", w2: "Single warehouse — slow delivery & high cost",
  w3: "Split inventory — DTC vs marketplace", w4: "Manual operations / no WMS",
  w5: "No real-time inventory visibility", w6: "Scaling to new regions",
  w7: "Returns processing & QC",
};

function Section({ title, children }) {
  return (
    <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "11px 16px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `0.5px solid ${C.border}`, gap: 16, alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.ink, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ScoreRow({ item, expanded, onToggle }) {
  const { label, earned, max, description } = item;
  const pct = max > 0 ? (earned / max) * 100 : 0;
  const barColor = earned === max ? C.teal : earned > 0 ? C.warn : C.danger;
  const expandBg = earned === max ? C.tealLight : earned > 0 ? C.warnLight : C.dangerLight;

  return (
    <div style={{ borderBottom: `0.5px solid ${C.border}` }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 5 }}>{label}</div>
          <div style={{ height: 6, background: C.paperDark, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s ease" }} />
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: barColor, whiteSpace: "nowrap", minWidth: 36, textAlign: "right" }}>
          {earned}/{max}
        </div>
        <span style={{ fontSize: 10, color: C.muted, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>
      {expanded && (
        <div style={{ margin: "0 0 10px", padding: "8px 12px", background: expandBg, borderRadius: 6, fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
    </div>
  );
}

function CoachCard({ title, items, accentColor, bgColor, icon }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ background: bgColor, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: "0.04em" }}>{title}</span>
      </div>
      <div style={{ padding: "10px 14px" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < items.length - 1 ? 8 : 0, alignItems: "flex-start" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: accentColor, flexShrink: 0, marginTop: 7 }} />
            <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DemoAnalysis() {
  const { id: dealId } = useParams();
  const navigate = useNavigate();
  const onBack = () => navigate(-1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedScore, setExpandedScore] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/api/deals/${dealId}/analysis`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 20px", textAlign: "center", color: C.muted, fontSize: 14 }}>
      Loading analysis…
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
      <button onClick={onBack} style={{ fontSize: 13, color: C.muted, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 18px", fontFamily: "inherit" }}>
        ← Back to deal
      </button>
      <div style={{ background: C.dangerLight, border: `0.5px solid ${C.danger}20`, borderRadius: 10, padding: "16px", fontSize: 13, color: C.danger }}>
        {error}
      </div>
    </div>
  );

  if (!data) return null;

  const { formData: f, aiAnalysis, scoreBreakdown, grade, score } = data;
  const gradeColors = GRADE_COLORS?.[grade] || { bg: C.paperDark, text: C.muted, border: C.border };
  const shippingPains = (f.shipping_pains || []).map(p => SHIPPING_PAIN_LABELS[p] || p).filter(Boolean);
  const warehousingPains = (f.warehousing_pains || []).map(p => WAREHOUSING_PAIN_LABELS[p] || p).filter(Boolean);
  const allPains = [...shippingPains, ...warehousingPains];

  const dmLabel = f.dm_present === 'yes' ? 'Yes — DM was there' : f.dm_present === 'champion' ? 'Champion only' : f.dm_present === 'unknown' ? 'Unknown' : null;
  const engLabel = f.engagement_level === 'high' ? 'High — asked detailed questions' : f.engagement_level === 'medium' ? 'Medium — engaged but passive' : f.engagement_level === 'low' ? 'Low — mostly listening' : null;
  const painLabel = f.pain_clarity === 'clear' ? 'Crystal clear' : f.pain_clarity === 'vague' ? 'Vague — implied' : f.pain_clarity === 'none' ? 'Not articulated' : null;
  const budgetLabel = f.budget_signal === 'confirmed' ? 'Confirmed — specific number' : f.budget_signal === 'implied' ? 'Implied' : f.budget_signal === 'none' ? 'Not discussed' : null;
  const timelineLabel = f.purchase_timeline === 'month' ? 'This month' : f.purchase_timeline === 'quarter' ? 'This quarter' : f.purchase_timeline === '6m' ? '6+ months' : f.purchase_timeline === 'unknown' ? 'Unknown' : null;
  const nextStepLabel = f.next_step === 'booked' ? 'Specific action agreed' : f.next_step === 'vague' ? 'Vague — will follow up' : f.next_step === 'none' ? 'Nothing agreed' : null;
  const champLabel = f.champion_strength === 'strong' ? 'Strong — internal advocate' : f.champion_strength === 'weak' ? 'Weak — passive supporter' : f.champion_strength === 'none' ? 'None identified' : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 60px" }}>
      <button onClick={onBack} style={{ fontSize: 13, color: C.muted, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 18px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
        ← Back to deal
      </button>

      {/* Header */}
      <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: gradeColors.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: gradeColors.text, border: `2px solid ${gradeColors.border}`, flexShrink: 0 }}>
          {grade}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>{f.brand_name}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Demo Analysis · {score} pts · Rep: {f.rep_name}</div>
        </div>
      </div>

      {/* Score breakdown */}
      <Section title="Deal score breakdown">
        {scoreBreakdown.map(item => (
          <ScoreRow
            key={item.category}
            item={item}
            expanded={expandedScore === item.category}
            onToggle={() => setExpandedScore(expandedScore === item.category ? null : item.category)}
          />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Total score</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: gradeColors.text }}>{score} pts — Grade {grade}</span>
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Left: Demo summary */}
        <div>
          <Section title="Deal info">
            <KV label="Prospect" value={f.prospect_name} />
            <KV label="Brand" value={f.brand_name} />
            <KV label="Order volume" value={f.order_volume} />
            <KV label="Solution interest" value={
              f.solution_interest === 'both' ? 'Both — full-stack' :
              f.solution_interest === 'shipping' ? 'Shipping only' :
              f.solution_interest === 'warehousing' ? 'Warehousing only' : f.solution_interest
            } />
            <KV label="Demo date" value={f.created_at?.split('T')[0]} />
            <KV label="Follow-up meeting" value={f.followup_meeting_date} />
            <KV label="Rep" value={f.rep_name} />
          </Section>

          <Section title="Demo details">
            <KV label="Demo format" value={f.demo_format === 'inperson' ? 'In-person' : f.demo_format === 'virtual' ? 'Virtual' : f.demo_format} />
            <KV label="Meeting location" value={f.meeting_location} />
            <KV label="DM present" value={dmLabel} />
            <KV label="Engagement" value={engLabel} />
            <KV label="Pain clarity" value={painLabel} />
            <KV label="Budget signal" value={budgetLabel} />
            <KV label="Purchase timeline" value={timelineLabel} />
            <KV label="Next step" value={nextStepLabel} />
            <KV label="Champion strength" value={champLabel} />
            <KV label="Pricing raised" value={f.pricing_raised === 'yes' || f.pricing_raised === true ? 'Yes' : null} />
            <KV label="Urgency driver" value={f.urgency_driver} />
            {f.features_shown?.length > 0 && (
              <div style={{ padding: "6px 0" }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Features shown</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {f.features_shown.map((feat, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: C.tealLight, color: C.teal, fontWeight: 500 }}>{feat}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title="Current setup">
            <KV label="OMS" value={f.oms} />
            <KV label="Shopping cart" value={f.shopping_cart} />
            <KV label="Shipping setup" value={f.shipping_setup} />
            <KV label="Warehousing setup" value={f.warehousing_setup} />
            <KV label="Brand type" value={f.brand_type} />
            <KV label="Procurement involved" value={f.procurement_involved} />
          </Section>
        </div>

        {/* Right: Pains, objections, coach */}
        <div>
          {allPains.length > 0 && (
            <Section title="Pain points & signals">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: (f.shipping_pain_other || f.warehousing_pain_other) ? 10 : 0 }}>
                {allPains.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: C.paperDark, color: C.muted, fontWeight: 500 }}>{p}</span>
                ))}
              </div>
              {f.shipping_pain_other && <KV label="Other shipping" value={f.shipping_pain_other} />}
              {f.warehousing_pain_other && <KV label="Other warehousing" value={f.warehousing_pain_other} />}
            </Section>
          )}

          <Section title="Objections & competition">
            <KV label="Objections raised" value={f.objections || 'None recorded'} />
            <KV label="Competitor mentioned" value={f.competitor_mentioned || 'None'} />
          </Section>

          {f.rep_notes && (
            <Section title="Rep notes">
              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{f.rep_notes}</div>
            </Section>
          )}

          <Section title="Coach recommendations">
            {aiAnalysis ? (
              <>
                <CoachCard title="What's working" items={aiAnalysis.strengths} accentColor={C.teal} bgColor={C.tealLight} icon="✓" />
                <CoachCard title="Risks to closing" items={aiAnalysis.risks} accentColor={C.danger} bgColor={C.dangerLight} icon="⚠" />
                <CoachCard title="For your next meeting" items={aiAnalysis.nextMeeting} accentColor={C.accent} bgColor={C.accent + '15'} icon="→" />
                <CoachCard title="Rep prep" items={aiAnalysis.repAdvice} accentColor={C.warn} bgColor={C.warnLight} icon="✦" />
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>
                No analysis available for this deal. Analysis is generated for demos logged after this feature was added.
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
