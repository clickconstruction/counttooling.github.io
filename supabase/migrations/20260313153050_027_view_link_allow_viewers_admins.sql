-- Allow project share viewers and admins to create view links
-- Run after 024_admin_access_project.sql

create or replace function public.create_view_link(p_project_id uuid, p_name text default null, p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token uuid;
  v_link_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not public.user_can_access_project(p_project_id) then
    return jsonb_build_object('ok', false, 'error', 'No permission to create view link');
  end if;

  insert into public.project_view_links (project_id, created_by, name, expires_at)
  values (p_project_id, v_uid, nullif(trim(p_name), ''), p_expires_at)
  returning id, token into v_link_id, v_token;

  return jsonb_build_object('ok', true, 'token', v_token, 'id', v_link_id);
end;
$$;;
