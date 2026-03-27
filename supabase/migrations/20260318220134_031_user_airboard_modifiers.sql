-- Add plumbing and line modifiers to user_airboard for cross-device sync
alter table public.user_airboard
  add column if not exists plumbing_modifiers jsonb default '{}',
  add column if not exists line_modifiers jsonb default '{}';;
