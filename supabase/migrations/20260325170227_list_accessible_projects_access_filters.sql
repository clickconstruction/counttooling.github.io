-- Add owner_email and my_access_role to list_accessible_projects for Load Project filters

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
  my_access_role text
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
        else 'unknown'
      end
    ) as my_access_role
  from public.projects p
  left join auth.users cu on cu.id = p.checked_out_by
  left join auth.users ou on ou.id = p.user_id
  where p.user_id = auth.uid()
     or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
     or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  order by p.updated_at desc;
$$;

grant execute on function public.list_accessible_projects() to authenticated;;
