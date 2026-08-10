-- T1-04 (corrected apply → verify hand-off): allowlist the two new user-activity
-- events — scale_set ({method: 'preset'|'custom'|'two-point'|'use-measured',
-- correctionFactor, pixelsPerUnit, unit, verifyHandoff, pageIndex}) fired on
-- every PAGE-scale apply in features/scale.js, and scale_verify ({deltaPct,
-- correctionFactor, pageIndex}) fired by the check panel's Check button.
-- Re-creates public.log_user_event from the latest deployed body
-- (20260810130000_user_activity_copy_summary_events.sql — the T1-05 migration,
-- itself built on T1-01's 20260810120000 and the original 20260326230000;
-- copying an older body would silently un-allowlist the earlier branches'
-- events) with the two events added. Re-asserts the authenticated grant and the
-- 20260724 revokes (CREATE OR REPLACE keeps the existing ACL, but new-function
-- defaults grant PUBLIC execute — re-assert so this file is correct even if the
-- function is ever dropped and re-run from scratch).

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
    'scale_set', 'scale_verify'
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
