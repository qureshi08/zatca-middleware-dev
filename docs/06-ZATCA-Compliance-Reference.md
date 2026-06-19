# ZATCA Compliance Reference

| | |
|---|---|
| **Document** | 06 — ZATCA Compliance Reference |
| **Status** | 🟢 LOCKED (v1.0) — validate ⚠️ items against the ZATCA SDK during onboarding/UAT |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-18 |
| **Related docs** | `01-PRD.md`, `02-Actors-and-Capabilities.md`, `03-Functional-Spec.md`, `04-Flows.md`, `05-Architecture.md` |

> The **non-negotiable rules**. ZATCA rejects non-conforming invoices, so this is the one doc that must be exact. Values below reflect the existing implementation + ZATCA's published specs (Detailed Technical Guidelines; Electronic Invoice XML Implementation Standard v1.2). A few items marked ⚠️ must be **validated against the ZATCA SDK's reference output during onboarding/UAT** — they are not dev blockers on the testing tier.
>
> 📌 The official **ZATCA e-invoicing Java SDK** is available locally at `D:\Anas\ZATCA\zatca-einvoicing-sdk-Java-238-R3.4.8` — use it as the source of truth for canonicalization, hashing, signing, and QR during build.

---

## 1. Scope

- **Standard:** ZATCA (Fatoora) e-invoicing, **Phase 2 (Integration Phase)**.
- **Format:** UBL 2.1 XML, signed (XAdES), with embedded QR.
- **Two submission modes:** **Clearance** (standard / B2B) and **Reporting** (simplified / B2C).
- Country: **KSA**; currency: **SAR** (v1).

## 2. Environments & Endpoints

ZATCA exposes distinct base URLs under `https://gw-fatoora.zatca.gov.sa/e-invoicing/`:

| Our tier | ZATCA base path | Onboarding | Invoices |
|---|---|---|---|
| **Testing** (dev) | `developer-portal/` | compliance / production CSID, renewal | compliance invoice checks |
| **Testing** (sim) | `simulation/` | `simulation/compliance` | `simulation/invoices/` |
| **Live** | `core/` | `core/compliance` | `core/invoices/` |

**Decision (locked):** development + customer **Demo mode** use the **Simulation** endpoint with **OTP `123456`** (not legally filed); customer **Real mode** uses **`core`** with the customer's **actual OTP** (legally filed). Progression: **Dev (simulation/123456) → UAT (validate against the real env) → Production (`core`)**. A tenant does a deliberate **real onboarding** against `core` to switch Demo → Real (FR-ENV-5..7, Flow 7). Full model: `08-Environments-and-Release-Management.md`. Operationally validate exact tier behaviour with ZATCA.

- ⚠️ **CODE GAP:** current code only wires `developer-portal` + `simulation` and **lacks the live `core/` endpoints** — must be added (`05-Architecture.md` §8, FR-ENV-1).
- **OTP source:** taxpayers generate the **OTP** in the Fatoora portal (`https://fatoora.zatca.gov.sa/`).

## 3. Onboarding APIs (Phase 2)

Order matters; each step gates the next (Flow 2 in `04-Flows.md`).

| Step | API | Auth | Returns |
|---|---|---|---|
| 1 | `POST .../compliance` (CSR + OTP) | OTP | **Compliance CSID (CCSID)** + secret |
| 2 | `POST .../compliance/invoices` | CCSID | validation results for sample docs |
| 3 | `POST .../production/csids` | CCSID | **Production CSID (PCSID)** + secret |
| 4 | `PATCH .../production/csids` (renewal) | PCSID | renewed CSID |

**Compliance checks (step 2):** the EGS must submit **one sample of every document type it declared in its CSR**, and all must pass before a PCSID is issued. In practice:
- If the unit issues **standard (B2B)** invoices → submit **standard invoice + standard credit note (381) + standard debit note (383)**.
- If it issues **simplified (B2C)** invoices → submit **simplified invoice + simplified credit + simplified debit**.
- A unit supporting both submits **all ~6 documents**.

The set is driven by the invoice-type flags in the CSR (`csr.invoiceType`). **CSID = Cryptographic Stamp Identifier** (an X.509 cert issued by ZATCA).

## 4. Invoice Types, Document Types & Transaction Code

| Concept | Values |
|---|---|
| **Invoice type** | **Standard** (B2B) → **Clearance**; **Simplified** (B2C) → **Reporting** |
| **Document type code** (`cbc:InvoiceTypeCode`) | `388` Tax Invoice · `381` Credit Note · `383` Debit Note · `386` Prepayment |
| **Subtype** | `01` = standard/tax · `02` = simplified |

**Transaction code** — the 7-char `name` attribute on `InvoiceTypeCode`, structure **`NNPNESB`**:

| Pos | Meaning | Values |
|---|---|---|
| 1–2 (`NN`) | Invoice subtype | `01` standard · `02` simplified |
| 3 (`P`) | 3rd-party invoice | 0 / 1 |
| 4 (`N`) | Nominal invoice | 0 / 1 |
| 5 (`E`) | Export invoice | 0 / 1 |
| 6 (`S`) | Summary invoice | 0 / 1 |
| 7 (`B`) | Self-billed invoice | 0 / 1 |

Examples: `<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>` (standard tax invoice), `name="0200000"` (simplified).

- **Clearance (standard/B2B):** real-time. ZATCA validates, **signs**, and returns the **cleared XML** — that cleared XML is the legal invoice.
- **Reporting (simplified/B2C):** the EGS signs and issues immediately; reported to ZATCA (within 24h). ZATCA returns acceptance, not a re-signed document.
- **Credit/Debit notes (381/383):** MUST reference the **original invoice** + a reason (`cac:BillingReference`). Fail loudly if missing (FR-DOC-2).

## 5. Required Invoice Content (UBL 2.1)

Per the Electronic Invoice XML Implementation Standard. Validate the full field list against the SDK/data dictionary.

**Document header** — Invoice number (ID); **UUID** (v4); issue date + time; `InvoiceTypeCode` + transaction-code `name`; currency `SAR`; **ICV** (Invoice Counter Value, monotonic, in `AdditionalDocumentReference` ICV); **PIH** (Previous Invoice Hash, in `AdditionalDocumentReference` PIH, chained).

**Seller (supplier)** — legal name; **VAT number** (15 digits, `3XXXXXXXXXX3`); **CRN / other scheme ID**; full **registered address** (street, building number, city, postal code `NNNNN`, district, country `SA`).
- ⚠️ **CODE GAP:** current code uses placeholder seller addresses — collect real values at registration (FR-AUTH-4).

**Buyer (customer)** — Standard (B2B): name, **VAT number (required)**, address. Simplified (B2C): minimal / optional.

**Lines** — per line: item name, quantity, unit price, line net, **VAT category code** + rate, VAT amount.

**VAT categories**

| Code | Meaning | Rate | Reason required? |
|---|---|---|---|
| `S` | Standard rate | 15% | no |
| `Z` | Zero-rated | 0% | **yes** (reason code + text) |
| `E` | Exempt | 0% | **yes** (reason code + text) |
| `O` | Out of scope / not subject | — | **yes** |

**Totals (LegalMonetaryTotal + TaxTotal)** — line nets sum, total VAT (grouped by category), total incl. VAT, prepaid, payable. Must reconcile exactly.

## 6. Cryptography

| Aspect | Value |
|---|---|
| Key | **ECDSA, curve secp256k1** |
| Hash | **SHA-256** |
| Signature | **XAdES** (enveloped) in `ext:UBLExtensions` |
| Invoice hash | SHA-256 over the **canonicalized** XML, Base64 |
| Cert / CSID | X.509 (DER), Base64; issued by ZATCA |

**Canonicalization (critical):** before hashing, canonicalize per ZATCA rules and **remove** these nodes: `ext:UBLExtensions` (the signature), `cac:Signature`, and the QR `cac:AdditionalDocumentReference`. Any deviation changes the hash and fails clearance.
- ⚠️ **VALIDATE against the local ZATCA SDK's reference hash** for a known invoice — this is the single most error-prone area.
- **PIH chaining:** each invoice hash becomes the next invoice's PIH; the first invoice uses ZATCA's defined seed (`0` base value per spec). ⚠️ Confirm seed via SDK.

## 7. QR Code (TLV)

TLV (Tag-Length-Value), Base64-encoded, embedded as `AdditionalDocumentReference` "QR" and rendered as a QR image.

| Tag | Field |
|---|---|
| 1 | Seller name |
| 2 | Seller VAT number |
| 3 | Timestamp (ISO 8601) |
| 4 | Invoice total (incl. VAT) |
| 5 | VAT total |
| 6 | Invoice hash (SHA-256, Base64) |
| 7 | ECDSA signature |
| 8 | ECDSA public key |
| 9 | Cryptographic stamp / cert signature |

- **Simplified (B2C):** the EGS generates the QR with **all tags 1–9** (6–9 are the cryptographic-stamp fields).
- **Standard (B2B):** the QR comes from ZATCA's **cleared** response; the EGS embeds what clearance returns.

## 8. Key BR-KSA Business Rules (high-impact)

The validation engine must enforce at least these (existing code covers ~25):

- VAT number = 15 digits, starts and ends with `3`.
- Totals reconcile (line sums = document totals; VAT computed per category).
- Standard invoice requires buyer VAT number; simplified does not.
- Credit/Debit notes (`381`/`383`) require a **`BillingReference` to the original invoice** + reason.
- Mandatory **ICV** (sequential) and **PIH** (chained) present and correct.
- Issue date/time present; not future-dated beyond tolerance.
- Only allowed VAT category codes; **`Z`/`E`/`O` require a VAT-exemption reason code + reason text**.
- Simplified invoices must carry the cryptographic stamp (QR tags 6–9).

## 9. Certificate / CSID Lifecycle

- Compliance CSID → pass compliance → Production CSID, **per environment**.
- **Separate CSIDs per tier** (testing vs live) — never reuse across tiers.
- Track **expiry**; warn at 30 / 14 / 3 days (FR-ONB-7); renew via the production CSID renewal API (step 4).

## 10. Must-Fix Gaps (carried from code review)

| Gap | Impact | Requirement |
|---|---|---|
| Missing live `core/` endpoints | Cannot go live | FR-ENV-1 |
| Placeholder seller address | Invalid UBL / rejection | FR-AUTH-4 |
| Cleartext ERP credentials | Security | FR-CONN-3 |
| No CSID expiry handling | Silent compliance break | FR-ONB-7 |

## 11. Go-Live Validation Checklist (run during onboarding/UAT)

- [ ] Validate **canonicalization + invoice hash** against the local ZATCA SDK reference values (§6).
- [ ] Confirm the **compliance sample-document set** for the declared invoice profile passes (§3).
- [ ] Verify **transaction-code flags** for every invoice variant in use (§4).
- [ ] Confirm **PIH seed** + chaining via the SDK (§6).
- [ ] Confirm **QR tags 1–9** for simplified; embed cleared QR for standard (§7).
- [ ] Confirm **exempt/zero-rated reason codes** accepted (§8).
- [ ] Run full **clearance + reporting** on the testing tier, then UAT against the live (`core`) environment before switching tenants to live.

## 12. Sources

- ZATCA **E-invoicing Detailed Technical Guidelines** (zatca.gov.sa, E-Invoicing → Guidelines).
- ZATCA **Electronic Invoice XML Implementation Standard v1.2** (zatca.gov.sa, Systems Developers).
- Fatoora **Developer Portal Manual** & **Fatoora Portal User Manual**.
- Fatoora Developer Community — E-Invoicing API endpoints (`zatca1.discourse.group`).
- **Local ZATCA Java SDK** `D:\Anas\ZATCA\zatca-einvoicing-sdk-Java-238-R3.4.8` (reference for hashing/signing/QR).
- Existing implementation `src/lib/zatca/*` in the `-zoho` / `-odoo` repos.

---

*Locked v1.0. The ⚠️ items are validated against the ZATCA SDK during onboarding/UAT, not before development. The full v1 documentation set is complete.*
