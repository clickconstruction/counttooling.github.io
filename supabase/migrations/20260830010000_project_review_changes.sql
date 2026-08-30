-- Review loop closure (robot-ready train CT-2; PT pipeline Wave 3.6): the review
-- flow gains its missing half — a reviewer can send a bid BACK with a note.
--   * new status 'changes' (overseer/admin only), carried with projects.review_note;
--   * 'ready' (owner/editor/admin — a twin re-marking after fixes included) clears
--     the note and the reviewed pair;
--   * 'reviewed' clears the note (it was guidance for the fix, now stale);
--   * clearing nulls everything.
-- The RPC gains a p_note parameter; the old 2-arg signature is dropped (PostgREST
-- overload ambiguity), and list_accessible_projects appends review_note.

alter table public.projects add column if not exists review_note text;

comment on column public.projects.review_note is
  'Reviewer''s note when review_status = ''changes'' — what to fix before marking ready again. Cleared on ready/reviewed/clear.';

do $$
begin
  alter table public.projects drop constraint if exists projects_review_status_check;
  alter table public.projects add constraint projects_review_status_check
    check (review_status in ('ready', 'reviewed', 'changes'));
end $$;

comment on column public.projects.review_status is
  'Bid review handoff: null (not in review), ready (estimator requested review), changes (reviewer sent it back — see review_note), reviewed (overseer marked seen). Transitions via set_project_review_status().';

drop function if exists public.set_project_review_status(uuid, text);

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
      or exists (select 1 from public.profiles pr where pr.user_id = v_uid and pr.is_admin = true)
    )
  ) into v_can_request;

  select exists (
    select 1 from public.profiles pr
    where pr.user_id = v_uid and (pr.is_overseer = true or pr.is_admin = true)
  ) into v_is_reviewer;

  if p_status = 'reviewed' then
    if not v_is_reviewer then
      return jsonb_build_object('ok', false, 'error', 'Only an overseer or admin can mark a bid reviewed');
    end if;
    update public.projects
    set review_status = 'reviewed', reviewed_at = v_now, reviewed_by = v_uid, review_note = null
    where id = p_project_id;
  elsif p_status = 'changes' then
    if not v_is_reviewer then
      return jsonb_build_object('ok', false, 'error', 'Only an overseer or admin can request changes');
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
      return jsonb_build_object('ok', false, 'error', 'Only the owner, an editor, or an admin can change review status');
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

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Project not found');
  end if;
  return jsonb_build_object('ok', true, 'review_status', p_status);
end;
$$;

grant execute on function public.set_project_review_status(uuid, text, text) to authenticated;
grant execute on function public.set_project_review_status(uuid, text, text) to service_role;
revoke execute on function public.set_project_review_status(uuid, text, text) from anon;
revoke execute on function public.set_project_review_status(uuid, text, text) from public;

-- list_accessible_projects: append review_note (return signature changes → drop first).
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
  review_note text
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
    p.review_note
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
