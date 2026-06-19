/**
 * Tenant context for the signed-in user: their active organization and a
 * derived view of how far through onboarding they are. Server-only.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureTenant } from "@/lib/tenant";

export type Integration = "odoo" | "zoho" | "custom";

export interface OrgRow {
  id: string;
  name: string;
  name_ar: string | null;
  tax_number: string;
  vat_number: string;
  addr_building: string | null;
  addr_street: string | null;
  addr_district: string | null;
  addr_city: string | null;
  addr_postal: string | null;
  addr_country: string | null;
  integration: Integration | null;
  status: string;
}

/** The signed-in user's active organization (created on first login). */
export async function getActiveOrg(): Promise<OrgRow | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const orgId = await ensureTenant(user.id, user.email ?? "");
  const { data } = await supabaseAdmin.from("organizations").select("*").eq("id", orgId).single();
  return (data as OrgRow) ?? null;
}

export interface OnboardingState {
  org: OrgRow;
  profileComplete: boolean;
  integration: Integration | null;
  connected: boolean;
  zatcaOnboarded: boolean;
  nextStep: "profile" | "integration" | "connect" | "zatca" | "done";
}

export async function getOnboardingState(): Promise<OnboardingState | null> {
  const org = await getActiveOrg();
  if (!org) return null;

  const profileComplete = Boolean(
    org.name && org.vat_number && org.tax_number && org.addr_city && org.addr_postal,
  );
  const integration = org.integration ?? null;

  let connected = false;
  if (integration === "zoho") {
    const { data } = await supabaseAdmin.from("zoho_config").select("status").eq("organization_id", org.id).maybeSingle();
    connected = data?.status === "connected";
  } else if (integration === "odoo") {
    const { data } = await supabaseAdmin.from("odoo_config").select("status").eq("organization_id", org.id).maybeSingle();
    connected = data?.status === "connected";
  } else if (integration === "custom") {
    const { count } = await supabaseAdmin
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("status", "active");
    connected = (count ?? 0) > 0;
  }

  const { data: prof } = await supabaseAdmin
    .from("zatca_profiles")
    .select("onboarding_step")
    .eq("organization_id", org.id)
    .eq("environment", "demo")
    .maybeSingle();
  const zatcaOnboarded = prof?.onboarding_step === "production_received";

  const nextStep: OnboardingState["nextStep"] = !profileComplete
    ? "profile"
    : !integration
      ? "integration"
      : !connected
        ? "connect"
        : !zatcaOnboarded
          ? "zatca"
          : "done";

  return { org, profileComplete, integration, connected, zatcaOnboarded, nextStep };
}
