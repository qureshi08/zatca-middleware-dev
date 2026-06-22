import Link from "next/link";
import { headers } from "next/headers";
import { getOnboardingState } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import {
  generateKeyForSettings, revokeApiKey, toggleAutoSubmit, retestConnection, provisionOdooAutomation,
} from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
const hint: React.CSSProperties = { fontSize: 11.5, color: "#8a97a6", margin: "0 0 4px" };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const ghost: React.CSSProperties = { ...btn, background: "#fff", color: "#1F6FB2", border: "1px solid #1F6FB2" };
const gray: React.CSSProperties = { ...btn, background: "#eef2f6", color: "#445" };
const danger: React.CSSProperties = { ...btn, background: "#fff", color: "#c0392b", border: "1px solid #e3b4ab", padding: "5px 12px", fontSize: 12 };
const copybox: React.CSSProperties = { background: "#0f2233", color: "#cfe3f5", padding: "9px 12px", borderRadius: 7, fontFamily: "Consolas,monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0" };
const banner = (bg: string, br: string, fg: string): React.CSSProperties => ({ background: bg, border: `1px solid ${br}`, color: fg, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 });
const pill = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.3 });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ newkey?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const state = await getOnboardingState();
  if (!state) return <div style={{ padding: 32 }}>Not authenticated.</div>;
  const { org, integration, connected } = state;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  // Connection details for the active integration
  type OdooCfg = { odoo_url: string; odoo_db: string; odoo_username: string; auto_submit: boolean; status: string; last_sync: string | null };
  type ZohoCfg = { zoho_org_id: string; auto_submit: boolean; status: string; last_sync: string | null };
  let odoo: OdooCfg | null = null;
  let zoho: ZohoCfg | null = null;
  if (integration === "odoo") {
    const { data } = await supabaseAdmin.from("odoo_config").select("odoo_url,odoo_db,odoo_username,auto_submit,status,last_sync").eq("organization_id", org.id).maybeSingle();
    odoo = (data as unknown) as OdooCfg | null;
  } else if (integration === "zoho") {
    const { data } = await supabaseAdmin.from("zoho_config").select("zoho_org_id,auto_submit,status,last_sync").eq("organization_id", org.id).maybeSingle();
    zoho = (data as unknown) as ZohoCfg | null;
  }
  const autoSubmit = odoo?.auto_submit ?? zoho?.auto_submit ?? true;
  const lastSync = odoo?.last_sync ?? zoho?.last_sync ?? null;

  // Integration keys
  const { data: keys } = await supabaseAdmin
    .from("api_keys")
    .select("id,key_prefix,name,status,created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });
  const activeKeys = (keys || []).filter((k) => k.status === "active");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 880 }}>
      <h1 style={{ color: "#155a93", fontSize: 22, margin: 0 }}>Settings</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Manage your connection, automation, and integration keys. You&apos;re in <strong>Demo mode</strong> (ZATCA simulation) — nothing is legally filed.
      </p>

      {sp.msg && <div style={banner("#e9f8ef", "#b6e4c6", "#1f9d57")}>✅ {sp.msg}</div>}
      {sp.err && <div style={banner("#fdeee9", "#f0c0b3", "#c0392b")}>❌ {sp.err}</div>}
      {sp.newkey && (
        <div style={banner("#fff6e0", "#f0d48a", "#8a5a00")}>
          🔑 New integration key — copy it now, it&apos;s shown only once:
          <div style={copybox}>{sp.newkey}</div>
        </div>
      )}

      {/* CONNECTION */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Connection</h3>
          <span style={connected ? pill("#e9f8ef", "#1f9d57") : pill("#fdeee9", "#c0392b")}>{connected ? "Connected" : "Disconnected"}</span>
        </div>
        {!integration ? (
          <p style={{ fontSize: 13, marginTop: 10 }}>No integration chosen yet. <Link href="/onboarding?step=2">Choose one →</Link></p>
        ) : (
          <>
            <table style={{ fontSize: 13, color: "#33414f", marginTop: 12, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>Software</td><td style={{ textTransform: "capitalize", fontWeight: 600 }}>{integration}</td></tr>
                {odoo && <>
                  <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>URL</td><td>{odoo.odoo_url}</td></tr>
                  <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>Database</td><td>{odoo.odoo_db}</td></tr>
                  <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>Username</td><td>{odoo.odoo_username}</td></tr>
                </>}
                {zoho && <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>Organization</td><td>{zoho.zoho_org_id}</td></tr>}
                <tr><td style={{ padding: "3px 16px 3px 0", color: "#8a97a6" }}>Last checked</td><td>{lastSync ? new Date(lastSync).toLocaleString() : "—"}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <form action={retestConnection}><button type="submit" style={ghost}>Re-test connection</button></form>
              <Link href="/onboarding?step=3" style={gray}>Edit credentials</Link>
              {integration === "odoo" && connected && (
                <form action={provisionOdooAutomation}><button type="submit" style={btn}>⚡ Re-run Odoo automation setup</button></form>
              )}
            </div>
          </>
        )}
      </div>

      {/* AUTO-SUBMIT */}
      {integration && integration !== "custom" && (
        <div style={card}>
          <h3 style={{ margin: "0 0 6px" }}>Automatic clearance</h3>
          <p style={{ ...hint, margin: "0 0 10px" }}>
            When on, every posted invoice received from {integration === "odoo" ? "Odoo" : "Zoho"} is signed and cleared/reported with ZATCA automatically. Turn off to receive invoices without auto-submitting.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={autoSubmit ? pill("#e9f8ef", "#1f9d57") : pill("#eef2f6", "#67788a")}>{autoSubmit ? "On" : "Off"}</span>
            <form action={toggleAutoSubmit}>
              <input type="hidden" name="integration" value={integration} />
              <input type="hidden" name="value" value={(!autoSubmit).toString()} />
              <button type="submit" style={gray}>{autoSubmit ? "Turn off" : "Turn on"}</button>
            </form>
          </div>
        </div>
      )}

      {/* INTEGRATION KEYS */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Integration keys</h3>
          <form action={generateKeyForSettings}><button type="submit" style={btn}>Generate new key</button></form>
        </div>
        <p style={{ ...hint, margin: "8px 0 0" }}>Used as the <code>x-api-key</code> header (or <code>?apiKey=</code>) when your software calls this middleware. Revoking a key immediately stops it from working.</p>
        {activeKeys.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a97a6", marginTop: 12 }}>No active keys. Generate one above.</p>
        ) : (
          <table style={{ width: "100%", fontSize: 13, marginTop: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8a97a6", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px 6px 0", fontWeight: 600 }}>Name</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Prefix</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Created</th>
                <th style={{ padding: "6px 0", fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {activeKeys.map((k) => (
                <tr key={k.id} style={{ borderTop: "1px solid #eef2f6" }}>
                  <td style={{ padding: "8px 8px 8px 0" }}>{k.name}</td>
                  <td style={{ padding: "8px", fontFamily: "Consolas,monospace", color: "#6b7785" }}>{k.key_prefix}…</td>
                  <td style={{ padding: "8px", color: "#6b7785" }}>{k.created_at ? new Date(k.created_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    <form action={revokeApiKey}>
                      <input type="hidden" name="id" value={k.id} />
                      <button type="submit" style={danger}>Revoke</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ENVIRONMENT */}
      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>Environment</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={pill("#eef5fc", "#155a93")}>Demo · ZATCA simulation</span>
          <p style={{ ...hint, margin: 0 }}>Invoices clear against ZATCA&apos;s simulation environment — not legally filed. Production filing is a later step.</p>
        </div>
        {integration === "odoo" && (
          <p style={{ ...hint, marginTop: 12 }}>Odoo webhook endpoint: <code style={{ color: "#33414f" }}>{base}/api/odoo/webhook</code></p>
        )}
      </div>
    </div>
  );
}
