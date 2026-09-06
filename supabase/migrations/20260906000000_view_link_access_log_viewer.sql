-- Viewer grants (2026-09-06): a view-link visit can now arrive vouched for by
-- PipeTooling (a subcontractor opening plans from their portal, no email gate).
-- The access log records who that was and how they came in, beside the
-- email column the gate path has always written. Additive; idempotent.

alter table public.view_link_access_log add column if not exists viewer_name text;
alter table public.view_link_access_log add column if not exists source text;

comment on column public.view_link_access_log.viewer_name is
  'The viewer''s name when a signed grant vouched for them (PipeTooling sub portal); null on the email-gate path.';
comment on column public.view_link_access_log.source is
  'How the visit was admitted: null = the email domain gate; pipetooling-sub-portal = a PipeTooling viewer grant.';

-- The Share modal's access log: same gate as before (admins and the project owner),
-- now returning the name and the source so a sub's visit reads as
-- "Behar Kraja · via PipeTooling portal".
drop function if exists public.get_view_link_access_log(uuid);
create or replace function public.get_view_link_access_log(p_view_link_id uuid)
returns table (
  email text,
  accessed_at timestamptz,
  viewer_name text,
  source text
)
language sql
security definer
set search_path = public
stable
as $$
  select a.email, a.accessed_at, a.viewer_name, a.source
  from public.view_link_access_log a
  join public.project_view_links l on l.id = a.view_link_id
  where a.view_link_id = p_view_link_id
  and (
    exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true)
    or exists (select 1 from public.projects p where p.id = l.project_id and p.user_id = auth.uid())
  )
  order by a.accessed_at desc;
$$;

grant execute on function public.get_view_link_access_log(uuid) to authenticated;
