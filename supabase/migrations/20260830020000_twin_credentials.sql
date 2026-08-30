-- Per-twin CT credentials (robot-ready train CT-4; PT pipeline Wave 3.5 parity).
-- PT issues ONE token per twin; the sha256 hash is mirrored here (manage-user
-- set_twin_credential) so CT's twin-login can verify the same token locally.
-- Service-role only — no client reads or writes; RLS enabled with no policies.

create table if not exists public.twin_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

comment on table public.twin_credentials is
  'sha256 hashes of per-twin fleet tokens, mirrored from PipeTooling at issue time. twin-login verifies X-Twin-Token against active rows; revoking (revoked_at) severs that token on this app independently.';

alter table public.twin_credentials enable row level security;

create index if not exists twin_credentials_user_idx on public.twin_credentials (user_id);
