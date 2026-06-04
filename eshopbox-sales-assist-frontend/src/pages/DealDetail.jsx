import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C, StagePill, GRADE_COLORS, SEV_COLORS } from "../components/ui";
import { useAppContext } from "../AppContext";
import { apiFetch } from "../api.js";

const API = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";

const PAIN_LABELS = {
  s1: "High shipping cost", s2: "Poor on-time delivery / SLA",
  s3: "High RTO / return rate", s4: "Limited carrier reach / pin code coverage",
  s5: "No shipment visibility for customers", s6: "No insurance / loss coverage",
  w1: "High warehousing / fulfillment cost", w2: "Single warehouse — slow delivery & high cost",
  w3: "Split inventory — DTC vs marketplace", w4: "Manual operations / no WMS",
  w5: "No real-time inventory visibility", w6: "Scaling to new regions",
  w7: "Returns processing & QC",
};

const EMAIL_META = {
  day1:  { label: "Day 1 — Personalised recap",    day: "Day 1", type: "Rep sends", editable: true },
  day3:  { label: "Day 3 — ROI value email",       day: "Day 3", type: "Rep sends", editable: true },
  day4:  { label: "Day 4 — Objection handling",    day: "Day 4", type: "Rep sends", editable: true },
  nudge: { label: "Meeting+7 — Decision nudge",    day: "M+7",  type: "Rep sends", editable: true },
};

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── Rich Text Editor ────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange, readOnly }) {
  const ref = React.useRef(null);

  const exec = (cmd, val) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val || undefined);
  };

  if (readOnly) {
    const isHtml = value?.trim().startsWith('<');
    return isHtml
      ? <div style={{ background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, fontFamily: "inherit" }} dangerouslySetInnerHTML={{ __html: value }} />
      : <div style={{ background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{value}</div>;
  }

  return (
    <div style={{ border: `1.5px solid ${C.accent}`, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 2, padding: "6px 8px", borderBottom: `1px solid ${C.border}`, background: C.paperDark, flexWrap: "wrap" }}>
        <button onMouseDown={e => { e.preventDefault(); exec('bold'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>B</button>
        <button onMouseDown={e => { e.preventDefault(); exec('italic'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontStyle: "italic", fontFamily: "inherit", cursor: "pointer" }}>I</button>
        <button onMouseDown={e => { e.preventDefault(); exec('underline'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" }}>U</button>
        <div style={{ width: 1, background: C.border, margin: "0 4px" }} />
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>• List</button>
        <button onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>1. List</button>
        <div style={{ width: 1, background: C.border, margin: "0 4px" }} />
        <button onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'h3'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>Heading</button>
        <button onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'p'); }} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>Normal</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.innerHTML)}
        style={{ padding: "10px 12px", fontSize: 13, color: C.ink, lineHeight: 1.7, fontFamily: "inherit", minHeight: 200, outline: "none" }}
      />
    </div>
  );
}

// ─── Email Draft Card ────────────────────────────────────────────────────────

function EmailDraftCard({ email, dealId }) {
  const meta = EMAIL_META[email.email_type] || {};
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [gmailSent, setGmailSent] = useState(false);
  const [gmailSentAt, setGmailSentAt] = useState(null);

  const isSent = email.status === "sent";
  const isScheduled = email.status === "scheduled";
  const isActuallySent = isSent || gmailSent;

  const statusColor = isActuallySent
    ? { bg: C.tealLight, text: C.teal }
    : isScheduled
    ? { bg: C.infoLight, text: C.info }
    : { bg: C.blueLight, text: C.blue };

  const statusLabel = isActuallySent ? "Sent" : isScheduled ? "Scheduled" : meta.type;

  const handleSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/api/deals/${dealId}/emails/${email.email_type}/create-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setGmailSent(true);
        setGmailSentAt(data.sent_at || new Date().toISOString());
      } else {
        setSendError(data.error || "Failed to send email.");
      }
    } catch {
      setSendError("Network error. Please try again.");
    }
    setSending(false);
  };

  return (
    <div style={{ background: C.white, border: `0.5px solid ${isActuallySent ? C.teal + "40" : C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      {/* Collapsed header */}
      <div onClick={() => setOpen(!open)} style={{ padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: isActuallySent ? C.tealLight : C.paperDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: isActuallySent ? C.teal : C.muted }}>{isActuallySent ? "✓" : meta.day}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{email.subject?.slice(0, 60)}{email.subject?.length > 60 ? "…" : ""}</div>
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 700, background: statusColor.bg, color: statusColor.text, whiteSpace: "nowrap" }}>{statusLabel}</span>
        <span style={{ fontSize: 14, color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "12px 14px" }}>

          {/* Subject */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Subject</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{email.subject}</div>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Body</div>
            <div style={{ background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{email.body}</div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => {
              const tmp = document.createElement('div');
              tmp.innerHTML = email.body;
              navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${tmp.textContent || tmp.innerText || ''}`);
            }} style={{ fontSize: 12, color: C.info, fontWeight: 600, background: "transparent", border: `1px solid ${C.info}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              Copy
            </button>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {isActuallySent ? (
                <span style={{ fontSize: 12, color: C.teal, fontWeight: 600, padding: "5px 0" }}>
                  ✓ Sent via Gmail {(email.sent_at || gmailSentAt) ? new Date(email.sent_at || gmailSentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                </span>
              ) : (
                <button onClick={handleSend} disabled={sending}
                  style={{ fontSize: 12, color: "#fff", fontWeight: 700, background: sending ? C.border : "#EA4335", border: "none", borderRadius: 6, padding: "5px 14px", cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {sending ? "Sending…" : "Send via Gmail →"}
                </button>
              )}
            </div>
          </div>
          {sendError && (
            <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{sendError}</div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Horizontal Sequence Checklist ──────────────────────────────────────────

function HorizontalSequence({ emails, deal }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const toDate = (s) => { if (!s) return null; const d = new Date(s); d.setHours(0,0,0,0); return d; };

  const emailMap = {};
  (emails || []).forEach(e => { emailMap[e.email_type] = e; });

  const getTask = (prefix) => deal?.tasks?.find(t => (t.Subject || t.subject || '').startsWith(prefix));
  const taskStatus = (task) => {
    if (!task) return 'pending';
    const st = task.Status || task.status;
    if (st === 'Completed') return 'done';
    const due = toDate(task.due_date || task.dueDate);
    if (!due) return 'upcoming';
    if (due < today) return 'overdue';
    if (due.getTime() === today.getTime()) return 'due-today';
    return 'upcoming';
  };

  const steps = [
    { key: 'day1',     label: 'Day 1',    name: 'Recap email',           auto: false, type: 'email' },
    { key: 'day2',     label: 'Day 2',    name: 'Pricing proposal',      auto: false, type: 'email' },
    { key: 'day3',     label: 'Day 3',    name: 'ROI value',             auto: false, type: 'email' },
    { key: 'day4',     label: 'Day 4',    name: 'Objection email',       auto: true,  type: 'email' },
    { key: 'meeting',  label: 'Meeting',  name: 'Follow-up mtg', auto: false, type: 'task', prefix: 'Meeting —' },
    { key: 'meeting3', label: 'M+3',      name: 'Check-in',      auto: true,  type: 'task', prefix: 'Meeting+3' },
    { key: 'meeting7', label: 'M+7',      name: 'Decision nudge', auto: true, type: 'task', prefix: 'Meeting+7' },
  ];

  const getStatus = (step) => {
    if (step.type === 'email') {
      const e = emailMap[step.key];
      if (!e) return 'pending';
      if (e.status === 'sent') return 'done';
      if (e.status === 'draft_created') return 'draft';
      return 'pending';
    }
    return taskStatus(getTask(step.prefix));
  };

  const stepCardStyle = (status) => {
    if (status === 'done')       return { border: 'var(--ok)',      bg: 'var(--ok-bg)',     statusColor: 'var(--ok)',     opacity: 1 };
    if (status === 'overdue')    return { border: 'var(--danger)',  bg: 'var(--danger-bg)', statusColor: 'var(--danger)', opacity: 1 };
    if (status === 'due-today')  return { border: 'var(--warn)',    bg: 'var(--warn-bg)',   statusColor: 'var(--warn)',   opacity: 1 };
    if (status === 'draft')      return { border: 'var(--info)',    bg: 'var(--info-bg)',   statusColor: 'var(--info)',   opacity: 1 };
    if (status === 'upcoming')   return { border: 'var(--line-2)', bg: 'var(--surface)',   statusColor: 'var(--ink-3)', opacity: 1 };
    return                              { border: 'var(--line)',   bg: 'var(--surface)',   statusColor: 'var(--ink-3)', opacity: 0.55 };
  };
  const SEQ_STATUS_LABEL = { done: 'Done', overdue: 'Overdue', 'due-today': 'Due today', draft: 'Draft ready', upcoming: 'Upcoming', pending: '' };

  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'hidden', marginTop: 10, width: '100%' }}>
      {steps.map((step) => {
        const status = getStatus(step);
        const { border: stepBorder, bg, statusColor, opacity } = stepCardStyle(status);
        const stLabel = SEQ_STATUS_LABEL[status] || '';
        return (
          <div key={step.key} style={{
            flex: '1', minWidth: 0,
            background: bg, border: `1px solid ${stepBorder}`,
            borderRadius: 6, padding: '8px 6px',
            opacity,
          }}>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{step.label}</div>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>{step.name}</div>
            {stLabel && (
              <div style={{ fontSize: 9.5, color: statusColor, marginTop: 2, fontWeight: status === 'overdue' ? 500 : 400 }}>{stLabel}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sequence Checklist ──────────────────────────────────────────────────────

function SequenceChecklist({ emails, dealId, deal }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate2 = (s) => { if (!s) return null; const d = new Date(s); d.setHours(0,0,0,0); return d; };

  const steps = [
    { key: "day1",     label: "Day 1 — Send recap email",          auto: false, type: 'email' },
    { key: "day2",     label: "Day 2 — Send pricing proposal",     auto: false, type: 'email', zohoTask: true },
    { key: "day3",     label: "Day 3 — Send ROI value email",      auto: false, type: 'email' },
    { key: "day4",     label: "Day 4 — Objection email",           auto: false, type: 'email' },
    { key: "meeting",  label: "Meeting — Follow-up mtg",           auto: false, type: 'task',  prefix: 'Meeting —' },
    { key: "meeting3", label: "Meeting+3 — Check-in",              auto: true,  type: 'task',  prefix: 'Meeting+3' },
    { key: "meeting7", label: "Meeting+7 — Decision nudge",        auto: true,  type: 'task',  prefix: 'Meeting+7' },
  ];

  const emailMap = {};
  (emails || []).forEach(e => { emailMap[e.email_type] = e; });

  const getZohoTask = (prefix) => deal?.tasks?.find(t => (t.Subject || t.subject || '').startsWith(prefix));

  const fmt = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const t = new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0);
    const diff = Math.floor((t - d) / 86400000);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear()).slice(2);
    const f = `${dd}-${mm}-${yy}`;
    if (diff === 0) return `Today · ${f}`;
    if (diff === 1) return `Yesterday · ${f}`;
    if (diff === -1) return `Tomorrow · ${f}`;
    if (diff < 0) return `In ${Math.abs(diff)}d · ${f}`;
    return f;
  };

  return (
    <Section title="Sequence checklist">
      {steps.map((step, i) => {
        let isSent = false, isOverdue = false, isScheduled = false, sentLate = false;
        let descLine = '';

        if (step.type === 'email') {
          const email = emailMap[step.key];
          isSent = email?.status === "sent";
          isScheduled = email?.status === "scheduled";
          const isZohoTask = step.zohoTask;
          const scheduledDate = email?.scheduled_for ? new Date(email.scheduled_for) : null;
          if (scheduledDate) scheduledDate.setHours(0, 0, 0, 0);
          isOverdue = !!scheduledDate && scheduledDate < today && !isSent && !isZohoTask;
          sentLate = isSent && email?.sent_at && email?.scheduled_for &&
            new Date(email.sent_at) > new Date(new Date(email.scheduled_for).getTime() + 86400000);
          descLine = isZohoTask && !isSent ? "Check Zoho Open Activities"
            : isSent && email?.sent_at && sentLate ? `Sent ${fmt(email.sent_at)} · Due ${fmt(email.scheduled_for)}`
            : isSent && email?.sent_at ? `Sent ${fmt(email.sent_at)}`
            : isScheduled ? `Scheduled · ${fmt(email.scheduled_for)}`
            : isOverdue ? `Overdue · ${fmt(email.scheduled_for)}`
            : scheduledDate ? `Due · ${fmt(email.scheduled_for)}`
            : "";
        } else {
          const task = getZohoTask(step.prefix);
          if (!task) {
            descLine = 'Not yet created in Zoho';
          } else {
            const st = task.Status || task.status;
            isSent = st === 'Completed';
            const due = toDate2(task.due_date || task.dueDate);
            isOverdue = !isSent && !!due && due < today;
            descLine = isSent ? 'Completed'
              : isOverdue ? `Overdue · ${fmt(task.due_date || task.dueDate)}`
              : due ? `Due · ${fmt(task.due_date || task.dueDate)}`
              : 'Open';
          }
        }

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < steps.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: isSent ? C.teal : isOverdue ? C.danger : C.paperDark, color: isSent ? C.white : isOverdue ? C.white : C.muted, border: `1.5px solid ${isSent ? C.teal : isOverdue ? C.danger : C.border}` }}>
              {isSent ? "✓" : isOverdue ? "!" : "·"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isOverdue ? C.danger : isSent ? C.muted : C.ink, textDecoration: isSent ? "line-through" : "none" }}>
                {step.label}
                {step.auto && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 10, background: C.paperDark, color: C.muted, fontWeight: 700 }}>AUTO</span>}
                {step.zohoTask && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 10, background: C.infoLight, color: C.info, fontWeight: 700 }}>Zoho task</span>}
              </div>
              <div style={{ fontSize: 11, color: isOverdue ? C.danger : C.muted }}>{descLine}</div>
            </div>
          </div>
        );
      })}
    </Section>
  );
}

// ─── Merged Sequence View ────────────────────────────────────────────────────

function MergedSequenceView({ emails, dealId, deal, emailsLoading, hasEmails, autoGenerating, autoGenError, prospectEmail, repEmail, fetchEmails, onLogDemo }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState({});
  const [polling, setPolling] = useState({});
  const [pollingExhausted, setPollingExhausted] = useState({});
  const [draftReady, setDraftReady] = useState({});
  const [sendErrors, setSendErrors] = useState({});
  const [localSent, setLocalSent] = useState({});
  const pollTimersRef = useRef({});
  const [proposalModal, setProposalModal] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');

  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => { Object.values(timers).forEach(clearInterval); };
  }, []);

  const emailMap = {};
  (emails || []).forEach(e => { emailMap[e.email_type] = e; });

  const getTask = (prefix) => deal?.tasks?.find(t => (t.Subject || t.subject || '').startsWith(prefix));
  const toDate = (s) => { if (!s) return null; const d = new Date(s); d.setHours(0, 0, 0, 0); return d; };

  const fmt = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    const diff = Math.floor((t - d) / 86400000);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    const f = `${dd}-${mm}-${yy}`;
    if (diff === 0) return `Today · ${f}`;
    if (diff === 1) return `Yesterday · ${f}`;
    if (diff === -1) return `Tomorrow · ${f}`;
    if (diff < 0) return `In ${Math.abs(diff)}d · ${f}`;
    return f;
  };

  const steps = [
    { key: 'day1',     label: 'Day 1',   name: 'Recap email',            auto: false, emailKey: 'day1',  expandable: true  },
    { key: 'day2',     label: 'Day 2',   name: 'Pricing proposal',       auto: false, emailKey: 'day2',  expandable: false },
    { key: 'day3',     label: 'Day 3',   name: 'ROI value email',        auto: false, emailKey: 'day3',  expandable: true  },
    { key: 'day4',     label: 'Day 4',   name: 'Objection email',        auto: false, emailKey: 'day4',  expandable: true  },
    { key: 'meeting',  label: 'Meeting', name: 'Follow-up mtg',          auto: false, emailKey: null,    expandable: false, zohoTask: true, prefix: 'Meeting —' },
    { key: 'meeting3', label: 'M+3',     name: 'Check-in',               auto: true,  emailKey: null,    expandable: false, zohoTask: true, prefix: 'Meeting+3' },
    { key: 'meeting7', label: 'M+7',     name: 'Decision nudge',         auto: true,  emailKey: 'nudge', expandable: true  },
  ];

  const handleSendEmail = async (emailType) => {
    // Resend protection: if a draft was already created, confirm before replacing
    const existingEmail = emailMap[emailType];
    if (existingEmail?.gmail_draft_id && !polling[emailType]) {
      const confirmed = window.confirm('A Gmail draft already exists for this email. Create a new draft anyway?');
      if (!confirmed) return;
    }

    // Clear any previous exhausted/error/draft state so button re-enters phase 1
    setPollingExhausted(p => ({ ...p, [emailType]: false }));
    setDraftReady(p => ({ ...p, [emailType]: false }));
    setSendErrors(p => ({ ...p, [emailType]: '' }));
    setCreating(p => ({ ...p, [emailType]: true }));

    // Open blank window now (before any await) to avoid popup blocker
    const gmailWindow = window.open('', '_blank');

    let draftId, messageId;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/deals/${dealId}/emails/${emailType}/create-draft`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        gmailWindow.close();
        if (data.code === 'GMAIL_NOT_CONNECTED') {
          setSendErrors(p => ({ ...p, [emailType]: 'GMAIL_NOT_CONNECTED' }));
        } else {
          setSendErrors(p => ({ ...p, [emailType]: data.error || 'Failed to create draft.' }));
        }
        setCreating(p => ({ ...p, [emailType]: false }));
        return;
      }
      draftId = data.draftId;
      messageId = data.messageId;
    } catch {
      gmailWindow.close();
      setSendErrors(p => ({ ...p, [emailType]: 'Network error. Please try again.' }));
      setCreating(p => ({ ...p, [emailType]: false }));
      return;
    }

    setCreating(p => ({ ...p, [emailType]: false }));

    // Navigate the pre-opened window to the Gmail draft
    gmailWindow.location.href = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

    // Show the "draft created" status message
    setDraftReady(p => ({ ...p, [emailType]: true }));

    // Phase 2: poll mark-sent every 8s, up to 15 attempts
    setPolling(p => ({ ...p, [emailType]: true }));
    let attempts = 0;
    const MAX_ATTEMPTS = 15;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API}/api/deals/${dealId}/emails/${emailType}/mark-sent`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.sent) {
          clearInterval(interval);
          delete pollTimersRef.current[emailType];
          setPolling(p => ({ ...p, [emailType]: false }));
          setDraftReady(p => ({ ...p, [emailType]: false }));
          setLocalSent(p => ({ ...p, [emailType]: true }));
          return;
        }
      } catch { /* ignore transient errors */ }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        delete pollTimersRef.current[emailType];
        setPolling(p => ({ ...p, [emailType]: false }));
        setPollingExhausted(p => ({ ...p, [emailType]: true }));
      }
    }, 8000);

    pollTimersRef.current[emailType] = interval;
  };

  const handleMarkProposalSent = async () => {
    setProposalLoading(true);
    setProposalError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/deals/${dealId}/mark-proposal-sent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!data.success) {
        setProposalError(data.details || data.error || `Server error ${res.status}`);
        setProposalLoading(false);
        return;
      }
      setProposalModal(false);
      setProposalLoading(false);
      fetchEmails();
    } catch (err) {
      setProposalError(err.message || 'Network error. Please try again.');
      setProposalLoading(false);
    }
  };

  if (!deal.saLogged) {
    return (
      <Section title="Sequence">
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: C.muted }}>
          Log a demo to unlock email drafts and sequence tracking.
        </div>
      </Section>
    );
  }

  if (emailsLoading) {
    return (
      <Section title="Sequence">
        <div style={{ fontSize: 13, color: C.muted, padding: '16px 0' }}>Loading sequence…</div>
      </Section>
    );
  }

  return (
    <>
    <Section title="Sequence">
      {steps.map((step, i) => {
        const email = step.emailKey ? emailMap[step.emailKey] : null;
        const task = (step.zohoTask && step.prefix) ? getTask(step.prefix) : null;
        const isDraftCreatedLocal = email?.status === 'draft_created';
        const isSent = email?.status === 'sent' && email?.sent_at != null;

        let dotBg = C.paperDark, dotBorder = C.border, dotSymbol = '·', dotColor = C.muted;
        let strikethrough = false;
        let pillLabel = 'Not created', pillBg = C.paperDark, pillText = C.muted;
        let descLine = '';

        if (email) {
          const scheduledDate = toDate(email.scheduled_for);
          const isOverdue = !!scheduledDate && scheduledDate < today && !isSent && email.status !== 'draft_created';
          if (isSent) {
            dotBg = C.teal; dotBorder = C.teal; dotSymbol = '✓'; dotColor = C.white; strikethrough = true;
            pillLabel = 'Sent'; pillBg = C.tealLight; pillText = C.teal;
            descLine = email.sent_at ? `Sent ${fmt(email.sent_at)}` : 'Sent';
          } else if (isDraftCreatedLocal) {
            dotBg = C.paperDark; dotBorder = C.muted; dotSymbol = '✓'; dotColor = C.muted;
            pillLabel = 'Draft created'; pillBg = C.tealLight; pillText = C.teal;
            descLine = 'Draft created in Zoho';
          } else if (isOverdue) {
            dotBg = C.danger; dotBorder = C.danger; dotSymbol = '!'; dotColor = C.white;
            pillLabel = 'Overdue'; pillBg = '#FCEBEB'; pillText = C.danger;
            descLine = `Overdue · ${fmt(email.scheduled_for)}`;
          } else if (email.status === 'scheduled') {
            pillLabel = 'Scheduled'; pillBg = C.infoLight; pillText = C.info;
            descLine = `Scheduled · ${fmt(email.scheduled_for)}`;
          } else {
            pillLabel = 'Pending';
            descLine = scheduledDate ? `Due · ${fmt(email.scheduled_for)}` : '';
          }
        } else if (step.zohoTask) {
          if (task) {
            const st = task.Status || task.status;
            const due = toDate(task.due_date || task.dueDate);
            const isOverdue = !!(due && due < today && st !== 'Completed');
            if (st === 'Completed') {
              dotBg = C.teal; dotBorder = C.teal; dotSymbol = '✓'; dotColor = C.white; strikethrough = true;
              pillLabel = 'Done'; pillBg = C.tealLight; pillText = C.teal; descLine = 'Completed';
            } else if (isOverdue) {
              dotBg = C.danger; dotBorder = C.danger; dotSymbol = '!'; dotColor = C.white;
              pillLabel = 'Overdue'; pillBg = '#FCEBEB'; pillText = C.danger;
              descLine = `Overdue · ${fmt(task.due_date || task.dueDate)}`;
            } else {
              pillLabel = 'Open';
              descLine = due ? `Due · ${fmt(task.due_date || task.dueDate)}` : 'Open';
            }
          } else {
            descLine = step.prefix ? 'Not yet created in Zoho' : 'Check Zoho Open Activities';
          }
        }

        if (step.key === 'day2') {
          const day2Sent = email?.status === 'sent' && email?.sent_at != null;
          if (day2Sent) {
            dotBg = C.teal; dotBorder = C.teal; dotSymbol = '✓'; dotColor = C.white; strikethrough = true;
            pillLabel = 'Done'; pillBg = C.tealLight; pillText = C.teal;
            descLine = email.sent_at ? `Sent ${fmt(email.sent_at)}` : 'Sent';
          } else {
            pillLabel = 'Pending'; pillBg = C.paperDark; pillText = C.muted;
            descLine = '';
          }
        }

        const canExpand = step.expandable && !!email;
        const isExpanded = expanded[step.key];

        return (
          <div key={step.key} style={{ borderBottom: i < steps.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
            <div
              onClick={canExpand ? () => setExpanded(p => ({ ...p, [step.key]: !p[step.key] })) : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: canExpand ? 'pointer' : 'default' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: dotBg, color: dotColor, border: `1.5px solid ${dotBorder}` }}>
                {dotSymbol}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: strikethrough ? C.muted : C.ink, textDecoration: strikethrough ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {step.label} — {step.name}
                  {step.auto && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: C.paperDark, color: C.muted, fontWeight: 700 }}>AUTO</span>}
                  {step.zohoTask && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: C.infoLight, color: C.info, fontWeight: 700 }}>Zoho task</span>}
                </div>
                {descLine && <div style={{ fontSize: 11, color: dotBg === C.danger ? C.danger : C.muted }}>{descLine}</div>}
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: pillBg, color: pillText, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {pillLabel}
              </span>
              {step.key === 'day2' && !(email?.status === 'sent' && email?.sent_at != null) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setProposalModal(true); }}
                  style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500, background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0 }}
                >
                  Mark as sent →
                </button>
              )}
              {canExpand && (
                <span style={{ fontSize: 14, color: C.muted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▾</span>
              )}
            </div>

            {canExpand && isExpanded && email && (
              <div style={{ borderTop: `0.5px solid ${C.border}`, padding: '12px 0 12px 30px', marginBottom: 4 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Subject</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{email.subject}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Body</div>
                  <div style={{ background: C.paperDark, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: 220, overflowY: 'auto' }}>{email.body}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      const tmp = document.createElement('div');
                      tmp.innerHTML = email.body;
                      navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${tmp.textContent || tmp.innerText || ''}`);
                    }}
                    style={{ fontSize: 12, color: C.info, fontWeight: 600, background: 'transparent', border: `1px solid ${C.info}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >Copy</button>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(isSent || localSent[step.emailKey]) ? (
                      <span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>
                        ✓ Sent {email.sent_at ? new Date(email.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    ) : creating[step.emailKey] ? (
                      <button disabled style={{ fontSize: 12, color: '#fff', fontWeight: 700, background: C.border, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'not-allowed', fontFamily: 'inherit' }}>
                        Opening Gmail...
                      </button>
                    ) : polling[step.emailKey] ? (
                      <button disabled style={{ fontSize: 12, color: '#fff', fontWeight: 700, background: C.border, border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'not-allowed', fontFamily: 'inherit' }}>
                        Waiting for send...
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendEmail(step.emailKey)}
                        style={{ fontSize: 12, color: '#fff', fontWeight: 700, background: '#EA4335', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Send via Gmail →
                      </button>
                    )}
                  </div>
                </div>
                {draftReady[step.emailKey] && !localSent[step.emailKey] && !isSent && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>📨 Draft created — if Gmail opens in the wrong account, make your Eshopbox account the default in your browser.</div>
                )}
                {pollingExhausted[step.emailKey] && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Email not detected as sent. Click "Send via Gmail →" to try again.</div>
                )}
                {sendErrors[step.emailKey] === 'GMAIL_NOT_CONNECTED' ? (
                  <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>
                    Connect your Gmail in <a href="/settings" style={{ color: C.info, textDecoration: 'underline' }}>Settings</a> first.
                  </div>
                ) : sendErrors[step.emailKey] ? (
                  <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{sendErrors[step.emailKey]}</div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {!hasEmails && deal.saLogged && (
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          {autoGenerating
            ? <div style={{ fontSize: 13, color: C.muted }}>Preparing your email drafts…</div>
            : autoGenError
              ? autoGenError.includes('Demo not logged through Sales Assist yet')
                ? <div style={{ fontSize: 12, color: C.danger }}>
                    Demo was logged before Sales Assist was active. Click{' '}
                    <button onClick={onLogDemo} style={{ color: '#F95253', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>+ Log demo</button>
                    {' '}to submit the form and generate email drafts.
                  </div>
                : <div style={{ fontSize: 12, color: C.danger }}>{autoGenError}</div>
              : null
          }
        </div>
      )}
    </Section>
    {proposalModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Mark proposal as sent?</div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 24 }}>Once marked as sent, this cannot be undone.</div>
          {proposalError && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{proposalError}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setProposalModal(false)}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={handleMarkProposalSent}
              disabled={proposalLoading}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: proposalLoading ? 'not-allowed' : 'pointer', opacity: proposalLoading ? 0.7 : 1 }}
            >Yes, mark as sent</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Re-engagement Generator ─────────────────────────────────────────────────

function ReEngagementGenerator({ deal, dealId, onReengage }) {
  const [angle, setAngle] = useState("value");
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const angles = [
    { v: "value", l: "Value reminder" },
    { v: "checkin", l: "Soft check-in" },
    { v: "urgency", l: "Urgency", disabled: !deal.urgencyDriver },
    { v: "breakup", l: "Break-up" },
  ];

  const generate = async () => {
    setLoading(true); setError(""); setDraft(null);
    try {
      const result = await onReengage({
        brandName: deal.brandName,
        contactName: deal.prospectName || deal.contactName || "",
        painPoints: deal.painPoints || "",
        stage: deal.stage,
        competitorMentioned: deal.competitorMentioned || "",
        urgencyDriver: deal.urgencyDriver || "",
        grade: deal.grade,
        solutionInterest: deal.solutionInterest || "",
        orderVolume: deal.orderVolume || "",
      }, angle);
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
    } catch {
      setError("Failed to generate. Try again.");
    }
    setLoading(false);
  };

  const handleOpenInZoho = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setShowModal(true);
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowModal(false);
          window.open(`https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${dealId}`, "_blank");
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <Section title="Re-engagement email">
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 14, padding: "28px", width: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.info, marginBottom: 10 }}>✓ Email copied to clipboard</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.info, lineHeight: 1.7, marginBottom: 20 }}>
              In Zoho, click <strong>"Send Email"</strong> → paste the copied content → add CC or attachments → hit Send.
            </div>
            <div style={{ background: C.infoLight, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.info }}>Opening Zoho automatically…</span>
              <span style={{ fontWeight: 800, color: C.accent, fontSize: 22 }}>{countdown}s</span>
            </div>
            <button onClick={() => { setShowModal(false); setCountdown(null); }}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 13, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {angles.map(a => (
          <button key={a.v} onClick={() => !a.disabled && setAngle(a.v)}
            title={a.disabled ? "No urgency driver logged for this deal." : ""}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${angle === a.v ? C.accent : C.border}`, background: angle === a.v ? C.accent + "15" : "transparent", color: a.disabled ? C.border : angle === a.v ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: a.disabled ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: a.disabled ? 0.5 : 1 }}>
            {a.l}
          </button>
        ))}
      </div>

      <button onClick={generate} disabled={loading}
        style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: loading ? C.border : C.accent, color: C.white, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: draft ? 12 : 0 }}>
        {loading ? "Generating…" : "Generate email"}
      </button>

      {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 8 }}>{error}</div>}

      {draft && (
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Subject</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, padding: "6px 0" }}>{subject}</div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Body</div>
            <div style={{ background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{body}</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)}
              style={{ fontSize: 12, color: C.info, fontWeight: 600, background: "transparent", border: `1px solid ${C.info}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              Copy
            </button>
            <button onClick={handleOpenInZoho}
              style={{ fontSize: 12, color: C.white, fontWeight: 700, background: C.accent, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>
              Send in Zoho →
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Transcript Block ─────────────────────────────────────────────────────────

function TranscriptBlock({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div onClick={() => setOpen(v => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: open ? 10 : 0 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{open ? "Hide transcript" : "Show transcript"}</span>
        <span style={{ fontSize: 10, color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>
      {open && (
        <div style={{ maxHeight: 300, overflowY: "auto", background: C.paperDark, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Score Row ───────────────────────────────────────────────────────────────

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
        <div style={{ fontSize: 12, fontWeight: 700, color: barColor, whiteSpace: "nowrap", minWidth: 36, textAlign: "right" }}>{earned}/{max}</div>
        <span style={{ fontSize: 10, color: C.muted, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </div>
      {expanded && (
        <div style={{ margin: "0 0 10px", padding: "8px 12px", background: expandBg, borderRadius: 6, fontSize: 12, color: C.ink, lineHeight: 1.5 }}>{description}</div>
      )}
    </div>
  );
}

// ─── Coach Card ───────────────────────────────────────────────────────────────

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

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function TabBar({ active, onChange, tabs }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", margin: "22px 0 14px" }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          style={{
            padding: "10px 14px",
            border: "none",
            background: "transparent",
            fontSize: 13.5,
            fontWeight: 500,
            color: active === tab.key ? "var(--ink)" : "var(--ink-3)",
            cursor: "pointer",
            fontFamily: "inherit",
            borderBottom: active === tab.key ? "2px solid var(--brand)" : "2px solid transparent",
            marginBottom: -1,
            display: "inline-flex",
            alignItems: "center",
          }}>
          {tab.label}
          {tab.count > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 18, height: 18, borderRadius: 9,
              background: "var(--surface-2)",
              fontSize: 11, padding: "0 6px", marginLeft: 6,
              color: "var(--ink-2)",
            }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── F2F Meeting Modal ────────────────────────────────────────────────────────

function F2FModal({ dealId, onSuccess, onClose }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const minDateStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [location, setLocation] = useState('warehouse');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locationOptions = [
    { value: 'warehouse', label: 'Eshopbox warehouse', sub: '+3 pts' },
    { value: 'inperson',  label: 'Their office',       sub: '+2 pts' },
    { value: 'other',     label: 'Other',              sub: '+2 pts' },
  ];

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try {
      const meetingType = location === 'warehouse' ? 'warehouse' : 'inperson';
      const res = await apiFetch(`/api/deals/${dealId}/f2f`, {
        method: 'PUT',
        body: JSON.stringify({ meetingType, location, date, attendees, notes }),
      });
      if (res.success) {
        onSuccess(`F2F meeting logged · Grade updated to ${res.newGrade}`);
      } else {
        setError(res.error || 'Failed to log F2F meeting.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.white, borderRadius: 14, padding: '24px', width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 4, letterSpacing: '-0.01em' }}>Log F2F meeting</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Record an in-person visit and update the deal score.</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>When</div>
          <input type="date" value={date} min={minDateStr} max={todayStr} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: C.ink }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Location</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {locationOptions.map(opt => (
              <button key={opt.value} onClick={() => setLocation(opt.value)}
                style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${location === opt.value ? C.accent : C.border}`, background: location === opt.value ? C.accent + '15' : 'transparent', color: location === opt.value ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {opt.label} <span style={{ fontSize: 11, opacity: 0.7 }}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Attendees</div>
          <input type="text" value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="E.g. Raj, Priya (founder)"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: C.ink }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Outcome notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What happened in the meeting?"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', color: C.ink }} />
        </div>

        {error && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: loading ? C.border : C.accent, color: C.white, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Logging…' : 'Confirm meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Won/Lost Modal ───────────────────────────────────────────────────────────

function CloseModal({ dealId, onSuccess, onClose }) {
  const [outcome, setOutcome] = useState('lost');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wonReasons  = ['Pricing', 'Timing', 'Relationship', 'Product', 'Other'];
  const lostReasons = ['Price', 'Competitor', 'Timing', 'No decision', 'Product', 'Other'];
  const reasons = outcome === 'won' ? wonReasons : lostReasons;

  const handleConfirm = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`/api/deals/${dealId}/close`, {
        method: 'POST',
        body: JSON.stringify({ outcome, reason, notes }),
      });
      if (res.success) {
        onSuccess(outcome === 'won' ? 'Deal marked Won ✓' : 'Deal marked Lost');
      } else {
        setError(res.error || 'Failed to update deal.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.white, borderRadius: 14, padding: '24px', width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 4 }}>Mark deal outcome</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>This will update the stage in Zoho CRM.</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Outcome</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['won', 'lost'].map(o => (
              <button key={o} onClick={() => { setOutcome(o); setReason(''); }}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${outcome === o ? (o === 'won' ? C.teal : C.danger) : C.border}`, background: outcome === o ? (o === 'won' ? C.tealLight : C.dangerLight) : 'transparent', color: outcome === o ? (o === 'won' ? C.teal : C.danger) : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {o === 'won' ? '✓ Won' : '✗ Lost'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Reason</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {reasons.map(r => (
              <button key={r} onClick={() => setReason(r)}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${reason === r ? C.accent : C.border}`, background: reason === r ? C.accent + '15' : 'transparent', color: reason === r ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes (optional)</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any context for the outcome…"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', color: C.ink }} />
        </div>

        {error && <div style={{ fontSize: 12, color: C.danger, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: 'transparent', fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={loading || !reason}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: (!reason || loading) ? C.border : outcome === 'won' ? C.teal : C.danger, color: C.white, fontSize: 13, fontWeight: 700, cursor: (!reason || loading) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Updating…' : `Confirm — ${outcome === 'won' ? 'Won' : 'Lost'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: ok ? '#0F6E56' : '#991F1F', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  );
}

// ─── Main DealDetail Component ────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, deals, canLogDemo, fetchDeals } = useAppContext();
  const localDeal = deals.find(d => d.id === id) || null;
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGenError, setAutoGenError] = useState(null);
  const [formRecord, setFormRecord] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [expandedScore, setExpandedScore] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const [dealSummary, setDealSummary] = useState(localDeal?.dealSummary || null);
  const [activeTab, setActiveTab] = useState("flags");
  const [showF2F, setShowF2F] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [toast, setToast] = useState(null);
  const [f2fLogs, setF2fLogs] = useState({ count: 0, logs: [] });
  const [f2fLogsLoading, setF2fLogsLoading] = useState(false);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/api/deals/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (data.dealSummary) setDealSummary(data.dealSummary); })
      .catch(console.error);
  }, [id]);

  const fetchEmails = () => {
    if (!id) return;
    setEmailsLoading(true);
    const token = localStorage.getItem("auth_token");
    fetch(`${API}/api/deals/${id}/emails`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setEmails(data.emails || []))
      .catch(console.error)
      .finally(() => setEmailsLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("auth_token");
    setEmailsLoading(true);
    fetch(`${API}/api/deals/${id}/emails`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(async data => {
        const fetched = data.emails || [];
        setEmails(fetched);
        if (fetched.length === 0 && localDeal?.saLogged) {
          setAutoGenerating(true);
          setAutoGenError(null);
          try {
            const res = await fetch(`${API}/api/deals/${id}/generate-content`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              if (res.status === 404) {
                setAutoGenError('Demo not logged through Sales Assist yet. Log the demo first to generate email drafts.');
              } else if (res.status === 429) {
                setAutoGenError('Claude is busy — please refresh to try again in a minute.');
              } else if (res.status === 503) {
                setAutoGenError('Claude is temporarily overloaded — please refresh in a few minutes.');
              } else {
                setAutoGenError(data.error || 'Could not generate drafts — refresh to retry.');
              }
              return;
            }
            const r2 = await fetch(`${API}/api/deals/${id}/emails`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const d2 = await r2.json();
            setEmails(d2.emails || []);
          } catch {
            setAutoGenError('Could not generate drafts — refresh to retry');
          } finally {
            setAutoGenerating(false);
          }
        }
      })
      .catch(console.error)
      .finally(() => setEmailsLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id || activeTab !== "email") return;
    fetchEmails();
  }, [id, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id || !localDeal?.saLogged) return;
    const token = localStorage.getItem("auth_token");
    fetch(`${API}/api/deals/${id}/form-data`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setFormRecord(data.formData || null))
      .catch(console.error);
  }, [id, localDeal?.saLogged]);

  useEffect(() => {
    if (!id) return;
    setAnalysisLoading(true);
    const token = localStorage.getItem("auth_token");
    fetch(`${API}/api/deals/${id}/analysis`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { if (!data.error) setAnalysisData(data); })
      .catch(console.error)
      .finally(() => setAnalysisLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || activeTab !== 'f2flogs') return;
    setF2fLogsLoading(true);
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/api/deals/${id}/f2f-log`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setF2fLogs({ count: data.count || 0, logs: data.logs || [] }))
      .catch(console.error)
      .finally(() => setF2fLogsLoading(false));
  }, [id, activeTab]);

  const handleReengage = async (dealContext, angle) => {
    const result = await apiFetch('/api/reengage', { method: 'POST', body: JSON.stringify({ dealContext, angle }) });
    return result.draft;
  };

  if (!localDeal) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px", textAlign: "center", color: C.muted }}>
      Deal not found. <button onClick={() => navigate('/deals')} style={{ color: C.info, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Go back</button>
    </div>
  );

  const flags = localDeal.flags || [];
  const isCloseable = !['Won/Payment Received', 'Lost/Dropped'].includes(localDeal.stage);
  const isPreDemo = ['Qualified To Buy', 'Demo Call Scheduled'].includes(localDeal.stage);
  const PRE_DEMO_TABS = [
    { key: 'flags',    label: 'Flags',    count: localDeal.flags?.length || 0 },
    { key: 'activity', label: 'Activity', count: null },
  ];
  const FULL_TABS = [
    { key: 'flags',    label: 'Flags',     count: localDeal.flags?.length || 0 },
    { key: 'email',    label: 'Sequence',  count: null },
    { key: 'f2flogs',  label: 'F2F log',   count: localDeal.f2fCount || 0 },
    { key: 'activity', label: 'Activity',  count: null },
    { key: 'dealinfo', label: 'Demo info', count: null },
  ];
  const gradeColors = GRADE_COLORS?.[localDeal.grade] || { bg: C.paperDark, text: C.muted, border: C.border };
  const daysAgo = localDeal.demoDate ? Math.floor((new Date() - new Date(localDeal.demoDate)) / 86400000) : null;
  const allPains = localDeal.painPoints
    ? localDeal.painPoints.split(",").map(p => { const k = p.trim(); return PAIN_LABELS[k] || k; }).filter(Boolean)
    : [];
  const zohoUrl = `https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${localDeal.id}`;
  const hasEmails = emails.length > 0;

  const coachData = useMemo(() => {
    try {
      const raw = formRecord?.ai_analysis;
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      } else if (raw && typeof raw === 'object') {
        return raw;
      }
    } catch (e) {
      console.error('Failed to parse ai_analysis:', e);
    }
    return analysisData?.aiAnalysis || null;
  }, [formRecord, analysisData]);

  const activityItems = (() => {
    const items = [];
    if (formRecord?.created_at) {
      items.push({ icon: "✓", color: C.teal, bg: C.tealLight, desc: "Demo logged via Sales Assist", date: formRecord.created_at });
    }
    emails.forEach(e => {
      if (e.email_type === 'day2') return;
      const meta = EMAIL_META[e.email_type];
      if (e.status === 'sent' && e.sent_at) {
        items.push({ icon: "✉", color: C.teal, bg: C.tealLight, desc: `${meta?.label || e.email_type} — sent`, date: e.sent_at });
      } else if (e.created_at) {
        items.push({ icon: "✉", color: C.info, bg: C.infoLight, desc: `${meta?.label || e.email_type} — draft created`, date: e.created_at });
      }
    });
    if (localDeal.f2fCount > 0) {
      items.push({ icon: "📍", color: C.warn, bg: C.warnLight, desc: `${localDeal.f2fCount} F2F meeting${localDeal.f2fCount > 1 ? 's' : ''} logged`, date: null });
    }
    items.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
    return items;
  })();

  const btnStyle = {
    padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
    border: '1px solid var(--line-2, #e2e2e2)', background: C.white,
    color: C.ink, cursor: 'pointer', fontFamily: 'inherit',
  };
  const btnPrimaryStyle = {
    ...btnStyle,
    background: 'var(--ink)', color: '#fff',
    border: '1px solid var(--ink)', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
  };
  const btnZohoStyle = {
    ...btnStyle,
    background: C.accent, color: '#fff',
    border: `1px solid ${C.accent}`, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
  };

  return (
    <div>

      <button onClick={() => navigate(-1)} style={{ fontSize: 13, color: C.muted, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 18px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
        ← All deals
      </button>

      {/* Slim header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 20px', background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
        marginBottom: 16, flexWrap: 'wrap',
        boxShadow: '0 1px 2px rgba(29,29,29,0.04)',
      }}>
        {!isPreDemo && localDeal.grade && (
          <span style={{
            width: 36, height: 36, borderRadius: 10, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16,
            background: gradeColors.bg, color: gradeColors.text,
          }}>
            {localDeal.grade}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 20, color: C.ink, margin: 0 }}>
            {localDeal.brandName || localDeal.dealName}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {localDeal.solutionInterest} · {localDeal.orderVolume} ·{' '}
            Demo {localDeal.demoDate
              ? new Date(localDeal.demoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </div>
        </div>

        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 10px',
          borderRadius: 999, background: C.paperDark, color: C.muted,
        }}>
          {localDeal.stage}
        </span>

        {!isPreDemo && localDeal.demoFormat && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px',
            borderRadius: 999, background: C.infoLight, color: C.info,
          }}>
            {localDeal.demoFormat}
          </span>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {isPreDemo ? (
            <>
              <button onClick={() => navigate(`/form?dealId=${localDeal.id}`)} style={btnPrimaryStyle}>+ Log demo (after call)</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowF2F(true)} style={btnStyle}>+ Log F2F</button>
              <a href={`https://crmplus.zoho.com/zoho10446/index.do/cxapp/crm/eshopbox/tab/Potentials/${localDeal.id}`}
                target="_blank" rel="noreferrer"
                style={btnZohoStyle}>
                Open in Zoho →
              </a>
            </>
          )}
        </div>
      </div>

      {/* AI deal summary */}
      {!isPreDemo && (
        <div style={{
          borderLeft: '3px solid var(--info)',
          background: 'var(--info-bg)',
          borderRadius: '0 8px 8px 0',
          padding: '12px 14px',
          marginBottom: 16,
          fontSize: 12.5,
          color: C.ink,
          lineHeight: 1.5,
        }}>
          {dealSummary || localDeal.aiSummary || `${localDeal.brandName} is a ${localDeal.brandType || ''}brand · ${localDeal.solutionInterest || ''} · ${localDeal.orderVolume || ''}.`}
        </div>
      )}

      {/* Pre-demo banner */}
      {isPreDemo && (
        <div style={{ background: C.infoLight, border: `0.5px solid ${C.info}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: C.info }}>
          Demo not yet logged. Log a demo after the call to unlock scoring, email drafts, and sequence tracking.
        </div>
      )}
      {/* Post-demo — not yet in Sales Assist */}
      {!isPreDemo && !localDeal.saLogged && (
        <div style={{
          background: 'var(--warn-bg)',
          border: '1px solid var(--warn)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 8, fontSize: 13.5, color: 'var(--warn)'
          }}>
            <span>⚠️</span>
            <span>
              Demo not yet logged in Sales Assist. Email drafts
              and sequence tracking won't be available until
              the form is submitted.
            </span>
          </div>
          <button
            onClick={() => navigate(`/form?dealId=${localDeal.id}`)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--warn)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap'
            }}
          >
            + Log demo now →
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start', marginTop: 16 }}>
        <div style={{ minWidth: 0 }}>

          {/* Sequence tracker card */}
          {!isPreDemo && (
            <div style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '14px 18px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Post-demo sequence</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    All 7 tasks · {localDeal.tasks?.length || 0} active
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Anchored on demo date · {localDeal.demoDate
                    ? new Date(localDeal.demoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </div>
              </div>
              <HorizontalSequence emails={emails} deal={localDeal} />
            </div>
          )}

          {/* Tab bar */}
          <TabBar active={activeTab} onChange={setActiveTab} tabs={isPreDemo ? PRE_DEMO_TABS : FULL_TABS} />

      {/* ── Flags tab ── */}
      {activeTab === "flags" && (
        flags.length === 0 ? (
          <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "32px 16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
            No open flags · This deal is on track.
          </div>
        ) : (
          <div style={{ background: C.white, border: '1px solid var(--line)', borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
            {flags.map((flag, i) => {
              const sc = SEV_COLORS[flag.severity] || SEV_COLORS.info;
              const isFirst = i === 0, isLast = i === flags.length - 1;
              const corners = isFirst && isLast ? '8px' : isFirst ? '8px 8px 0 0' : isLast ? '0 0 8px 8px' : '0';
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "4px 1fr",
                  borderBottom: !isLast ? '1px solid var(--line)' : "none",
                  overflow: "hidden", borderRadius: corners,
                }}>
                  <div style={{ background: sc.dot }} />
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>{flag.severity.toUpperCase()}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{flag.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{flag.desc}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: "10px 16px", fontSize: 11, color: C.muted, borderTop: '1px solid var(--line)' }}>
              Flags resolve automatically when the underlying condition clears.
            </div>
          </div>
        )
      )}

      {/* ── Deal Info tab ── */}
      {activeTab === "dealinfo" && (
        <>
          <Section title="Deal info">
            <KV label="Stage" value={localDeal.stage} />
            <KV label="Pipeline" value={localDeal.pipeline} />
            <KV label="Solution interest" value={
              localDeal.solutionInterest === "both" ? "Both — full-stack"
              : localDeal.solutionInterest === "shipping" ? "Shipping only"
              : localDeal.solutionInterest === "warehousing" ? "Warehousing only"
              : localDeal.solutionInterest || null
            } />
            <KV label="Order volume" value={localDeal.orderVolume} />
            <KV label="Follow-up meeting" value={localDeal.followupMeetingDate || null} />
            <KV label="Demo date" value={localDeal.demoDate} />
            <KV label="Pricing raised" value={localDeal.pricingRaised ? "Yes" : null} />
            {formRecord && <>
              <KV label="OMS" value={formRecord.oms || null} />
              <KV label="Shopping cart" value={formRecord.shopping_cart || null} />
              <KV label="Current shipping" value={formRecord.shipping_setup || null} />
              <KV label="Current warehousing" value={formRecord.warehousing_setup || null} />
              <KV label="Brand type" value={formRecord.brand_type || null} />
              <KV label="Demo format" value={formRecord.demo_format || null} />
              <KV label="DM present" value={
                formRecord.dm_present === "yes" ? "Yes — DM was there"
                : formRecord.dm_present === "champion" ? "Champion only"
                : formRecord.dm_present === "unknown" ? "Unknown" : null
              } />
              <KV label="Engagement level" value={
                formRecord.engagement_level === "high" ? "High — asked detailed questions"
                : formRecord.engagement_level === "medium" ? "Medium — engaged but passive"
                : formRecord.engagement_level === "low" ? "Low — mostly listening" : null
              } />
              <KV label="Pain clarity" value={
                formRecord.pain_clarity === "clear" ? "Crystal clear — they named it"
                : formRecord.pain_clarity === "vague" ? "Vague — implied not stated"
                : formRecord.pain_clarity === "none" ? "Not articulated" : null
              } />
              <KV label="Budget signal" value={
                formRecord.budget_signal === "confirmed" ? "Confirmed — specific number mentioned"
                : formRecord.budget_signal === "implied" ? "Implied — likely spending"
                : formRecord.budget_signal === "none" ? "Not discussed" : null
              } />
              <KV label="Purchase timeline" value={
                formRecord.purchase_timeline === "month" ? "This month"
                : formRecord.purchase_timeline === "quarter" ? "This quarter"
                : formRecord.purchase_timeline === "6m" ? "6+ months"
                : formRecord.purchase_timeline === "unknown" ? "Unknown / exploring" : null
              } />
              <KV label="Champion strength" value={
                formRecord.champion_strength === "strong" ? "Strong — asked for internal materials"
                : formRecord.champion_strength === "weak" ? "Weak — passive supporter"
                : formRecord.champion_strength === "none" ? "None identified" : null
              } />
              <KV label="Next step" value={
                formRecord.next_step === "booked" ? "Yes — specific action agreed"
                : formRecord.next_step === "vague" ? "Vague — will follow up"
                : formRecord.next_step === "none" ? "Nothing agreed" : null
              } />
              <KV label="Urgency driver" value={formRecord.urgency_driver || null} />
              <KV label="Competitor mentioned" value={formRecord.competitor_mentioned || null} />
              <KV label="Prospect name" value={formRecord.prospect_name || null} />
              <KV label="Prospect email" value={formRecord.prospect_email || null} />
            </>}
          </Section>

          {allPains.length > 0 && (
            <Section title="Pain points">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allPains.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: C.paperDark, color: C.muted, fontWeight: 500 }}>{p}</span>
                ))}
              </div>
            </Section>
          )}

          {formRecord && (formRecord.objections || formRecord.rep_notes || formRecord.features_shown?.length > 0) && (
            <Section title="Demo notes">
              {formRecord.features_shown?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Features shown</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {formRecord.features_shown.map((f, i) => (
                      <span key={i} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: C.tealLight, color: C.teal, fontWeight: 500 }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {formRecord.objections && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Objections raised</div>
                  <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{formRecord.objections}</div>
                </div>
              )}
              {formRecord.rep_notes && (
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rep notes</div>
                  <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{formRecord.rep_notes}</div>
                </div>
              )}
            </Section>
          )}

          {localDeal.saLogged && (
            <Section title="Transcript">
              {formRecord?.transcript
                ? <TranscriptBlock text={formRecord.transcript} />
                : <div style={{ fontSize: 13, color: C.muted }}>No transcript was logged for this demo.</div>
              }
            </Section>
          )}
        </>
      )}

      {/* ── Analysis tab ── */}
      {activeTab === "analysis" && (
        <>
          {analysisLoading ? (
            <div style={{ fontSize: 13, color: C.muted, padding: "24px 0" }}>Loading analysis…</div>
          ) : (
            <>
              {coachData && (
                <Section title="Coach recommendations">
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                    <CoachCard title="Strengths" items={coachData.strengths} accentColor={C.teal} bgColor={C.tealLight} icon="✓" />
                    <CoachCard title="Risks" items={coachData.risks} accentColor={C.danger} bgColor={C.dangerLight} icon="⚠" />
                    <CoachCard title="Next meeting prep" items={coachData.nextMeeting || coachData.nextMeetingPrep} accentColor={C.info} bgColor={C.infoLight} icon="→" />
                    <CoachCard title="Rep advice" items={coachData.repAdvice} accentColor={C.accent} bgColor={C.paperDark} icon="💡" />
                  </div>
                </Section>
              )}

              {analysisData?.scoreBreakdown?.length > 0 && (
                <Section title="Score breakdown">
                  {analysisData.scoreBreakdown.map((item) => (
                    <ScoreRow
                      key={item.category}
                      item={item}
                      expanded={expandedScore === item.category}
                      onToggle={() => setExpandedScore(expandedScore === item.category ? null : item.category)}
                    />
                  ))}
                </Section>
              )}

              {!analysisData && (
                <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "24px 16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
                  No analysis available for this deal yet.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Sequence tab ── */}
      {activeTab === "email" && (
        <>
          <MergedSequenceView
            emails={emails}
            dealId={localDeal.id}
            deal={localDeal}
            emailsLoading={emailsLoading}
            hasEmails={hasEmails}
            autoGenerating={autoGenerating}
            autoGenError={autoGenError}
            prospectEmail={formRecord?.prospect_email}
            repEmail={user?.email}
            fetchEmails={fetchEmails}
            onLogDemo={() => navigate(`/form?dealId=${localDeal.id}`)}
          />
          <ReEngagementGenerator deal={localDeal} dealId={localDeal.id} onReengage={handleReengage} />
          {localDeal.lostReason && (
            <Section title="Lost reason">
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>{localDeal.lostReason}</p>
            </Section>
          )}
        </>
      )}

      {/* ── F2F log tab ── */}
      {activeTab === "f2flogs" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>F2F meetings · {f2fLogs.count}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {f2fLogs.count > 0 ? `+${f2fLogs.count * 2}–${f2fLogs.count * 3} pts from in-person visits` : 'No in-person meetings logged yet.'}
              </div>
            </div>
          </div>
          {f2fLogsLoading ? (
            <div style={{ fontSize: 13, color: C.muted, padding: "16px 0" }}>Loading…</div>
          ) : f2fLogs.logs.length > 0 ? (
            f2fLogs.logs.map((log, i) => (
              <div key={i} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                    {new Date(log.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, background: log.location === 'warehouse' ? C.tealLight : C.infoLight, color: log.location === 'warehouse' ? C.teal : C.info }}>
                    {log.location === 'warehouse' ? 'Eshopbox warehouse +3 pts' : 'In-person +2 pts'}
                  </span>
                </div>
                {log.attendees && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Attendees: {log.attendees}</div>}
                {log.notes && <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{log.notes}</div>}
              </div>
            ))
          ) : f2fLogs.count > 0 ? (
            <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "20px 16px", fontSize: 13, color: C.muted }}>
              {f2fLogs.count} F2F meeting{f2fLogs.count > 1 ? 's' : ''} logged in Zoho. Detailed log entries not available for meetings before structured storage was enabled.
            </div>
          ) : (
            <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "32px 16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
              No in-person meetings logged yet. Use "Log F2F meeting" to record a visit.
            </div>
          )}
        </>
      )}

      {/* ── Activity tab ── */}
      {activeTab === "activity" && (
        activityItems.length === 0 ? (
          <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "32px 16px", fontSize: 13, color: C.muted, textAlign: "center" }}>
            No activity logged yet.
          </div>
        ) : (
          <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {activityItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderBottom: i < activityItems.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: item.color, flexShrink: 0, fontWeight: 700 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{item.desc}</div>
                  {item.date && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

        </div> {/* end main column */}

        {/* Right sidebar — post-demo only */}
        {!isPreDemo && !isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16 }}>

            {/* Deal Grade card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(29,29,29,0.04)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px 10px', borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Deal grade</h4>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13,
                  background: gradeColors.bg, color: gradeColors.text,
                }}>{localDeal.grade}</span>
              </div>
              <div style={{ padding: '12px 16px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {localDeal.score}
                  <span style={{ fontSize: 14, fontWeight: 400, color: C.muted }}> / 22</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {localDeal.grade === 'A' ? 'Strong fit · 55–70% close probability' :
                   localDeal.grade === 'B' ? 'Qualified · 30–50% close probability' :
                   localDeal.grade === 'C' ? 'Uncertain · 10–25% close probability' :
                   'Weak fit · <10% close probability'}
                </div>
              </div>
              <div style={{ padding: '12px 16px 14px' }}>
                {[
                  { label: 'Pain clarity', val: formRecord?.pain_clarity === 'clear' ? 3 : formRecord?.pain_clarity === 'vague' ? 1 : 0, max: 3 },
                  { label: 'DM present', val: formRecord?.dm_present === 'yes' ? 3 : formRecord?.dm_present === 'champion' ? 1 : 0, max: 3 },
                  { label: 'Budget signal', val: formRecord?.budget_signal === 'confirmed' ? 2 : formRecord?.budget_signal === 'implied' ? 1 : 0, max: 2 },
                  { label: 'Purchase timeline', val: formRecord?.purchase_timeline === 'month' ? 3 : formRecord?.purchase_timeline === 'quarter' ? 2 : formRecord?.purchase_timeline === '6m' ? 1 : 0, max: 3 },
                  { label: 'Engagement', val: formRecord?.engagement_level === 'high' ? 2 : formRecord?.engagement_level === 'medium' ? 1 : 0, max: 2 },
                  { label: 'Procurement / Champion', val: formRecord?.champion_strength === 'strong' ? 2 : formRecord?.champion_strength === 'weak' ? 1 : 0, max: 2 },
                  { label: 'Next step booked', val: formRecord?.next_step === 'booked' ? 2 : formRecord?.next_step === 'vague' ? 1 : 0, max: 2 },
                  { label: 'In-person meeting', val: formRecord?.demo_format === 'inperson' ? 2 : 0, max: 2 },
                  { label: 'Warehouse visit', val: formRecord?.meeting_location === 'warehouse' ? 3 : 0, max: 3 },
                ].map(({ label, val, max }) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 0', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right', color: C.muted }}>{val}/{max}</span>
                    <div style={{ gridColumn: '1 / 3', height: 5, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${(val / max) * 100}%`,
                        background: val === max ? 'var(--ok)' : val > 0 ? 'var(--info)' : 'transparent',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Recommendations card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(29,29,29,0.04)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)' }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Coach recommendations</h4>
              </div>
              <div style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {coachData ? (
                  [
                    { key: 'strengths',   header: '✓ STRENGTHS',        panelBg: 'var(--ok-bg)',     panelBorder: 'rgba(15,110,86,0.18)',  color: 'var(--ok)' },
                    { key: 'risks',       header: '△ RISKS',             panelBg: 'var(--danger-bg)', panelBorder: 'rgba(153,31,31,0.15)', color: 'var(--danger)' },
                    { key: 'nextMeeting', header: '→ NEXT MEETING PREP', panelBg: 'var(--info-bg)',   panelBorder: 'rgba(24,95,165,0.15)', color: 'var(--info)' },
                    { key: 'repAdvice',   header: '! REP ADVICE',        panelBg: 'var(--warn-bg)',   panelBorder: 'rgba(133,79,11,0.15)', color: 'var(--warn)' },
                  ].map(({ key, header, panelBg, panelBorder, color }) => {
                    const items = coachData[key] || coachData[key === 'nextMeeting' ? 'nextMeetingPrep' : key] || [];
                    if (!items.length) return null;
                    return (
                      <div key={key} style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color, marginBottom: 8 }}>{header}</div>
                        {items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: i < items.length - 1 ? 6 : 0 }}>
                            <span style={{ color, flexShrink: 0, fontSize: 10, marginTop: 3 }}>•</span>
                            <span style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>AI analysis generated at demo form submission.</div>
                )}
              </div>
            </div>

            {/* Owner card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(29,29,29,0.04)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)' }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Owner</h4>
              </div>
              <div style={{ padding: '12px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.paperDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                  {(localDeal.repName || '').split(' ').map(w => w[0]).slice(0, 2).join('') || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{localDeal.repName || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Sales Rep</div>
                </div>
              </div>
            </div>

            {/* Prospect card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(29,29,29,0.04)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)' }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Prospect</h4>
              </div>
              <div style={{ padding: '0 16px 14px' }}>
                {[
                  { k: 'Name',  v: formRecord?.prospect_name || localDeal.contactName || localDeal.prospectName || '—' },
                  { k: 'Email', v: formRecord?.prospect_email || localDeal.contactEmail || localDeal.prospectEmail || '—' },
                ].map(({ k, v }, i, arr) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '7px 0', fontSize: 13, borderBottom: i < arr.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                    <span style={{ color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: C.ink, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%', fontSize: k === 'Email' ? 11.5 : 13 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zoho card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(29,29,29,0.04)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)' }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Zoho</h4>
              </div>
              <div style={{ padding: '0 16px 14px' }}>
                {[
                  { k: 'Deal ID',   v: localDeal.id ? String(localDeal.id).slice(0, 10) + '…' : '—' },
                  { k: 'Stage',     v: localDeal.stage || '—' },
                  { k: 'SA logged', v: localDeal.saLogged ? '✓ Yes' : 'Not yet' },
                ].map(({ k, v }, i, arr) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '7px 0', fontSize: 13, borderBottom: i < arr.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                    <span style={{ color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: C.ink, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%' }}>{v}</span>
                  </div>
                ))}
                <a href={zohoUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: 10, fontSize: 12.5, color: 'var(--info)', fontWeight: 600, textDecoration: 'none' }}>
                  Open in Zoho →
                </a>
              </div>
            </div>

          </div>
        )}

      </div> {/* end two-column flex */}

      {showF2F && (
        <F2FModal
          dealId={localDeal.id}
          onSuccess={msg => { setShowF2F(false); showToast(msg); fetchDeals(); }}
          onClose={() => setShowF2F(false)}
        />
      )}
      {showClose && (
        <CloseModal
          dealId={localDeal.id}
          onSuccess={msg => { setShowClose(false); showToast(msg); setTimeout(() => navigate('/deals'), 1500); }}
          onClose={() => setShowClose(false)}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

    </div>
  );
}
