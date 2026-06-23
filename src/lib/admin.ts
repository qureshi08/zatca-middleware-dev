/**
 * Platform admin (a.k.a. middleware support staff) — NOT a tenant role.
 * These are our own support/operations people who can see all tenants and
 * handle support requests. Controlled entirely by the ADMIN_EMAILS env var
 * (comma-separated list of support-staff emails). No hardcoded default — if
 * unset, nobody is an admin (secure by default).
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
