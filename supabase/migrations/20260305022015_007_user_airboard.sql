create table if not exists public.user_airboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  counters jsonb not null default '[]',
  line_types jsonb not null default '[]',
  icon_names jsonb default '{}',
  icon_order jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_airboard enable row level security;

drop policy if exists "Users manage own airboard" on public.user_airboard;
create policy "Users manage own airboard"
  on public.user_airboard for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);;
