# Actors & Capabilities

| | |
|---|---|
| **Document** | 02 — Actors & Capabilities Matrix |
| **Status** | 🟢 LOCKED (v1.0) |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-17 |
| **Related docs** | `01-PRD.md`, `03-Functional-Spec.md`, `04-Flows.md`, `05-Architecture.md`, `06-ZATCA-Compliance-Reference.md` |

> Defines **who/what interacts** with the middleware and **exactly what each can do**. Derived from the PRD. The Functional Spec (03) expands each capability into behavior.

---

## 1. Guiding Principle

The product has a **deliberately flat actor model**. There are only two kinds of people:
1. **Customers** — who self-serve: create an account, set up their accounting software or custom app, then just keep using their own software.
2. **Convergent (CBT) team** — who run the platform and help customers when asked.

There is **no role hierarchy inside a customer's tenant** (no Maker/Checker/Approver, no viewer tier). Everything else is software talking to software.

## 2. Actor Catalog

### Human actors

#### A1 — Tenant User *(the customer)*
The person who sets up and uses a business's compliance. All users within a tenant are **equal** — there are no sub-roles.
- **Authenticates via:** Google authentication (sign up + log in). See PRD §8.1.
- **Scope:** their own tenant (organization) only.
- **Does:** creates the account/profile, connects their accounting software (Odoo/Zoho) **or** sets up the headless API for a custom app, completes ZATCA onboarding (CSR → compliance → production CSID), manages API keys, monitors invoices/compliance status. If their accounting software **isn't listed**, they reach out to Convergent for help (see A3).
- After setup, the user simply **works in their own accounting software** — compliance is automatic (PRD §6).

#### A2 — Business Staff *(indirect actor)*
Employees who create invoices in the accounting software day to day.
- **Authenticates via:** *nothing in our system* — they only use Odoo/Zoho.
- **Interaction with us:** **none, directly.** Their invoice-creation action is what *automatically* triggers compliance.
- Listed because they originate the core flow in the real world, but they are **invisible** to our product surface. (Often the same person as A1 in a small business.)

#### A3 — Convergent (CBT) Team Admin *(internal)*
Convergent staff who operate the platform and assist customers.
- **Authenticates via:** internal admin access (privileged).
- **Scope:** **cross-tenant** — the only actor that can see across customers.
- **Does:**
  - **Assisted onboarding** — help a customer set up, especially when their **accounting software is not yet listed/supported** (the customer reaches out; we help, and may build a new adapter).
  - **Support & troubleshooting** across tenants.
  - Platform/tenant administration as needed.

### System / external actors

#### S1 — Accounting Software *(Odoo, Zoho)*
The connected ERP/accounting system in Mode A.
- **Authenticates via:** tenant **API key** (`x-api-key`) on inbound webhook calls; we authenticate **to** it using the tenant's stored credentials (Zoho: OAuth2 refresh-token; Odoo: JSON-RPC user/password).
- **Does:** triggers the flow when an invoice is created (push payload or pull-by-id), and **receives the write-back** (signed XML, cleared PDF, QR, status, UUID).

#### S2 — Custom / In-House System *(Mode B)*
A customer's own accounting software using our headless API.
- **Authenticates via:** tenant **API key**.
- **Does:** calls our API to onboard, submit invoices for clearance/reporting, and retrieve validated outputs — everything Mode A does, driven by the customer's own code.

#### S3 — ZATCA (Fatoora) Authority *(external upstream)*
The Saudi tax authority we integrate with.
- **We authenticate to it via:** compliance/production CSID + secret (obtained during onboarding).
- **Does:** issues CSIDs during onboarding; receives invoices for **clearance** (B2B standard) or **reporting** (B2C simplified); returns cleared XML / validation results.

## 3. Capabilities Matrix

Legend: ✅ can do · ➖ not applicable · *(auto)* = happens automatically without anyone operating the middleware.

| Capability | A1 Tenant User | A2 Staff | A3 CBT Admin | S1 Accounting SW | S2 Custom System | S3 ZATCA |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Account & Access** | | | | | | |
| Sign up / log in (Google auth) | ✅ | ➖ | ✅* | ➖ | ➖ | ➖ |
| Register / configure tenant profile | ✅ | ➖ | ✅ | ➖ | ➖ | ➖ |
| Generate / revoke API keys | ✅ | ➖ | ✅ | ➖ | ➖ | ➖ |
| **Accounting-Software Connection (Mode A)** | | | | | | |
| Connect & configure ERP (Odoo/Zoho) | ✅ | ➖ | ✅ (assist) | ➖ | ➖ | ➖ |
| Test connection / provision custom fields | ✅ | ➖ | ✅ | ➖ | ➖ | ➖ |
| Request support for an unlisted accounting software | ✅ | ➖ | ✅ (fulfils) | ➖ | ➖ | ➖ |
| Trigger compliance by creating an invoice | ➖ | ✅ *(auto)* | ➖ | ✅ *(auto)* | ➖ | ➖ |
| Receive write-back (XML/PDF/QR/status/UUID) | ➖ | ➖ | ➖ | ✅ *(auto)* | ➖ | ➖ |
| **ZATCA Onboarding** | | | | | | |
| Run onboarding (CSR → compliance → production) | ✅ | ➖ | ✅ (assist) | ➖ | ✅ (via API) | ➖ |
| Issue CSIDs | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ |
| **Invoicing & Compliance (core)** | | | | | | |
| Generate ZATCA UBL XML + sign + QR | *(system)* | ➖ | ➖ | ➖ | ➖ | ➖ |
| Submit invoice for clearance (B2B) | ➖ | ➖ | ➖ | ✅ *(auto)* | ✅ (via API) | receives |
| Submit invoice for reporting (B2C) | ➖ | ➖ | ➖ | ✅ *(auto)* | ✅ (via API) | receives |
| Clear / validate / return result | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ |
| Retrieve validated invoice / PDF / XML | ✅ | ➖ | ✅ | ✅ *(auto)* | ✅ (via API) | ➖ |
| **Monitoring & Audit** | | | | | | |
| View invoices & compliance status | ✅ | ➖ | ✅ (all tenants) | ➖ | ✅ (via API) | ➖ |
| View transaction / audit logs | ✅ | ➖ | ✅ (all tenants) | ➖ | ✅ (via API) | ➖ |
| **Headless API (Mode B)** | | | | | | |
| Call all compliance operations programmatically | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |

\* A3 (CBT admin) uses privileged internal access; Google auth shown only as the general sign-in mechanism.

## 4. Notes on Boundaries

- **No human operates the middleware in the happy path.** A1 only does **setup and monitoring**; per-invoice compliance is fully automatic. A2 never touches us. A3 acts only on **support/setup**, not routine operations.
- **Mode A vs Mode B parity:** S1 (accounting software) and S2 (custom system) can do the same compliance operations; the difference is *who drives* — our adapter vs the customer's own code.
- **Isolation:** every A1/S1/S2 capability is scoped to a single tenant profile (PRD §8). The **only** cross-tenant actor is A3 (CBT team).
- **Unlisted accounting software path:** customer (A1) requests → CBT team (A3) assists / builds a new adapter. This is the human escalation valve on the otherwise self-service model.

---

*Locked v1.0. Next: Document 03 — Functional Spec.*
