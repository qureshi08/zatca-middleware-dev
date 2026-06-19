"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/profile", label: "Business Profile" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/invoices", label: "Invoices" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{ width: 240, flexShrink: 0, background: "#0f2233", color: "#cdd8e3", minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #1d3a52", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1F6FB2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>Z</div>
        <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, lineHeight: 1.1 }}>
          ZATCA<br /><span style={{ fontWeight: 400, color: "#7d93a8", fontSize: 11 }}>Middleware</span>
        </div>
      </div>
      <nav style={{ marginTop: 12 }}>
        {NAV.map((item) => {
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
                background: active ? "#16293b" : "transparent",
                borderLeft: `3px solid ${active ? "#1F6FB2" : "transparent"}`,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
