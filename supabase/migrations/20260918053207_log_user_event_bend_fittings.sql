-- BEND-FITTINGS (2026-09-18): one new client event, `bend_fittings_toggle`,
-- fired when an estimator turns "Fittings from bends" on or off for a line type
-- (features/child-counts.js; metadata { on, lineType }). Without it the feed is
-- blind to whether the option is being found and used, which is the one thing
-- the day-7 read of this feature needs.
--
-- Re-creates the function from the DEPLOYED body (diffed against
--   select pg_get_functiondef('public.log_user_event(text, uuid, jsonb)'::regprocedure);
-- on prod 2026-09-18: identical to 20260916143700_log_user_event_allowlist_catchup.sql,
-- thirty-three types) with the one added. Migration chain discipline (_INDEX.md
-- conflict note 6): a re-creation carries every type an earlier migration allowed;
-- log-user-event-allowlist.test.js pins that, and pins every logUserEvent('…')
-- literal in the client as a subset of this list.
--
-- Re-asserts the authenticated grant and the 20260724 revokes (CREATE OR REPLACE
-- keeps the existing ACL, but new-function defaults grant PUBLIC execute).

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
    'prepare_trim',
    'duct_run',
    'project_close', 'restore_prompt_deferred',
    'tour_step', 'trade_set', 'codes_set', 'ceiling_set', 'drop_set',
    'bid_check_row_state', 'child_count_from_rule', 'rule_open',
    'tag_suggestion_accepted', 'ghost_placed', 'ghost_stamped',
    'client_error', 'client_unhandled_rejection',
    'bend_fittings_toggle'
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
