/**
 * Tenant bootstrap & resolution.
 *
 * Every authenticated user belongs to one or more organizations (tenants) via
 * `tenant_members`. On first login a personal organization is created and the
 * user is linked to it. All members of a tenant are equal — no role tiers
 * (PRD §4, docs/02-Actors-and-Capabilities.md).
 *
 * Uses the service-role client (bypasses RLS) for these privileged writes.
 */
import { supabaseAdmin } from "@/lib/supabase";

/** Return the user's first organization id, creating one on first login. */
export async function ensureTenant(userId: string, email: string): Promise<string> {
  const existing = await supabaseAdmin
    .from("tenant_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing.data?.organization_id) return existing.data.organization_id;

  const orgName = (email?.split("@")[0] || "My business").trim();
  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .insert({ name: orgName, tax_number: "", vat_number: "", status: "onboarding" })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`Failed to create organization: ${orgErr?.message}`);

  const { error: memErr } = await supabaseAdmin
    .from("tenant_members")
    .insert({ organization_id: org.id, user_id: userId });
  if (memErr) throw new Error(`Failed to link member: ${memErr.message}`);

  return org.id;
}

/** All organization ids the user belongs to. */
export async function getUserOrganizations(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("tenant_members")
    .select("organization_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.organization_id as string);
}
