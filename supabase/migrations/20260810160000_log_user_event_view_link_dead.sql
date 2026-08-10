-- T1-12 (Dead view link full-screen message): allowlist the new user-activity
-- event — view_link_dead ({reason: 'inactive' | 'network'}) fired by
-- features/view-only.js showViewLinkFailure when a view-link boot fails
-- (signed-in sessions only; the anonymous viewer emits nothing). Also adds
-- render_worker_fallback — a pre-existing gap: app.js has logged it since the
-- render-worker seam landed, but the allowlist never included it, so the RPC
-- raised 'invalid event type' and the fire-and-forget call silently dropped
-- every emission. Re-creates public.log_user_event from the latest deployed
-- body (20260810150000_log_user_event_allow_artboard_load.sql — the T1-09
-- migration, itself built on the T1-04/T1-05/T1-01 chain and the original
-- 20260326230000; copying an older body would silently un-allowlist the
-- earlier branches' events) with the two events added. Re-asserts the
-- authenticated grant and the 20260724 revokes (CREATE OR REPLACE keeps the
-- existing ACL, but new-function defaults grant PUBLIC execute — re-assert so
-- this file is correct even if the function is ever dropped and re-run from
-- scratch).

create or replace function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'invalid event type';
  end if;
  if p_event_type not in (
    'session_start', 'project_open', 'project_save', 'export_pdf', 'export_canvas',
    'counter_marker_added', 'line_added',
    'restore_prompt_shown', 'restore_keep',
    'copy_summary', 'unscaled_ft_block',
    'scale_set', 'scale_verify',
    'artboard_load',
    'view_link_dead', 'render_worker_fallback'
  ) then
    raise exception 'invalid event type';
  end if;
  insert into public.user_activity (user_id, event_type, project_id, metadata)
  values (auth.uid(), p_event_type, p_project_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.log_user_event(text, uuid, jsonb) to authenticated;
revoke execute on function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb) from anon;
revoke execute on function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb) from public;
