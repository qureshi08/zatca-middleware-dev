"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOrg } from "@/lib/org";
import { encryptSecret } from "@/lib/secrets";

const field = (fd: FormData, k: string) => ((fd.get(k) as string) ?? "").trim();

async function requireOrg() {
  const org = await getActiveOrg();
  if (!org) throw new Error("Not authenticated");
  return org;
}

/** Save the business profile (seller identity) to organizations. */
export async function saveProfile(fd: FormData) {
  const org = await requireOrg();
  await supabaseAdmin
    .from("organizations")
    .update({
      name: field(fd, "name") || org.name,
      name_ar: field(fd, "name_ar") || null,
      vat_number: field(fd, "vat_number"),
      tax_number: field(fd, "tax_number"),
      addr_building: field(fd, "addr_building"),
      addr_street: field(fd, "addr_street"),
      addr_district: field(fd, "addr_district"),
      addr_city: field(fd, "addr_city"),
      addr_postal: field(fd, "addr_postal"),
      addr_country: field(fd, "addr_country") || "SA",
    })
    .eq("id", org.id);
  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/onboarding");
}

/** Choose the accounting integration (odoo | zoho | custom). */
export async function setIntegration(fd: FormData) {
  const org = await requireOrg();
  const integration = field(fd, "integration");
  if (!["odoo", "zoho", "custom"].includes(integration)) throw new Error("Invalid integration");
  await supabaseAdmin.from("organizations").update({ integration }).eq("id", org.id);
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

/**
 * Generate an API key for this tenant and show it once. Used as the webhook
 * `x-api-key` (Odoo/Zoho) and as the Mode B key (custom). Shown only at creation.
 */
export async function generateWebhookKey() {
  const org = await requireOrg();
  const raw = "sk_zatca_live_" + crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  await supabaseAdmin.from("api_keys").insert({
    organization_id: org.id,
    key_prefix: raw.slice(0, 20),
    key_hash: hash,
    name: "Integration key",
    status: "active",
  });
  revalidatePath("/onboarding");
  redirect(`/onboarding?newkey=${encodeURIComponent(raw)}`);
}

/** Save & mark connected: Zoho Books. Secrets encrypted at rest. */
export async function saveZohoConnection(fd: FormData) {
  const org = await requireOrg();
  await supabaseAdmin.from("zoho_config").upsert(
    {
      organization_id: org.id,
      zoho_region: field(fd, "zoho_region") || "sa",
      zoho_org_id: field(fd, "zoho_org_id"),
      zoho_client_id: field(fd, "zoho_client_id"),
      zoho_client_secret: encryptSecret(field(fd, "zoho_client_secret")) ?? "",
      zoho_refresh_token: encryptSecret(field(fd, "zoho_refresh_token")) ?? "",
      status: "connected",
      last_sync: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  revalidatePath("/onboarding");
  revalidatePath("/");
  redirect("/onboarding");
}

/** Save & mark connected: Odoo. Password encrypted at rest. */
export async function saveOdooConnection(fd: FormData) {
  const org = await requireOrg();
  await supabaseAdmin.from("odoo_config").upsert(
    {
      organization_id: org.id,
      odoo_url: field(fd, "odoo_url"),
      odoo_db: field(fd, "odoo_db"),
      odoo_username: field(fd, "odoo_username"),
      odoo_password: encryptSecret(field(fd, "odoo_password")) ?? "",
      status: "connected",
      last_sync: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  revalidatePath("/onboarding");
  revalidatePath("/");
  redirect("/onboarding");
}

/** Let the user change their integration choice. */
export async function resetIntegration() {
  const org = await requireOrg();
  await supabaseAdmin.from("organizations").update({ integration: null }).eq("id", org.id);
  revalidatePath("/onboarding");
  redirect("/onboarding");
}
