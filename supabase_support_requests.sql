-- Support requests: customers reach out to middleware support (general help,
-- "please add my accounting software", bug reports). Platform admins triage them.
-- Run this in the Supabase SQL editor of the SAME project the app uses.
--
-- Note: organization_id is a plain uuid (no foreign key) so this runs cleanly
-- even if applied before the base schema. The app always filters by
-- organization_id explicitly, so the FK isn't required.

create table if not exists support_requests (
    id                 uuid primary key default gen_random_uuid(),
    organization_id    uuid,
    user_email         text,
    category           text not null default 'general',   -- general | integration_request | bug | billing
    subject            text not null,
    message            text not null,
    requested_software text,                                -- set when category = integration_request
    status             text not null default 'open',        -- open | in_progress | resolved
    admin_note         text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_support_org on support_requests (organization_id, created_at desc);
create index if not exists idx_support_status on support_requests (status, created_at desc);
