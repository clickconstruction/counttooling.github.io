-- Owners subject to checkout: owners must check out to edit, same as shared editors.
-- Run after 011_project_rpcs.sql

-- 1. Projects RLS UPDATE policy: only checkout holder or admin can update (remove owner bypass)
drop policy if exists "Owners checkout holder or admin can update projects" on public.projects;
create policy "Checkout holder or admin can update projects"
  on public.projects for update to authenticated
  using (
    (checked_out_by = auth.uid() and (checked_out_at is null or checked_out_at >= now() - interval '12 hours'))
    or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  );

-- 2. list_accessible_projects: can_edit = only when user has valid checkout (remove owner bypass)
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
  can_check_out boolean
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
    u.email::text as checked_out_email,
    (p.user_id = auth.uid()) as is_owner,
    (p.checked_out_by = auth.uid() and (p.checked_out_at is null or p.checked_out_at >= now() - interval '12 hours')) as can_edit,
    (
      (p.user_id = auth.uid() or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor'))
      and (p.checked_out_by is null or p.checked_out_at < now() - interval '12 hours')
    ) as can_check_out
  from public.projects p
  left join auth.users u on u.id = p.checked_out_by
  where p.user_id = auth.uid()
     or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
  order by p.updated_at desc;
$$;

-- 3. Auto-checkout on new project insert: creator is automatically checked out
create or replace function public.auto_checkout_on_project_insert()
returns trigger language plpgsql as $$
begin
  new.checked_out_by := new.user_id;
  new.checked_out_at := now();
  return new;
end;
$$;
drop trigger if exists on_project_insert_auto_checkout on public.projects;
create trigger on_project_insert_auto_checkout
  before insert on public.projects
  for each row execute function public.auto_checkout_on_project_insert();;
