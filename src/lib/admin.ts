/**
 * Platform admin (a.k.a. middleware support staff) — NOT a tenant role.
 * These are our own support/operations people who can see all tenants and
 * handle support requests. Controlled by the ADMIN_EMAILS env var
 * (comma-separated). Defaults to the founding support address so it works
 * out of the box; override in Vercel for production.
 */
const DEFAULT_ADMINS = "claude.ai@convergentbt.com";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMINS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
