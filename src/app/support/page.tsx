import { getActiveOrg } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import { submitSupportRequest } from "@/lib/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#33414f", margin: "12px 0 4px", fontWeight: 600 };
const input: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid #cfd8e3", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };
const btn: React.CSSProperties = { background: "#00994D", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const banner = (bg: string, br: string, fg: string): React.CSSProperties => ({ background: bg, border: `1px solid ${br}`, color: fg, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 });
const pill = (s: string): React.CSSProperties => {
  const m: Record<string, [string, string]> = { open: ["#fff3df", "#b9770e"], in_progress: ["#E6F5ED", "#00994D"], resolved: ["#e6f6ec", "#1f9d57"] };
  const [bg, fg] = m[s] || ["#eef2f6", "#67788a"];
  return { background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, textTransform: "capitalize" };
};

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string }> }) {
  const sp = await searchParams;
  const org = await getActiveOrg();
  if (!org) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  let rows: any[] = [];
  let tableMissing = false;
  try {
    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,category,subject,message,requested_software,status,admin_note,created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) tableMissing = true;
    else rows = data ?? [];
  } catch { tableMissing = true; }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 820 }}>
      <h1 style={{ color: "#007A3D", fontSize: 22, margin: 0 }}>Support</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Need help, or want us to support a different accounting software? Send our team a message — we&apos;ll get back to you.
      </p>

      {sp.sent && <div style={banner("#e9f8ef", "#b6e4c6", "#1f9d57")}>✅ Your request was sent. Our support team will reach out by email.</div>}
      {sp.err && <div style={banner("#fdeee9", "#f0c0b3", "#c0392b")}>❌ {sp.err}</div>}

      <div style={card}>
        <h3 style={{ margin: "0 0 6px" }}>Contact support</h3>
        <form action={submitSupportRequest}>
          <label style={label}>What do you need?</label>
          <select style={input} name="category" defaultValue="general">
            <option value="general">General help</option>
            <option value="integration_request">Request an accounting software / integration</option>
            <option value="bug">Report a problem</option>
            <option value="billing">Billing / account</option>
          </select>
          <label style={label}>Which software? <span style={{ color: "#8a97a6", fontWeight: 400 }}>(only if requesting an integration)</span></label>
          <input style={input} name="requested_software" placeholder="e.g. QuickBooks, Xero, Microsoft Dynamics, SAP…" />
          <label style={label}>Subject</label>
          <input style={input} name="subject" required placeholder="Short summary" />
          <label style={label}>Message</label>
          <textarea style={{ ...input, minHeight: 110, resize: "vertical" }} name="message" required placeholder="Tell us what you need, with any details that help." />
          <button type="submit" style={{ ...btn, marginTop: 16 }}>Send to support →</button>
        </form>
      </div>

      <div style={{ ...card, padding: 0 }}>
        <h3 style={{ margin: 0, padding: "16px 20px", borderBottom: rows.length ? "1px solid #eef2f6" : "none", fontSize: 15 }}>Your requests</h3>
        {tableMissing ? (
          <div style={{ padding: "20px", color: "#b9770e", fontSize: 13 }}>Support inbox isn&apos;t initialized yet — run <code>supabase_support_requests.sql</code> in Supabase.</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center", color: "#8a97a6", fontSize: 13 }}>No requests yet.</div>
        ) : (
          <div>
            {rows.map((r) => (
              <div key={r.id} style={{ padding: "14px 20px", borderTop: "1px solid #f3f6f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.subject}</span>
                  <span style={pill(r.status)}>{r.status.replace("_", " ")}</span>
                  <span style={{ marginLeft: "auto", color: "#8a97a6", fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div style={{ color: "#5a6b7b", fontSize: 12.5, marginTop: 4 }}>{r.category.replace("_", " ")}{r.requested_software ? ` · ${r.requested_software}` : ""}</div>
                <div style={{ color: "#33414f", fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.message}</div>
                {r.admin_note && <div style={{ marginTop: 8, background: "#E6F5ED", border: "1px solid #b7e0c8", color: "#007A3D", fontSize: 12.5, padding: "8px 10px", borderRadius: 7 }}><b>Support:</b> {r.admin_note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
