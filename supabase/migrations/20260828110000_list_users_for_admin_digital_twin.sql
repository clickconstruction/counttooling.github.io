-- Surface the digital-twin flag on the admin user list (PipeTooling
-- docs/DIGITAL_TWINS_PLAN.md, Phase E2 — "humans and the twin itself can always tell").
-- Every other collaboration surface carries only an email and badges twins by the fleet
-- pattern; the admin roster is the one place that can read the real flag, and PT's
-- manage-user bridge can flag an account whose email does NOT match the pattern — so
-- without this column the roster would under-report. Return signature changes, so drop
-- first (same shape as 20260605000000_list_users_for_admin_project_count.sql).

drop function if exists public.list_users_for_admin();

create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text,
  last_seen_at timestamptz,
  project_count bigint,
  is_digital_twin boolean
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
    p.last_seen_at,
    coalesce((select count(*) from public.projects pj where pj.user_id = u.id), 0)::bigint,
    coalesce(p.is_digital_twin, false)
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
