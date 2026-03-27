-- User presence (profiles.last_seen_at) and discrete activity events (user_activity).
-- RPCs: touch_presence, log_user_event, list_user_activity_for_admin; list_users_for_admin extended.

alter table public.profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at desc nulls last);

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  project_id uuid references public.projects(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_id_created_idx on public.user_activity (user_id, created_at desc);
create index if not exists user_activity_created_at_idx on public.user_activity (created_at desc);

alter table public.user_activity enable row level security;

drop policy if exists "Admins can read user_activity" on public.user_activity;
create policy "Admins can read user_activity"
  on public.user_activity for select
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  );

create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_seen_at = now() where user_id = auth.uid();
end;
$$;

grant execute on function public.touch_presence() to authenticated;

create or replace function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'invalid event type';
  end if;
  if p_event_type not in (
    'session_start', 'project_open', 'project_save', 'export_pdf', 'export_canvas',
    'counter_marker_added', 'line_added'
  ) then
    raise exception 'invalid event type';
  end if;
  insert into public.user_activity (user_id, event_type, project_id, metadata)
  values (auth.uid(), p_event_type, p_project_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.log_user_event(text, uuid, jsonb) to authenticated;

create or replace function public.list_user_activity_for_admin(
  p_limit int default 200,
  p_user_id uuid default null,
  p_since timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  event_type text,
  project_id uuid,
  metadata jsonb,
  created_at timestamptz,
  email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    a.id,
    a.user_id,
    a.event_type,
    a.project_id,
    a.metadata,
    a.created_at,
    u.email::text
  from public.user_activity a
  join auth.users u on u.id = a.user_id
  where exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_admin = true
  )
  and (p_user_id is null or a.user_id = p_user_id)
  and (p_since is null or a.created_at >= p_since)
  order by a.created_at desc
  limit least(coalesce(nullif(p_limit, 0), 200), 500);
$$;

grant execute on function public.list_user_activity_for_admin(int, uuid, timestamptz) to authenticated;

drop function if exists public.list_users_for_admin();

create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    case when p.is_admin then 'Admin' else 'User' end,
    p.last_seen_at
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  )
  order by u.email
$$;

grant execute on function public.list_users_for_admin() to authenticated;
grant execute on function public.list_users_for_admin() to service_role;
