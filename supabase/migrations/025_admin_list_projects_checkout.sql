-- Extend list_projects_for_admin to include checkout fields for Force turn-in in Manage Projects modal

drop function if exists public.list_projects_for_admin();

create or replace function public.list_projects_for_admin()
returns table (
  id uuid,
  name text,
  user_id uuid,
  updated_at timestamptz,
  pdf_path text,
  size_bytes bigint,
  owner_email text,
  checked_out_by uuid,
  checked_out_at timestamptz,
  checked_out_email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.name,
    p.user_id,
    p.updated_at,
    p.pdf_path,
    p.size_bytes,
    u.email::text as owner_email,
    p.checked_out_by,
    p.checked_out_at,
    u_checkout.email::text as checked_out_email
  from public.projects p
  left join auth.users u on u.id = p.user_id
  left join auth.users u_checkout on u_checkout.id = p.checked_out_by
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  )
  order by p.updated_at desc
$$;

grant execute on function public.list_projects_for_admin() to authenticated;
grant execute on function public.list_projects_for_admin() to service_role;
