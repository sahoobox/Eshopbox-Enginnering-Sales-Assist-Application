import { C } from "../components/ui";

export default function Notifications() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 8, letterSpacing: "-0.02em" }}>Notifications</div>
      <div style={{ fontSize: 14, color: C.muted }}>Coming soon</div>
    </div>
  );
}
