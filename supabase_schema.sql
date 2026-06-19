-- ============================================================================
-- ZATCA Compliance Middleware — Unified Database Schema (v1.0)
-- Target: Supabase (PostgreSQL). Run in the Supabase SQL Editor on a fresh project.
-- Auth: Supabase Auth (Google). Users live in auth.users; tenant_members links them.
-- Isolation: every business is an "organization" (tenant); RLS scopes rows to members.
-- See docs/05-Architecture.md and docs/06-ZATCA-Compliance-Reference.md.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ORGANIZATIONS (tenants / businesses)
-- ----------------------------------------------------------------------------
create table if not exists organizations (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,                 -- legal name (EN)
    name_ar         text,                          -- legal name (AR)
    tax_number      text not null,                 -- CRN / commercial reg. number
    vat_number      text not null,                 -- 15 digits, 3XXXXXXXXXX3
    -- registered seller address (required for valid ZATCA UBL — fixes placeholder gap)
    addr_building   text,
    addr_street     text,
    addr_district   text,
    addr_city       text,
    addr_postal     text,                          -- NNNNN
    addr_country    text not null default 'SA',
    status          text not null default 'onboarding',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. TENANT MEMBERS (auth user <-> organization; all members are equal, no roles)
-- ----------------------------------------------------------------------------
create table if not exists tenant_members (
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    created_at      timestamptz not null default now(),
    primary key (organization_id, user_id)
);
create index if not exists idx_members_user on tenant_members (user_id);

-- ----------------------------------------------------------------------------
-- 3. ZATCA PROFILES (CSID & key store) — per tenant, per environment
--    environment: 'demo' = ZATCA simulation (OTP 123456, not filed)
--                 'real' = ZATCA core (real OTP, legally filed)
--    Secrets (keys/CSIDs) are stored ENCRYPTED at rest by the app layer.
-- ----------------------------------------------------------------------------
create table if not exists zatca_profiles (
    id                    uuid primary key default gen_random_uuid(),
    organization_id       uuid not null references organizations(id) on delete cascade,
    environment           text not null default 'demo' check (environment in ('demo','real')),
    onboarding_step       text not null default 'none',
    compliance_request_id text,
    compliance_csid       text,
    compliance_secret     text,
    production_csid       text,
    production_secret     text,
    private_key_base64    text,
    public_key_base64     text,
    csid_expires_at       timestamptz,             -- drives expiry warnings (FR-ONB-7)
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    unique (organization_id, environment)          -- separate demo/real profiles
);

-- ----------------------------------------------------------------------------
-- 4. API KEYS (webhook + Mode B auth) — only the SHA-256 hash is stored
-- ----------------------------------------------------------------------------
create table if not exists api_keys (
    id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    key_prefix      text not null,
    key_hash        text not null unique,
    name            text not null default 'Default Key',
    status          text not null default 'active',
    created_at      timestamptz not null default now()
);
create index if not exists idx_api_keys_hash on api_keys (key_hash) where status = 'active';

-- ----------------------------------------------------------------------------
-- 5. INVOICES (audit ledger & cache)
-- ----------------------------------------------------------------------------
create table if not exists invoices (
    id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    environment     text not null default 'demo' check (environment in ('demo','real')),
    invoice_number  text not null,
    invoice_type    text not null,                 -- 'standard' | 'simplified'
    document_type   text not null default '388',   -- 388 invoice, 381 credit, 383 debit
    status          text not null default 'draft',
    total_amount    numeric(18,2),
    zatca_status    text,                          -- CLEARED | REPORTED | REJECTED
    zatca_uuid      text,
    qr_code         text,
    xml_path        text,                          -- Supabase Storage path (signed XML)
    pdf_path        text,                          -- Supabase Storage path (compliant PDF)
    error_reason    text,
    payload         jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (organization_id, environment, invoice_number)
);
create index if not exists idx_invoices_org_date on invoices (organization_id, created_at desc);
create index if not exists idx_invoices_status on invoices (organization_id, status);

-- ----------------------------------------------------------------------------
-- 6. TRANSACTION LOGS (every ZATCA request/response, for audit)
-- ----------------------------------------------------------------------------
create table if not exists transaction_logs (
    id               uuid primary key default gen_random_uuid(),
    organization_id  uuid not null references organizations(id) on delete cascade,
    request_type     text not null,                -- clearance | reporting | onboarding
    invoice_number   text,
    invoice_hash     text,
    status           text not null,                -- success | failure
    response_payload jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now()
);
create index if not exists idx_logs_org_date on transaction_logs (organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. ACCOUNTING-SOFTWARE CONFIG — one row per tenant per adapter
--    Secrets stored ENCRYPTED at rest (app layer, AES-256-GCM).
-- ----------------------------------------------------------------------------
create table if not exists zoho_config (
    id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade unique,
    zoho_region     text not null default 'sa',
    zoho_org_id     text not null,
    zoho_client_id  text not null,
    zoho_client_secret text not null,              -- encrypted
    zoho_refresh_token text not null,              -- encrypted
    auto_submit     boolean not null default true,
    status          text not null default 'disconnected',
    last_sync       timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists odoo_config (
    id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade unique,
    odoo_url        text not null,
    odoo_db         text not null,
    odoo_username   text not null,
    odoo_password   text not null,                 -- encrypted (password or API key)
    auto_submit     boolean not null default true,
    status          text not null default 'disconnected',
    last_sync       timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. JOBS (async compliance pipeline — FR-FLOW-9/10)
--    Webhook/API enqueues; a Supabase DB webhook triggers /api/worker;
--    a Vercel Cron sweeps due 'queued'/'retry' rows. Idempotent per invoice.
-- ----------------------------------------------------------------------------
create table if not exists jobs (
    id              uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    idempotency_key text not null unique,          -- org:env:invoice_ref:doc_type
    type            text not null default 'compliance',
    status          text not null default 'queued' check (status in ('queued','processing','done','failed','retry')),
    attempts        int not null default 0,
    max_attempts    int not null default 5,
    run_after       timestamptz not null default now(),
    payload         jsonb not null default '{}'::jsonb,
    last_error      text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists idx_jobs_due on jobs (status, run_after) where status in ('queued','retry');

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

do $$ declare t text;
begin
  foreach t in array array['organizations','zatca_profiles','invoices','zoho_config','odoo_config','jobs']
  loop
    execute format('drop trigger if exists trg_%s_updated on %s', t, t);
    execute format('create trigger trg_%s_updated before update on %s for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY — tenant isolation
--   Server (service-role key) bypasses RLS for the worker/webhooks.
--   Browser/session access is limited to the caller's own organizations.
-- ----------------------------------------------------------------------------
create or replace function is_member(org uuid) returns boolean as $$
  select exists (select 1 from tenant_members m where m.organization_id = org and m.user_id = auth.uid());
$$ language sql security definer stable;

do $$ declare t text;
begin
  foreach t in array array['organizations','zatca_profiles','api_keys','invoices','transaction_logs','zoho_config','odoo_config','jobs','tenant_members']
  loop execute format('alter table %s enable row level security', t); end loop;
end $$;

-- members can read their org row; org-scoped tables readable by members
create policy org_read on organizations for select using (is_member(id));
create policy members_self on tenant_members for select using (user_id = auth.uid());
create policy zatca_read on zatca_profiles for select using (is_member(organization_id));
create policy keys_read on api_keys for select using (is_member(organization_id));
create policy inv_read on invoices for select using (is_member(organization_id));
create policy logs_read on transaction_logs for select using (is_member(organization_id));
create policy zoho_read on zoho_config for select using (is_member(organization_id));
create policy odoo_read on odoo_config for select using (is_member(organization_id));
-- jobs are operated by the server only (no client policy) — service role bypasses RLS.

-- ============================================================================
-- End of unified schema.
-- ============================================================================
