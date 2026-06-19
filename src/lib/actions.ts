"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOrg } from "@/lib/org";
import { encryptSecret } from "@/lib/secrets";
import { completeOnboarding } from "@/lib/zatca/onboarding";
import { generateInvoiceAction } from "@/lib/zatca/actions";
import { ZohoClient } from "@/lib/zoho/client";
import { OdooClient } from "@/lib/odoo/client";

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

/**
 * Connect Zoho Books — REAL: builds the client, calls testConnection() against
 * Zoho's API, and only marks `connected` if it actually succeeds. Then verifies
 * the cf_zatca_* custom fields. Secrets encrypted at rest. No fake states.
 */
export async function saveZohoConnection(fd: FormData) {
  const org = await requireOrg();
  const region = field(fd, "zoho_region") || "sa";
  const orgIdField = field(fd, "zoho_org_id");
  const clientId = field(fd, "zoho_client_id");
  const clientSecret = field(fd, "zoho_client_secret");
  const refreshToken = field(fd, "zoho_refresh_token");

  const zoho = new ZohoClient({ zohoRegion: region, zohoOrgId: orgIdField, zohoClientId: clientId, zohoClientSecret: clientSecret, zohoRefreshToken: refreshToken });
  const test = await zoho.testConnection();

  await supabaseAdmin.from("zoho_config").upsert(
    {
      organization_id: org.id,
      zoho_region: region,
      zoho_org_id: orgIdField,
      zoho_client_id: clientId,
      zoho_client_secret: encryptSecret(clientSecret) ?? "",
      zoho_refresh_token: encryptSecret(refreshToken) ?? "",
      status: test.success ? "connected" : "disconnected",
      last_sync: test.success ? new Date().toISOString() : null,
    },
    { onConflict: "organization_id" },
  );
  revalidatePath("/onboarding");
  revalidatePath("/");

  if (!test.success) redirect(`/onboarding?cerr=${encodeURIComponent(test.error || "Could not reach Zoho — check your credentials.")}`);

  let warn = "";
  try {
    const prov = await zoho.provisionCustomFields();
    if (!prov.success && prov.errors?.length) warn = "Connected, but create these Zoho fields: " + prov.errors.join(", ");
  } catch { /* field check is best-effort */ }
  redirect(warn ? `/onboarding?cwarn=${encodeURIComponent(warn)}` : "/onboarding");
}

/**
 * Connect Odoo — REAL: authenticates via JSON-RPC (testConnection), only marks
 * `connected` on success, then provisions the x_zatca_* fields. Password encrypted.
 */
export async function saveOdooConnection(fd: FormData) {
  const org = await requireOrg();
  const url = field(fd, "odoo_url");
  const db = field(fd, "odoo_db");
  const username = field(fd, "odoo_username");
  const password = field(fd, "odoo_password");

  const odoo = new OdooClient({ odooUrl: url, odooDb: db, odooUsername: username, odooPassword: password });
  const test = await odoo.testConnection();

  await supabaseAdmin.from("odoo_config").upsert(
    {
      organization_id: org.id,
      odoo_url: url,
      odoo_db: db,
      odoo_username: username,
      odoo_password: encryptSecret(password) ?? "",
      status: test.success ? "connected" : "disconnected",
      last_sync: test.success ? new Date().toISOString() : null,
    },
    { onConflict: "organization_id" },
  );
  revalidatePath("/onboarding");
  revalidatePath("/");

  if (!test.success) redirect(`/onboarding?cerr=${encodeURIComponent(test.error || "Could not reach Odoo — check URL/DB/credentials.")}`);

  let warn = "";
  try {
    const prov = await odoo.provisionCustomFields();
    if (!prov.success && prov.errors?.length) warn = "Connected, but Odoo field provisioning had issues: " + prov.errors.join(", ");
  } catch { /* best-effort */ }
  redirect(warn ? `/onboarding?cwarn=${encodeURIComponent(warn)}` : "/onboarding");
}

/** Let the user change their integration choice. */
export async function resetIntegration() {
  const org = await requireOrg();
  await supabaseAdmin.from("organizations").update({ integration: null }).eq("id", org.id);
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

/**
 * Run the full ZATCA onboarding for this tenant against the Demo (simulation)
 * environment: CSR → compliance CSID → compliance checks → production CSID.
 * Uses the proven `completeOnboarding`. OTP 123456 routes to simulation.
 */
export async function runZatcaOnboarding(fd: FormData) {
  const org = await requireOrg();
  const otp = field(fd, "otp") || "123456";
  let err: string | null = null;
  try {
    await completeOnboarding(otp, org.id);
  } catch (e) {
    err = e instanceof Error ? e.message : "ZATCA onboarding failed";
  }
  revalidatePath("/onboarding");
  revalidatePath("/");
  redirect(err ? `/onboarding?zerr=${encodeURIComponent(err)}` : "/onboarding");
}

/**
 * Send a sample simplified invoice through the REAL pipeline (sign + submit to
 * ZATCA simulation) — lets the user verify clearance without needing the ERP
 * trigger wired. Persists to the invoices ledger like the webhook does.
 */
export async function sendTestInvoice() {
  const org = await requireOrg();
  const invoiceId = "TEST-" + Date.now();
  const body = {
    type: "simplified",
    invoiceId,
    documentType: "388",
    items: [{ name: "Test service", quantity: 1, unitPrice: 100, vatRate: 15 }],
  };

  let res: { success: boolean; data?: Record<string, unknown>; error?: string };
  try {
    res = (await generateInvoiceAction(body as never, org.id)) as typeof res;
  } catch (e) {
    res = { success: false, error: e instanceof Error ? e.message : "Test invoice failed" };
  }

  if (!res.success || !res.data) {
    revalidatePath("/onboarding");
    redirect(`/onboarding?terr=${encodeURIComponent(res.error || "Test invoice failed")}`);
  }

  const data = res.data!;
  const zStatus = String(data.status ?? "");
  await supabaseAdmin.from("invoices").upsert(
    {
      organization_id: org.id,
      environment: "demo",
      invoice_number: invoiceId,
      invoice_type: "simplified",
      document_type: "388",
      status: zStatus === "REPORTED" ? "reported" : zStatus === "CLEARED" ? "cleared" : "cleared",
      total_amount: 115,
      zatca_status: zStatus,
      zatca_uuid: data.uuid ?? null,
      qr_code: data.qrCode ?? null,
      xml: data.xml ?? null,
      payload: body,
    },
    { onConflict: "organization_id,invoice_number" },
  );

  revalidatePath("/onboarding");
  revalidatePath("/");
  redirect(`/onboarding?tok=${encodeURIComponent(`${invoiceId} → ${zStatus || "DONE"}`)}`);
}
