import Link from "next/link";
import { getActiveOrg } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10 };
const pill = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" });

type LogRow = {
  id: string;
  request_type: string;
  invoice_number: string | null;
  status: string;
  response_payload: any;
  created_at: string;
};

/** Pull a human-readable reason/detail out of the stored response payload. */
function detailOf(r: LogRow): string {
  const p = r.response_payload || {};
  if (p.error) return String(p.error);
  if (Array.isArray(p.validationMessages) && p.validationMessages.length) {
    return p.validationMessages.map((m: any) => (typeof m === "string" ? m : m?.message || JSON.stringify(m))).join("; ");
  }
  if (r.status === "success") {
    const uuid = p?.data?.uuid || p?.uuid;
    return uuid ? `Cleared · UUID ${String(uuid).slice(0, 8)}…` : "Processed";
  }
  return "—";
}

function sourceOf(r: LogRow): string {
  const p = r.response_payload || {};
  if (p.source) return String(p.source);
  const n = r.invoice_number || "";
  if (n.startsWith("Odoo#")) return "odoo";
  if (n.startsWith("Zoho#")) return "zoho";
  return "api";
}

export default async function ActivityPage() {
  const org = await getActiveOrg();
  if (!org) return <div style={{ padding: 32 }}>Not authenticated.</div>;

  const { data } = await supabaseAdmin
    .from("transaction_logs")
    .select("id,request_type,invoice_number,status,response_payload,created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(80);
  const rows = (data ?? []) as LogRow[];
  const failures = rows.filter((r) => r.status !== "success").length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <h1 style={{ color: "#007A3D", fontSize: 22, margin: 0 }}>Activity</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Every invoice/credit-note your accounting software sent here, and what happened — including failures, so you can see <em>why</em> something didn&apos;t clear.
      </p>

      {failures > 0 && (
        <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "14px 0" }}>
          ⚠️ {failures} of the last {rows.length} events failed — see the reason in each row below.
        </div>
      )}

      <div style={{ ...card, marginTop: 14, padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "44px 20px", color: "#8a97a6", fontSize: 13 }}>
            No webhook activity yet. Post an invoice in your accounting software — successes <em>and</em> failures will show here.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8a97a6", fontSize: 11, textTransform: "uppercase", background: "#f9fafc" }}>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>When</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Source</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Document</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ok = r.status === "success";
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #f0f3f7" }}>
                    <td style={{ padding: "9px 16px", color: "#6b7785", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ padding: "9px 12px", textTransform: "capitalize", color: "#33414f" }}>{sourceOf(r)}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 500 }}>{r.invoice_number || "—"}</td>
                    <td style={{ padding: "9px 12px", textTransform: "capitalize", color: "#6b7785" }}>{r.request_type}</td>
                    <td style={{ padding: "9px 12px" }}><span style={ok ? pill("#e6f6ec", "#1f9d57") : pill("#fdeeea", "#c0392b")}>{ok ? "Success" : "Failed"}</span></td>
                    <td style={{ padding: "9px 16px", color: ok ? "#6b7785" : "#c0392b", maxWidth: 360 }}>{detailOf(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: "#8a97a6", fontSize: 12, marginTop: 12 }}>
        Showing the last {rows.length} events. Cleared documents also appear on the <Link href="/invoices">Invoices</Link> page.
      </p>
    </div>
  );
}
