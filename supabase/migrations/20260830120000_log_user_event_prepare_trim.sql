-- T2-15 (Thumbnail-grid trim for Prepare PDF): allowlist the new user-activity
-- event — prepare_trim ({total, kept, dropped, mode: 'project' | 'append'})
-- fired once per Prepare PDF commit (Open / Save & Open) by
-- features/prepare-pdf.js. Closes the trim-and-organize dossier's named blind
-- spot: pages deleted/rotated/kept in Prepare PDF left no telemetry.
-- Re-creates public.log_user_event from the latest deployed body
-- (20260810160000_log_user_event_view_link_dead.sql — the T1-12 migration,
-- itself built on the T1-09/T1-04/T1-05/T1-01 chain and the original
-- 20260326230000; copying an older body would silently un-allowlist the
-- earlier branches' events) with prepare_trim added. Re-asserts the
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
    'view_link_dead', 'render_worker_fallback',
    'prepare_trim'
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
