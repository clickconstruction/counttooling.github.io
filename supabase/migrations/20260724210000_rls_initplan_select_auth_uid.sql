-- Advisor remediation (auth_rls_initplan, 2026-07-24 scan; user-approved):
-- wrap every auth.uid() in the nine flagged policies as (select auth.uid())
-- so Postgres evaluates it ONCE per query (InitPlan) instead of per row.
-- Behavior-identical — each expression below is the pg_policies definition
-- captured verbatim before the rewrite, with only that substitution applied.
-- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

alter policy "Users can read own profile" on public.profiles
  using ((select auth.uid()) = user_id);

alter policy "Owner inviter or admin can remove shares" on public.project_shares
  using (
    (exists (select 1 from profiles
             where profiles.user_id = (select auth.uid()) and profiles.is_admin = true))
    or (exists (select 1 from projects p
                where p.id = project_shares.project_id and p.user_id = (select auth.uid())))
    or (invited_by = (select auth.uid()))
  );

alter policy "Checkout holder or admin can update projects" on public.projects
  using (
    ((checked_out_by = (select auth.uid()))
      and (checked_out_at is null or checked_out_at >= (now() - interval '00:30:00')))
    or (exists (select 1 from profiles pr
                where pr.user_id = (select auth.uid()) and pr.is_admin = true))
  );

alter policy "Owners can delete projects" on public.projects
  using (user_id = (select auth.uid()));

alter policy "Owners can insert projects" on public.projects
  with check (user_id = (select auth.uid()));

alter policy "Users can select own or shared projects" on public.projects
  using (
    (user_id = (select auth.uid()))
    or user_can_access_project(id)
    or (checked_out_by = (select auth.uid()))
  );

alter policy "Admins can read user_activity" on public.user_activity
  using (exists (select 1 from profiles pr
                 where pr.user_id = (select auth.uid()) and pr.is_admin = true));

alter policy "Users manage own airboard" on public.user_airboard
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Project owner or admin can read access log" on public.view_link_access_log
  using (
    (exists (select 1 from profiles
             where profiles.user_id = (select auth.uid()) and profiles.is_admin = true))
    or (exists (select 1 from projects p
                where p.id = view_link_access_log.project_id and p.user_id = (select auth.uid())))
  );
