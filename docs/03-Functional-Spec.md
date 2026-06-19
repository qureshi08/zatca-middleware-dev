# Functional Specification

| | |
|---|---|
| **Document** | 03 — Functional Specification |
| **Status** | 🟢 LOCKED (v1.0) |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-17 |
| **Related docs** | `01-PRD.md`, `02-Actors-and-Capabilities.md`, `04-Flows.md`, `05-Architecture.md`, `06-ZATCA-Compliance-Reference.md` |

> The team's primary build reference. Describes **what the system does**, feature by feature, as testable functional requirements (FR). *How* it's built lives in `05-Architecture.md`; the exact ZATCA rules live in `06-ZATCA-Compliance-Reference.md`; the visual flows live in `04-Flows.md`.
>
> Each requirement is tagged `FR-<area>-<n>`. Items still open are marked **⚠️ OPEN**.

---

## Feature Map

| # | Feature Area | Code | Summary |
|---|---|---|---|
| F1 | Account & Authentication | `AUTH` | Google sign-up/login; tenant profile. |
| F2 | API Key Management | `KEY` | Issue/revoke keys for ERP webhooks & Mode B. |
| F3 | Accounting-Software Connection | `CONN` | Connect, test, provision Odoo/Zoho. |
| F4 | ZATCA Onboarding | `ONB` | CSR → compliance CSID → production CSID. |
| F5 | Environment Management | `ENV` | Switch dev/simulation/actual/production. |
| F6 | Automatic Compliance Flow | `FLOW` | The core: trigger → build → sign → QR → submit. |
| F7 | Write-Back | `WB` | Push XML/PDF/QR/status/UUID into the ERP. |
| F8 | Invoice Types & Documents | `DOC` | Standard/simplified, credit/debit notes. |
| F9 | Failure Handling & Notifications | `ERR` | Detect, record, notify with reason. |
| F10 | Dashboard & Monitoring | `DASH` | Invoices, statuses, audit logs. |
| F11 | Headless API (Mode B) | `API` | Programmatic parity for custom systems. |
| F12 | Assisted Onboarding (CBT) | `OPS` | Help + unlisted-software requests. |

---

## F1 — Account & Authentication (`AUTH`)

- **FR-AUTH-1** A new customer can **sign up using Google authentication** (no manual provisioning).
- **FR-AUTH-2** On first sign-up, the system creates a **tenant profile (organization)** owned by that user.
- **FR-AUTH-3** Returning users **log in via Google**; sessions are scoped to their tenant only.
- **FR-AUTH-4** During/after sign-up, the user provides the **seller identity** required for ZATCA: legal name, **VAT number** (15 digits, `3XXXXXXXXXX3`), **CRN/tax number**, and **registered address** (street, building no., city, postal code, district). *(The current code uses placeholder seller addresses — this must be collected for real compliance.)*
- **FR-AUTH-5** No in-tenant roles exist; **all users of a tenant have equal, full access** (PRD §4, Doc 02). No seat/login limits in v1.
- **FR-AUTH-6** A tenant supports **multiple equal members**: an existing member can **invite another Google account by email** to join the same tenant, with identical full access. *(Decision: real businesses have more than one person; invite-by-email is low-complexity and preserves the flat model.)*

## F2 — API Key Management (`KEY`)

- **FR-KEY-1** A tenant can **generate one or more API keys** (format `sk_zatca_live_…`). Keys are shown once, then stored only as a **SHA-256 hash**.
- **FR-KEY-2** A tenant can **revoke** a key; revoked keys are rejected immediately.
- **FR-KEY-3** API keys authenticate **inbound ERP webhooks** (F3/F6) and **Mode B API calls** (F11) via the `x-api-key` header.
- **FR-KEY-4** Every key resolves to exactly one tenant; a key can never access another tenant's data.

## F3 — Accounting-Software Connection (`CONN`)

Supports **Odoo** and **Zoho** today; built so new adapters slot in (PRD §7).

- **FR-CONN-1** A tenant can **connect one accounting software** by entering its connection details:
  - **Odoo:** URL, database, username, password/API key (JSON-RPC).
  - **Zoho:** region (`.sa`, `.com`, …), organization ID, OAuth2 client ID, client secret, refresh token (Zoho Books v3).
- **FR-CONN-2** The system can **test the connection** and report success/failure before saving.
- **FR-CONN-3** Connection secrets are **write-only from the UI** (never returned after saving) and **encrypted at rest**. *(Current code stores some credentials in cleartext — must be encrypted for production.)*
- **FR-CONN-4** The system can **provision/verify the custom fields** the ERP needs to receive write-back:
  - **Odoo:** auto-provision `x_zatca_*` fields (status, uuid, qr, xml, error, document_type).
  - **Zoho:** **verify** presence of `cf_zatca_*` fields and report any missing (Zoho custom fields can't be created via API — the guide instructs the user to add them).
- **FR-CONN-5** The system records **connection status** (connected/disconnected) and **last sync** time per tenant.
- **FR-CONN-6** If a customer's accounting software is **not supported**, the UI offers a **"request support"** path that notifies the CBT team (F12).

## F4 — ZATCA Onboarding (`ONB`)

One-time per tenant. Implements ZATCA Phase-2 onboarding.

- **FR-ONB-1** The system **generates an ECDSA secp256k1 keypair** and a **CSR** (X.509 v3 with ZATCA OID extensions) from the tenant's seller identity.
- **FR-ONB-2** Using the **OTP** from the Fatoora portal, the system requests a **Compliance CSID**.
- **FR-ONB-3** The system runs the **compliance checks** (submits required sample invoice types) needed to qualify.
- **FR-ONB-4** On success, the system requests and stores the **Production CSID** + secret.
- **FR-ONB-5** The private key, public key, and CSIDs are stored **per tenant**, isolated and encrypted.
- **FR-ONB-6** Onboarding **state is tracked and resumable** (`none → compliance_requested → compliance_complete → production_received`) and shown to the user.
- **FR-ONB-7 (Expiry warning)** The system **tracks CSID expiry** and **warns the tenant ahead of time** (dashboard + email, e.g. 30 / 14 / 3 days before) so compliance never breaks silently. *(Decision: warn-before-expiry in v1; full automatic renewal is a fast-follow once the warn path is proven.)*

## F5 — Environment Management (`ENV`)

- **FR-ENV-1** The system supports the distinct ZATCA API environments via configurable base URLs: **developer-portal/simulation** (testing) and the **actual/`core`** endpoints (live). *(Exact naming locked in Doc 06; the current code lacks the `core` production endpoints — must be added.)*
- **FR-ENV-2** A tenant's onboarding and submissions target a **defined environment**; moving a tenant from testing → actual/production is an explicit, controlled step (re-onboard against the live environment).
- **FR-ENV-3** Test mode (e.g. OTP `123456`) routes to the testing environment and must **never** hit live endpoints.
- **FR-ENV-4 (Locked design)** The environment model above is locked: configurable, switchable environments with a controlled testing → live promotion. The only remaining work is **confirming ZATCA's exact environment names/URLs** in `06-ZATCA-Compliance-Reference.md` (ideally via the ZATCA contact) — a fact-check, not a design change.
- **FR-ENV-5 (Demo-first onboarding)** Every new tenant starts in **Demo mode** — pointed at the **ZATCA Simulation endpoint (OTP `123456`)**. They configure and test the full flow here; invoices are processed exactly like production but are **not legally filed** with ZATCA.
- **FR-ENV-6 (Clear Demo-mode awareness)** While a tenant is in **Demo mode**, the product **clearly and persistently signals it** — e.g. a dashboard banner such as *"Demo mode — invoices are not yet live with ZATCA."* The customer must never be confused about whether their invoices are real.
- **FR-ENV-7 (Deliberate switch to Real)** Switching to **Real mode** is a **separate, deliberate action** the customer takes when ready: get a **real OTP** from the Fatoora portal and re-onboard against the **live `core` ZATCA environment** to obtain real CSIDs (see Flow 7). The product guides them through it. *(Full environment/release model: `08-Environments-and-Release-Management.md`.)*

## F6 — Automatic Compliance Flow (`FLOW`) — *the core*

This is the heart of the product. Triggered with **no manual middleware step** (PRD §6, §9). Detailed visually in `04-Flows.md`.

- **FR-FLOW-1 (Trigger)** When an invoice is created in the connected ERP, the middleware is invoked automatically via webhook. Two supported modes:
  - **Pull (recommended):** ERP sends a minimal event (`{ action: "pull", <erp>InvoiceId, entityType }`); the middleware **fetches** the full document from the ERP API.
  - **Push:** ERP/caller sends the full invoice payload directly.
- **FR-FLOW-2 (Classify)** The system determines **invoice type** — **standard (B2B → clearance)** vs **simplified (B2C → reporting)** — and **document type** (388 invoice / 381 credit note / 383 debit note).
- **FR-FLOW-3 (Map)** The ERP document is mapped to the canonical ZATCA invoice model (seller, buyer, line items, taxes, totals, references). Adapter-specific (Odoo `account.move` / Zoho Books document).
- **FR-FLOW-4 (Build XML)** The system generates **UBL 2.1 XML** (standard or simplified) with ICV (counter), UUID, and previous-invoice-hash (PIH) chaining.
- **FR-FLOW-5 (Hash & Sign)** The XML is canonicalized, **SHA-256 hashed**, and **signed (ECDSA secp256k1)**; a **XAdES** signature block is embedded.
- **FR-FLOW-6 (QR)** A **TLV QR code** is generated (seller, VAT, timestamp, totals, hash, signature, public key, cert signature).
- **FR-FLOW-7 (Submit)** The signed invoice is submitted to ZATCA: **clearance** (standard) returns the **cleared XML**; **reporting** (simplified) returns acceptance. The system records ZATCA's response and validation messages.
- **FR-FLOW-8 (Persist)** Every invoice and every ZATCA request/response is **persisted** (invoice record + transaction log), scoped to the tenant, for audit.
- **FR-FLOW-9 (Async + queued)** Processing is **asynchronous and queued**, not synchronous. The trigger webhook **acknowledges immediately** (so the ERP isn't blocked and serverless time limits aren't hit); a background worker then builds, signs, submits, and writes back. *(Decision: required for enterprise/bank volume and a better fit for Vercel's serverless execution limits than waiting inline on ZATCA.)*
- **FR-FLOW-10 (Retry & idempotency)** Transient failures (network / ZATCA timeouts) are **retried automatically with backoff** up to a configured limit; processing is **idempotent** per invoice (no duplicate submissions or attachments). Exhausted retries surface to F9. *(Queue mechanism chosen in Doc 05.)*

## F7 — Write-Back (`WB`)

After ZATCA responds, the **full result is written back into the ERP automatically** (PRD §9).

- **FR-WB-1** The system writes back the complete set: **signed XML, cleared/compliant PDF, QR code, ZATCA status, and UUID**.
- **FR-WB-2 (Odoo)** Write `x_zatca_*` fields, attach the signed XML + PDF to the `account.move`, and post a status message to the chatter.
- **FR-WB-3 (Zoho)** Write `cf_zatca_*` custom fields, post a **comment** to the document, and **attach** the QR PNG + signed PDF (PDF last, flagged sendable in customer emails); replace any prior `ZATCA_*` attachments to avoid duplicates.
- **FR-WB-4** Write-back is **best-effort and idempotent** — re-processing the same invoice must not create duplicate attachments or records.
- **FR-WB-5** If write-back partially fails, the compliance result is still **persisted in the middleware** and the failure is surfaced (F9).

## F8 — Invoice Types & Documents (`DOC`)

- **FR-DOC-1** Support **standard tax invoices** (B2B, clearance) and **simplified invoices** (B2C, reporting).
- **FR-DOC-2** Support **credit notes (381)** and **debit notes (383)**, including the **mandatory reference to the original invoice**. The system must **fail loudly** if an adjustment document lacks its original-invoice reference (current Zoho code already enforces this).
- **FR-DOC-3** Map per-line **VAT categories** (standard 15%, zero-rated, exempt, out-of-scope) and compute tax subtotals + legal monetary totals.
- **FR-DOC-4** Currency is **SAR** in v1. *(Multi-currency not in scope; schema may allow it but logic assumes SAR.)*

## F9 — Failure Handling & Notifications (`ERR`)

Per your decision: customers must get **proper notification with the error and the reason**.

- **FR-ERR-1** Every failure (validation, signing, ZATCA rejection, ERP/network error) is **captured with a human-readable reason** and the raw ZATCA response stored for audit.
- **FR-ERR-2 (In-software notice)** The failure + reason is written **back into the ERP** (error field + comment/chatter), where the user already works.
- **FR-ERR-3 (Dashboard)** Failed invoices appear in the middleware dashboard with status and reason, filterable.
- **FR-ERR-4 (Retry)** A failed invoice can be **re-submitted** after correction (manually from the dashboard, and/or automatically by re-triggering from the ERP). Automatic transient-failure retries are covered by FR-FLOW-10.
- **FR-ERR-5 (Email alert)** On failure (and on retry-exhaustion), the system **emails the tenant** (the Google account address) with the invoice reference and the failure reason. *(Decision: the product is invisible by design and users don't watch the middleware — email is the reliable channel that flags something needs attention. On by default.)*

## F10 — Dashboard & Monitoring (`DASH`)

- **FR-DASH-1** A tenant sees a **summary**: counts of cleared / reported / failed, total SAR volume, onboarding status.
- **FR-DASH-2** A tenant can **list and open invoices** with their ZATCA status, QR, and downloadable PDF/XML.
- **FR-DASH-3** A tenant can view the **transaction/audit log** (each ZATCA request/response).
- **FR-DASH-4** The dashboard is **read/monitor-oriented** — routine compliance needs no dashboard action (PRD §6).

## F11 — Headless API (Mode B) (`API`)

For custom/in-house systems; **functional parity** with Mode A, driven by the customer's code.

- **FR-API-1** Documented REST endpoints (auth via `x-api-key`) to: run onboarding, submit an invoice for **clearance/reporting**, retrieve an invoice + its **PDF/XML/QR/status**, list invoices, and read transaction logs.
- **FR-API-2** Same compliance engine, validation, and persistence as Mode A — only the trigger differs (customer call vs ERP webhook).
- **FR-API-3** Public API documentation is part of the self-serve guides (PRD §8.1).

## F12 — Assisted Onboarding & Ops (CBT) (`OPS`)

- **FR-OPS-1** A CBT team admin (A3) has **cross-tenant** access for support and troubleshooting.
- **FR-OPS-2** When a customer requests support for an **unlisted accounting software**, the request reaches the CBT team to assist and, if warranted, **build a new adapter**.
- **FR-OPS-3** CBT admin actions on a tenant are **auditable**.
- **FR-OPS-4 (Minimal console)** v1 ships a **minimal** internal console: cross-tenant view of tenants / onboarding status / invoices / logs, basic support actions (view error, re-trigger an invoice), and a queue of unlisted-software requests. No heavy admin tooling in v1. *(Decision.)*

---

## Resolved Decisions (locked v1.0)

| ID | Decision | Requirement |
|---|---|---|
| AUTH | Multiple **equal members per tenant** via email invite | FR-AUTH-6 |
| ONB | **Warn before CSID expiry** (auto-renewal is fast-follow) | FR-ONB-7 |
| ENV | Configurable testing → live env switching locked; exact ZATCA names/URLs = fact-check in Doc 06 | FR-ENV-4 |
| FLOW | **Async + queued** processing with **automatic retry + idempotency** | FR-FLOW-9, FR-FLOW-10 |
| ERR | **Email alerts** on failure (on by default), plus in-software + dashboard | FR-ERR-5 |
| OPS | **Minimal** internal admin console for v1 | FR-OPS-4 |

**Carried to other docs (not blockers):** queue mechanism choice → Doc 05; exact ZATCA env names/URLs → Doc 06.

---

*Locked v1.0. Next: Document 04 — Flows & Diagrams.*
