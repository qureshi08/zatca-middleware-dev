-- Migration 002 — store each tenant's chosen accounting integration.
-- Run once in the Supabase SQL Editor.
alter table organizations add column if not exists integration text
  check (integration in ('odoo','zoho','custom'));
