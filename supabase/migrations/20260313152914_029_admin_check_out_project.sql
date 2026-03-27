-- Allow admins to check out any project (align with list_accessible_projects)
-- Run after 022_admin_see_all_projects.sql

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
      or exists (select 1 from public.profiles pr where pr.user_id = v_uid and pr.is_admin = true)
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
$$;;
