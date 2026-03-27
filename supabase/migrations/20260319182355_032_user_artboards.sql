-- Multiple artboards per user (replaces single user_airboard for manager)
create table public.user_artboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled',
  sort_order int not null default 0,
  counters jsonb not null default '[]',
  line_types jsonb not null default '[]',
  icon_names jsonb default '{}',
  icon_order jsonb,
  plumbing_modifiers jsonb default '{}',
  line_modifiers jsonb default '{}',
  custom_icon_paths jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_artboards_user_id_idx on public.user_artboards(user_id);
alter table public.user_artboards enable row level security;

create policy "Users manage own artboards"
  on public.user_artboards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);;
