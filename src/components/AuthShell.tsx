import Link from "next/link";

/**
 * Shared branded wrapper for all auth screens (login, signup, password reset),
 * so they share one consistent, production-looking identity.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footerNote,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#E6F5ED 0%,#F7F8F7 55%,#E6F5ED 100%)", padding: 20 }}>
      <div style={{ width: 410 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <Link href="/login" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "#00994D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17 }}>Z</span>
            <span style={{ fontWeight: 800, color: "#007A3D", fontSize: 17, letterSpacing: -0.2 }}>ZATCA Middleware</span>
          </Link>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 14, padding: "26px 26px 24px", boxShadow: "0 8px 30px rgba(0,153,77,.08)" }}>
          <h1 style={{ fontSize: 19, color: "#1a2b3c", margin: "0 0 4px" }}>{title}</h1>
          {subtitle && <p style={{ color: "#6b7785", fontSize: 13, margin: "0 0 18px" }}>{subtitle}</p>}
          {children}
        </div>
        <p style={{ color: "#8a97a6", fontSize: 11.5, textAlign: "center", marginTop: 16 }}>
          {footerNote || <>ZATCA Phase-2 e-invoicing · KSA · Secure by design</>}
        </p>
      </div>
    </div>
  );
}

export const authInput: React.CSSProperties = { width: "100%", padding: "11px 12px", border: "1px solid #cfd8e3", borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
export const authLabel: React.CSSProperties = { display: "block", fontSize: 12.5, color: "#33414f", margin: "0 0 5px", fontWeight: 600 };
export const authBtn: React.CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: 9, border: "none", background: "#00994D", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" };
export const authGhostBtn: React.CSSProperties = { width: "100%", padding: "11px 16px", borderRadius: 9, border: "1px solid #cfd8e3", background: "#fff", color: "#33414f", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };
