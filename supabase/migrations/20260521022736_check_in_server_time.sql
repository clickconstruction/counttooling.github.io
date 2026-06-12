-- Migration 040: server-side time on check-in RPCs
-- Extends check_in_project and force_check_in_project to return server_now so
-- the client can update its serverClockOffsetMs on every check-in roundtrip
-- (same pattern as migration 038 for check_out / refresh_activity).

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
    return jsonb_build_object('ok', false, 'error', 'Not authenticated', 'server_now', now());
  end if;

  update public.projects
  set checked_out_by = null, checked_out_at = null
  where id = p_project_id and checked_out_by = auth.uid();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'You do not have this project checked out', 'server_now', now());
  end if;

  return jsonb_build_object('ok', true, 'server_now', now());
end;
$$;

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
    return jsonb_build_object('ok', false, 'error', 'Admin only', 'server_now', now());
  end if;

  update public.projects
  set checked_out_by = null, checked_out_at = null
  where id = p_project_id;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'server_now', now());
end;
$$;
