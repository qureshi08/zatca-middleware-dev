# Flows & Diagrams

| | |
|---|---|
| **Document** | 04 — Flows & Diagrams |
| **Status** | 🟡 DRAFT (v0.1) — for team review |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-17 |
| **Related docs** | `01-PRD.md`, `02-Actors-and-Capabilities.md`, `03-Functional-Spec.md`, `05-Architecture.md`, `06-ZATCA-Compliance-Reference.md` |

> Visual companion to the Functional Spec. Diagrams use **Mermaid** (renders on GitHub and most Markdown viewers). Each flow cites the `FR-*` it realizes.

---

## 1. Customer Journey (onboarding, end-to-end)

From zero to compliant. One-time. The customer first onboards in **Demo mode** (ZATCA simulation, OTP `123456`) — clearly flagged — then does the deliberate switch to **Real** to go live (see Flow 7). Realizes `FR-AUTH-*`, `FR-CONN-*`, `FR-ONB-*`, `FR-ENV-5..7`.

```mermaid
flowchart TD
    A([New customer]) --> B[Sign up with Google]
    B --> C[Create tenant profile]
    C --> D[Enter seller identity:<br/>name, VAT, CRN, registered address]
    D --> E{How will they integrate?}
    E -->|Accounting software| F[Connect Odoo / Zoho<br/>enter credentials]
    E -->|Custom system| G[Generate API key<br/>read API guide]
    F --> H[Test connection]
    H -->|fail| F
    H -->|ok| I[Provision / verify ERP custom fields]
    I --> J[ZATCA onboarding]
    G --> J
    E -->|Software not listed| Z[Request support → CBT team]
    Z --> F
    J --> K([Ready: compliance now automatic])
```

## 2. ZATCA Onboarding (detail)

CSR → Compliance CSID → compliance checks → Production CSID. Done in **Demo** (ZATCA simulation) first; switch to **Real** later (see Flow 7). Realizes `FR-ONB-1..6`, `FR-ENV-*`.

```mermaid
sequenceDiagram
    actor U as Tenant User
    participant M as Middleware
    participant Z as ZATCA Simulation
    Note over U,Z: Onboarding runs in Demo against the ZATCA simulation
    U->>M: Provide OTP from Fatoora portal
    M->>M: Generate ECDSA secp256k1 keypair
    M->>M: Build CSR from seller identity
    M->>Z: Request Compliance CSID with CSR and OTP
    Z-->>M: Compliance CSID and secret
    loop For each required document type
        M->>M: Build and sign sample standard, simplified, credit, debit
        M->>Z: Submit compliance invoice
        Z-->>M: Validation result
    end
    M->>Z: Request Production CSID
    Z-->>M: Production CSID and secret
    M->>M: Store keys and CSIDs encrypted per tenant
    M-->>U: Onboarding complete, state production_received
    Note over M,Z: Switch to Real later by re-onboarding against core, see Flow 7
```

## 3. Core Automatic Compliance Flow ⭐ (async + queued)

The heart of the product. **No manual middleware step.** Realizes `FR-FLOW-1..10`, `FR-WB-*`, `FR-ERR-*`.

```mermaid
sequenceDiagram
    actor S as Staff in ERP
    participant E as Accounting Software
    participant W as Middleware Webhook
    participant Q as Job Queue
    participant K as Worker ZATCA core
    participant Z as ZATCA
    S->>E: Create or send invoice
    E->>W: Webhook, pull invoice id or push payload, with x-api-key
    W->>W: Validate key and resolve tenant
    W->>Q: Enqueue job with idempotency key
    W-->>E: 200 Accepted immediately
    Q->>K: Dispatch job
    alt pull mode
        K->>E: Fetch full invoice via ERP API
        E-->>K: Invoice with buyer and lines
    end
    K->>K: Classify standard or simplified and doc type
    K->>K: Map to UBL 2.1 XML with ICV, UUID, PIH
    K->>K: Hash SHA-256, sign ECDSA, add XAdES
    K->>K: Generate TLV QR
    alt standard B2B
        K->>Z: Clearance
        Z-->>K: Cleared XML and status
    else simplified B2C
        K->>Z: Reporting
        Z-->>K: Reported and status
    end
    K->>E: Write back XML, PDF, QR, status, UUID
    K->>K: Persist invoice and transaction log
    Note over K,E: Staff sees the compliant invoice in their own software with zero extra steps
```

## 4. Invoice Classification (decision logic)

How a document is routed. Realizes `FR-FLOW-2`, `FR-DOC-*`.

```mermaid
flowchart TD
    A([Incoming document]) --> B{Document type?}
    B -->|Invoice 388| C{Buyer is VAT-registered business?}
    B -->|Credit note 381| D[Require original invoice ref]
    B -->|Debit note 383| D
    D -->|missing ref| X[[Reject: fail loudly]]
    D -->|present| C
    C -->|Yes B2B| E[Standard invoice → CLEARANCE]
    C -->|No B2C| F[Simplified invoice → REPORTING]
    E --> G([Submit to ZATCA])
    F --> G
```

## 5. Failure & Retry Flow

What happens when something goes wrong. Realizes `FR-FLOW-10`, `FR-ERR-1..5`.

```mermaid
flowchart TD
    A([Job processing]) --> B{Step failed?}
    B -->|No| C([Success: write-back + persist])
    B -->|Transient<br/>network/ZATCA timeout| D{Retries left?}
    D -->|Yes| E[Backoff + retry] --> A
    D -->|No| F[Mark FAILED + reason]
    B -->|Permanent<br/>validation/rejection| F
    F --> G[Write error into ERP<br/>field + comment]
    F --> H[Show in dashboard<br/>with reason]
    F --> I[Email tenant<br/>invoice ref + reason]
    G --> J([Awaiting correction])
    H --> J
    I --> J
    J --> K[User fixes + re-triggers] --> A
```

## 6. Headless API Flow (Mode B)

Custom systems drive the same engine. Realizes `FR-API-*`.

```mermaid
sequenceDiagram
    participant C as Custom System
    participant A as Middleware API
    participant Q as Job Queue
    participant K as Worker ZATCA core
    participant Z as ZATCA
    C->>A: POST invoice payload with x-api-key
    A->>A: Validate key and resolve tenant
    A->>Q: Enqueue or process
    A-->>C: Accepted with job or invoice id
    Q->>K: Dispatch
    K->>Z: Clearance or Reporting
    Z-->>K: Result
    K->>K: Persist
    C->>A: GET invoice by id to poll status
    A-->>C: Status with cleared XML, PDF, QR, UUID
```

## 7. Environment Promotion (Demo → Real)

Controlled move from **Demo** (ZATCA simulation, OTP 123456) to **Real** (live `core`). Realizes `FR-ENV-1..7`.

```mermaid
flowchart LR
    A([Tenant in Demo<br/>ZATCA simulation]) --> B[Validate end-to-end:<br/>clear/report sample invoices]
    B --> C{All good?}
    C -->|No| B
    C -->|Yes| D[Get real OTP from Fatoora]
    D --> E[Re-onboard against Real<br/>core env, new CSIDs]
    E --> F([Tenant in Real<br/>live filing])
```

> Exact ZATCA environment names/URLs for Demo (simulation) and Real (`core`) are in `06-ZATCA-Compliance-Reference.md`; the full model is in `08-Environments-and-Release-Management.md`.

---

## Legend & Conventions

- **Demo** = ZATCA **simulation** endpoint (OTP `123456`, not legally filed). **Real** = ZATCA **`core`** (real OTP, legally filed). See `08-Environments-and-Release-Management.md`.
- **Pull mode** is the recommended ERP trigger (middleware fetches the full document); **push mode** sends the full payload.
- ⭐ Flow 3 is the canonical path the whole product exists to deliver.
- All flows are **per tenant** and isolated.

---

*End of draft. Review/correct; then we lock and move to Document 05 — Architecture.*
