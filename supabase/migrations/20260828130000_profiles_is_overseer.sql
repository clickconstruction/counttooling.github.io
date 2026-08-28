-- Overseer role: a read-only "see every bid" flag (first user: Master Malachi).
-- An overseer can LIST and OPEN every project (always in viewer mode — the
-- check_out_project guard stays owner/editor/admin, so an overseer can never
-- acquire edit rights) and can download every project's PDF. Deliberately NOT
-- added to user_can_access_project(): that helper also gates project_shares
-- INSERT and the view-link policies, and an overseer must stay read-only.

alter table public.profiles add column if not exists is_overseer boolean not null default false;

comment on column public.profiles.is_overseer is
  'Read-only oversight role: sees and opens every project in viewer mode (bid board). No edit, checkout, share, or admin rights.';

-- Direct-table SELECT (project open re-fetches data; restore-last-session too).
drop policy if exists "Overseers can view all projects" on public.projects;
create policy "Overseers can view all projects"
  on public.projects for select
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.user_id = (select auth.uid()) and pr.is_overseer = true)
  );

-- PDF download for any project (mirror of "Admins can read all PDFs").
drop policy if exists "Overseers can read all PDFs" on storage.objects;
create policy "Overseers can read all PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (select 1 from public.profiles pr where pr.user_id = (select auth.uid()) and pr.is_overseer = true)
  );
