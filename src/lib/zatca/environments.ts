/**
 * ZATCA environment resolution (Demo vs Real).
 *
 * Two independent dimensions (see docs/08-Environments-and-Release-Management.md):
 *   - our app deploy env (local/preview/production) — handled by Vercel
 *   - which ZATCA API a *tenant* targets — resolved here, per tenant
 *
 *   'demo' → ZATCA Simulation endpoint (OTP 123456, NOT legally filed)
 *   'real' → ZATCA Core endpoint     (real OTP, legally filed)
 */

export type ZatcaEnv = "demo" | "real";

const DEV = process.env.ZATCA_DEV_BASE_URL || "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";
const SIMULATION = process.env.ZATCA_SIMULATION_BASE_URL || "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation";
const CORE = process.env.ZATCA_CORE_BASE_URL || "https://gw-fatoora.zatca.gov.sa/e-invoicing/core";

/** Base URL for a tenant's ZATCA environment. */
export function zatcaBaseUrl(env: ZatcaEnv): string {
  return env === "real" ? CORE : SIMULATION;
}

/** Developer-portal base (used for early onboarding/sandbox flows). */
export function zatcaDevBaseUrl(): string {
  return DEV;
}

/** True while a tenant is in Demo (simulation) — nothing is legally filed. */
export function isDemo(env: ZatcaEnv): boolean {
  return env !== "real";
}

/** The fixed sandbox OTP accepted by the simulation onboarding flow. */
export const DEMO_OTP = "123456";
