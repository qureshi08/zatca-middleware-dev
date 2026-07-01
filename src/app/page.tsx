import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/org";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/admin";
import { getActiveZatcaEnv } from "@/lib/zatca/actions";
import SignOutButton from "@/components/SignOutButton";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "16px 18px" };

function Pill({ s }: { s: string | null }) {
  const v = (s || "").toUpperCase();
  const map: Record<string, [string, string]> = { CLEARED: ["#e6f6ec", "#1f9d57"], REPORTED: ["#E6F5ED", "#00994D"], REJECTED: ["#fdeeea", "#c0392b"], FAILED: ["#fdeeea", "#c0392b"] };
  const [bg, fg] = map[v] || ["#f3f0e6", "#c77700"];
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 600, background: bg, color: fg }}>{v || "PENDING"}</span>;
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li style={{ margin: "5px 0", color: ok ? "#1f9d57" : "#6b7785" }}>{ok ? "✅" : "⬜"} {children}</li>;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Support staff aren't a customer tenant — send them straight to the console.
  if (isPlatformAdmin(user?.email)) redirect("/admin");
  const state = await getOnboardingState();

  type Inv = { id: string; invoice_number: string; invoice_type: string; zatca_status: string | null; total_amount: number | null; created_at: string };
  let rows: Inv[] = [];
  if (state?.org) {
    const { data } = await supabaseAdmin
      .from("invoices")
      .select("id,invoice_number,invoice_type,zatca_status,total_amount,created_at")
      .eq("organization_id", state.org.id)
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as Inv[];
  }
  const live = state?.org ? (await getActiveZatcaEnv(state.org.id)) === "real" : false;
  const up = (s: string | null) => (s || "").toUpperCase();
  const cleared = rows.filter((i) => up(i.zatca_status) === "CLEARED").length;
  const reported = rows.filter((i) => up(i.zatca_status) === "REPORTED").length;
  const failed = rows.filter((i) => ["REJECTED", "FAILED"].includes(up(i.zatca_status))).length;
  const volume = rows.reduce((a, i) => a + Number(i.total_amount ?? 0), 0);

  const stepLabel: Record<string, string> = { profile: "Complete your business profile", integration: "Choose your accounting software", connect: "Connect your accounting software", zatca: "Run ZATCA onboarding (Demo)", done: "You're all set" };
  const stepHref: Record<string, string> = { profile: "/profile", integration: "/onboarding?step=2", connect: "/onboarding?step=3", zatca: "/onboarding?step=4", done: "/onboarding" };

  const kpis = [
    { l: "Cleared (B2B)", n: cleared, c: "#1f9d57" },
    { l: "Reported (B2C)", n: reported, c: "#00994D" },
    { l: "Failed", n: failed, c: "#c0392b" },
    { l: "Invoiced (SAR)", n: volume.toLocaleString(), c: "#007A3D" },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <h1 style={{ color: "#007A3D", fontSize: 22, margin: 0, flex: 1 }}>Dashboard</h1>
        {live
          ? <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#e9f8ef", color: "#1f7a45", border: "1px solid #b6e4c6", fontWeight: 600 }}>● Live · ZATCA</span>
          : <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#fff6e0", color: "#8a5a00", border: "1px solid #f0d48a", fontWeight: 600 }}>● Demo mode</span>}
        <SignOutButton />
      </div>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Signed in as <strong>{user?.email}</strong>{state?.org?.name ? ` · ${state.org.name}` : ""}{state?.integration ? ` · ${state.integration}` : ""}
      </p>

      {live ? (
        <div style={{ background: "#e9f8ef", border: "1px solid #b6e4c6", color: "#1f7a45", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "16px 0" }}>
          🟢 <strong>Live</strong> — invoices are legally filed with ZATCA (core).
        </div>
      ) : (
        <div style={{ background: "#fff6e0", border: "1px solid #f0d48a", color: "#8a5a00", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "16px 0" }}>
          ⚠️ <strong>Demo mode</strong> — invoices go to ZATCA simulation and are <strong>not legally filed</strong>. Switch to live in <Link href="/onboarding?step=4">onboarding</Link>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.l} style={card}><div style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.n}</div><div style={{ color: "#6b7785", fontSize: 12 }}>{k.l}</div></div>
        ))}
      </div>

      {state && state.nextStep !== "done" && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Finish setup</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13.5 }}>
            <Check ok={state.profileComplete}>Business profile</Check>
            <Check ok={!!state.integration}>Accounting software chosen{state.integration ? ` — ${state.integration}` : ""}</Check>
            <Check ok={state.connected}>Connected &amp; verified</Check>
            <Check ok={state.zatcaOnboarded}>ZATCA onboarding (Demo)</Check>
          </ul>
          <Link href={stepHref[state.nextStep]} style={{ display: "inline-block", marginTop: 12, background: "#00994D", color: "#fff", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
            Next: {stepLabel[state.nextStep]} →
          </Link>
        </div>
      )}

      <div style={{ ...card, marginTop: 16, padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: rows.length ? "1px solid #eef2f6" : "none" }}>
          <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>Recent invoices</h3>
          <Link href="/invoices" style={{ color: "#00994D", fontSize: 13 }}>View all →</Link>
        </div>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px", color: "#8a97a6", fontSize: 13 }}>
            No invoices yet. {state?.zatcaOnboarded ? <Link href="/onboarding?step=4">Send a test invoice →</Link> : <Link href="/onboarding">Finish onboarding →</Link>}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {rows.slice(0, 6).map((i) => (
                <tr key={i.id}>
                  <td style={{ padding: "10px 18px", borderBottom: "1px solid #f5f7fa", fontWeight: 500 }}>{i.invoice_number}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f5f7fa", textTransform: "capitalize", color: "#6b7785" }}>{i.invoice_type}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f5f7fa" }}>SAR {Number(i.total_amount ?? 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid #f5f7fa" }}><Pill s={i.zatca_status} /></td>
                  <td style={{ padding: "10px 18px", borderBottom: "1px solid #f5f7fa", textAlign: "right" }}><Link href={`/invoices/${i.id}`} style={{ color: "#00994D" }}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
