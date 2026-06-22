"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOrg } from "@/lib/org";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
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
  redirect("/onboarding?step=2");
}

/** Choose the accounting integration (odoo | zoho | custom). */
export async function setIntegration(fd: FormData) {
  const org = await requireOrg();
  const integration = field(fd, "integration");
  if (!["odoo", "zoho", "custom"].includes(integration)) throw new Error("Invalid integration");
  await supabaseAdmin.from("organizations").update({ integration }).eq("id", org.id);
  revalidatePath("/onboarding");
  redirect("/onboarding?step=3");
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
  redirect(`/onboarding?step=3&newkey=${encodeURIComponent(raw)}`);
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
  let refreshToken = field(fd, "zoho_refresh_token");
  const grantCode = field(fd, "zoho_grant_code");

  // If the user pasted a Self-Client grant code (the easy path) instead of a
  // refresh token, exchange it for one server-side — no manual curl needed.
  if (!refreshToken && grantCode) {
    try {
      const exchanger = new ZohoClient({ zohoRegion: region, zohoOrgId: orgIdField, zohoClientId: clientId, zohoClientSecret: clientSecret });
      refreshToken = await exchanger.exchangeGrantCode(grantCode);
    } catch (e) {
      redirect(`/onboarding?step=3&cerr=${encodeURIComponent(e instanceof Error ? e.message : "Grant-code exchange failed")}`);
    }
  }

  if (!refreshToken) {
    redirect(`/onboarding?step=3&cerr=${encodeURIComponent("Provide a Self-Client grant code (recommended) or an existing refresh token.")}`);
  }

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

  if (!test.success) redirect(`/onboarding?step=3&cerr=${encodeURIComponent(test.error || "Could not reach Zoho — check your credentials.")}`);

  let warn = "";
  try {
    const prov = await zoho.provisionCustomFields();
    if (!prov.success && prov.errors?.length) warn = "Connected, but create these Zoho fields: " + prov.errors.join(", ");
  } catch { /* field check is best-effort */ }
  redirect(warn ? `/onboarding?step=3&cwarn=${encodeURIComponent(warn)}` : "/onboarding?step=3");
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
      odoo_db: odoo.currentDb, // may be self-corrected (e.g. subdomain casing) during the test
      odoo_username: username,
      odoo_password: encryptSecret(password) ?? "",
      status: test.success ? "connected" : "disconnected",
      last_sync: test.success ? new Date().toISOString() : null,
    },
    { onConflict: "organization_id" },
  );
  revalidatePath("/onboarding");
  revalidatePath("/");

  if (!test.success) redirect(`/onboarding?step=3&cerr=${encodeURIComponent(test.error || "Could not reach Odoo — check URL/DB/credentials.")}`);

  let warn = "";
  try {
    const prov = await odoo.provisionCustomFields();
    if (!prov.success && prov.errors?.length) warn = "Connected, but Odoo field provisioning had issues: " + prov.errors.join(", ");
  } catch { /* best-effort */ }
  redirect(warn ? `/onboarding?step=3&cwarn=${encodeURIComponent(warn)}` : "/onboarding?step=3");
}

/**
 * One-click Odoo automation setup — does in code what the manual guide describes:
 * installs the Automation Rules module, creates the webhook Server Action, and the
 * Automated Action that fires it on posted customer invoices. Uses the stored
 * (encrypted) connection and a freshly-minted integration key embedded in the URL,
 * so the user never touches Odoo's Technical screens.
 */
export async function provisionOdooAutomation() {
  const org = await requireOrg();

  // Everything is wrapped so ANY failure surfaces as a banner (never a silent
  // "nothing happened"). Exactly one redirect, at the very end, outside the try.
  let ok = false;
  let msg = "";
  try {
    const { data: config } = await supabaseAdmin
      .from("odoo_config")
      .select("odoo_url, odoo_db, odoo_username, odoo_password")
      .eq("organization_id", org.id)
      .maybeSingle();

    if (!config?.odoo_url) {
      msg = "Connect Odoo first (form below), then run automated setup.";
    } else {
      // Mint a dedicated integration key for the webhook (raw value only available
      // now, so we embed it directly into the action URL inside Odoo).
      const raw = "sk_zatca_live_" + crypto.randomBytes(24).toString("hex");
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      await supabaseAdmin.from("api_keys").insert({
        organization_id: org.id,
        key_prefix: raw.slice(0, 20),
        key_hash: hash,
        name: "Odoo webhook key",
        status: "active",
      });

      // Build the public webhook URL from the live request host (no env var needed).
      const h = await headers();
      const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
      const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
      const webhookUrl = `${proto}://${host}/api/odoo/webhook?apiKey=${encodeURIComponent(raw)}`;

      const odoo = new OdooClient({
        odooUrl: config.odoo_url,
        odooDb: config.odoo_db,
        odooUsername: config.odoo_username,
        odooPassword: decryptSecret(config.odoo_password) || config.odoo_password,
      });

      const result = await odoo.provisionAutomation(webhookUrl);
      ok = result.success;
      msg = ok
        ? result.steps.join(" ")
        : [...result.steps, ...result.errors].join(" — ");

      // Persist any self-corrected DB name + a fresh, truthful connection stamp.
      if (ok) {
        await supabaseAdmin.from("odoo_config").update({
          odoo_db: odoo.currentDb,
          status: "connected",
          last_sync: new Date().toISOString(),
        }).eq("organization_id", org.id);
      }
    }
  } catch (e) {
    ok = false;
    msg = e instanceof Error ? e.message : "Automated setup failed unexpectedly.";
  }

  revalidatePath("/onboarding");
  redirect(
    ok
      ? `/onboarding?step=3&pok=${encodeURIComponent(msg)}`
      : `/onboarding?step=3&perr=${encodeURIComponent(msg || "Automated setup could not complete; use the manual steps below.")}`,
  );
}

/** Let the user change their integration choice. */
export async function resetIntegration() {
  const org = await requireOrg();
  await supabaseAdmin.from("organizations").update({ integration: null }).eq("id", org.id);
  revalidatePath("/onboarding");
  redirect("/onboarding?step=2");
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
  redirect(err ? `/onboarding?step=4&zerr=${encodeURIComponent(err)}` : "/onboarding?step=4");
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
    redirect(`/onboarding?step=4&terr=${encodeURIComponent(res.error || "Test invoice failed")}`);
  }

  const data = res.data!;
  const zStatus = String(data.status ?? "");
  const { error: saveErr } = await supabaseAdmin.from("invoices").upsert(
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
  // Do not claim success if the invoice didn't actually persist.
  if (saveErr) {
    redirect(`/onboarding?step=4&terr=${encodeURIComponent(`Cleared as ${zStatus} but NOT saved: ${saveErr.message}. Run migration 003.`)}`);
  }
  redirect(`/onboarding?step=4&tok=${encodeURIComponent(`${invoiceId} → ${zStatus || "DONE"}`)}`);
}

// ===========================================================================
// SETTINGS — management actions for an already-onboarded tenant.
// ===========================================================================

/** Generate a fresh integration key and show it once on the Settings page. */
export async function generateKeyForSettings() {
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
  revalidatePath("/settings");
  redirect(`/settings?newkey=${encodeURIComponent(raw)}`);
}

/** Revoke an integration key (scoped to the caller's org). */
export async function revokeApiKey(fd: FormData) {
  const org = await requireOrg();
  const id = field(fd, "id");
  if (id) {
    await supabaseAdmin
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("organization_id", org.id);
  }
  revalidatePath("/settings");
  redirect("/settings?msg=Key+revoked");
}

/** Toggle auto-submit (auto-clear invoices on webhook) for the active integration. */
export async function toggleAutoSubmit(fd: FormData) {
  const org = await requireOrg();
  const integration = field(fd, "integration");
  const next = field(fd, "value") === "true";
  const table = integration === "zoho" ? "zoho_config" : "odoo_config";
  await supabaseAdmin.from(table).update({ auto_submit: next }).eq("organization_id", org.id);
  revalidatePath("/settings");
  redirect("/settings");
}

/** Re-test the stored connection and refresh status + last_sync (no re-entry needed). */
export async function retestConnection() {
  const org = await requireOrg();

  const { data: oc } = await supabaseAdmin
    .from("odoo_config")
    .select("odoo_url, odoo_db, odoo_username, odoo_password")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (oc?.odoo_url) {
    const odoo = new OdooClient({
      odooUrl: oc.odoo_url,
      odooDb: oc.odoo_db,
      odooUsername: oc.odoo_username,
      odooPassword: decryptSecret(oc.odoo_password) || oc.odoo_password,
    });
    const test = await odoo.testConnection();
    await supabaseAdmin
      .from("odoo_config")
      .update({
        status: test.success ? "connected" : "disconnected",
        odoo_db: odoo.currentDb, // persist any self-corrected DB name
        last_sync: test.success ? new Date().toISOString() : null,
      })
      .eq("organization_id", org.id);
    revalidatePath("/settings");
    redirect(test.success ? "/settings?msg=Connection+verified" : `/settings?err=${encodeURIComponent(test.error || "Connection failed")}`);
  }

  const { data: zc } = await supabaseAdmin
    .from("zoho_config")
    .select("zoho_region, zoho_org_id, zoho_client_id, zoho_client_secret, zoho_refresh_token")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (zc?.zoho_org_id) {
    const zoho = new ZohoClient({
      zohoRegion: zc.zoho_region || "sa",
      zohoOrgId: zc.zoho_org_id,
      zohoClientId: zc.zoho_client_id,
      zohoClientSecret: decryptSecret(zc.zoho_client_secret) || "",
      zohoRefreshToken: decryptSecret(zc.zoho_refresh_token) || "",
    });
    const test = await zoho.testConnection();
    await supabaseAdmin
      .from("zoho_config")
      .update({
        status: test.success ? "connected" : "disconnected",
        last_sync: test.success ? new Date().toISOString() : null,
      })
      .eq("organization_id", org.id);
    revalidatePath("/settings");
    redirect(test.success ? "/settings?msg=Connection+verified" : `/settings?err=${encodeURIComponent(test.error || "Connection failed")}`);
  }

  redirect("/settings?err=No+connection+configured+yet");
}
