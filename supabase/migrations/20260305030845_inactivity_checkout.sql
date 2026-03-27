-- 30 minutes inactivity checkout expiry (replaces 12-hour fixed expiry)
-- Run after 016_owner_subject_to_checkout.sql

-- 1. New RPC: refresh checkout activity (extends lock on user activity)
create or replace function public.refresh_checkout_activity(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  update public.projects
  set checked_out_at = now()
  where id = p_project_id and checked_out_by = auth.uid();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'You do not have this project checked out');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.refresh_checkout_activity(uuid) to authenticated;

-- 2. Update check_out_project: lock expires after 30 minutes inactivity
create or replace function public.check_out_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_can_check_out boolean;
  v_updated int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (
      p.user_id = v_uid
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = v_uid and ps.role = 'editor')
    )
  ) into v_can_check_out;

  if not v_can_check_out then
    return jsonb_build_object('ok', false, 'error', 'No permission to check out');
  end if;

  -- Lock must be free or expired (30 minutes inactivity)
  update public.projects
  set checked_out_by = v_uid, checked_out_at = now()
  where id = p_project_id
  and (checked_out_by is null or checked_out_at < now() - interval '30 minutes');

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'Project is checked out by someone else');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 3. Update RLS: checkout holder valid for 30 minutes from last activity
drop policy if exists "Checkout holder or admin can update projects" on public.projects;
create policy "Checkout holder or admin can update projects"
  on public.projects for update to authenticated
  using (
    (checked_out_by = auth.uid() and (checked_out_at is null or checked_out_at >= now() - interval '30 minutes'))
    or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  );

-- 4. Update list_accessible_projects: 30 minutes inactivity
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
    (p.checked_out_by = auth.uid() and (p.checked_out_at is null or p.checked_out_at >= now() - interval '30 minutes')) as can_edit,
    (
      (p.user_id = auth.uid() or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor'))
      and (p.checked_out_by is null or p.checked_out_at < now() - interval '30 minutes')
    ) as can_check_out
  from public.projects p
  left join auth.users u on u.id = p.checked_out_by
  where p.user_id = auth.uid()
     or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
  order by p.updated_at desc;
$$;;
