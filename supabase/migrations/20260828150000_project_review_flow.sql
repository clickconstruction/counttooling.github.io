-- Bid review handoff (the estimator → overseer ops flow): an estimator marks a
-- bid "ready" for review, the overseer's Bid Board surfaces it and lets them
-- mark it "reviewed". One status column + audit timestamps on projects, and a
-- single guarded transition RPC:
--   * 'ready' / clear (null)  — project owner, an editor-share, or an admin.
--   * 'reviewed'              — an overseer or an admin.
-- Setting 'ready' stamps review_requested_at/by and clears the reviewed pair;
-- 'reviewed' stamps reviewed_at/by. Clearing nulls everything.

alter table public.projects
  add column if not exists review_status text
    check (review_status in ('ready', 'reviewed')),
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_requested_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

comment on column public.projects.review_status is
  'Bid review handoff: null (not in review), ready (estimator requested review), reviewed (overseer marked seen). Transitions via set_project_review_status().';

create or replace function public.set_project_review_status(p_project_id uuid, p_status text)
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
  if p_status is not null and p_status not in ('ready', 'reviewed') then
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
    set review_status = 'reviewed', reviewed_at = v_now, reviewed_by = v_uid
    where id = p_project_id;
  else
    if not v_can_request then
      return jsonb_build_object('ok', false, 'error', 'Only the owner, an editor, or an admin can change review status');
    end if;
    if p_status = 'ready' then
      update public.projects
      set review_status = 'ready', review_requested_at = v_now, review_requested_by = v_uid,
          reviewed_at = null, reviewed_by = null
      where id = p_project_id;
    else
      update public.projects
      set review_status = null, review_requested_at = null, review_requested_by = null,
          reviewed_at = null, reviewed_by = null
      where id = p_project_id;
    end if;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Project not found');
  end if;
  return jsonb_build_object('ok', true, 'review_status', p_status);
end;
$$;

grant execute on function public.set_project_review_status(uuid, text) to authenticated;
grant execute on function public.set_project_review_status(uuid, text) to service_role;
revoke execute on function public.set_project_review_status(uuid, text) from anon;
revoke execute on function public.set_project_review_status(uuid, text) from public;
