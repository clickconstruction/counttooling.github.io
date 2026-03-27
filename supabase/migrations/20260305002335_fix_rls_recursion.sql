-- Fix infinite recursion: projects SELECT <-> project_shares SELECT
-- Use SECURITY DEFINER helper so both policies avoid cross-table RLS evaluation

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
  );
$$;

grant execute on function public.user_can_access_project(uuid) to authenticated;

-- Replace projects SELECT: use helper instead of inline project_shares check
drop policy if exists "Users can select own or shared projects" on public.projects;
create policy "Users can select own or shared projects"
  on public.projects for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.user_can_access_project(id)
    or checked_out_by = auth.uid()
  );

-- Replace project_shares SELECT: use helper instead of inline projects + project_shares check
drop policy if exists "Users can read project shares for accessible projects" on public.project_shares;
create policy "Users can read project shares for accessible projects"
  on public.project_shares for select
  to authenticated
  using (public.user_can_access_project(project_id));

-- Replace project_shares INSERT: use helper instead of inline check
drop policy if exists "Project members can add shares" on public.project_shares;
create policy "Project members can add shares"
  on public.project_shares for insert
  to authenticated
  with check (public.user_can_access_project(project_id));;
