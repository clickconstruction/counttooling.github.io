-- Project checkout RPCs and updated RLS for sharing
-- Run after 010_project_checkout.sql

-- Replace projects RLS: allow owner, shared users, and checkout holder
drop policy if exists "Users can manage own projects" on public.projects;

create policy "Users can select own or shared projects"
  on public.projects for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.project_shares ps where ps.project_id = id and ps.user_id = auth.uid())
    or checked_out_by = auth.uid()
  );

create policy "Owners can insert projects"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owners checkout holder or admin can update projects"
  on public.projects for update
  to authenticated
  using (
    user_id = auth.uid()
    or (checked_out_by = auth.uid() and (checked_out_at is null or checked_out_at >= now() - interval '12 hours'))
    or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  );

create policy "Owners can delete projects"
  on public.projects for delete
  to authenticated
  using (user_id = auth.uid());

-- Check out: take the edit lock (owner or editor, lock free or expired)
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

  -- Owner or editor in project_shares can check out
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

  -- Lock must be free or expired (12 hours)
  update public.projects
  set checked_out_by = v_uid, checked_out_at = now()
  where id = p_project_id
  and (checked_out_by is null or checked_out_at < now() - interval '12 hours');

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'Project is checked out by someone else');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Check in: release your own lock
create or replace function public.check_in_project(p_project_id uuid)
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
  set checked_out_by = null, checked_out_at = null
  where id = p_project_id and checked_out_by = auth.uid();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'You do not have this project checked out');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Force check-in: system admin only
create or replace function public.force_check_in_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true) then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;

  update public.projects
  set checked_out_by = null, checked_out_at = null
  where id = p_project_id;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true);
end;
$$;

-- List projects accessible to current user (owner or shared)
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
    ((p.user_id = auth.uid()) or (p.checked_out_by = auth.uid() and (p.checked_out_at is null or p.checked_out_at >= now() - interval '12 hours'))) as can_edit,
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

-- Add project share (any project member can add)
create or replace function public.add_project_share(p_project_id uuid, p_target_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if p_role not in ('viewer', 'editor') then
    return jsonb_build_object('ok', false, 'error', 'Invalid role');
  end if;

  -- Caller must be owner or in project_shares
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (p.user_id = auth.uid() or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid()))
  ) then
    return jsonb_build_object('ok', false, 'error', 'No permission to add share');
  end if;

  insert into public.project_shares (project_id, user_id, role, invited_by)
  values (p_project_id, p_target_user_id, p_role, auth.uid())
  on conflict (project_id, user_id) do update set role = p_role, invited_by = auth.uid();

  return jsonb_build_object('ok', true);
end;
$$;

-- Remove project share (owner, inviter, or admin)
create or replace function public.remove_project_share(p_project_id uuid, p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  delete from public.project_shares
  where project_id = p_project_id and user_id = p_target_user_id
  and (
    exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true)
    or exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = auth.uid())
    or invited_by = auth.uid()
  );

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return jsonb_build_object('ok', false, 'error', 'No permission to remove share');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.check_out_project(uuid) to authenticated;
grant execute on function public.check_in_project(uuid) to authenticated;
grant execute on function public.force_check_in_project(uuid) to authenticated;
grant execute on function public.list_accessible_projects() to authenticated;
grant execute on function public.add_project_share(uuid, uuid, text) to authenticated;
-- List project shares with email (for Share modal)
create or replace function public.list_project_shares(p_project_id uuid)
returns table (user_id uuid, email text, role text)
language sql
security definer
set search_path = public, auth
as $$
  select ps.user_id, u.email::text, ps.role
  from public.project_shares ps
  left join auth.users u on u.id = ps.user_id
  where ps.project_id = p_project_id
  and (
    exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = auth.uid())
    or exists (select 1 from public.project_shares ps2 where ps2.project_id = p_project_id and ps2.user_id = auth.uid())
  );
$$;

grant execute on function public.list_project_shares(uuid) to authenticated;
grant execute on function public.remove_project_share(uuid, uuid) to authenticated;
