# Development Plan — 1 Week to Production

| | |
|---|---|
| **Document** | 07 — Development Plan |
| **Status** | 🟢 Proposed plan — for manager review |
| **Owner** | Convergent BT |
| **Last updated** | 2026-06-18 |
| **Goal** | Ship a **unified, fully-tested, production-level** ZATCA middleware in **~1 week** |
| **Repo** | `github.com/qureshi08/zatca-middleware-dev` · **DB:** Supabase · **Host:** Vercel |
| **Related** | `01-PRD` → `06-ZATCA-Compliance-Reference`, `08-Environments-and-Release-Management` |

> **Environment note (read first):** the entire week is built against the **ZATCA Simulation endpoint with OTP `123456`** (the dev tier — nothing legally filed). Customers start in **Demo** mode (simulation); **Real** mode (live filing) comes after internal **UAT** against the actual ZATCA environment and ZATCA production access. Full model in `08-Environments-and-Release-Management.md`.

---

## 1. Why one week is realistic

This is **not a greenfield build**. Two production-grade codebases already exist — a working ZATCA Phase-2 core (signing, UBL XML, QR, clearance/reporting, onboarding) plus complete **Zoho** and **Odoo** integrations. The week is spent **unifying, hardening, and testing** that into one adapter-based app — not inventing it.

The architecture, data model, API surface, flows, and 21 UI screens are already specified and mocked (Docs 01–06 + mockups). So the team builds against a locked spec, not a moving target.

## 2. Scope for the week (v1)

**In scope:** unified app; shared ZATCA core; Odoo + Zoho adapters; headless API (Mode B); Google auth; multi-tenant isolation; async queue + retry; onboarding; dashboard + all screens; write-back; failure notifications (in-app + email); minimal CBT admin; **full automated end-to-end against the ZATCA Simulation endpoint (OTP `123456`)**, with the per-tenant **Demo/Real** switch built; production deploy on Vercel; full test suite.

**Out of scope (deferred):** Dynamics 365 / Oracle adapters; Maker/Checker/Approver; billing; full automatic CSID renewal (we ship expiry *warnings*); multi-currency.

## 3. Daily milestones at a glance

| Day | Theme | Milestone (done = demoable) |
|---|---|---|
| 1 | Foundation & infra | App boots on Vercel; Google login; Supabase schema live; tenant isolation |
| 2 | ZATCA core (correctness) | Core proven against the ZATCA SDK reference (hash/sign/QR) |
| 3 | Adapters + async pipeline | Invoice → clear/report → write-back works end-to-end (testing tier) |
| 4 | Onboarding, API keys, Mode B | A tenant can self-onboard; headless API live + documented |
| 5 | Frontend + notifications + admin | All 21 screens functional on the real backend; email alerts |
| 6 | Full testing & QA | Green test suite (unit/integration/E2E/compliance/security) |
| 7 | Hardening + deploy + handoff | Production-deployed, smoke-tested, demo + docs handed off |

## 4. Day-by-day

### Day 1 — Foundation & Infrastructure
- Scaffold unified Next.js + TypeScript repo per `05-Architecture` (`core/`, `adapters/`, `queue/`, `db/`, `auth/`).
- **Supabase:** finalize schema + migrations (organizations, users, tenant_members, zatca_profiles `+environment +csid_expires_at`, invoices, transaction_logs, api_keys, odoo_config/zoho_config **encrypted**, jobs); **RLS** for tenant isolation; Storage buckets (XML/PDF).
- **Google auth** (Supabase Auth) + session + tenant bootstrap; **API-key** validation middleware.
- Secrets encryption (AES-256-GCM); environment resolver (testing/`core`).
- CI (lint, typecheck, test) on GitHub Actions; deploy skeleton to Vercel.
- *Done:* login works, empty dashboard renders, DB + RLS live.

### Day 2 — ZATCA Core (the correctness-critical day)
- Consolidate the shared core from both repos: UBL 2.1 XML (388/381/383, standard + simplified), **canonicalization**, SHA-256 hash, **ECDSA secp256k1** signing, XAdES, **TLV QR** (tags 1–9), transaction code `NNPNESB`, ICV/PIH chaining.
- **Validate against the local ZATCA Java SDK** (`D:\Anas\ZATCA\…`) — match reference hash + signature for a known invoice. *This de-risks the whole product.*
- Onboarding core: CSR → compliance CSID → compliance checks → production CSID.
- Unit tests for crypto / xml / qr / hash.
- *Done:* core output matches the ZATCA SDK byte-for-byte.

### Day 3 — Adapters + Async Pipeline
- `AccountingAdapter` interface; **Odoo** adapter (JSON-RPC, `x_zatca_*`, provision, write-back) + **Zoho** adapter (OAuth2, `cf_zatca_*`, comments, attachments, write-back).
- Async pipeline: `jobs` table + **Supabase DB webhook → `/api/worker`**, retry+backoff, idempotency, Vercel Cron sweep.
- Webhook endpoints (pull/push) both ERPs; classify → submit (clearance/reporting) → write-back → persist.
- Integration tests: full flow on the **testing tier**.
- *Done:* create invoice in Odoo/Zoho → auto-cleared/reported → results written back.

### Day 4 — Onboarding, API Keys, Mode B
- Onboarding wizard backend + screens wired (live CSR→compliance→production progress); testing-first + go-live (re-onboard `core`).
- API-key issue/revoke; **headless API (Mode B)** endpoints + **documented contract (OpenAPI)**.
- ERP connect / test / provision-fields wired; CSID expiry tracking + warnings.
- *Done:* a new tenant self-onboards end-to-end; Mode B usable from an external call.

### Day 5 — Frontend, Notifications, Admin
- Wire all screens to the real backend: dashboard (KPIs + testing/expiry banners), invoices list/detail (QR, XML/PDF, error + re-submit), audit logs, settings (connection/keys/team/go-live), request-unlisted, help, API docs.
- **Email** notifications via Resend (failures + expiry).
- Minimal **CBT admin** console (tenants, tenant detail + support actions, software-request queue).
- *Done:* all 21 screens functional on live data.

### Day 6 — Full Testing & QA
- **Unit:** crypto, XML, QR, validation rules.
- **Integration:** adapters, queue, retry, idempotency, write-back.
- **E2E (Playwright):** onboarding → invoice → write-back → dashboard.
- **Compliance:** clearance + reporting + credit/debit on testing tier; re-validate vs SDK.
- **Security:** tenant isolation/RLS, secret handling, API-key auth, rate limiting; failure/retry paths.
- **Performance:** async pipeline under burst load.
- Bug triage + fixes; coverage report.
- *Done:* green suite, documented coverage.

### Day 7 — Hardening, Deploy, Handoff
- Polish (error/empty states), edge cases, self-serve setup guides (Zoho/Odoo/API).
- **Production deploy** to Vercel; logging/monitoring; smoke tests.
- Documentation handoff + **live demo walkthrough**.
- **Buffer** for slippage.
- *Done:* production-deployed, tested, demoable; manager-ready.

## 5. Testing Strategy (what "fully tested" means)

| Layer | Tooling | Coverage target |
|---|---|---|
| Unit | Vitest/Jest | Core crypto/XML/QR/validation ≈ 90% |
| Integration | Vitest + Supabase test project | Adapters, queue, write-back |
| E2E | Playwright | Critical journeys (onboarding, invoice, failure) |
| Compliance | ZATCA SDK + testing tier | Hash/sign match; clear+report+notes pass |
| Security | Manual + automated | RLS isolation, secrets, auth, rate limits |

## 6. Definition of Done (production-level)

- [ ] Unified app deployed on Vercel; Supabase schema + RLS live.
- [ ] Odoo **and** Zoho: invoice → auto clear/report → write-back, end-to-end on the testing tier.
- [ ] Headless API (Mode B) works against documented contract.
- [ ] Self-service onboarding (Google → connect → ZATCA → testing) with clear testing-mode signalling.
- [ ] Async + retry + idempotency proven; failures notify (in-app + email).
- [ ] Secrets encrypted; tenants isolated; green test suite.
- [ ] ZATCA core validated against the SDK.
- [ ] Demo + docs handed off.

## 7. Assumptions & Risks (honest)

- **Feasibility hinges on the existing code being sound.** If the inherited core has hidden defects, Day 2 absorbs it (it's the buffer-critical day).
- **Live (production `core`) cutover depends on external ZATCA production access/approval**, which we don't control. The week delivers a fully working app on the **testing/simulation tier**; flipping a real tenant to live may extend a few days pending ZATCA. *(This is the one item that can slip beyond the week — worth stating to your manager up front.)*
- Single developer (Claude) building, with daily review from you; same-day feedback keeps the pace.
- Currency = SAR; deferred items (§2) stay deferred.
- Third-party setup (Supabase project, Vercel project, Google OAuth app, Resend, ERP test instances) assumed available Day 1.

## 8. What you get at the end of the week
A single deployed, multi-tenant, tested ZATCA middleware that auto-clears/reports invoices from Odoo and Zoho (and via API), with self-service onboarding — running live on the testing tier and ready for production cutover as soon as ZATCA production access is granted.

---

*Proposed. On approval, Day 1 starts in `zatca-middleware-dev`.*
