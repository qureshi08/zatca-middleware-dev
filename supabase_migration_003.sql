-- Migration 003 — align `invoices` with the proven clearance/webhook code.
-- The tested code writes an `xml` column and upserts on (organization_id, invoice_number).
-- Run once in the Supabase SQL Editor.

alter table invoices add column if not exists xml text;

-- Replace the (org, environment, invoice_number) unique with (org, invoice_number)
alter table invoices drop constraint if exists invoices_organization_id_environment_invoice_number_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_org_invoice_unique') then
    alter table invoices add constraint invoices_org_invoice_unique unique (organization_id, invoice_number);
  end if;
end $$;
