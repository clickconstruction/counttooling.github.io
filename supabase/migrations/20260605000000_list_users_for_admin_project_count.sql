-- Add owned-project count to the admin user list (used by Manage Users / All Users and
-- the delete/transfer dialogs). Return signature changes, so drop first.

drop function if exists public.list_users_for_admin();

create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text,
  last_seen_at timestamptz,
  project_count bigint
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
    coalesce((select count(*) from public.projects pj where pj.user_id = u.id), 0)::bigint
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
