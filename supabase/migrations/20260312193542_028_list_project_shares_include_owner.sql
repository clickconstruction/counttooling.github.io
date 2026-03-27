-- Include project owner as first row in list_project_shares (role='owner')

create or replace function public.list_project_shares(p_project_id uuid)
returns table (user_id uuid, email text, role text)
language sql
security definer
set search_path = public, auth
as $$
  select sub.user_id, sub.email, sub.role from (
    select proj.user_id, u.email::text as email, 'owner'::text as role
    from public.projects proj
    left join auth.users u on u.id = proj.user_id
    where proj.id = p_project_id
    and (
      exists (select 1 from public.projects p2 where p2.id = p_project_id and p2.user_id = auth.uid())
      or exists (select 1 from public.project_shares ps2 where ps2.project_id = p_project_id and ps2.user_id = auth.uid())
    )
    union all
    select ps.user_id, u.email::text, ps.role
    from public.project_shares ps
    left join auth.users u on u.id = ps.user_id
    where ps.project_id = p_project_id
    and (
      exists (select 1 from public.projects p2 where p2.id = p_project_id and p2.user_id = auth.uid())
      or exists (select 1 from public.project_shares ps2 where ps2.project_id = p_project_id and ps2.user_id = auth.uid())
    )
  ) sub
  order by case when sub.role = 'owner' then 0 else 1 end, lower(sub.email);
$$;;
