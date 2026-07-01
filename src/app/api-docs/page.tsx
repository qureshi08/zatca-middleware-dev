import Link from "next/link";
import { headers } from "next/headers";
import { getOnboardingState } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveZatcaEnv } from "@/lib/zatca/actions";
import { cbt, card, btn, ghostBtn, hint, pageTitle, pageSubtitle, copybox, codeBox } from "@/lib/ui";
import TryIt from "./TryIt";

export const maxDuration = 60;

function Req({ ok, children, href }: { ok: boolean; children: React.ReactNode; href?: string }) {
  return (
    <li style={{ margin: "6px 0", color: ok ? cbt.success : cbt.textBody, display: "flex", gap: 8, alignItems: "baseline" }}>
      <span>{ok ? "✅" : "⬜"}</span>
      <span>{children}{!ok && href && <> — <Link href={href} style={{ color: cbt.primary, fontWeight: 600 }}>do it →</Link></>}</span>
    </li>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { POST: "#E6F5ED|#007A3D", GET: "#eef2f6|#445" };
  const [bg, fg] = (colors[method] || "#eef2f6|#445").split("|");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${cbt.border}` }}>
      <span style={{ background: bg, color: fg, fontWeight: 700, fontSize: 11, padding: "3px 8px", borderRadius: 6, minWidth: 42, textAlign: "center" }}>{method}</span>
      <code style={{ fontSize: 12.5, flex: 1 }}>{path}</code>
      <span style={{ ...hint, margin: 0, textAlign: "right", maxWidth: 260 }}>{desc}</span>
    </div>
  );
}

export default async function ApiDocsPage() {
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;
  const { org, profileComplete, zatcaOnboarded } = state;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const { count } = await supabaseAdmin.from("api_keys").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "active");
  const hasKey = (count ?? 0) > 0;
  const live = (await getActiveZatcaEnv(org.id)) === "real";
  const ready = profileComplete && zatcaOnboarded;

  const submitBody = `{
  "type": "standard",              // "standard" (B2B) | "simplified" (B2C)
  "documentType": "388",           // 388 invoice | 381 credit | 383 debit
  "invoiceId": "INV-1001",
  "buyer": {                        // required for "standard" only
    "partyIdentification": { "id": "310175397400003", "schemeID": "TXID" },
    "postalAddress": { "streetName": "King Fahd Road", "buildingNumber": "1000",
      "citySubdivisionName": "Al Olaya", "cityName": "Riyadh",
      "postalZone": "11564", "country": "SA" },
    "partyTaxScheme": { "companyID": "310175397400003" },
    "partyLegalEntity": { "registrationName": "Al-Faisal Trading Co." }
  },
  "items": [
    { "name": "Consulting", "quantity": 1, "unitPrice": 1000,
      "vatCategory": "S", "vatRate": 15 }
  ]
  // credit/debit notes also need: "originalInvoiceId", "creditReason"
}`;
  const responseBody = `{
  "success": true,
  "zatcaStatus": "CLEARED",          // or "REPORTED" (simplified)
  "uuid": "…", "invoiceHash": "…",
  "qrCode": "data:image/png;base64,…",
  "signedXml": "<base64 UBL XML>",
  "timestamp": "2026-…Z"
}`;
  const curl = `curl -X POST ${base}/api/v1/zatca/invoices/submit \\
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \\
  -d @invoice.json`;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h1 style={pageTitle}>Developer API</h1>
      <p style={pageSubtitle}>Clear invoices with ZATCA straight from your own software — one authenticated call. {live ? <b style={{ color: cbt.success }}>You&apos;re Live.</b> : <>You&apos;re in <b style={{ color: "#8a5a00" }}>Demo</b> (simulation).</>}</p>

      {/* JOURNEY / PREREQUISITES */}
      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>Before you start</h3>
        <p style={{ ...hint, margin: "0 0 8px" }}>The API signs invoices with your ZATCA identity, so a little one-time setup is required:</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13.5 }}>
          <Req ok={profileComplete} href="/profile">Complete your <b>business profile</b> (legal name, VAT, address)</Req>
          <Req ok={zatcaOnboarded} href="/onboarding?step=4">Run <b>ZATCA onboarding</b> (Demo) to get signing credentials</Req>
          <Req ok={hasKey} href="/settings">Generate an <b>API key</b> (Settings → Integration keys)</Req>
        </ul>
        {!ready && <div style={{ marginTop: 10, background: cbt.warnBg, border: `1px solid ${cbt.warnBorder}`, color: "#8a5a00", fontSize: 12.5, padding: "8px 11px", borderRadius: 7 }}>Finish the unchecked steps above — the API can&apos;t sign invoices until then.</div>}
      </div>

      {/* TRY IT */}
      <div style={card}>
        <h3 style={{ margin: "0 0 4px" }}>▶ Try it now <span style={{ fontWeight: 400, color: cbt.textFaint, fontSize: 12 }}>· no key needed</span></h3>
        <p style={{ ...hint, margin: "0 0 12px" }}>Send a real request from here to see exactly what your software will get back. Pick a scenario, edit the JSON, hit Send.</p>
        {ready ? <TryIt /> : <p style={{ ...hint, color: cbt.error }}>Complete the setup above first, then the tester will work.</p>}
      </div>

      {/* AUTH */}
      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>Authentication</h3>
        <p style={hint}>Every request carries your API key in a header. Keep it secret (server-side only); rotate/revoke anytime in <Link href="/settings">Settings</Link>.</p>
        <div style={copybox}>x-api-key: sk_zatca_live_…</div>
      </div>

      {/* ENDPOINTS */}
      <div style={card}>
        <h3 style={{ margin: "0 0 8px" }}>Endpoints</h3>
        <EndpointRow method="POST" path="/api/v1/zatca/invoices/submit" desc="Sign + clear/report an invoice" />
        <EndpointRow method="GET" path="/api/v1/zatca/invoices" desc="List your invoices" />
        <EndpointRow method="GET" path="/api/v1/zatca/summary" desc="Cleared/reported/failed KPIs" />

        <p style={{ ...hint, marginTop: 16, marginBottom: 2 }}><b>POST /submit — request body</b></p>
        <pre style={codeBox}>{submitBody}</pre>
        <p style={{ ...hint, marginTop: 10, marginBottom: 2 }}><b>Response</b> (<code>422</code> on ZATCA rejection with <code>validationMessages</code>, <code>401</code> on a bad key)</p>
        <pre style={codeBox}>{responseBody}</pre>
      </div>

      {/* TOOLS */}
      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>Test from your tools</h3>
        <p style={{ ...hint, margin: "0 0 8px" }}>Grab a key from <Link href="/settings">Settings</Link>, then:</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <a href={`${base}/api/postman`} style={btn} download>⬇ Download Postman collection</a>
          <Link href="/settings" style={ghostBtn}>Manage API keys</Link>
        </div>
        <p style={{ ...hint, marginBottom: 2 }}><b>cURL</b></p>
        <pre style={codeBox}>{curl}</pre>
      </div>

      {/* AFTER */}
      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>What happens after you submit</h3>
        <p style={{ ...hint, margin: 0 }}>Each accepted invoice is signed, filed against your active environment ({live ? "ZATCA core — legally filed" : "Demo simulation — not legally filed"}), and appears on your <Link href="/invoices">Invoices</Link> and <Link href="/activity">Activity</Link> pages (with the failure reason if it&apos;s rejected). When you&apos;re ready for real filing, <Link href="/onboarding?step=4">go live</Link> — the same API then files against ZATCA core, no code changes.</p>
      </div>
    </div>
  );
}
