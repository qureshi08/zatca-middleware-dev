import Link from "next/link";
import { getOnboardingState } from "@/lib/org";
import { setIntegration, saveZohoConnection, saveOdooConnection, resetIntegration } from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px" };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#6b7785", margin: "12px 0 4px", fontWeight: 600 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 13 };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const row: React.CSSProperties = { display: "flex", gap: 14 };

function Stepper({ active }: { active: number }) {
  const steps = ["Profile", "Integration", "Connect", "ZATCA"];
  return (
    <div style={{ display: "flex", gap: 6, margin: "8px 0 20px" }}>
      {steps.map((s, i) => {
        const done = i + 1 < active, on = i + 1 === active;
        return (
          <div key={s} style={{ flex: 1, padding: "9px 8px", borderRadius: 8, textAlign: "center", fontSize: 12, border: `1px solid ${on ? "#1F6FB2" : done ? "#b6e4c6" : "#e3e8ef"}`, background: on ? "#eef5fc" : done ? "#f1faf4" : "#fff", color: on ? "#155a93" : done ? "#1f9d57" : "#6b7785", fontWeight: on ? 600 : 400 }}>
            {i + 1}. {s}
          </div>
        );
      })}
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ newkey?: string }> }) {
  const sp = await searchParams;
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  const { profileComplete, integration, connected, zatcaOnboarded, nextStep } = state;
  const activeStep = nextStep === "profile" ? 1 : nextStep === "integration" ? 2 : nextStep === "connect" ? 3 : 4;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 820 }}>
      <h1 style={{ color: "#155a93", fontSize: 22, margin: 0 }}>Onboarding</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        One-time setup. You&apos;re in <strong>Demo mode</strong> (ZATCA simulation, OTP 123456) — nothing is legally filed.
      </p>
      <Stepper active={activeStep} />

      {/* Step 1 — profile */}
      {!profileComplete && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px" }}>Step 1 — Complete your business profile</h3>
          <p style={{ color: "#6b7785", fontSize: 13 }}>We need your seller identity (VAT, CRN, address) before connecting.</p>
          <Link href="/profile" style={{ ...btn, display: "inline-block", textDecoration: "none" }}>Go to Business Profile →</Link>
        </div>
      )}

      {/* Step 2 — choose integration */}
      {profileComplete && !integration && (
        <div>
          <h3 style={{ margin: "0 0 10px" }}>Step 2 — How do you create invoices?</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { id: "odoo", title: "🟢 Odoo", desc: "Connect your Odoo instance via JSON-RPC." },
              { id: "zoho", title: "🔵 Zoho Books", desc: "Connect Zoho Books via secure OAuth." },
              { id: "custom", title: "⚙️ Custom / Our API", desc: "Use our headless API from your own system." },
            ].map((o) => (
              <form key={o.id} action={setIntegration}>
                <input type="hidden" name="integration" value={o.id} />
                <button type="submit" style={{ ...card, cursor: "pointer", textAlign: "left", width: "100%", border: "2px solid #e3e8ef" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{o.title}</div>
                  <div style={{ color: "#6b7785", fontSize: 12 }}>{o.desc}</div>
                </button>
              </form>
            ))}
          </div>
          <p style={{ color: "#6b7785", fontSize: 12, marginTop: 10 }}>
            Don&apos;t see your software? <Link href="/onboarding">Request support</Link> — our team will help.
          </p>
        </div>
      )}

      {/* Step 3 — connect */}
      {profileComplete && integration && !connected && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Step 3 — Connect {integration === "zoho" ? "Zoho Books" : integration === "odoo" ? "Odoo" : "your system"}</h3>
            <form action={resetIntegration}><button type="submit" style={{ background: "#eef2f6", color: "#445", border: "none", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Change</button></form>
          </div>

          {integration === "zoho" && (
            <form action={saveZohoConnection}>
              <div style={row}><div style={{ flex: 1 }}><label style={label}>Region</label><input style={input} name="zoho_region" defaultValue="sa" /></div><div style={{ flex: 1 }}><label style={label}>Organization ID</label><input style={input} name="zoho_org_id" required /></div></div>
              <div style={row}><div style={{ flex: 1 }}><label style={label}>Client ID</label><input style={input} name="zoho_client_id" required /></div><div style={{ flex: 1 }}><label style={label}>Client secret</label><input style={input} name="zoho_client_secret" type="password" required /></div></div>
              <label style={label}>Refresh token</label><input style={input} name="zoho_refresh_token" type="password" required />
              <button type="submit" style={{ ...btn, marginTop: 16 }}>Save &amp; connect →</button>
            </form>
          )}

          {integration === "odoo" && (
            <form action={saveOdooConnection}>
              <div style={row}><div style={{ flex: 1 }}><label style={label}>Odoo URL</label><input style={input} name="odoo_url" placeholder="https://you.odoo.com" required /></div><div style={{ flex: 1 }}><label style={label}>Database</label><input style={input} name="odoo_db" required /></div></div>
              <div style={row}><div style={{ flex: 1 }}><label style={label}>Username</label><input style={input} name="odoo_username" required /></div><div style={{ flex: 1 }}><label style={label}>Password / API key</label><input style={input} name="odoo_password" type="password" required /></div></div>
              <button type="submit" style={{ ...btn, marginTop: 16 }}>Save &amp; connect →</button>
            </form>
          )}

          {integration === "custom" && (
            <div>
              <p style={{ color: "#6b7785", fontSize: 13 }}>No connection form — your system calls our API. Your key:</p>
              {sp.newkey ? (
                <div style={{ background: "#0f2233", color: "#cfe3f5", padding: "10px 12px", borderRadius: 7, fontFamily: "Consolas,monospace", fontSize: 12, wordBreak: "break-all" }}>{sp.newkey}</div>
              ) : (
                <p style={{ color: "#6b7785", fontSize: 12 }}>A key was generated. Manage keys in Settings (shown once on creation).</p>
              )}
              <p style={{ color: "#c77700", fontSize: 12, marginTop: 8 }}>⚠️ Copy it now — it&apos;s shown only once.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — ZATCA */}
      {profileComplete && integration && connected && !zatcaOnboarded && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px" }}>Step 4 — ZATCA onboarding (Demo / simulation)</h3>
          <p style={{ color: "#6b7785", fontSize: 13 }}>
            Get an OTP from the Fatoora portal (use <code>123456</code> in Demo), then we generate your keys/CSR and run compliance against the simulation environment.
          </p>
          <p style={{ color: "#8a97a6", fontSize: 12 }}>⏳ The ZATCA onboarding action is wired in the next build step.</p>
        </div>
      )}

      {/* Done */}
      {zatcaOnboarded && (
        <div style={{ ...card, background: "#f1faf4", borderColor: "#b6e4c6" }}>
          <h3 style={{ margin: "0 0 6px", color: "#1f9d57" }}>✅ Onboarded in Demo mode</h3>
          <p style={{ color: "#3a4a5a", fontSize: 13 }}>Invoices created in your accounting software now auto-clear/report against ZATCA simulation. Switch to Real when ready.</p>
        </div>
      )}
    </div>
  );
}
