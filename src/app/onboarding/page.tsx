import Link from "next/link";
import { getOnboardingState } from "@/lib/org";
import { setIntegration, saveZohoConnection, saveOdooConnection, resetIntegration, generateWebhookKey } from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#33414f", margin: "12px 0 3px", fontWeight: 600 };
const hint: React.CSSProperties = { fontSize: 11.5, color: "#8a97a6", margin: "0 0 4px" };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 13 };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const copybox: React.CSSProperties = { background: "#0f2233", color: "#cfe3f5", padding: "9px 12px", borderRadius: 7, fontFamily: "Consolas,monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0" };
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

function KeyBlock({ newkey }: { newkey?: string }) {
  return (
    <div style={card}>
      <h4 style={{ margin: "0 0 4px" }}>1 · Your integration key</h4>
      <p style={hint}>Paste this as the <code>x-api-key</code> header in your accounting software&apos;s webhook (below). Shown only once.</p>
      {newkey ? (
        <>
          <div style={copybox}>{newkey}</div>
          <p style={{ color: "#c77700", fontSize: 12 }}>⚠️ Copy it now — you won&apos;t see it again. Lost it? Generate a new one.</p>
        </>
      ) : (
        <form action={generateWebhookKey}><button type="submit" style={btn}>Generate integration key</button></form>
      )}
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ newkey?: string }> }) {
  const sp = await searchParams;
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const { profileComplete, integration, connected, zatcaOnboarded, nextStep } = state;
  const activeStep = nextStep === "profile" ? 1 : nextStep === "integration" ? 2 : nextStep === "connect" ? 3 : 4;
  const zohoBody = '{ "action": "pull", "zohoInvoiceId": "${invoice.invoice_id}", "entityType": "invoice" }';

  return (
    <div style={{ padding: "28px 32px", maxWidth: 840 }}>
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
              { id: "odoo", title: "🟢 Odoo", desc: "You invoice in Odoo. We sync via JSON-RPC + a webhook." },
              { id: "zoho", title: "🔵 Zoho Books", desc: "You invoice in Zoho Books. We sync via OAuth + a webhook." },
              { id: "custom", title: "⚙️ Custom / Our API", desc: "You have your own system. Call our API directly." },
            ].map((o) => (
              <form key={o.id} action={setIntegration}>
                <input type="hidden" name="integration" value={o.id} />
                <button type="submit" style={{ ...card, marginBottom: 0, cursor: "pointer", textAlign: "left", width: "100%", border: "2px solid #e3e8ef" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{o.title}</div>
                  <div style={{ color: "#6b7785", fontSize: 12 }}>{o.desc}</div>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — connect (with full guidance) */}
      {profileComplete && integration && !connected && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Step 3 — Connect {integration === "zoho" ? "Zoho Books" : integration === "odoo" ? "Odoo" : "your system"}</h3>
            <form action={resetIntegration}><button type="submit" style={{ background: "#eef2f6", color: "#445", border: "none", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>← Change software</button></form>
          </div>

          <KeyBlock newkey={sp.newkey} />

          {/* ===== ZOHO ===== */}
          {integration === "zoho" && (
            <>
              <div style={card}>
                <h4 style={{ margin: "0 0 8px" }}>2 · Set this up inside Zoho Books</h4>
                <ol style={{ paddingLeft: 18, fontSize: 13, color: "#33414f" }}>
                  <li style={{ margin: "8px 0" }}>
                    <b>Create an OAuth Self-Client.</b> Go to <a href="https://api-console.zoho.sa" target="_blank" rel="noreferrer">api-console.zoho.sa</a> → <i>Self Client</i> → create. Copy the <b>Client ID</b> &amp; <b>Client Secret</b>, then generate a <b>refresh token</b> with scope <code>ZohoBooks.fullaccess.all</code>.
                  </li>
                  <li style={{ margin: "8px 0" }}>
                    <b>Create 4 custom fields</b> on Invoices: Zoho → Settings → Preferences → Invoices → Field Customization → add these text fields:
                    <div style={copybox}>cf_zatca_uuid · cf_zatca_status · cf_zatca_qr_code · cf_zatca_error</div>
                  </li>
                  <li style={{ margin: "8px 0" }}>
                    <b>Create a Workflow webhook.</b> Zoho → Settings → Automation → Workflow Rules → new rule on <i>Invoice → Created/Sent</i> → action <i>Webhook</i>:
                    <div style={{ ...hint, marginTop: 6 }}>URL (POST):</div>
                    <div style={copybox}>{base}/api/zoho/webhook</div>
                    <div style={hint}>Header:</div>
                    <div style={copybox}>x-api-key: &lt;your integration key from step 1&gt;</div>
                    <div style={hint}>Body:</div>
                    <div style={copybox}>{zohoBody}</div>
                  </li>
                </ol>
              </div>

              <div style={card}>
                <h4 style={{ margin: "0 0 6px" }}>3 · Enter the connection here</h4>
                <form action={saveZohoConnection}>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Region</label><p style={hint}>Your Zoho data center. KSA = <code>sa</code>.</p><input style={input} name="zoho_region" defaultValue="sa" /></div>
                    <div style={{ flex: 1 }}><label style={label}>Organization ID</label><p style={hint}>Zoho → Settings → Organization Profile.</p><input style={input} name="zoho_org_id" required /></div>
                  </div>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Client ID</label><p style={hint}>From the Self-Client (step 1).</p><input style={input} name="zoho_client_id" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Client secret</label><p style={hint}>From the Self-Client (step 1).</p><input style={input} name="zoho_client_secret" type="password" required /></div>
                  </div>
                  <label style={label}>Refresh token</label><p style={hint}>Generated from your grant token (step 1).</p><input style={input} name="zoho_refresh_token" type="password" required />
                  <button type="submit" style={{ ...btn, marginTop: 16 }}>Save &amp; connect →</button>
                </form>
              </div>
            </>
          )}

          {/* ===== ODOO ===== */}
          {integration === "odoo" && (
            <>
              <div style={card}>
                <h4 style={{ margin: "0 0 8px" }}>2 · Set this up inside Odoo</h4>
                <ol style={{ paddingLeft: 18, fontSize: 13, color: "#33414f" }}>
                  <li style={{ margin: "8px 0" }}><b>Get an API key</b> for a user with invoicing access: Odoo → user menu → My Profile → Account Security → <i>New API Key</i>. Note that user&apos;s <b>login (email)</b> and the <b>API key</b>.</li>
                  <li style={{ margin: "8px 0" }}><b>ZATCA fields:</b> on connect we auto-provision <code>x_zatca_status / x_zatca_uuid / x_zatca_qr_code / x_zatca_xml / x_zatca_error</code> on <code>account.move</code> (or add them manually).</li>
                  <li style={{ margin: "8px 0" }}>
                    <b>Create an Automation/webhook</b> (on Invoice <i>posted</i>) calling:
                    <div style={copybox}>{base}/api/odoo/webhook</div>
                    <div style={hint}>Header:</div>
                    <div style={copybox}>x-api-key: &lt;your integration key from step 1&gt;</div>
                  </li>
                </ol>
              </div>

              <div style={card}>
                <h4 style={{ margin: "0 0 6px" }}>3 · Enter the connection here</h4>
                <form action={saveOdooConnection}>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Odoo URL</label><p style={hint}>e.g. https://yourco.odoo.com</p><input style={input} name="odoo_url" placeholder="https://yourco.odoo.com" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Database</label><p style={hint}>Your Odoo database name.</p><input style={input} name="odoo_db" required /></div>
                  </div>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Username</label><p style={hint}>The user login/email from step 1.</p><input style={input} name="odoo_username" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Password / API key</label><p style={hint}>That user&apos;s API key (step 1).</p><input style={input} name="odoo_password" type="password" required /></div>
                  </div>
                  <button type="submit" style={{ ...btn, marginTop: 16 }}>Save &amp; connect →</button>
                </form>
              </div>
            </>
          )}

          {/* ===== CUSTOM ===== */}
          {integration === "custom" && (
            <div style={card}>
              <h4 style={{ margin: "0 0 8px" }}>2 · Call our API from your system</h4>
              <p style={{ color: "#33414f", fontSize: 13 }}>Submit invoices for clearance/reporting with your integration key (step 1) as <code>x-api-key</code>:</p>
              <div style={copybox}>POST {base}/api/v1/zatca/invoices/submit</div>
              <p style={hint}>Full reference: onboard · submit · fetch XML/PDF/QR · list · logs. (API docs page coming.)</p>
              <p style={{ color: "#8a97a6", fontSize: 12, marginTop: 8 }}>Once you&apos;ve generated a key above, this integration counts as connected.</p>
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

      {zatcaOnboarded && (
        <div style={{ ...card, background: "#f1faf4", borderColor: "#b6e4c6" }}>
          <h3 style={{ margin: "0 0 6px", color: "#1f9d57" }}>✅ Onboarded in Demo mode</h3>
          <p style={{ color: "#3a4a5a", fontSize: 13 }}>Invoices created in your accounting software now auto-clear/report against ZATCA simulation. Switch to Real when ready.</p>
        </div>
      )}
    </div>
  );
}
