import Link from "next/link";
import { getOnboardingState } from "@/lib/org";
import { setIntegration, saveZohoConnection, saveOdooConnection, resetIntegration, generateWebhookKey, runZatcaOnboarding } from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#33414f", margin: "12px 0 3px", fontWeight: 600 };
const hint: React.CSSProperties = { fontSize: 11.5, color: "#8a97a6", margin: "0 0 4px" };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 13 };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const copybox: React.CSSProperties = { background: "#0f2233", color: "#cfe3f5", padding: "9px 12px", borderRadius: 7, fontFamily: "Consolas,monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0" };
const code: React.CSSProperties = { background: "#0f2233", color: "#a8e6b0", padding: "12px 14px", borderRadius: 8, fontFamily: "Consolas,monospace", fontSize: 11.5, whiteSpace: "pre", overflowX: "auto", margin: "6px 0", lineHeight: 1.5 };
const row: React.CSSProperties = { display: "flex", gap: 14 };
const ol: React.CSSProperties = { paddingLeft: 18, fontSize: 13, color: "#33414f", margin: 0 };

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
      <h4 style={{ margin: "0 0 4px" }}>① Your integration key</h4>
      <p style={hint}>You&apos;ll paste this as the <code>x-api-key</code> header in your accounting software (below). Shown only once.</p>
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

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ newkey?: string; zerr?: string; cerr?: string; cwarn?: string }> }) {
  const sp = await searchParams;
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const { profileComplete, integration, connected, zatcaOnboarded, nextStep } = state;
  const activeStep = nextStep === "profile" ? 1 : nextStep === "integration" ? 2 : nextStep === "connect" ? 3 : 4;

  const zohoBody = `{
  "action": "pull",
  "zohoInvoiceId": "\${invoice.invoice_id}",
  "entityType": "invoice"
}`;
  const odooPython = `# ZATCA E-Invoicing Auto-Clearance  (Server Action: Model = account.move)
if record.move_type in ['out_invoice','out_refund'] and record.state == 'posted' and record.x_zatca_status != 'cleared':
    import requests
    webhook_url = "${base}/api/odoo/webhook"
    api_key = "PASTE_YOUR_INTEGRATION_KEY"   # the key from step ①
    headers = {"Content-Type": "application/json", "x-api-key": api_key}
    payload = {"action": "pull", "odooInvoiceId": record.id}
    try:
        r = requests.post(webhook_url, headers=headers, json=payload, timeout=15)
        res = r.json()
        if r.status_code != 200 or not res.get('success'):
            record.write({'x_zatca_status':'failed','x_zatca_error':res.get('error','Unknown error')})
    except Exception as e:
        record.write({'x_zatca_status':'failed','x_zatca_error':'Timeout: '+str(e)})`;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860 }}>
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
              { id: "odoo", title: "🟢 Odoo", desc: "You invoice in Odoo. We sync via JSON-RPC + a server action." },
              { id: "zoho", title: "🔵 Zoho Books", desc: "You invoice in Zoho Books. We sync via OAuth + a workflow webhook." },
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

      {/* Step 3 — connect */}
      {profileComplete && integration && !connected && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Step 3 — Connect {integration === "zoho" ? "Zoho Books" : integration === "odoo" ? "Odoo" : "your system"}</h3>
            <form action={resetIntegration}><button type="submit" style={{ background: "#eef2f6", color: "#445", border: "none", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>← Change software</button></form>
          </div>

          {sp.cerr && <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", padding: "9px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>❌ Connection failed: {sp.cerr}</div>}
          {sp.cwarn && <div style={{ background: "#fff6e0", border: "1px solid #f0d48a", color: "#8a5a00", padding: "9px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠️ {sp.cwarn}</div>}

          <KeyBlock newkey={sp.newkey} />

          {/* ===== ZOHO ===== */}
          {integration === "zoho" && (
            <>
              <div style={card}>
                <h4 style={{ margin: "0 0 8px" }}>② Set up Zoho Books (do this in Zoho)</h4>
                <ol style={ol}>
                  <li style={{ margin: "10px 0" }}>
                    <b>Generate OAuth credentials.</b> In the <b>Zoho API Console</b> (<a href="https://api-console.zoho.sa" target="_blank" rel="noreferrer">api-console.zoho.sa</a>) create a <b>Self Client</b> → generate a grant token with scope <code>ZohoBooks.fullaccess.all</code> → exchange it for a <b>refresh token</b>. Find your <b>organization_id</b> under Zoho Books → Settings → Organizations.
                  </li>
                  <li style={{ margin: "10px 0" }}>
                    <b>Create invoice custom fields</b> (Zoho Books → Settings → Preferences → Invoices → <b>Field Customization</b>):
                    <ul style={{ fontSize: 12.5, color: "#5a6a78", marginTop: 4 }}>
                      <li><code>cf_zatca_uuid</code> — Text</li>
                      <li><code>cf_zatca_status</code> — Text or Dropdown (pending, submitted, cleared, failed)</li>
                      <li><code>cf_zatca_qr_code</code> — Multi-line Text</li>
                      <li><code>cf_zatca_error</code> — Multi-line Text</li>
                    </ul>
                    <p style={hint}>Optional: <code>cf_zatca_document_type</code> to force a Debit Note (383).</p>
                  </li>
                  <li style={{ margin: "10px 0" }}>
                    <b>Create the webhook</b> (Settings → Automation → Workflow Rules → new rule on <b>Invoices</b>, trigger = created / marked sent → action <b>Webhook</b>):
                    <div style={hint}>URL (POST):</div><div style={copybox}>{base}/api/zoho/webhook</div>
                    <div style={hint}>Header:</div><div style={copybox}>x-api-key: &lt;your integration key from ①&gt;</div>
                    <div style={hint}>Body (pull mode):</div><pre style={code}>{zohoBody}</pre>
                    <p style={hint}>For credit notes, add a rule on the Credit Notes module with <code>&quot;zohoInvoiceId&quot;: &quot;${"$"}{`{creditnote.creditnote_id}`}&quot;</code> and <code>&quot;entityType&quot;: &quot;creditnote&quot;</code>.</p>
                  </li>
                </ol>
              </div>

              <div style={card}>
                <h4 style={{ margin: "0 0 6px" }}>③ Enter the connection — we verify it live against Zoho</h4>
                <details style={{ margin: "4px 0 14px", fontSize: 12.5 }}>
                  <summary style={{ cursor: "pointer", color: "#1F6FB2", fontWeight: 600 }}>🔍 Where do I find each value? (step-by-step)</summary>
                  <div style={{ padding: "10px 12px", marginTop: 6, background: "#f7f9fc", border: "1px solid #e3e8ef", borderRadius: 8, color: "#33414f", lineHeight: 1.7 }}>
                    <p style={{ margin: "0 0 6px" }}><b>Region</b> — your Zoho data center. For Saudi Arabia it&apos;s <code>sa</code> (your Zoho URL ends in <code>.sa</code>).</p>
                    <p style={{ margin: "0 0 6px" }}><b>Organization ID</b> — in <b>Zoho Books → ⚙️ Settings → Organizations</b>: open your organization and the <b>Organization ID</b> (a long number) is shown there.</p>
                    <p style={{ margin: "0 0 6px" }}><b>Client ID &amp; Client secret</b> — these come from the <b>Self Client</b> you created in step ②.1. Open it at <a href="https://api-console.zoho.sa" target="_blank" rel="noreferrer">api-console.zoho.sa</a> → your Self Client → <b>Client Secret</b> tab shows both.</p>
                    <p style={{ margin: 0 }}><b>Refresh token</b> — in that same Self Client → <b>Generate Code</b> tab → enter scope <code>ZohoBooks.fullaccess.all</code> → <b>Create</b> to get a grant code (valid a few minutes) → exchange that code for a <b>refresh token</b> by POSTing to <code>https://accounts.zoho.sa/oauth/v2/token</code> with your client id/secret + the code. The refresh token is long-lived — paste it here. <i>(This is the most technical step; if you&apos;re stuck, use Help → Contact CBT.)</i></p>
                  </div>
                </details>
                <form action={saveZohoConnection}>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Region</label><p style={hint}>KSA = <code>sa</code>.</p><input style={input} name="zoho_region" defaultValue="sa" /></div>
                    <div style={{ flex: 1 }}><label style={label}>Organization ID</label><p style={hint}>Zoho → Settings → Organizations.</p><input style={input} name="zoho_org_id" required /></div>
                  </div>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Client ID</label><p style={hint}>From the Self-Client (step ②.1).</p><input style={input} name="zoho_client_id" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Client secret</label><p style={hint}>From the Self-Client (step ②.1).</p><input style={input} name="zoho_client_secret" type="password" required /></div>
                  </div>
                  <label style={label}>Refresh token</label><p style={hint}>Exchanged from your grant token (step ②.1).</p><input style={input} name="zoho_refresh_token" type="password" required />
                  <button type="submit" style={{ ...btn, marginTop: 16 }}>Test &amp; connect →</button>
                </form>
              </div>
            </>
          )}

          {/* ===== ODOO ===== */}
          {integration === "odoo" && (
            <>
              <div style={card}>
                <h4 style={{ margin: "0 0 6px" }}>② Connect Odoo — we verify it live &amp; auto-create the ZATCA fields</h4>
                <p style={hint}>On <b>Test &amp; connect</b> we authenticate to Odoo and auto-provision <code>x_zatca_uuid / status / qr_code / xml / error</code> on <code>account.move</code>.</p>
                <details style={{ margin: "8px 0 14px", fontSize: 12.5 }}>
                  <summary style={{ cursor: "pointer", color: "#1F6FB2", fontWeight: 600 }}>🔍 Where do I find each value? (step-by-step)</summary>
                  <div style={{ padding: "10px 12px", marginTop: 6, background: "#f7f9fc", border: "1px solid #e3e8ef", borderRadius: 8, color: "#33414f", lineHeight: 1.7 }}>
                    <p style={{ margin: "0 0 6px" }}><b>Odoo URL</b> — the web address you use to open Odoo. Log into Odoo and copy it from your browser&apos;s address bar, e.g. <code>https://yourcompany.odoo.com</code> (just the domain, no page path).</p>
                    <p style={{ margin: "0 0 6px" }}><b>Database</b> — on <b>Odoo Online</b> it&apos;s usually the word before <code>.odoo.com</code> (so <code>acme.odoo.com</code> → <code>acme</code>). Not sure? In Odoo go to <b>Settings → scroll to the bottom → &quot;Activate the developer mode&quot;</b>; the database name then appears in <b>Settings → Technical</b> and in the <b>⚙️ → About</b> dialog.</p>
                    <p style={{ margin: "0 0 6px" }}><b>Username</b> — the <b>email</b> you log into Odoo with.</p>
                    <p style={{ margin: 0 }}><b>Password / API key</b> — in Odoo, click your <b>profile photo (top-right) → My Profile</b> (or Preferences) → <b>Account Security</b> tab → <b>New API Key</b> → type your account password → name it &quot;ZATCA&quot; → <b>Generate</b> → copy the key. (Don&apos;t see &quot;Account Security&quot;? Turn on developer mode first, as above.) A password works too, but an API key is safer.</p>
                  </div>
                </details>
                <form action={saveOdooConnection}>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Odoo URL</label><p style={hint}>e.g. https://yourco.odoo.com</p><input style={input} name="odoo_url" placeholder="https://yourco.odoo.com" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Database</label><p style={hint}>Your Odoo database name.</p><input style={input} name="odoo_db" required /></div>
                  </div>
                  <div style={row}>
                    <div style={{ flex: 1 }}><label style={label}>Username</label><p style={hint}>The user login/email.</p><input style={input} name="odoo_username" required /></div>
                    <div style={{ flex: 1 }}><label style={label}>Password / API key</label><p style={hint}>That user&apos;s API key (recommended).</p><input style={input} name="odoo_password" type="password" required /></div>
                  </div>
                  <button type="submit" style={{ ...btn, marginTop: 16 }}>Test &amp; connect →</button>
                </form>
              </div>

              <div style={card}>
                <h4 style={{ margin: "0 0 8px" }}>③ Then add the auto-clearance trigger (in Odoo)</h4>
                <ol style={ol}>
                  <li style={{ margin: "10px 0" }}>
                    <b>Create a Server Action.</b> Settings → Technical → Actions → <b>Server Actions</b> → new, Model = <code>account.move</code>, name &quot;ZATCA E-Invoicing Auto-Clearance&quot;, then paste this Python (replace the key with yours from ①):
                    <pre style={code}>{odooPython}</pre>
                  </li>
                  <li style={{ margin: "10px 0" }}>
                    <b>Create an Automated Action.</b> Settings → Technical → Automation → <b>Automated Actions</b>: Model <code>account.move</code>, Trigger <b>On Update</b>, Apply on <code>[(&quot;state&quot;,&quot;=&quot;,&quot;posted&quot;)]</code>, Action = the Server Action above.
                  </li>
                </ol>
                <p style={hint}>Now posting a customer invoice in Odoo auto-submits it for ZATCA clearance.</p>
              </div>
            </>
          )}

          {/* ===== CUSTOM ===== */}
          {integration === "custom" && (
            <div style={card}>
              <h4 style={{ margin: "0 0 8px" }}>② Call our API from your system</h4>
              <p style={{ color: "#33414f", fontSize: 13 }}>Submit invoices with your integration key (①) as <code>x-api-key</code>:</p>
              <div style={copybox}>POST {base}/api/v1/zatca/invoices/submit</div>
              <p style={hint}>Once you&apos;ve generated a key above, this integration counts as connected. (Full API docs page coming.)</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — ZATCA */}
      {profileComplete && integration && connected && !zatcaOnboarded && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px" }}>Step 4 — ZATCA onboarding (Demo / simulation)</h3>
          <p style={{ color: "#6b7785", fontSize: 13 }}>
            We generate your keys + CSR, request a compliance certificate, run the compliance checks, and issue your production CSID — all against the ZATCA <b>simulation</b> environment. In Demo the OTP is <code>123456</code>.
          </p>
          {sp.zerr && <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", padding: "9px 12px", borderRadius: 8, fontSize: 13, margin: "10px 0" }}>❌ {sp.zerr}</div>}
          <form action={runZatcaOnboarding}>
            <label style={label}>OTP (from the Fatoora portal — use 123456 in Demo)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 380 }}>
              <input style={input} name="otp" defaultValue="123456" />
              <button type="submit" style={{ ...btn, whiteSpace: "nowrap" }}>Run onboarding →</button>
            </div>
          </form>
          <p style={hint}>This calls ZATCA simulation and may take a few seconds.</p>
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
