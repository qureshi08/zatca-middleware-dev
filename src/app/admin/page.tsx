import { getCurrentUser } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { updateSupportRequestStatus } from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, marginBottom: 16 };
const input: React.CSSProperties = { padding: "7px 9px", border: "1px solid #cfd8e3", borderRadius: 7, fontSize: 12.5 };
const btn: React.CSSProperties = { background: "#1F6FB2", color: "#fff", border: "none", padding: "7px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const pill = (s: string): React.CSSProperties => {
  const m: Record<string, [string, string]> = { open: ["#fff3df", "#b9770e"], in_progress: ["#e7f0fb", "#1F6FB2"], resolved: ["#e6f6ec", "#1f9d57"] };
  const [bg, fg] = m[s] || ["#eef2f6", "#67788a"];
  return { background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, textTransform: "capitalize" };
};
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#8a97a6", fontSize: 11, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 13, borderTop: "1px solid #f3f6f9" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user?.email)) {
    return (
      <div style={{ padding: "40px 32px", maxWidth: 600 }}>
        <h1 style={{ color: "#c0392b", fontSize: 20 }}>Not authorized</h1>
        <p style={{ color: "#6b7785", fontSize: 14 }}>This area is for ZATCA Middleware support staff only.</p>
      </div>
    );
  }

  // Tenants
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id,name,vat_number,integration,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const tenants = orgs ?? [];

  // Support inbox
  let requests: any[] = [];
  let tableMissing = false;
  try {
    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,category,subject,message,requested_software,status,admin_note,user_email,created_at,organizations(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) tableMissing = true;
    else requests = data ?? [];
  } catch { tableMissing = true; }
  const openCount = requests.filter((r) => r.status !== "resolved").length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1040 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ color: "#155a93", fontSize: 22, margin: 0, flex: 1 }}>Admin · Support</h1>
        <span style={{ background: "#1F6FB2", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 5, letterSpacing: 0.5 }}>SUPPORT STAFF</span>
      </div>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>All tenants and incoming support requests across the platform.</p>
      {sp.msg && <div style={{ background: "#e9f8ef", border: "1px solid #b6e4c6", color: "#1f9d57", padding: "9px 13px", borderRadius: 8, fontSize: 13, margin: "12px 0" }}>✅ {sp.msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "16px 0" }}>
        <div style={{ ...card, padding: "14px 16px", marginBottom: 0 }}><div style={{ fontSize: 24, fontWeight: 700, color: "#155a93" }}>{tenants.length}</div><div style={{ color: "#6b7785", fontSize: 12 }}>Tenants</div></div>
        <div style={{ ...card, padding: "14px 16px", marginBottom: 0 }}><div style={{ fontSize: 24, fontWeight: 700, color: "#1f9d57" }}>{tenants.filter((t) => t.status === "active").length}</div><div style={{ color: "#6b7785", fontSize: 12 }}>Active</div></div>
        <div style={{ ...card, padding: "14px 16px", marginBottom: 0 }}><div style={{ fontSize: 24, fontWeight: 700, color: openCount ? "#b9770e" : "#1f9d57" }}>{openCount}</div><div style={{ color: "#6b7785", fontSize: 12 }}>Open requests</div></div>
      </div>

      {/* SUPPORT INBOX */}
      <div style={card}>
        <h3 style={{ margin: 0, padding: "14px 18px", borderBottom: "1px solid #eef2f6", fontSize: 15 }}>Support inbox</h3>
        {tableMissing ? (
          <div style={{ padding: 18, color: "#b9770e", fontSize: 13 }}>Run <code>supabase_support_requests.sql</code> in Supabase to enable the support inbox.</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: "26px", textAlign: "center", color: "#8a97a6", fontSize: 13 }}>No support requests yet.</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={{ padding: "14px 18px", borderTop: "1px solid #f3f6f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.subject}</span>
                <span style={pill(r.status)}>{r.status.replace("_", " ")}</span>
                <span style={{ color: "#5a6b7b", fontSize: 12 }}>{r.category.replace("_", " ")}{r.requested_software ? ` · ${r.requested_software}` : ""}</span>
                <span style={{ marginLeft: "auto", color: "#8a97a6", fontSize: 12 }}>{r.organizations?.name || "—"} · {r.user_email || "—"} · {new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div style={{ color: "#33414f", fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.message}</div>
              <form action={updateSupportRequestStatus} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={r.id} />
                <select name="status" defaultValue={r.status} style={input}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <input name="admin_note" defaultValue={r.admin_note || ""} placeholder="Reply / internal note (visible to customer)" style={{ ...input, flex: 1, minWidth: 240 }} />
                <button type="submit" style={btn}>Update</button>
              </form>
            </div>
          ))
        )}
      </div>

      {/* TENANTS */}
      <div style={card}>
        <h3 style={{ margin: 0, padding: "14px 18px", borderBottom: "1px solid #eef2f6", fontSize: 15 }}>Tenants ({tenants.length})</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Business</th><th style={th}>VAT</th><th style={th}>Software</th><th style={th}>Status</th><th style={th}>Joined</th></tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td style={{ ...td, fontWeight: 500 }}>{t.name}</td>
                <td style={{ ...td, color: "#6b7785" }}>{t.vat_number || "—"}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{t.integration || "—"}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{t.status || "—"}</td>
                <td style={{ ...td, color: "#6b7785" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
