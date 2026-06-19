import Link from "next/link";
import { getActiveOrg } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getActiveOrg();
  const { data: inv } = org
    ? await supabaseAdmin.from("invoices").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle()
    : { data: null };

  if (!inv) {
    return (
      <div style={{ padding: "28px 32px" }}>
        <p style={{ color: "#6b7785" }}>Invoice not found. <Link href="/invoices">← Back to invoices</Link></p>
      </div>
    );
  }

  const isImg = typeof inv.qr_code === "string" && inv.qr_code.length > 100;
  const status = (inv.zatca_status || inv.status || "").toUpperCase();
  const failed = ["REJECTED", "FAILED"].includes(status);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <p style={{ marginBottom: 8 }}><Link href="/invoices" style={{ color: "#1F6FB2", fontSize: 13 }}>← Invoices</Link></p>
      <h1 style={{ color: "#155a93", fontSize: 22, margin: 0 }}>
        {inv.invoice_number}{" "}
        <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 12, fontWeight: 600, verticalAlign: "middle", background: failed ? "#fdeeea" : status === "CLEARED" ? "#e6f6ec" : "#e7f0fb", color: failed ? "#c0392b" : status === "CLEARED" ? "#1f9d57" : "#1F6FB2" }}>{status || "PENDING"}</span>
      </h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4, textTransform: "capitalize" }}>
        {inv.invoice_type} · doc {inv.document_type} · {new Date(inv.created_at).toLocaleString()}
      </p>

      {failed && inv.error_reason && (
        <div style={{ background: "#fdeee9", border: "1px solid #f0c0b3", color: "#c0392b", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "12px 0" }}>
          <b>ZATCA rejected:</b> {inv.error_reason}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div style={card}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Details</h3>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Type", `${inv.invoice_type} → ${inv.invoice_type === "standard" ? "Clearance" : "Reporting"}`],
                ["Document type", inv.document_type],
                ["ZATCA status", status || "—"],
                ["UUID", inv.zatca_uuid || "—"],
                ["Total", `SAR ${Number(inv.total_amount ?? 0).toLocaleString()}`],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "6px 0", color: "#6b7785", width: 120 }}>{k}</td>
                  <td style={{ padding: "6px 0", fontFamily: k === "UUID" ? "Consolas,monospace" : undefined, wordBreak: "break-all" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Compliance artifacts</h3>
          {isImg ? (
            <div style={{ textAlign: "center" }}>
              {/* qr_code may be a base64 PNG or a TLV string */}
              {inv.qr_code.startsWith("data:") || inv.qr_code.startsWith("iVBOR") ? (
                <img alt="QR" src={inv.qr_code.startsWith("data:") ? inv.qr_code : `data:image/png;base64,${inv.qr_code}`} style={{ width: 130, height: 130 }} />
              ) : (
                <div style={{ fontFamily: "Consolas,monospace", fontSize: 10, wordBreak: "break-all", background: "#f5f7fa", padding: 8, borderRadius: 6 }}>{inv.qr_code.slice(0, 180)}…</div>
              )}
              <p style={{ color: "#6b7785", fontSize: 12, marginTop: 6 }}>QR (TLV)</p>
            </div>
          ) : (
            <p style={{ color: "#8a97a6", fontSize: 13 }}>No QR yet.</p>
          )}
          {inv.xml && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: "#1F6FB2", fontSize: 13 }}>View signed XML</summary>
              <pre style={{ background: "#0f2233", color: "#cfe3f5", padding: 10, borderRadius: 8, fontSize: 10.5, maxHeight: 280, overflow: "auto", marginTop: 6 }}>{inv.xml}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
