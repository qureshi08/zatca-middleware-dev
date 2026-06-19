# Environments & Release Management

| | |
|---|---|
| **Document** | 08 — Environments & Release Management |
| **Status** | 🟢 Working guide |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-18 |
| **Audience** | The whole team — this is *the* reference for how we run, configure, and ship the product |

> Plain-English protocols. If you're unsure where something runs or how a change ships, the answer is here.

---

## 1. The core idea: two independent dimensions

The most common confusion in this product is mixing up two separate things. Keep them apart:

| | **Dimension A — our app's environment** | **Dimension B — which ZATCA API a tenant uses** |
|---|---|---|
| What it is | Where *our code* is deployed | Which external ZATCA system invoices go to |
| Values | Local → Preview/Staging → Production | **Simulation** (OTP `123456`, not legal) ↔ **Core/Production** (real OTP, legally filed) |
| Controlled by | Git branch / deploy | A **per-tenant setting** in the database |
| Changes via | A deployment | A toggle — no redeploy |

**They're independent.** Our app can be running in **Production** while a specific customer is still pointed at ZATCA **Simulation**. That's intended.

## 2. Dimension B in detail — ZATCA progression

```
Dev  ─────────────►  UAT  ─────────────►  Production
(Simulation API,     (validate against     (live core API,
 OTP 123456,          the REAL/actual        real OTP,
 nothing filed)       ZATCA env, real OTP)   legally filed)
```

- **Dev (now):** the entire build runs against the **ZATCA Simulation endpoint with OTP `123456`**. Invoices clear/report exactly like production, but nothing is legally filed.
- **UAT:** before opening to customers, we onboard a real device against the **actual** ZATCA environment with a **real OTP** and confirm end-to-end. This proves "it works for real."
- **Production:** customers operate live; their invoices are legally filed with ZATCA.

> The exact ZATCA endpoint names/URLs are in `06-ZATCA-Compliance-Reference.md` §2 (validate with the ZATCA contact). What matters here is the *progression*.

## 3. The user-facing version: Demo vs Real

Customers never see "simulation/core" jargon. They see two modes — this is Dimension B, per tenant (the FR-ENV-5..7 flow, renamed for clarity):

| Mode | ZATCA target | Legally filed? | For |
|---|---|---|---|
| **🟠 Demo** | Simulation (OTP 123456 / simulation onboarding) | No | Trying the product, sales demos, training |
| **🟢 Real** | Core / production (the customer's actual OTP) | **Yes** | Live business invoicing |

- Every new tenant **starts in Demo** and the UI shows a persistent **"Demo mode — invoices are not yet live"** banner.
- Switching to **Real** is a deliberate, guided action ("Go live"): the customer gets a **real OTP** from the Fatoora portal and we re-run onboarding against the real ZATCA environment.
- Demo and Real use **separate ZATCA credentials/CSIDs** — never shared.

## 4. Dimension A in detail — our deployment environments

| Environment | Where | Supabase | ZATCA default | Purpose |
|---|---|---|---|---|
| **Local** | dev machine | dev project | Simulation (123456) | day-to-day coding |
| **Preview / Staging** | Vercel preview (per branch/PR) | staging project | Simulation (123456) | review a change before it ships |
| **Production** | Vercel production (`main`) | production project | per-tenant (Demo or Real) | the live product |

- **Vercel** auto-creates a **Preview** deployment for every branch/PR (a shareable URL to test that change), and deploys **Production** from `main`.
- **Supabase** is separated per environment (separate projects) so test data never touches production data.

## 5. Configuration & secrets per environment

- All config lives in **environment variables**, never in code. Vercel scopes them to Development / Preview / Production.
- Per environment we set: Supabase URL + keys, ZATCA base URLs (simulation + core), the encryption master key, Resend key, Google OAuth credentials.
- Secrets (ZATCA private keys, CSIDs, ERP credentials) are **encrypted at rest** in Supabase and **never logged** (see `05-Architecture` §7).
- A tenant's **Demo/Real** choice and its ZATCA credentials live in the database (`zatca_profiles.environment`), not in deploy config.

## 6. How we ship code — the git & release protocol

You don't need to memorise this; it's the routine I'll follow.

```
feature branch  →  Pull Request  →  (Preview deploy + CI tests)  →  review  →  merge to main  →  auto-deploy to Production
```

1. **Branch** off `main` for every change (`feat/...`, `fix/...`).
2. **Pull Request** — CI runs (lint, types, tests); Vercel posts a **Preview URL** to click-test the change.
3. **Review & approve** — nothing reaches `main` unreviewed/red.
4. **Merge to `main`** → Vercel deploys **Production** automatically.
5. **Tag a version** (e.g. `v1.0.0`) + changelog for traceability.
6. **Hotfix:** same flow, fast-tracked from `main`.

**Golden rule:** `main` is always deployable and always green. Experiments live on branches.

## 7. How enhancements work after v1

Future features/changes follow the same loop, so the live product is never destabilised:
1. Capture the request (small spec / issue).
2. Build on a feature branch → Preview deploy.
3. Test (incl. against ZATCA **simulation** first).
4. Review → merge → production.
5. If it touches compliance/crypto, **re-validate against the ZATCA SDK** before merge.

## 8. Where we are right now & the path

- **Today:** building in `zatca-middleware-dev`, everything against **ZATCA Simulation (OTP 123456)**, deployed to Vercel preview/production for review. Tenants are in **Demo**.
- **Next (post-build):** internal **UAT** against the real ZATCA environment.
- **Then:** customers can switch tenants to **Real** as ZATCA production access is granted.

---

*This guide governs all environment and release decisions. Update it when the process changes.*
