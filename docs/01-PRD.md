# Product Requirements Document (PRD)
### ZATCA Compliance Middleware

| | |
|---|---|
| **Document** | 01 — Product Requirements Document |
| **Status** | 🟢 LOCKED (v1.0) |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-17 |
| **Related docs** | `02-Actors-and-Capabilities.md`, `03-Functional-Spec.md`, `04-Flows.md`, `05-Architecture.md`, `06-ZATCA-Compliance-Reference.md` |

---

## 1. Problem Statement

In Saudi Arabia, **ZATCA (Fatoora) e-invoicing is mandatory**. Every business must generate invoices in a strict format (UBL 2.1 XML), cryptographically sign them, attach a compliant QR code, and submit each invoice to ZATCA for **clearance** (B2B) or **reporting** (B2C) — in real time.

Doing this correctly is hard:
- The cryptography (ECDSA secp256k1, SHA-256, XAdES, CSR/certificate lifecycle) is unforgiving.
- The XML and business rules (BR-KSA) are detailed and easy to get wrong.
- A mistake means **legally invalid invoices** and rejected submissions.

Most businesses already run an accounting system (Odoo, Zoho, Dynamics, Oracle, or a custom one). They do **not** want to change how they work, learn ZATCA internals, or maintain compliance plumbing themselves.

## 2. Vision

**Make any business in KSA ZATCA-compliant with zero hassle — without leaving the software they already use.**

A business connects once. From then on, they keep invoicing exactly as before, and compliance happens **automatically and invisibly** in the background. Validated invoices flow right back to them.

## 3. Goals

| # | Goal |
|---|------|
| G1 | A business becomes ZATCA-compliant through a **one-time setup**, not an ongoing chore. |
| G2 | Compliance is **automatic and transparent** — the user's normal invoicing workflow is never interrupted. |
| G3 | Support the **software people already use** — Odoo & Zoho now; Dynamics 365, Oracle & others later — via a **pluggable adapter model**. |
| G4 | Serve businesses with **custom/in-house accounting** via a clean **headless API**. |
| G5 | Serve the **full KSA market**: small businesses → enterprises → banks, on one platform. |
| G6 | Keep each customer's data and ZATCA credentials **securely isolated** per registered profile. |

## 4. Non-Goals (for v1)

- ❌ **Maker / Checker / Approver approval workflow** — explicitly deferred; may return later.
- ❌ Being an accounting system ourselves — we are **middleware**, not a bookkeeping product.
- ❌ Dynamics 365 / Oracle / other adapters — architected for, but **not built** in v1.
- ❌ On-premise / per-customer deployments — we run **one shared cloud platform**.

## 5. Target Users / Market

**Market:** Kingdom of Saudi Arabia (KSA), ZATCA e-invoicing mandate.

**Customer segments (one platform serves all):**
- **Small businesses** — want it to "just work," minimal setup.
- **Enterprises** — higher volume, reliability, audit trail.
- **Banks** — institutional integration, security, scale.
- **Software vendors / businesses with custom accounting** — consume our API directly.

## 6. The Two Product Modes

### Mode A — Accounting Software Integration *(primary)*
The flagship experience.

1. Business does a **one-time configuration** linking their accounting software (Odoo / Zoho), following our self-serve guides.
2. They **keep working normally** — creating invoices in their own software. Nothing else changes.
3. Creating the invoice **automatically triggers** the middleware. With **no manual step on the middleware side**, it builds the ZATCA XML, signs it, generates the QR, and submits to ZATCA (clearance or reporting).
4. **Everything flows back automatically into their accounting software** — the **signed XML, the cleared/compliant PDF, the QR code, the ZATCA status, and the UUID** — available right there with zero extra steps.

> The user experiences *normal business as usual*. They never have to open or operate the middleware. Compliance is fully automated and invisible.

### Mode B — Headless API *(for custom systems)*
For businesses running their own/custom accounting software.

- We expose **APIs** that do everything Mode A does — onboard, generate, sign, clear/report, retrieve validated invoices.
- The customer integrates our API into their own system.

## 7. Adapter Model (how we scale across accounting software)

The ZATCA compliance engine is **built once** and shared. Each accounting software is a **swappable adapter** on top of that shared core.

```
            ┌─────────────────────────────────────────┐
            │         Shared ZATCA Core Engine          │
            │  (XML · signing · QR · clearance/report)  │
            └─────────────────────────────────────────┘
                 ▲          ▲           ▲          ▲
                 │          │           │          │
            ┌────┴───┐ ┌────┴───┐  ┌────┴────┐ ┌───┴─────┐
            │  Odoo  │ │  Zoho  │  │ D365 *  │ │ Oracle *│   * = future
            │ adapter│ │ adapter│  │ adapter │ │ adapter │
            └────────┘ └────────┘  └─────────┘ └─────────┘
                 ▲
            ┌────┴─────────────────┐
            │  Headless API (Mode B)│  → custom/in-house accounting
            └──────────────────────┘
```

Adding a new accounting software = writing a new adapter, **not** touching the compliance core.

## 8. Tenancy & Isolation

- **One multi-tenant cloud deployment.** Anyone can register.
- Each customer registers a **profile (organization)** in the middleware.
- The profile is the **isolation boundary**: invoices, ZATCA credentials (private key, CSIDs), accounting-software connection config, and API keys are all scoped to it.
- No customer can see or touch another customer's data.

## 8.1 Onboarding, Authentication & Self-Service

The product is **self-service by default** — a customer can go from zero to compliant on their own.

- **Account creation & login:** via **Google authentication** — sign up and log in automatically; no manual account provisioning by us.
- **Guided setup:** we provide **complete self-serve guides, tutorials and documentation** for:
  - Connecting and configuring each **accounting software** (Odoo, Zoho).
  - Using the **headless API** for custom/in-house systems (Mode B).
- **Assisted help is optional:** we step in **only if the customer asks**. The default path requires no involvement from us.


## 9. Resolved Decisions (locked v1.0)

- [x] **Trigger:** Fully automated. Creating an invoice in the accounting software triggers the flow; the validated outputs return automatically. **No manual step on the middleware side.** *(Exact push-vs-pull mechanics per Odoo/Zoho are detailed in `04-Flows.md`.)*
- [x] **Onboarding:** Self-service with **Google authentication** + complete self-serve guides/tutorials for accounting-software setup and API access. Assisted help only on request. *(See §8.1.)*
- [x] **Write-back:** Returns the **full set** — signed XML + cleared/compliant PDF + QR + ZATCA status + UUID — for **both** Odoo and Zoho.
- [x] **Actor model:** Flat. Customers self-serve (no in-tenant roles); the only privileged actor is the **Convergent (CBT) team admin** (cross-tenant, for support and unlisted-software setup). *(See `02-Actors-and-Capabilities.md`.)*

## 10. Pricing, Deployment & Go-to-Market

- **Pricing:** The product is offered **free of cost** — positioned as "ZATCA integration, free" to drive adoption across the KSA market.
- **Deployment:** Single multi-tenant instance on **Vercel** (cost-efficiency matters given the free model — informs `05-Architecture.md`).
- **Go-to-market:** Marketed via the **Convergent Business Technology (CBT) website**, with deliberate **SEO and AEO (Answer Engine Optimization)** so that both search engines **and AI assistants** surface CBT as the go-to for ZATCA compliance.
- **Unlisted accounting software:** If a customer's accounting software isn't supported yet, they contact us and the CBT team assists with setup (and may build a new adapter).

---

*PRD locked at v1.0.*
