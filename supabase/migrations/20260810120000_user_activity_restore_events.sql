-- T1-01 (signed-out restore prompt): allowlist the two new user-activity
-- events — restore_prompt_shown ({source:'local'|'cloud'}, project id null for
-- the local candidate since 'local' is not a uuid) and restore_keep
-- ({source, markers, ms}). Re-creates public.log_user_event from the latest
-- deployed body (20260326230000_user_presence_and_activity.sql — verified the
-- only later touches are the 20260724 grant revokes, no body re-creations)
-- with the two events added to the allowlist. Re-asserts the authenticated
-- grant and the 20260724 revokes (CREATE OR REPLACE keeps the existing ACL,
-- but new-function defaults grant PUBLIC execute — re-assert so this file is
-- correct even if the function is ever dropped and re-run from scratch).

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
    'restore_prompt_shown', 'restore_keep'
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
