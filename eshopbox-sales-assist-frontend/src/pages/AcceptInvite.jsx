import { useState, useEffect } from "react";

const API_BASE = "https://eshopbox-sales-assist-backend.satyanarayan-sahoo.workers.dev";

export default function AcceptInvite({ onLogin }) {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedUser, setAcceptedUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) { setInvalidToken(true); return; }
    setToken(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Please enter your full name."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Invalid or expired invite link."); return; }
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setAcceptedUser(data.user);
      setAccepted(true);
      setTimeout(() => {
        window.location.replace('/');
      }, 3000);
    } catch {
      setErr("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const c = { bg: "#F7F6F2", white: "#FFFFFF", ink: "#1A1A1A", muted: "#6B6B6B", accent: "#E8441A", border: "#E5E3DC", danger: "#DC2626" };

  if (accepted) return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes sa-welcome-progress { from { width: 0% } to { width: 100% } }`}</style>
      <div style={{ background: c.white, borderRadius: 16, padding: "48px 40px", width: 360, border: `0.5px solid ${c.border}`, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <img
            src="/eshopbox-monogram.jpg"
            alt="Eshopbox"
            style={{
              width: 56, height: 56, borderRadius: 14,
              objectFit: 'contain', background: '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: c.ink, marginBottom: 10 }}>Welcome to Sales Assist!</div>
        <div style={{ fontSize: 14, color: c.muted, marginBottom: 32 }}>
          {acceptedUser?.name ? `Hi ${acceptedUser.name.split(" ")[0]} — you're all set.` : "You're all set."}<br />
          Taking you to your dashboard…
        </div>
        <div style={{ height: 3, background: c.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: c.accent, borderRadius: 2, animation: "sa-welcome-progress 3s linear forwards" }} />
        </div>
      </div>
    </div>
  );

  if (invalidToken) return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: c.white, borderRadius: 16, padding: "40px", width: 360, border: `0.5px solid ${c.border}`, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: c.ink, marginBottom: 8 }}>Invalid invite link</div>
        <div style={{ fontSize: 13, color: c.muted }}>This invite link is missing or invalid. Ask your admin to resend the invite.</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: c.white, borderRadius: 16, padding: "40px", width: 360, border: `0.5px solid ${c.border}` }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: c.ink }}>SALES ASSIST</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: c.ink }}>Set up your account</div>
          <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>You've been invited to join Eshopbox Sales Assist.</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Full name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Confirm password</div>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: c.danger, marginBottom: 16 }}>
              {err}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Creating account..." : "Create account & sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}