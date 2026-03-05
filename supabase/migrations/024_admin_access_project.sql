-- Admins can access any project (fixes 406 when restoring last project or loading non-owned project)
-- Run after 022_admin_see_all_projects.sql

create or replace function public.user_can_access_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.project_shares ps
    where ps.project_id = p_project_id and ps.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_admin = true
  );
$$;
