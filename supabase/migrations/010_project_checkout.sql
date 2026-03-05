-- Checkout: one editor at a time, 12-hour auto-expiry
-- Run after 009_project_shares.sql

alter table public.projects add column if not exists checked_out_by uuid references auth.users(id) on delete set null;
alter table public.projects add column if not exists checked_out_at timestamptz;
create index if not exists projects_checked_out_by_idx on public.projects(checked_out_by);
