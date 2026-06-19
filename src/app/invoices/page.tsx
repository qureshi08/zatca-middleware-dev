import Link from "next/link";
import { getActiveOrg } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";

type Inv = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  document_type: string;
  status: string;
  total_amount: number | null;
  zatca_status: string | null;
  created_at: string;
};

function Pill({ s }: { s: string | null }) {
  const v = (s || "").toUpperCase();
  const map: Record<string, [string, string]> = {
    CLEARED: ["#e6f6ec", "#1f9d57"],
    REPORTED: ["#e7f0fb", "#1F6FB2"],
    REJECTED: ["#fdeeea", "#c0392b"],
    FAILED: ["#fdeeea", "#c0392b"],
  };
  const [bg, fg] = map[v] || ["#f3f0e6", "#c77700"];
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 600, background: bg, color: fg }}>{v || "PENDING"}</span>;
}

export default async function InvoicesPage() {
  const org = await getActiveOrg();
  const { data } = org
    ? await supabaseAdmin
        .from("invoices")
        .select("id,invoice_number,invoice_type,document_type,status,total_amount,zatca_status,created_at")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as Inv[] };
  const rows = (data ?? []) as Inv[];

  const count = (f: (i: Inv) => boolean) => rows.filter(f).length;
  const kpis = [
    { l: "Total", n: rows.length, c: "#155a93" },
    { l: "Cleared", n: count((i) => i.zatca_status === "CLEARED"), c: "#1f9d57" },
    { l: "Reported", n: count((i) => i.zatca_status === "REPORTED"), c: "#1F6FB2" },
    { l: "Failed", n: count((i) => ["REJECTED", "FAILED"].includes((i.zatca_status || "").toUpperCase())), c: "#c0392b" },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <h1 style={{ color: "#155a93", fontSize: 22, margin: 0 }}>Invoices</h1>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>Every invoice processed for {org?.name ?? "your business"} — Demo (ZATCA simulation).</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "16px 0" }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.c }}>{k.n}</div>
            <div style={{ color: "#6b7785", fontSize: 12 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#8a97a6" }}>
            <div style={{ fontSize: 34 }}>🧾</div>
            <p style={{ marginTop: 8 }}>No invoices yet.</p>
            <p style={{ fontSize: 13 }}>Post an invoice in your accounting software, or <Link href="/onboarding">send a test invoice →</Link></p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7785", fontSize: 11.5, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>Invoice</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>Type</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>Doc</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>Amount</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>ZATCA</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}>Date</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #e3e8ef" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7", fontWeight: 500 }}>{i.invoice_number}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7", textTransform: "capitalize" }}>{i.invoice_type}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7" }}>{i.document_type}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7" }}>SAR {Number(i.total_amount ?? 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7" }}><Pill s={i.zatca_status} /></td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7", color: "#6b7785" }}>{new Date(i.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f3f7" }}><Link href={`/invoices/${i.id}`} style={{ color: "#1F6FB2" }}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
