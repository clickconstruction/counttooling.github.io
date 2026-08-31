-- Bid stamp: projects carry an optional external reference ("b409") from the
-- upstream estimating system, so reviewers can tell audit projects apart and
-- search by bid number. Generic name on purpose — CountTooling stays
-- product-agnostic; PipeTooling is just one upstream that stamps its bid ids.
-- Rendered as a small chip in Load Project + Bid Board and appended to the
-- status-bar project segment; import-takeoff sets it via the optional
-- `external_ref` body field.

alter table public.projects
  add column if not exists external_ref text
  check (external_ref is null or char_length(external_ref) <= 40);

comment on column public.projects.external_ref is
  'Optional upstream reference (e.g. a PipeTooling bid number like "b409"). Free text, <=40 chars. Shown as a chip in project lists and matched by list search.';

-- list_accessible_projects: append external_ref (return signature changes → drop first).
drop function if exists public.list_accessible_projects();

create or replace function public.list_accessible_projects()
returns table (
  id uuid,
  name text,
  user_id uuid,
  data jsonb,
  updated_at timestamptz,
  pdf_path text,
  pdf_hash text,
  size_bytes bigint,
  checked_out_by uuid,
  checked_out_at timestamptz,
  checked_out_email text,
  is_owner boolean,
  can_edit boolean,
  can_check_out boolean,
  counter_count int,
  line_count int,
  owner_email text,
  my_access_role text,
  review_status text,
  review_requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  external_ref text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.name,
    p.user_id,
    p.data,
    p.updated_at,
    p.pdf_path,
    p.pdf_hash,
    p.size_bytes,
    p.checked_out_by,
    p.checked_out_at,
    cu.email::text as checked_out_email,
    (p.user_id = auth.uid()) as is_owner,
    (p.checked_out_by = auth.uid() and (p.checked_out_at is null or p.checked_out_at >= now() - interval '30 minutes')) as can_edit,
    (
      (
        p.user_id = auth.uid()
        or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor')
        or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
      )
      and (p.checked_out_by is null or p.checked_out_at < now() - interval '30 minutes')
    ) as can_check_out,
    p.counter_count,
    p.line_count,
    ou.email::text as owner_email,
    (
      case
        when p.user_id = auth.uid() then 'owner'
        when exists (
          select 1 from public.project_shares ps
          where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor'
        ) then 'editor'
        when exists (
          select 1 from public.project_shares ps
          where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'viewer'
        ) then 'viewer'
        when exists (
          select 1 from public.profiles pr
          where pr.user_id = auth.uid() and pr.is_admin = true
        ) then 'admin'
        when exists (
          select 1 from public.profiles pr
          where pr.user_id = auth.uid() and pr.is_overseer = true
        ) then 'viewer'
        else 'unknown'
      end
    ) as my_access_role,
    p.review_status,
    p.review_requested_at,
    p.reviewed_at,
    p.review_note,
    p.external_ref
  from public.projects p
  left join auth.users cu on cu.id = p.checked_out_by
  left join auth.users ou on ou.id = p.user_id
  where p.user_id = auth.uid()
     or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
     or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_overseer = true))
  order by p.updated_at desc;
$$;

grant execute on function public.list_accessible_projects() to authenticated;
grant execute on function public.list_accessible_projects() to service_role;
revoke execute on function public.list_accessible_projects() from anon;
revoke execute on function public.list_accessible_projects() from public;
