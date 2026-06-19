import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/org";
import SignOutButton from "@/components/SignOutButton";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e3e8ef", borderRadius: 10, padding: "18px 20px" };

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li style={{ margin: "6px 0", color: ok ? "#1f9d57" : "#6b7785" }}>
      {ok ? "✅" : "⬜"} {children}
    </li>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const state = await getOnboardingState();

  const stepLabel: Record<string, string> = {
    profile: "Complete your business profile",
    integration: "Choose your accounting software",
    connect: "Connect your accounting software",
    zatca: "Run ZATCA onboarding (Demo)",
    done: "You're all set",
  };
  const stepHref: Record<string, string> = { profile: "/profile", integration: "/onboarding", connect: "/onboarding", zatca: "/onboarding", done: "/onboarding" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <h1 style={{ color: "#155a93", fontSize: 22, margin: 0, flex: 1 }}>Dashboard</h1>
        <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#fff6e0", color: "#8a5a00", border: "1px solid #f0d48a", fontWeight: 600 }}>● Demo mode</span>
        <SignOutButton />
      </div>
      <p style={{ color: "#6b7785", fontSize: 13, marginTop: 4 }}>
        Signed in as <strong>{user?.email}</strong>{state?.org?.name ? ` · ${state.org.name}` : ""}
      </p>

      <div style={{ background: "#fff6e0", border: "1px solid #f0d48a", color: "#8a5a00", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "16px 0" }}>
        ⚠️ <strong>Demo mode</strong> — invoices go to ZATCA simulation and are <strong>not legally filed</strong>.
      </div>

      {state && (
        <div style={card}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Setup checklist</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13.5 }}>
            <Check ok={state.profileComplete}>Business profile (seller identity)</Check>
            <Check ok={!!state.integration}>Accounting software chosen{state.integration ? ` — ${state.integration}` : ""}</Check>
            <Check ok={state.connected}>Connected &amp; verified</Check>
            <Check ok={state.zatcaOnboarded}>ZATCA onboarding (Demo)</Check>
          </ul>
          {state.nextStep !== "done" && (
            <Link href={stepHref[state.nextStep]} style={{ display: "inline-block", marginTop: 14, background: "#1F6FB2", color: "#fff", padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              Next: {stepLabel[state.nextStep]} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
