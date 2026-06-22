import Link from "next/link";
import { headers } from "next/headers";
import { getOnboardingState } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import {
  setIntegration, saveZohoConnection, saveOdooConnection, resetIntegration,
  generateWebhookKey, runZatcaOnboarding, sendTestInvoice, provisionOdooAutomation,
} from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#33414f", margin: "12px 0 3px", fontWeight: 600 };
const hint: React.CSSProperties = { fontSize: 11.5, color: "#8a97a6", margin: "0 0 4px" };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 13 };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const ghost: React.CSSProperties = { ...btn, background: "#fff", color: "#1F6FB2", border: "1px solid #1F6FB2" };
const gray: React.CSSProperties = { ...btn, background: "#eef2f6", color: "#445" };
const copybox: React.CSSProperties = { background: "#0f2233", color: "#cfe3f5", padding: "9px 12px", borderRadius: 7, fontFamily: "Consolas,monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0" };
const codeBox: React.CSSProperties = { background: "#0f2233", color: "#a8e6b0", padding: "12px 14px", borderRadius: 8, fontFamily: "Consolas,monospace", fontSize: 11.5, whiteSpace: "pre", overflowX: "auto", margin: "6px 0", lineHeight: 1.5 };
const row: React.CSSProperties = { display: "flex", gap: 14 };
const ol: React.CSSProperties = { paddingLeft: 18, fontSize: 13, color: "#33414f", margin: 0 };
const banner = (bg: string, br: string, fg: string): React.CSSProperties => ({ background: bg, border: `1px solid ${br}`, color: fg, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 });

const STEPS = ["Profile", "Integration", "Connect", "ZATCA"];

// Odoo auto-provisioning (module install + several RPC round-trips) can run long.
export const maxDuration = 60;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; newkey?: string; zerr?: string; cerr?: string; cwarn?: string; terr?: string; tok?: string; pok?: string; perr?: string }> }) {
  const sp = await searchParams;
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  // Derive the public base URL from the live request — always correct (Vercel or localhost), no env var needed.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const { org, profileComplete, integration, connected, zatcaOnboarded, nextStep } = state;
  const done = [profileComplete, !!integration, connected, zatcaOnboarded];
  const defaultStep = nextStep === "profile" ? 1 : nextStep === "integration" ? 2 : nextStep === "connect" ? 3 : 4;
  const selected = Math.min(4, Math.max(1, Number(sp.step) || defaultStep));

  // current connection detail (for the Connect step)
  let conn: { label: string; status: string; last_sync: string | null } | null = null;
  if (integration === "odoo") {
    const { data } = await supabaseAdmin.from("odoo_config").select("odoo_url,status,last_sync").eq("organization_id", org.id).maybeSingle();
    if (data) conn = { label: data.odoo_url, status: data.status, last_sync: data.last_sync };
  } else if (integration === "zoho") {
    const { data } = await supabaseAdmin.from("zoho_config").select("zoho_org_id,status,last_sync").eq("organization_id", org.id).maybeSingle();
    if (data) conn = { label: `org ${data.zoho_org_id}`, status: data.status, last_sync: data.last_sync };
  }

  const zohoBody = `{
  "action": "pull",
  "zohoInvoiceId": "\${invoice.invoice_id}",
  "entityType": "invoice"
}`;
  const zohoCnBody = `{
  "action": "pull",
  "zohoInvoiceId": "\${creditnote.creditnote_id}",
  "entityType": "creditnote"
}`;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 880 }}>
      <h1 style={{ color: "#155a93", fontSize: 22, margin: 0 }}>Onboarding</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        One-time setup. You&apos;re in <strong>Demo mode</strong> (ZATCA simulation, OTP 123456) — nothing is legally filed.
        {zatcaOnboarded && <> &nbsp;·&nbsp; <Link href="/onboarding?step=3">Manage connection</Link></>}
      </p>

      {/* CLICKABLE stepper */}
      <div style={{ display: "flex", gap: 6, margin: "10px 0 20px" }}>
        {STEPS.map((s, i) => {
          const n = i + 1, isDone = done[i], on = selected === n;
          return (
            <Link key={s} href={`/onboarding?step=${n}`} style={{ flex: 1, textDecoration: "none", padding: "10px 8px", borderRadius: 8, textAlign: "center", fontSize: 12.5,
              border: `1px solid ${on ? "#1F6FB2" : isDone ? "#b6e4c6" : "#e3e8ef"}`,
              background: on ? "#eef5fc" : isDone ? "#f1faf4" : "#fff",
              color: on ? "#155a93" : isDone ? "#1f9d57" : "#6b7785", fontWeight: on ? 700 : 500, boxShadow: on ? "0 1px 4px rgba(31,111,178,.15)" : "none" }}>
              {isDone ? "✓ " : `${n}. `}{s}
            </Link>
          );
        })}
      </div>

      {/* ===== STEP 1 — PROFILE ===== */}
      {selected === 1 && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px" }}>1 · Business profile</h3>
          {profileComplete ? (
            <>
              <p style={{ fontSize: 13, color: "#33414f" }}>✅ <b>{org.name}</b> · VAT {org.vat_number} · {org.addr_city}</p>
              <Link href="/profile" style={ghost}>Edit profile</Link> &nbsp; <Link href="/onboarding?step=2" style={btn}>Next: Integration →</Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#6b7785" }}>Add your seller identity (VAT, CRN, address) — required for ZATCA invoices.</p>
              <Link href="/profile" style={btn}>Complete Business Profile →</Link>
            </>
          )}
        </div>
      )}

      {/* ===== STEP 2 — INTEGRATION ===== */}
      {selected === 2 && (
        <div>
          {!profileComplete && <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>Finish your <Link href="/onboarding?step=1">business profile</Link> first.</div>}
          {integration ? (
            <div style={card}>
              <h3 style={{ margin: "0 0 8px" }}>2 · Integration</h3>
              <p style={{ fontSize: 13 }}>You chose <b style={{ textTransform: "capitalize" }}>{integration}</b>.</p>
              <form action={resetIntegration} style={{ display: "inline" }}><button type="submit" style={gray}>Change software</button></form>
              &nbsp; <Link href="/onboarding?step=3" style={btn}>Next: Connect →</Link>
            </div>
          ) : (
            <>
              <h3 style={{ margin: "0 0 10px" }}>2 · How do you create invoices?</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {[
                  { id: "odoo", title: "🟢 Odoo", desc: "You invoice in Odoo (JSON-RPC + a server action)." },
                  { id: "zoho", title: "🔵 Zoho Books", desc: "You invoice in Zoho Books (OAuth + a webhook)." },
                  { id: "custom", title: "⚙️ Custom / API", desc: "Your own system calls our API." },
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
            </>
          )}
        </div>
      )}

      {/* ===== STEP 3 — CONNECT (always viewable) ===== */}
      {selected === 3 && (
        <div>
          {!integration ? (
            <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>Choose an <Link href="/onboarding?step=2">integration</Link> first.</div>
          ) : (
            <>
              {/* live status */}
              <div style={banner(connected ? "#f1faf4" : "#fdeee9", connected ? "#b6e4c6" : "#f0c0b3", connected ? "#1f9d57" : "#c0392b")}>
                {connected ? <>✅ Connected to {integration === "zoho" ? "Zoho Books" : "Odoo"} ({conn?.label}). Last checked {conn?.last_sync ? new Date(conn.last_sync).toLocaleString() : "—"}.</> : <>❌ Not connected yet. Fill the form below and press <b>Test &amp; connect</b>.</>}
              </div>
              {sp.cerr && <div style={banner("#fdeee9", "#f0c0b3", "#c0392b")}>❌ Connection failed: {sp.cerr}</div>}
              {sp.cwarn && <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>⚠️ {sp.cwarn}</div>}
              {sp.pok && <div style={banner("#e9f8ef", "#b6e4c6", "#1f9d57")}>✅ Automated setup done in Odoo: {sp.pok} You can post an invoice now.</div>}
              {sp.perr && <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>⚠️ Automated setup didn&apos;t fully complete: {sp.perr} — you can use the manual steps below.</div>}

              <KeyBlock newkey={sp.newkey} />

              {integration === "zoho" && <ZohoGuide base={base} zohoBody={zohoBody} zohoCnBody={zohoCnBody} />}
              {integration === "odoo" && <OdooGuide base={base} apiKey={sp.newkey} connected={connected} />}
              {integration === "custom" && (
                <div style={card}><h4 style={{ margin: "0 0 8px" }}>Call our API</h4><div style={copybox}>POST {base}/api/v1/zatca/invoices/submit</div><p style={hint}>Use your integration key (above) as <code>x-api-key</code>. Generating a key marks this connected.</p></div>
              )}

              {/* connection form (always available to (re)connect) */}
              {integration === "zoho" && (
                <div style={card}>
                  <h4 style={{ margin: "0 0 6px" }}>Connection details — verified live</h4>
                  <form action={saveZohoConnection}>
                    <div style={row}><div style={{ flex: 1 }}><label style={label}>Region</label><input style={input} name="zoho_region" defaultValue="sa" /><p style={hint}>Zoho data center: sa, com, eu, in, com.au, jp, ca.</p></div><div style={{ flex: 1 }}><label style={label}>Organization ID</label><input style={input} name="zoho_org_id" required /></div></div>
                    <div style={row}><div style={{ flex: 1 }}><label style={label}>Client ID</label><input style={input} name="zoho_client_id" required /></div><div style={{ flex: 1 }}><label style={label}>Client secret</label><input style={input} name="zoho_client_secret" type="password" required /></div></div>
                    <label style={label}>Grant code <span style={{ color: "#1f9d57" }}>(recommended — we exchange it for you)</span></label>
                    <input style={input} name="zoho_grant_code" placeholder="1000.xxxxxxxx… from Self Client → Generate Code" />
                    <p style={hint}>From api-console.zoho → your Self Client → <b>Generate Code</b>, scope <code>ZohoBooks.fullaccess.all</code>. Codes expire in minutes — generate it right before connecting.</p>
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: "pointer", color: "#6b7785", fontSize: 12.5 }}>Already have a refresh token? Use it instead</summary>
                      <label style={label}>Refresh token</label><input style={input} name="zoho_refresh_token" type="password" />
                    </details>
                    <button type="submit" style={{ ...btn, marginTop: 16 }}>Test &amp; connect →</button>
                  </form>
                </div>
              )}
              {integration === "odoo" && (
                <div style={card}>
                  <h4 style={{ margin: "0 0 6px" }}>Connection details — verified live</h4>
                  <form action={saveOdooConnection}>
                    <div style={row}><div style={{ flex: 1 }}><label style={label}>Odoo URL</label><input style={input} name="odoo_url" placeholder="https://yourco.odoo.com" required /></div><div style={{ flex: 1 }}><label style={label}>Database</label><input style={input} name="odoo_db" required /></div></div>
                    <div style={row}><div style={{ flex: 1 }}><label style={label}>Username (email)</label><input style={input} name="odoo_username" required /></div><div style={{ flex: 1 }}><label style={label}>Password / API key</label><input style={input} name="odoo_password" type="password" required /></div></div>
                    <button type="submit" style={{ ...btn, marginTop: 16 }}>Test &amp; connect →</button>
                  </form>
                </div>
              )}

              {connected && <p style={{ fontSize: 13 }}><Link href="/onboarding?step=4" style={btn}>Next: ZATCA onboarding →</Link></p>}
            </>
          )}
        </div>
      )}

      {/* ===== STEP 4 — ZATCA ===== */}
      {selected === 4 && (
        <div>
          {sp.tok && <div style={banner("#e9f8ef", "#b6e4c6", "#1f9d57")}>✅ Test invoice: <b>{sp.tok}</b> — <Link href="/invoices">view it →</Link></div>}
          {sp.terr && <div style={banner("#fdeee9", "#f0c0b3", "#c0392b")}>❌ {sp.terr}</div>}
          {sp.zerr && <div style={banner("#fdeee9", "#f0c0b3", "#c0392b")}>❌ {sp.zerr}</div>}

          {!connected ? (
            <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>Connect your accounting software (<Link href="/onboarding?step=3">step 3</Link>) before ZATCA onboarding.</div>
          ) : zatcaOnboarded ? (
            <div style={{ ...card, background: "#f1faf4", borderColor: "#b6e4c6" }}>
              <h3 style={{ margin: "0 0 6px", color: "#1f9d57" }}>✅ ZATCA onboarded (Demo)</h3>
              <p style={{ color: "#3a4a5a", fontSize: 13, margin: "0 0 14px" }}>Verify the pipeline now (no ERP trigger needed):</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <form action={sendTestInvoice}><button type="submit" style={btn}>Send a test invoice →</button></form>
                <Link href="/invoices" style={ghost}>View invoices</Link>
                <Link href="/" style={gray}>Dashboard</Link>
              </div>
              <p style={{ ...hint, marginTop: 14 }}>Final step <b>in {integration === "odoo" ? "Odoo" : "Zoho"}</b>: ensure the {integration === "odoo" ? "Server Action + Automated Action" : "workflow webhook"} is set up — see <Link href="/onboarding?step=3">step 3</Link>.</p>
            </div>
          ) : (
            <div style={card}>
              <h3 style={{ margin: "0 0 8px" }}>4 · ZATCA onboarding (Demo / simulation)</h3>
              <p style={{ color: "#6b7785", fontSize: 13 }}>We generate keys + CSR, request a compliance certificate, run checks, and issue your production CSID — against ZATCA <b>simulation</b>. OTP is <code>123456</code> in Demo.</p>
              <form action={runZatcaOnboarding}>
                <label style={label}>OTP</label>
                <div style={{ display: "flex", gap: 10, maxWidth: 380 }}><input style={input} name="otp" defaultValue="123456" /><button type="submit" style={{ ...btn, whiteSpace: "nowrap" }}>Run onboarding →</button></div>
              </form>
              <p style={hint}>Calls ZATCA simulation; takes a few seconds.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeyBlock({ newkey }: { newkey?: string }) {
  return (
    <div style={card}>
      <h4 style={{ margin: "0 0 4px" }}>① Your integration key</h4>
      <p style={hint}>Paste as the <code>x-api-key</code> header in your accounting software (below). Shown only once.</p>
      {newkey ? (<><div style={copybox}>{newkey}</div><p style={{ color: "#c77700", fontSize: 12 }}>⚠️ Copy it now — shown once. Lost it? Generate a new one.</p></>)
        : (<form action={generateWebhookKey}><button type="submit" style={btn}>Generate integration key</button></form>)}
    </div>
  );
}

function ZohoGuide({ base, zohoBody, zohoCnBody }: { base: string; zohoBody: string; zohoCnBody: string }) {
  return (
    <div style={card}>
      <h4 style={{ margin: "0 0 8px" }}>② Set up Zoho Books (do this in Zoho)</h4>
      <p style={hint}>Zoho Books has no API to create webhooks or custom fields, so these few steps are done once in Zoho&apos;s UI. We handle the rest (incl. turning your grant code into a refresh token).</p>
      <ol style={ol}>
        <li style={{ margin: "10px 0" }}><b>OAuth credentials.</b> At <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer">api-console.zoho.com</a> (use the console for your data center) → <b>Self Client</b> → copy the <b>Client ID</b> &amp; <b>Client Secret</b>. Then open the <b>Generate Code</b> tab, scope <code>ZohoBooks.fullaccess.all</code>, pick a duration, and copy the <b>grant code</b>. Paste Client ID/Secret + grant code into the form below — we exchange it for a refresh token automatically. Organization ID is under Zoho Books → Settings → Organizations.</li>
        <li style={{ margin: "10px 0" }}><b>Custom fields</b> (Settings → Preferences → <b>Invoices</b> → Field Customization, and repeat for <b>Credit Notes</b>): <code>cf_zatca_uuid</code> (Text), <code>cf_zatca_status</code> (Text/Dropdown), <code>cf_zatca_qr_code</code> (Multi-line), <code>cf_zatca_error</code> (Multi-line). Optional — write-back also posts a comment + attaches the PDF even without these.</li>
        <li style={{ margin: "10px 0" }}><b>Webhook for invoices</b> (Settings → Automation → Workflow Rules → on <b>Invoices</b>, created/sent → Webhook):
          <div style={hint}>URL (POST):</div><div style={copybox}>{base}/api/zoho/webhook</div>
          <div style={hint}>Header:</div><div style={copybox}>x-api-key: &lt;your integration key from ①&gt;</div>
          <div style={hint}>Body:</div><pre style={codeBox}>{zohoBody}</pre>
        </li>
        <li style={{ margin: "10px 0" }}><b>Webhook for credit notes</b> (same place, but a Workflow Rule on the <b>Credit Notes</b> module) — so 381 adjustments clear too. Same URL &amp; header; body uses the credit-note id:
          <div style={hint}>Body:</div><pre style={codeBox}>{zohoCnBody}</pre>
          <span style={hint}>Debit notes (383): if you issue them as an invoice subtype, the invoice webhook already covers them; the middleware detects the debit type and references the original.</span>
        </li>
      </ol>
    </div>
  );
}

function OdooGuide({ base, apiKey, connected }: { base: string; apiKey?: string; connected: boolean }) {
  const hookUrl = `${base}/api/odoo/webhook?apiKey=${apiKey || "<generate your key in ① first>"}`;
  return (
    <>
      <div style={card}>
        <h4 style={{ margin: "0 0 6px" }}>② Find your Odoo connection values</h4>
        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer", color: "#1F6FB2", fontWeight: 600 }}>🔍 Where do I find each value?</summary>
          <div style={{ padding: "10px 12px", marginTop: 6, background: "#f7f9fc", border: "1px solid #e3e8ef", borderRadius: 8, color: "#33414f", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 6px" }}><b>URL</b> — your browser&apos;s address bar when Odoo is open, e.g. <code>https://yourco.odoo.com</code>.</p>
            <p style={{ margin: "0 0 6px" }}><b>Database</b> — usually the word before <code>.odoo.com</code>. Unsure? Settings → bottom → &quot;Activate developer mode&quot;, it then shows in Settings → Technical / ⚙️ About.</p>
            <p style={{ margin: "0 0 6px" }}><b>Username</b> — the email you log into Odoo with.</p>
            <p style={{ margin: 0 }}><b>API key</b> — profile photo → My Profile → Account Security → New API Key → name it &quot;ZATCA&quot; → Generate → copy.</p>
          </div>
        </details>
      </div>
      <div style={card}>
        <h4 style={{ margin: "0 0 6px" }}>③ Make it automatic in Odoo</h4>

        {/* Primary path: we do it for you over RPC */}
        <div style={{ background: "#eef5fc", border: "1px solid #bcd9f2", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#155a93" }}>⚡ Let us set it up for you (recommended)</p>
          <p style={{ ...hint, margin: "0 0 10px" }}>
            We&apos;ll connect to your Odoo and create everything automatically — install the <b>Automation Rules</b> app
            if needed, add the webhook <b>Server Action</b>, and the <b>Automated Action</b> that fires it on every posted
            customer invoice. No Technical menus, no clicking.
          </p>
          {connected ? (
            <form action={provisionOdooAutomation}>
              <button type="submit" style={btn}>⚡ Set up automation in Odoo for me →</button>
            </form>
          ) : (
            <p style={{ ...hint, margin: 0, color: "#c0392b" }}>Connect Odoo below first, then this button appears.</p>
          )}
        </div>

        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer", color: "#6b7785", fontWeight: 600 }}>Prefer to do it by hand in Odoo? (manual steps)</summary>
          <div style={{ marginTop: 10 }}>
        <p style={hint}>Create a <b>Server Action</b> that sends each posted invoice to this middleware, and an <b>Automated Action</b> that runs it. We use Odoo&apos;s native <b>Send Webhook Notification</b> — Odoo&apos;s &quot;Execute Code&quot; sandbox blocks <code>import</code> (the &quot;forbidden opcode&quot; error), so a webhook action is the reliable, no-code way. If you don&apos;t see <b>Automated Actions</b> under Settings → Technical → Automation, install the <b>Automation Rules</b> app first (Apps → search <code>Automation Rules</code> → Activate).</p>

        <p style={{ fontWeight: 700, margin: "14px 0 4px", color: "#155a93" }}>A. Create the Server Action</p>
        <ol style={ol}>
          <li style={{ margin: "7px 0" }}>If you don&apos;t see <b>Technical</b>: Settings → scroll to the bottom → <b>Activate the developer mode</b>.</li>
          <li style={{ margin: "7px 0" }}>Go to <b>Settings → Technical → Actions → Server Actions</b> → <b>New</b>.</li>
          <li style={{ margin: "7px 0" }}><b>Name</b>: <code>ZATCA Auto-Clearance</code>.</li>
          <li style={{ margin: "7px 0" }}><b>Model</b>: choose <b>Journal Entry</b> (technical name <code>account.move</code>) — not the default <i>&quot;Account&quot;</i>.</li>
          <li style={{ margin: "7px 0" }}><b>Type</b>: click <b>Send Webhook Notification</b>.</li>
          <li style={{ margin: "7px 0" }}><b>URL</b> field — paste this (your key is already embedded):
            <div style={copybox}>{hookUrl}</div>
            <span style={hint}>The key rides in the URL because webhook actions can&apos;t send custom headers; Odoo posts its native record payload, which the middleware reads.</span>
          </li>
          <li style={{ margin: "7px 0" }}><b>Save</b> (the cloud / save icon).</li>
        </ol>

        <p style={{ fontWeight: 700, margin: "16px 0 4px", color: "#155a93" }}>B. Create the Automated Action (the trigger)</p>
        <ol style={ol}>
          <li style={{ margin: "7px 0" }}>Go to <b>Settings → Technical → Automation → Automated Actions</b> → <b>New</b>.</li>
          <li style={{ margin: "7px 0" }}><b>Name</b>: <code>ZATCA on Posted Invoice</code>.</li>
          <li style={{ margin: "7px 0" }}><b>Model</b>: <b>Journal Entry</b> (<code>account.move</code>).</li>
          <li style={{ margin: "7px 0" }}><b>Trigger</b>: select <b>On Save</b> (older Odoo calls it <b>On Update</b>).</li>
          <li style={{ margin: "7px 0" }}><b>Apply on / Domain</b>: <code>[(&quot;state&quot;,&quot;=&quot;,&quot;posted&quot;)]</code> (only posted invoices).</li>
          <li style={{ margin: "7px 0" }}><b>Actions To Do</b> → add → pick <b>ZATCA Auto-Clearance</b> from step A.</li>
          <li style={{ margin: "7px 0" }}><b>Save.</b></li>
        </ol>

        <details style={{ margin: "8px 0", fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer", color: "#6b7785" }}>Already had a ZATCA action from a previous setup? (optional)</summary>
          <div style={{ padding: "10px 12px", marginTop: 6, background: "#f7f9fc", border: "1px solid #e3e8ef", borderRadius: 8, color: "#3a4a5a", lineHeight: 1.6 }}>
            Reuse it instead of creating a new one — open it and set its <b>URL</b> to the value above. No duplicate, no clash.
          </div>
        </details>

          </div>
        </details>

        <p style={{ ...hint, marginTop: 14 }}><b>Test (either path):</b> open a draft customer invoice in Odoo → <b>Confirm</b> (post it). In a few seconds its <code>x_zatca_status</code> becomes <code>cleared</code>/<code>reported</code> with a QR + UUID, and it shows on your Dashboard here. The middleware de-duplicates by invoice number, so the same invoice won&apos;t create duplicate records.</p>
      </div>
    </>
  );
}
