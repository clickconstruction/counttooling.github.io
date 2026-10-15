-- LEAD-ROLE (2026-10-02, Will's call): a fourth role under admin and over user.
--
-- Today's roles: User (own + shared projects), Overseer (every project,
-- read-only by design: a reviewer who must never touch a bid; 20260828130000),
-- Admin (everything: users, passwords, deletes, force, global reload). Wendi,
-- an estimator, needs the clean-up tools and nothing that touches accounts or
-- destroys data. A Lead:
--   * sees every project (Load Project, Bid Board) and downloads its PDF;
--   * checks out any project whose lock is free or expired;
--   * forces a live lock (force_check_in_project);
--   * adds and removes a project's shares, on any project;
--   * hands ONE bid to another estimator (reassign_project, new below);
--   * marks a bid reviewed or sends it back, as an overseer can.
-- Never: list_users_for_admin, passwords, delete, global reload, others'
-- activity. Those guards stay is_admin.
--
-- Shape: every arm that read `pr.is_admin = true` for a TAKE-OVER right gains
-- `or pr.is_lead = true`; the account-management RPCs are untouched. The
-- functions below are copied from their latest definitions (named in each
-- comment) with that one change; list_accessible_projects and
-- get_project_permissions must stay copies of each other.

alter table public.profiles add column if not exists is_lead boolean not null default false;

comment on column public.profiles.is_lead is
  'Lead estimator: sees every project, checks out any, forces a live lock, manages shares, hands a bid to another estimator, marks reviewed. No user management, no deletes, no global reload (LEAD-ROLE, 2026-10-02).';

-- 1. See every project and its PDF (mirror of the overseer pair).
drop policy if exists "Leads can view all projects" on public.projects;
create policy "Leads can view all projects"
  on public.projects for select
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.user_id = (select auth.uid()) and pr.is_lead = true)
  );

drop policy if exists "Leads can read all PDFs" on storage.objects;
create policy "Leads can read all PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (select 1 from public.profiles pr where pr.user_id = (select auth.uid()) and pr.is_lead = true)
  );

-- 2. user_can_access_project (latest: 20260305173227_024_admin_access_project):
-- the helper behind list_users_for_project_invite, the project_shares INSERT
-- policy and the view-link policies. The overseer was kept OUT of it on
-- purpose (read-only); a lead manages shares and links, so in.
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
    where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true)
  );
$$;

-- 3. check_out_project (latest: 20260521015346_checkout_server_time).
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
  v_now timestamptz := now();
  v_checked_out_at timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated', 'server_now', v_now);
  end if;

  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (
      p.user_id = v_uid
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = v_uid and ps.role = 'editor')
      or exists (select 1 from public.profiles pr where pr.user_id = v_uid and (pr.is_admin = true or pr.is_lead = true))
    )
  ) into v_can_check_out;

  if not v_can_check_out then
    return jsonb_build_object('ok', false, 'error', 'No permission to check out', 'server_now', v_now);
  end if;

  update public.projects
  set checked_out_by = v_uid, checked_out_at = v_now
  where id = p_project_id
  and (checked_out_by is null or checked_out_at < v_now - interval '30 minutes')
  returning checked_out_at into v_checked_out_at;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'Project is checked out by someone else', 'server_now', v_now);
  end if;

  return jsonb_build_object('ok', true, 'checked_out_at', v_checked_out_at, 'server_now', v_now);
end;
$$;

-- 4. force_check_in_project (latest: 20260521022736_check_in_server_time).
create or replace function public.force_check_in_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and (is_admin = true or is_lead = true)) then
    return jsonb_build_object('ok', false, 'error', 'Admin or lead only', 'server_now', now());
  end if;

  update public.projects
  set checked_out_by = null, checked_out_at = null
  where id = p_project_id;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'server_now', now());
end;
$$;

-- 5. list_accessible_projects (latest: 20260831100000_projects_external_ref).
-- Same signature, replaced in place. The lead arm in can_check_out, a 'lead'
-- my_access_role (before the overseer's 'viewer'), and the WHERE clause.
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
        or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true))
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
          where pr.user_id = auth.uid() and pr.is_lead = true
        ) then 'lead'
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
     or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_overseer = true or pr.is_lead = true))
  order by p.updated_at desc;
$$;

grant execute on function public.list_accessible_projects() to authenticated;
grant execute on function public.list_accessible_projects() to service_role;
revoke execute on function public.list_accessible_projects() from anon;
revoke execute on function public.list_accessible_projects() from public;

-- 6. get_project_permissions (latest: 20260927194936_get_project_permissions):
-- the list's row for one project, minus data / pdf_path / pdf_hash. Kept a
-- copy of the list above.
create or replace function public.get_project_permissions(p_project_id uuid)
returns table (
  id uuid,
  name text,
  user_id uuid,
  updated_at timestamptz,
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
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.name,
    p.user_id,
    p.updated_at,
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
        or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true))
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
          where pr.user_id = auth.uid() and pr.is_lead = true
        ) then 'lead'
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
  where p.id = p_project_id
    and (
      p.user_id = auth.uid()
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
      or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_overseer = true or pr.is_lead = true))
    );
$$;

grant execute on function public.get_project_permissions(uuid) to authenticated;
grant execute on function public.get_project_permissions(uuid) to service_role;
revoke execute on function public.get_project_permissions(uuid) from anon;
revoke execute on function public.get_project_permissions(uuid) from public;

-- 7. Shares (latest: 20260305000442_011_project_rpcs for add/remove,
-- 20260325162801_035_list_project_shares_admin for list). add_project_share
-- never had an admin arm (admins invite through the Edge Function); both
-- admin and lead get one here.
create or replace function public.add_project_share(p_project_id uuid, p_target_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  if p_role not in ('viewer', 'editor') then return jsonb_build_object('ok', false, 'error', 'Invalid role'); end if;
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (
      p.user_id = auth.uid()
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
      or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true))
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'No permission to share');
  end if;
  if exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = p_target_user_id) then
    return jsonb_build_object('ok', false, 'error', 'Cannot share with project owner');
  end if;
  insert into public.project_shares (project_id, user_id, role, invited_by)
  values (p_project_id, p_target_user_id, p_role, auth.uid())
  on conflict (project_id, user_id) do update set role = p_role, invited_by = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_project_share(p_project_id uuid, p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  delete from public.project_shares
  where project_id = p_project_id and user_id = p_target_user_id
  and (
    exists (select 1 from public.profiles where user_id = auth.uid() and (is_admin = true or is_lead = true))
    or exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = auth.uid())
    or invited_by = auth.uid()
  );
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then return jsonb_build_object('ok', false, 'error', 'No permission to remove share'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_project_shares(p_project_id uuid)
returns table (user_id uuid, email text, role text)
language sql
security definer
set search_path = public, auth
as $$
  select sub.user_id, sub.email, sub.role from (
    select proj.user_id, u.email::text as email, 'owner'::text as role
    from public.projects proj
    left join auth.users u on u.id = proj.user_id
    where proj.id = p_project_id
    and (
      exists (select 1 from public.projects p2 where p2.id = p_project_id and p2.user_id = auth.uid())
      or exists (select 1 from public.project_shares ps2 where ps2.project_id = p_project_id and ps2.user_id = auth.uid())
      or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true))
    )
    union all
    select ps.user_id, u.email::text, ps.role
    from public.project_shares ps
    left join auth.users u on u.id = ps.user_id
    where ps.project_id = p_project_id
    and (
      exists (select 1 from public.projects p2 where p2.id = p_project_id and p2.user_id = auth.uid())
      or exists (select 1 from public.project_shares ps2 where ps2.project_id = p_project_id and ps2.user_id = auth.uid())
      or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_lead = true))
    )
  ) sub
  order by case when sub.role = 'owner' then 0 else 1 end, lower(sub.email);
$$;

-- 8. Review (latest: 20260830010000_project_review_changes): a lead requests
-- and reviews alike.
create or replace function public.set_project_review_status(p_project_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_can_request boolean;
  v_is_reviewer boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;
  if p_status is not null and p_status not in ('ready', 'reviewed', 'changes') then
    return jsonb_build_object('ok', false, 'error', 'Invalid status');
  end if;

  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (
      p.user_id = v_uid
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = v_uid and ps.role = 'editor')
      or exists (select 1 from public.profiles pr where pr.user_id = v_uid and (pr.is_admin = true or pr.is_lead = true))
    )
  ) into v_can_request;

  select exists (
    select 1 from public.profiles pr
    where pr.user_id = v_uid and (pr.is_overseer = true or pr.is_admin = true or pr.is_lead = true)
  ) into v_is_reviewer;

  if p_status = 'reviewed' then
    if not v_is_reviewer then
      return jsonb_build_object('ok', false, 'error', 'Only an overseer, lead or admin can mark a bid reviewed');
    end if;
    update public.projects
    set review_status = 'reviewed', reviewed_at = v_now, reviewed_by = v_uid, review_note = null
    where id = p_project_id;
  elsif p_status = 'changes' then
    if not v_is_reviewer then
      return jsonb_build_object('ok', false, 'error', 'Only an overseer, lead or admin can request changes');
    end if;
    if coalesce(trim(p_note), '') = '' then
      return jsonb_build_object('ok', false, 'error', 'Requesting changes needs a note — say what to fix');
    end if;
    update public.projects
    set review_status = 'changes', reviewed_at = v_now, reviewed_by = v_uid,
        review_note = trim(p_note)
    where id = p_project_id;
  else
    if not v_can_request then
      return jsonb_build_object('ok', false, 'error', 'Only the owner, an editor, a lead or an admin can change review status');
    end if;
    if p_status = 'ready' then
      update public.projects
      set review_status = 'ready', review_requested_at = v_now, review_requested_by = v_uid,
          reviewed_at = null, reviewed_by = null, review_note = null
      where id = p_project_id;
    else
      update public.projects
      set review_status = null, review_requested_at = null, review_requested_by = null,
          reviewed_at = null, reviewed_by = null, review_note = null
      where id = p_project_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'review_status', p_status);
end;
$$;

-- 9. Hand one bid to another estimator. NEW. The bulk move
-- (admin-reassign-projects, every project of A to B, admin only) stays for
-- account retirement; this is the per-project one a lead uses day to day.
-- Owner, lead or admin may call it. It moves the row's owner, the PDF
-- (storage objects live at {ownerId}/{projectId}/document.pdf and the read
-- policy is by that first folder, so the object is renamed in place), the
-- view links the old owner made, drops a share the new owner held (they own
-- it now), KEEPS the old owner on the bid as an editor (a hand-off is not a
-- lock-out; remove the share after if that is wanted), and releases the old
-- owner's checkout so the new owner can start (their open tab, if any, is told
-- the way a force tells it). Writes a project_reassigned row to user_activity.
create or replace function public.reassign_project(p_project_id uuid, p_to_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
  v_pdf_path text;
  v_new_path text;
  v_from_email text;
  v_to_email text;
  v_held_by uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;
  select p.user_id, p.pdf_path, p.checked_out_by into v_from, v_pdf_path, v_held_by
  from public.projects p where p.id = p_project_id;
  if v_from is null then
    return jsonb_build_object('ok', false, 'error', 'Project not found');
  end if;
  if not (
    v_from = v_uid
    or exists (select 1 from public.profiles pr where pr.user_id = v_uid and (pr.is_admin = true or pr.is_lead = true))
  ) then
    return jsonb_build_object('ok', false, 'error', 'Only the owner, a lead or an admin can hand a project off');
  end if;
  if p_to_user_id is null or not exists (select 1 from auth.users u where u.id = p_to_user_id) then
    return jsonb_build_object('ok', false, 'error', 'That user does not exist');
  end if;
  if p_to_user_id = v_from then
    return jsonb_build_object('ok', false, 'error', 'That user already owns this project');
  end if;
  select u.email::text into v_from_email from auth.users u where u.id = v_from;
  select u.email::text into v_to_email from auth.users u where u.id = p_to_user_id;

  -- The PDF: rename the storage object under the new owner's folder.
  if v_pdf_path is not null and position('/' in v_pdf_path) > 0 then
    v_new_path := p_to_user_id::text || substr(v_pdf_path, position('/' in v_pdf_path));
    update storage.objects
    set name = v_new_path
    where bucket_id = 'pdfs' and name = v_pdf_path;
  else
    v_new_path := v_pdf_path;
  end if;

  update public.projects
  set user_id = p_to_user_id,
      pdf_path = v_new_path,
      checked_out_by = case when checked_out_by = v_from then null else checked_out_by end,
      checked_out_at = case when checked_out_by = v_from then null else checked_out_at end
  where id = p_project_id;

  update public.project_view_links
  set created_by = p_to_user_id
  where project_id = p_project_id and created_by = v_from;

  delete from public.project_shares where project_id = p_project_id and user_id = p_to_user_id;

  insert into public.project_shares (project_id, user_id, role, invited_by)
  values (p_project_id, v_from, 'editor', v_uid)
  on conflict (project_id, user_id) do update set role = 'editor';

  insert into public.user_activity (user_id, event_type, project_id, metadata)
  values (v_uid, 'project_reassigned', p_project_id,
          jsonb_build_object('from', v_from_email, 'to', v_to_email, 'released_lock', v_held_by = v_from));

  return jsonb_build_object('ok', true, 'from_email', v_from_email, 'to_email', v_to_email);
end;
$$;

grant execute on function public.reassign_project(uuid, uuid) to authenticated;
grant execute on function public.reassign_project(uuid, uuid) to service_role;
revoke execute on function public.reassign_project(uuid, uuid) from anon;
revoke execute on function public.reassign_project(uuid, uuid) from public;

-- 10. The admin toggle and the user list (latest: 20260828132000_overseer_admin;
-- 20260828110000's is_digital_twin preserved). Signature changes: drop first.
create or replace function public.admin_set_lead(p_user_id uuid, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;

  insert into public.profiles (user_id, is_lead)
  values (p_user_id, p_value)
  on conflict (user_id) do update set is_lead = excluded.is_lead;

  return jsonb_build_object('ok', true, 'is_lead', p_value);
end;
$$;

grant execute on function public.admin_set_lead(uuid, boolean) to authenticated;
grant execute on function public.admin_set_lead(uuid, boolean) to service_role;
revoke execute on function public.admin_set_lead(uuid, boolean) from anon;
revoke execute on function public.admin_set_lead(uuid, boolean) from public;

drop function if exists public.list_users_for_admin();

create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text,
  last_seen_at timestamptz,
  project_count bigint,
  is_digital_twin boolean,
  is_overseer boolean,
  is_lead boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    case when p.is_admin then 'Admin' when p.is_lead then 'Lead' when p.is_overseer then 'Overseer' else 'User' end,
    p.last_seen_at,
    coalesce((select count(*) from public.projects pj where pj.user_id = u.id), 0)::bigint,
    coalesce(p.is_digital_twin, false),
    coalesce(p.is_overseer, false),
    coalesce(p.is_lead, false)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_admin = true
  )
  order by lower(u.email);
$$;

grant execute on function public.list_users_for_admin() to authenticated;
grant execute on function public.list_users_for_admin() to service_role;
revoke execute on function public.list_users_for_admin() from anon;
revoke execute on function public.list_users_for_admin() from public;
