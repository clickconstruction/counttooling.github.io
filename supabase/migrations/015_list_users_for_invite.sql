-- List users for project invite (any project member can call)
-- Excludes project owner; sorted alphabetically by email

create or replace function public.list_users_for_project_invite(p_project_id uuid)
returns table (id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id != (select p.user_id from public.projects p where p.id = p_project_id)
  and public.user_can_access_project(p_project_id)
  order by lower(u.email);
$$;

grant execute on function public.list_users_for_project_invite(uuid) to authenticated;
