import { useState, useEffect } from "react";
import { C } from "../components/ui";
import { useAppContext } from "../AppContext";
import { apiFetch } from "../api.js";

const ROLES = ["Admin", "Manager", "Sales Lead Mid-Market", "Sales Lead Enterprise", "Sales rep"];
const ROLE_DESC = {
  "Admin": "Full access. Can invite team members, assign roles, and see all settings.",
  "Manager": "Can see all deals across the team, manager overview, rep performance, and log demos.",
  "Sales Lead Mid-Market": "Manages the mid-market team. Sees all Shipping deals across the team.",
  "Sales Lead Enterprise": "Manages the enterprise team. Sees all Warehousing and Full-stack deals across the team.",
  "Sales rep": "Can only see their own deals, their own overview, and log new demos.",
};

const ROLE_COLORS = {
  "Admin":                  { bg: 'var(--danger-bg)',  text: 'var(--danger)'  },
  "Manager":                { bg: 'var(--warn-bg)',    text: 'var(--warn)'    },
  "Sales Lead Mid-Market":  { bg: 'var(--warn-bg)',    text: 'var(--warn)'    },
  "Sales Lead Enterprise":  { bg: 'var(--purple-bg)',  text: 'var(--purple)'  },
  "Sales rep":              { bg: 'var(--info-bg)',    text: 'var(--info)'    },
};

function RolePill({ role }) {
  const c = ROLE_COLORS[role] || { bg: 'var(--surface-2)', text: 'var(--ink-3)' };
  return (
    <span style={{ fontSize: '13px', padding: '4px 12px', borderRadius: 999, fontWeight: 600, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
      {role}
    </span>
  );
}

function SeverityPill({ severity }) {
  const cfg = {
    critical: { bg: 'var(--danger-bg)', text: 'var(--danger)' },
    warning:  { bg: 'var(--warn-bg)',   text: 'var(--warn)'   },
    info:     { bg: 'var(--info-bg)',   text: 'var(--info)'   },
  };
  const c = cfg[severity] || cfg.info;
  return (
    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
      {severity}
    </span>
  );
}

function Avatar({ name, size = 40 }) {
  const safeName = name || "?";
  const initials = safeName.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const colors = ["#0B6B5A", "#1A5FA0", "#E8440A", "#534AB7", "#B05C00"];
  const color = colors[safeName.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color + "20", border: `1.5px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, color, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function InviteModal({ onClose, onInvite, isManager = false }) {
  const { user: currentUser } = useAppContext();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales rep");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const handle = async () => {
    if (!email.includes("@")) { setErr("Enter a valid email address."); return; }
    if (!email.endsWith("@eshopbox.com")) { setErr("Only @eshopbox.com email addresses are allowed."); return; }
    if (!name.trim()) { setErr("Enter the person's name."); return; }
    setErr("");
    setLoading(true);
    try {
      const result = await onInvite(email.trim(), role);
      if (result?.error) { setErr(result.error); setLoading(false); return; }
      if (result?.inviteLink) {
        setInviteLink(result.inviteLink);
        const subject = encodeURIComponent("You're invited to Eshopbox Sales Assist");
        const body = encodeURIComponent(
`Hi,

You've been invited to join Eshopbox Sales Assist as a ${role}.

Sales Assist helps you track deals, log demos, generate AI-powered follow-up emails, and close more deals — all in one place.

Click the link below to set up your account:

${result.inviteLink}

This link expires in 7 days.

If you have any questions, just reply to this email.

Welcome to the team!
${currentUser?.name || 'The Eshopbox team'}`
        );
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.trim())}&su=${subject}&body=${body}`, '_blank');
      }
      setSent(true);
    } catch (err) {
      setErr(err.message || "Failed to send invite. Try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.white, borderRadius: 14, padding: "28px 28px 24px", width: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        {!sent ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Invite team member</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Must be an @eshopbox.com email address.</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Full name <span style={{ color: C.accent }}>*</span></div>
              <input value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="e.g. Rohit Sharma"
                style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Work email <span style={{ color: C.accent }}>*</span></div>
              <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="e.g. rohit@eshopbox.com" type="email"
                style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: C.ink, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Role <span style={{ color: C.accent }}>*</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ROLES.filter(r => isManager ? r !== "Admin" : true).map(r => (
                  <label key={r} onClick={() => setRole(r)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${role === r ? C.accent : C.border}`, background: role === r ? C.accentLight : C.white, cursor: "pointer" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${role === r ? C.accent : C.border}`, background: role === r ? C.accent : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {role === r && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.white }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 1 }}>{r}</div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{ROLE_DESC[r]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {err && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10, padding: "8px 12px", background: C.dangerLight, borderRadius: 7 }}>{err}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 13, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handle} disabled={loading} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: loading ? C.border : C.accent, fontSize: 13, fontWeight: 700, color: C.white, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {loading ? "Sending…" : "Send invite"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13L9 17L19 7" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Invite created! ✓</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              Gmail has opened with the invite email ready to send. Review and click Send.
            </div>
            {inviteLink && (
              <div style={{ textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Invite link (backup)</div>
                <div style={{ background: C.paperDark, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.ink, wordBreak: "break-all", marginBottom: 8 }}>
                  {inviteLink}
                </div>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink); alert("✓ Invite link copied to clipboard!"); }}
                  style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%" }}>
                  Copy invite link
                </button>
              </div>
            )}
            <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.teal, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeRoleModal({ member, onClose, onSave }) {
  const [role, setRole] = useState(member.role);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.white, borderRadius: 14, padding: "24px 24px 20px", width: 380 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Change role</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>{member.name} · {member.email}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
          {ROLES.map(r => (
            <label key={r} onClick={() => setRole(r)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${role === r ? C.accent : C.border}`, background: role === r ? C.accentLight : C.white, cursor: "pointer" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${role === r ? C.accent : C.border}`, background: role === r ? C.accent : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {role === r && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.white }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{r}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{ROLE_DESC[r]}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 13, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onSave(member.id, role)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: C.accent, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>Save change</button>
        </div>
      </div>
    </div>
  );
}

const API = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";
const SETTINGS_TABS = ["Team", "Sequence", "Zoho sync", "Rules engine", "Account"];

export default function Settings() {
  const { user: currentUser, scopedDeals } = useAppContext();
  const currentUserRole = currentUser?.role || "Admin";
  const onInvite = (email, role) => apiFetch('/auth/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
  const [activeTab, setActiveTab] = useState(currentUserRole === "Admin" || currentUserRole === "Manager" ? "Team" : "Account");
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [resendResult, setResendResult] = useState(null);
  const [zohoConnected, setZohoConnected] = useState(null);
  const [zohoConnecting, setZohoConnecting] = useState(false);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [togglingRule, setTogglingRule] = useState(null);
  const [savedThresholdId, setSavedThresholdId] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [seqSaveStatus, setSeqSaveStatus] = useState({});
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [backfillError, setBackfillError] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailToast, setGmailToast] = useState(null);

  const isAdmin = currentUserRole === "Admin";
  const isManager = currentUserRole === "Manager";

  const fetchTeam = async () => {
    setLoadingTeam(true);
    const token = localStorage.getItem("auth_token");
    if (!token) { setLoadingTeam(false); return; }
    try {
      const data = await fetch(`${API}/auth/team`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      setMembers(data.users || []);
      setPendingInvites(data.pendingInvites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Load real team from backend
  useEffect(() => { fetchTeam(); }, []);

  useEffect(() => {
    if (activeTab === 'Team') fetchTeam();
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch(`${API}/auth/zoho/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setZohoConnected(data.connected ?? false))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch(`${API}/api/auth/gmail-status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setGmailConnected(data.connected ?? false))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true);
      setGmailToast('Gmail connected successfully');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setGmailToast(null), 4000);
    }
  }, []);

  const handleGmailConnect = async () => {
    setGmailConnecting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const data = await fetch(`${API}/auth/gmail`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      if (data.url) window.open(data.url, '_self');
    } catch {
      setGmailConnecting(false);
    }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const data = await apiFetch('/api/settings/rules');
      setRules(data.rules || []);
    } catch {
      setRulesError("Could not load rules");
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchRules();
  }, []);

  const fetchSequence = async () => {
    setSequenceLoading(true);
    try {
      const data = await apiFetch('/api/settings/sequence');
      setSequence(data.sequence || []);
    } catch {
      // silent fail
    } finally {
      setSequenceLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'Sequence' && sequence.length === 0) fetchSequence();
  }, [activeTab]);

  const handleSeqDaysSave = async (step, newDays) => {
    const val = parseInt(newDays, 10);
    if (isNaN(val) || val < 1) return;
    setSeqSaveStatus(prev => ({ ...prev, [step.id]: 'saving' }));
    try {
      await apiFetch(`/api/settings/sequence/${step.id}`, {
        method: 'PUT',
        body: JSON.stringify({ days: val }),
      });
      setSequence(prev => prev.map(s => s.id === step.id ? { ...s, days: val } : s));
      setSeqSaveStatus(prev => ({ ...prev, [step.id]: 'saved' }));
      setTimeout(() => setSeqSaveStatus(prev => ({ ...prev, [step.id]: null })), 2000);
    } catch {
      setSeqSaveStatus(prev => ({ ...prev, [step.id]: 'error' }));
      setTimeout(() => setSeqSaveStatus(prev => ({ ...prev, [step.id]: null })), 3000);
    }
  };

  const handleThresholdSave = async (rule, newVal) => {
    const val = parseInt(newVal, 10);
    if (isNaN(val) || val < 1) return;
    setSavedThresholdId(rule.id);
    try {
      await apiFetch(`/api/settings/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ threshold: val }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, threshold: val } : r));
      setTimeout(() => setSavedThresholdId(null), 2000);
    } catch {
      setSavedThresholdId(null);
    }
  };

  const handleToggleRule = async (rule) => {
    setTogglingRule(rule.id);
    try {
      await apiFetch(`/api/settings/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !rule.active }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
    } catch {
      // silent fail
    } finally {
      setTogglingRule(null);
    }
  };

  const handleBackfill = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    setBackfillError(null);
    try {
      const data = await apiFetch('/api/admin/backfill-tasks', { method: 'POST' });
      if (data.success) {
        setBackfillResult(`✓ Done — ${data.tasksCreated} task${data.tasksCreated !== 1 ? 's' : ''} created across ${data.dealsProcessed} deals`);
      } else {
        setBackfillError(data.error || 'Backfill failed.');
      }
    } catch (e) {
      setBackfillError(e.message || 'Backfill failed.');
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleZohoConnect = async () => {
    setZohoConnecting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const config = await fetch(`${API}/auth/zoho/config`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      const scope = "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.send_mail.all.CREATE,ZohoCRM.modules.emails.ALL,Aaaserver.profile.Read";
      const url = `https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(scope)}&client_id=${config.clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(config.redirectUri)}`;
      window.location.href = url;
    } catch {
      setZohoConnecting(false);
    }
  };

  const handleInvite = async (email, role) => {
    const result = await onInvite(email, role);
    if (!result?.error) fetchTeam();
    return result;
  };

  const handleRoleChange = async (id, newRole) => {
    const token = localStorage.getItem("auth_token");
    await fetch(`${API}/auth/team/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole })
    });
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role: newRole } : m));
    setChangingRole(null);
  };

const handleRemove = async (id) => {
  const token = localStorage.getItem("auth_token");
  await fetch(`${API}/auth/team/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  setRemovingId(null);
  fetchTeam();
};

const handleReactivate = async (id) => {
  const token = localStorage.getItem("auth_token");
  await fetch(`${API}/auth/team/${id}/reactivate`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });
  fetchTeam();
};

const handleResend = async (member) => {
  try {
    const token = localStorage.getItem("auth_token");
    const result = await fetch(`${API}/auth/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: member.email, role: member.role }),
    }).then(r => r.json());

    if (result.inviteLink) {
      setResendResult({
        email: member.email,
        role: member.role,
        inviteLink: result.inviteLink,
        name: member.name || member.email.split("@")[0]
      });
      fetchTeam();
    } else {
      alert(result.error || "Failed to resend invite.");
    }
  } catch {
    alert("Failed to resend invite. Try again.");
  }
};

  const activeMembers = members.filter(m => m.is_active !== 0);
  const deactivatedMembers = members.filter(m => m.is_active === 0);

  // Combine active members + pending invites into one list
  const allMembers = [
    ...activeMembers.map(m => ({ ...m, status: "active" })),
    ...pendingInvites.map(i => ({ id: i.id, name: i.email.split("@")[0], email: i.email, role: i.role, status: "invited" })),
  ];

  const removingTarget = removingId ? allMembers.find(m => m.id === removingId) : null;

  const dealCountByEmail = {};
  (scopedDeals || []).forEach(d => {
    if (d.repEmail) dealCountByEmail[d.repEmail] = (dealCountByEmail[d.repEmail] || 0) + 1;
  });

  return (
    <div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: "0 0 4px", letterSpacing: "-0.02em" }}>{currentUserRole === "Admin" ? "Settings" : currentUserRole === "Manager" ? "Team settings" : "Account settings"}</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Manage your team, sequences, and integrations.</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 28, flexWrap: 'wrap' }}>
        {(currentUserRole === "Admin" ? SETTINGS_TABS : currentUserRole === "Manager" ? ["Team", "Account"] : ["Account"]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--ink-2)'; }}
            onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = 'var(--ink-3)'; }}
            style={{ padding: '12px 18px', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--brand)' : '2px solid transparent', background: 'transparent', fontSize: '15px', fontWeight: 500, color: activeTab === tab ? 'var(--ink)' : 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1, transition: 'all 0.12s ease' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Team tab */}
      {activeTab === "Team" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Team members</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{allMembers.length} member{allMembers.length !== 1 ? "s" : ""}</div>
            </div>
            {(isAdmin || isManager) && (
              <button onClick={() => setShowInvite(true)}
                style={{ padding: "8px 18px", borderRadius: 'var(--radius-sm)', border: "none", background: 'var(--brand)', fontSize: 13, fontWeight: 600, color: '#fff', cursor: "pointer", fontFamily: "inherit" }}>
                + Invite member
              </button>
            )}
          </div>

          {/* Role legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {ROLES.map(r => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <RolePill role={r} />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{ROLE_DESC[r]}</span>
              </div>
            ))}
          </div>

          {loadingTeam ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: "20px 0" }}>Loading team…</div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 40, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Member</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80, textAlign: 'right', flexShrink: 0 }}>Deals</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 120, textAlign: 'center', flexShrink: 0 }}>Role</span>
                <div style={{ width: 200, flexShrink: 0 }} />
              </div>
              {allMembers.map((member, mi) => (
                <div key={member.id} style={{ padding: '18px 20px', fontSize: '13.5px', display: "flex", alignItems: "center", gap: 12, borderBottom: mi < allMembers.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <Avatar name={member.name || member.email} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{member.name || member.email.split("@")[0]}</span>
                      {member.status === "invited" && (
                        <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: 'var(--warn-bg)', color: 'var(--warn)', fontWeight: 500 }}>Invite pending</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                      {member.email}
                      {member.created_at && ` · Joined ${new Date(member.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                    </div>
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
                    {dealCountByEmail[member.email] || 0}
                  </div>
                  <div style={{ width: 120, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <RolePill role={member.role} />
                  </div>
                  <div style={{ width: 200, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {member.email !== currentUser?.email && (isAdmin || (isManager && member.status === "invited")) && (
                      <>
                        {isAdmin && (
                          <button onClick={() => setChangingRole(member)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'transparent'; }}
                            style={{ fontSize: 13, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-2)', cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                            Change role
                          </button>
                        )}
                        {member.status === "invited" && (
                          <button onClick={() => handleResend(member)}
                            style={{ fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--info)', cursor: "pointer", fontFamily: "inherit" }}>
                            Resend
                          </button>
                        )}
                        <button onClick={() => setRemovingId(member.id)}
                          style={{ fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: "pointer", fontFamily: "inherit" }}>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {deactivatedMembers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Deactivated</div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
                {deactivatedMembers.map((member, mi) => (
                  <div key={member.id} style={{ padding: '14px 16px', display: "flex", alignItems: "center", gap: 12, opacity: 0.6, borderBottom: mi < deactivatedMembers.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <Avatar name={member.name || member.email} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{member.name || member.email.split("@")[0]}</span>
                        <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: 'var(--surface-2)', color: 'var(--ink-3)', fontWeight: 500 }}>Deactivated</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{member.email}</div>
                    </div>
                    <RolePill role={member.role} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sequence tab */}
      {activeTab === "Sequence" && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Follow-up sequence settings</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>Configure the timing of automated emails in the post-demo sequence. Editable steps accept a day offset.</div>
          {sequenceLoading ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: "20px 0" }}>Loading sequence…</div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", padding: "10px 16px", background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em" }}>Step</span>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Day offset</span>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Mode</span>
              </div>
              {sequence.map((step, i) => (
                <div key={step.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", padding: "14px 16px", borderBottom: i < sequence.length - 1 ? '1px solid var(--line)' : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{step.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{step.desc}</div>
                  </div>
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {step.editable ? (
                      <>
                        <input
                          key={step.days}
                          type="number"
                          defaultValue={step.days}
                          min={1}
                          style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: '12.5px', fontFamily: "inherit", textAlign: "center" }}
                          onBlur={e => handleSeqDaysSave(step, e.target.value)}
                        />
                        {seqSaveStatus[step.id] === 'saving' && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>saving…</span>}
                        {seqSaveStatus[step.id] === 'saved' && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>Saved ✓</span>}
                        {seqSaveStatus[step.id] === 'error' && <span style={{ fontSize: 11, color: 'var(--danger)' }}>Error</span>}
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>—</span>
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {step.mode === 'auto'
                      ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info)', fontWeight: 500 }}>Auto</span>
                      : <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--ink-2)', fontWeight: 500 }}>Manual</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zoho sync tab */}
      {activeTab === "Zoho sync" && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Zoho CRM integration</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>Manage your personal Zoho connection and view the organisation-level CRM sync status.</div>

          {/* Personal Zoho connection */}
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Your personal Zoho connection</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Required to send emails from your Zoho account. Connect once — stays active across sessions.</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: "16px", marginBottom: 20, boxShadow: 'var(--shadow-1)' }}>
            {zohoConnected === null ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Checking connection…</div>
            ) : zohoConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: 'var(--ok-bg)', color: 'var(--ok)', fontWeight: 600 }}>✓ Zoho connected</span>
                <button onClick={handleZohoConnect} disabled={zohoConnecting}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)', background: "transparent", color: 'var(--ink-3)', cursor: zohoConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {zohoConnecting ? "Redirecting…" : "Reconnect"}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-bg)', borderRadius: 'var(--radius-sm)', padding: "10px 14px", fontSize: 12, color: 'var(--warn)', marginBottom: 12 }}>
                  ⚠ Your Zoho account is not connected. Connect it to send emails from your Zoho account.
                </div>
                <button onClick={handleZohoConnect} disabled={zohoConnecting}
                  style={{ padding: "8px 16px", borderRadius: 'var(--radius-sm)', border: "none", background: zohoConnecting ? 'var(--line)' : 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: zohoConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {zohoConnecting ? "Redirecting…" : "Connect Zoho →"}
                </button>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', marginBottom: 20 }} />
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Organisation connection</div>

          <div style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-bg)', borderRadius: 'var(--radius-md)', padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)', marginBottom: 4 }}>✓ Backend connected</div>
            <div style={{ fontSize: 12, color: 'var(--ok)' }}>Zoho CRM is connected and syncing live data. Deals, tasks and activities are fetched in real time.</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)', marginBottom: 16 }}>
            {[
              { label: "Data Centre", value: "Global (.com)" },
              { label: "API Base URL", value: "https://www.zohoapis.com/crm/v2" },
              { label: "Pipelines", value: "Ship, SME 2.0, Enterprise 2.0" },
              { label: "Deals from", value: "Jan 1, 2026 onwards" },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', fontSize: '13.5px' }}>
                <span style={{ color: 'var(--ink-3)' }}>{row.label}</span>
                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {isAdmin && (
            <>
              <div style={{ borderTop: '1px solid var(--line)', margin: "24px 0 20px" }} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Sequence task backfill</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
                Create missing Day 1, Day 3, Day 4 Zoho tasks for deals that were logged before these tasks were added. Safe to run multiple times — skips deals that already have all 7 tasks.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={handleBackfill}
                  disabled={backfillLoading}
                  style={{ padding: "8px 16px", borderRadius: 'var(--radius-sm)', border: "none", background: backfillLoading ? 'var(--line)' : 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: backfillLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {backfillLoading ? "Running…" : "Run backfill →"}
                </button>
                {backfillResult && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)' }}>{backfillResult}</span>
                )}
                {backfillError && (
                  <span style={{ fontSize: 13, color: 'var(--danger)' }}>{backfillError}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rules engine tab */}
      {activeTab === "Rules engine" && isAdmin && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Rules engine</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>Configure which attention rules are active. Inactive rules won't generate flags for deals.</div>
          {rulesLoading ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: "20px 0" }}>Loading rules…</div>
          ) : rulesError ? (
            <div>
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10, padding: "10px 14px", background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>{rulesError}</div>
              <button onClick={fetchRules} style={{ padding: "7px 16px", borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', background: "transparent", fontSize: 13, color: 'var(--ink-3)', cursor: "pointer", fontFamily: "inherit" }}>
                Retry
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, padding: "10px 16px", background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em" }}>Rule</span>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Severity</span>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--ink-3)', textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Active</span>
              </div>
              {rules.map((rule, i) => (
                <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < rules.length - 1 ? '1px solid var(--line)' : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{rule.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{rule.desc}</div>
                    {rule.threshold !== null && rule.threshold !== undefined && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          key={rule.threshold}
                          type="number"
                          defaultValue={rule.threshold}
                          min={1}
                          style={{ width: 50, padding: "3px 7px", borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 12, fontFamily: "inherit" }}
                          onBlur={e => handleThresholdSave(rule, e.target.value)}
                        />
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>days</span>
                        {savedThresholdId === rule.id && (
                          <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>Saved ✓</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <SeverityPill severity={rule.severity} />
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleRule(rule)}
                      disabled={togglingRule === rule.id}
                      style={{
                        fontSize: 12, padding: '2px 10px', borderRadius: 999, fontWeight: 600,
                        background: rule.active ? 'var(--ok-bg)' : 'var(--surface-2)',
                        color: rule.active ? 'var(--ok)' : 'var(--ink-3)',
                        border: "none", cursor: togglingRule === rule.id ? "not-allowed" : "pointer",
                        fontFamily: "inherit", opacity: togglingRule === rule.id ? 0.6 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {togglingRule === rule.id ? "…" : rule.active ? "On" : "Off"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Account tab */}
      {activeTab === "Account" && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Account settings</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: "hidden", marginBottom: 20, boxShadow: 'var(--shadow-1)' }}>
            {[
              { label: "App name", value: "Eshopbox Sales Assist" },
              { label: "Your name", value: currentUser?.name || "—" },
              { label: "Your email", value: currentUser?.email || "—" },
              { label: "Your role", value: currentUser?.role || "—" },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : "none" }}>
                <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Zoho connection — only for non-admin roles */}
          {currentUserRole !== "Admin" && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: "16px", boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Zoho connection</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>Connect your personal Zoho account to create email drafts directly in Zoho CRM.</div>
            {zohoConnected === null ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Checking connection…</div>
            ) : zohoConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: 'var(--ok-bg)', color: 'var(--ok)', fontWeight: 600 }}>✓ Zoho connected</span>
                <button onClick={handleZohoConnect} disabled={zohoConnecting}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)', background: "transparent", color: 'var(--ink-3)', cursor: zohoConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {zohoConnecting ? "Redirecting…" : "Reconnect"}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-sm)', padding: "10px 14px", fontSize: 12, color: 'var(--warn)', marginBottom: 12 }}>
                  ⚠ Your Zoho account is not connected. Connect it to send emails from your Zoho account.
                </div>
                <button onClick={handleZohoConnect} disabled={zohoConnecting}
                  style={{ padding: "8px 16px", borderRadius: 'var(--radius-sm)', border: "none", background: zohoConnecting ? 'var(--line)' : 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: zohoConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {zohoConnecting ? "Redirecting…" : "Connect Zoho →"}
                </button>
              </div>
            )}
          </div>
          )}

          {/* Gmail connection — all roles */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: "16px", marginTop: 16, boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Gmail connection</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>Connect your Gmail account to send follow-up emails directly from Sales Assist.</div>
            {gmailConnected === null ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Checking connection…</div>
            ) : gmailConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: 'var(--ok-bg)', color: 'var(--ok)', fontWeight: 600 }}>✓ Gmail connected</span>
                <button onClick={handleGmailConnect} disabled={gmailConnecting}
                  style={{ fontSize: 12, padding: "4px 10px", borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)', background: "transparent", color: 'var(--ink-3)', cursor: gmailConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {gmailConnecting ? "Redirecting…" : "Reconnect"}
                </button>
              </div>
            ) : (
              <button onClick={handleGmailConnect} disabled={gmailConnecting}
                style={{ padding: "8px 16px", borderRadius: 'var(--radius-sm)', border: "none", background: gmailConnecting ? 'var(--line)' : "#EA4335", color: "#fff", fontSize: 13, fontWeight: 600, cursor: gmailConnecting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {gmailConnecting ? "Redirecting…" : "Connect Gmail →"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Gmail success toast */}
      {gmailToast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0B6B5A", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 300, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          ✓ {gmailToast}
        </div>
      )}

      {/* Modals */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} isManager={isManager} />}
      {changingRole && <ChangeRoleModal member={changingRole} onClose={() => setChangingRole(null)} onSave={handleRoleChange} />}
      {resendResult && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: C.white, borderRadius: 14, padding: "28px 28px 24px", width: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13L9 17L19 7" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 6 }}>New invite link generated!</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
          Share this link with <strong>{resendResult.name}</strong> to join as <strong>{resendResult.role}</strong>.<br/>
          <span style={{ fontSize: 12 }}>(Email sending not set up yet — share manually)</span>
        </div>
        <div style={{ background: C.paperDark, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.ink, wordBreak: "break-all", textAlign: "left", marginBottom: 10 }}>
          {resendResult.inviteLink}
        </div>
        <>
          <button onClick={() => {
            navigator.clipboard.writeText(resendResult.inviteLink);
            alert("✓ Invite link copied to clipboard!");
          }}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, display: "block", width: "100%" }}>
            Copy invite link
          </button>
          <button onClick={() => {
            const to = encodeURIComponent(resendResult.email);
            const subject = encodeURIComponent("You've been invited to Eshopbox Sales Assist");
            const body = encodeURIComponent(`Hi ${resendResult.name},\n\nYou've been invited to join Eshopbox Sales Assist as ${resendResult.role}.\n\nClick the link below to set up your account:\n\n${resendResult.inviteLink}\n\nThis link expires in 7 days.\n\nWelcome aboard!\nEshopbox Sales Team`);
            window.open(`https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`, "_blank");
          }}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: C.accent, fontSize: 12, color: C.white, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, display: "block", width: "100%" }}>
            Send via Gmail →
          </button>
        </>
        <button onClick={() => setResendResult(null)} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.teal, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
      </div>
    </div>
  </div>
)}

      {removingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 12, padding: "24px", width: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
              {removingTarget?.status === "invited" ? "Cancel pending invite?" : "Remove team member?"}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              {removingTarget?.status === "invited"
                ? `Cancel the pending invite for ${removingTarget?.email}?`
                : `Remove ${removingTarget?.name}? They will lose access immediately.`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRemovingId(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "transparent", fontSize: 13, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => handleRemove(removingId)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: C.danger, fontSize: 13, fontWeight: 700, color: C.white, cursor: "pointer", fontFamily: "inherit" }}>
                {removingTarget?.status === "invited" ? "Cancel invite" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}