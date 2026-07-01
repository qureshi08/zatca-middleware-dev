/**
 * Shared CBT-branded UI style kit. Single source of truth for the inline style
 * objects that were previously copy-pasted into every page. Import these instead
 * of re-declaring `card`/`btn`/`label`/… per file.
 */
import type { CSSProperties } from "react";

/** CBT brand tokens (mirrors globals.css :root). */
export const cbt = {
  primary: "#00994D",
  primaryDark: "#007A3D",
  primaryLight: "#00C060",
  primaryMuted: "#E6F5ED",
  surface: "#F7F8F7",
  border: "#e3e8ef",
  textHeading: "#111827",
  textBody: "#33414f",
  textMuted: "#6b7785",
  textFaint: "#8a97a6",
  success: "#1f9d57",
  successBg: "#e9f8ef",
  successBorder: "#b6e4c6",
  warn: "#b9770e",
  warnBg: "#fff6e0",
  warnBorder: "#f0d48a",
  error: "#c0392b",
  errorBg: "#fdeee9",
  errorBorder: "#f0c0b3",
} as const;

export const pageTitle: CSSProperties = { color: cbt.primaryDark, fontSize: 22, margin: 0 };
export const pageSubtitle: CSSProperties = { color: cbt.textMuted, fontSize: 13, marginTop: 4 };

export const card: CSSProperties = { background: "#fff", border: `1px solid ${cbt.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 14 };
export const label: CSSProperties = { display: "block", fontSize: 12, color: cbt.textBody, margin: "12px 0 4px", fontWeight: 600 };
export const input: CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid #cfd8e3", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };
export const hint: CSSProperties = { fontSize: 11.5, color: cbt.textFaint, margin: "0 0 4px" };

export const btn: CSSProperties = { background: cbt.primary, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" };
export const ghostBtn: CSSProperties = { ...btn, background: "#fff", color: cbt.primary, border: `1px solid ${cbt.primary}` };
export const grayBtn: CSSProperties = { ...btn, background: "#eef2f6", color: "#445" };

export const copybox: CSSProperties = { background: "#0d1f15", color: "#cfe3f5", padding: "9px 12px", borderRadius: 7, fontFamily: "var(--font-mono), Consolas, monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0" };

/** Coloured message banner. */
export const banner = (bg: string, br: string, fg: string): CSSProperties => ({ background: bg, border: `1px solid ${br}`, color: fg, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 });
export const successBanner = banner(cbt.successBg, cbt.successBorder, cbt.success);
export const errorBanner = banner(cbt.errorBg, cbt.errorBorder, cbt.error);
export const warnBanner = banner(cbt.warnBg, cbt.warnBorder, "#8a5a00");

/** Status pill styling for both support statuses and ZATCA/invoice statuses. */
export function statusPill(status: string): CSSProperties {
  const s = (status || "").toLowerCase();
  const map: Record<string, [string, string]> = {
    open: ["#fff3df", cbt.warn],
    in_progress: [cbt.primaryMuted, cbt.primary],
    resolved: ["#e6f6ec", cbt.success],
    cleared: ["#e6f6ec", cbt.success],
    reported: [cbt.primaryMuted, cbt.primary],
    rejected: [cbt.errorBg, cbt.error],
    failed: [cbt.errorBg, cbt.error],
  };
  const [bg, fg] = map[s] || ["#eef2f6", "#67788a"];
  return { background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, textTransform: "capitalize" };
}
