"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/profile", label: "Business Profile" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/invoices", label: "Invoices" },
  { href: "/activity", label: "Activity" },
  { href: "/api-docs", label: "Developer API" },
  { href: "/support", label: "Support" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar({ email, isAdmin }: { email?: string; isAdmin?: boolean }) {
  const path = usePathname();
  // Support staff get a focused console nav, not the customer onboarding links.
  const nav = isAdmin ? [{ href: "/admin", label: "Admin · Support" }] : NAV;

  return (
    <aside style={{ width: 240, flexShrink: 0, background: "#0d1f15", color: "#cdd8e3", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #1c3a2a", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#00994D", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>Z</div>
        <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, lineHeight: 1.1 }}>
          ZATCA<br /><span style={{ fontWeight: 400, color: "#7d93a8", fontSize: 11 }}>Middleware</span>
        </div>
      </div>

      <nav style={{ marginTop: 12, flex: 1 }}>
        {nav.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "9px 20px",
                fontSize: 13,
                textDecoration: "none",
                color: active ? "#fff" : "#cdd8e3",
                background: active ? "#12291b" : "transparent",
                borderLeft: `3px solid ${active ? "#00994D" : "transparent"}`,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "14px 18px", borderTop: "1px solid #1c3a2a" }}>
        {email && (
          <div style={{ fontSize: 11.5, color: "#7d93a8", marginBottom: 9, wordBreak: "break-all", lineHeight: 1.4 }}>
            {isAdmin && <span style={{ display: "inline-block", background: "#00994D", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 6, letterSpacing: 0.5, verticalAlign: "middle" }}>SUPPORT</span>}
            {email}
          </div>
        )}
        <SignOutButton dark />
      </div>
    </aside>
  );
}
