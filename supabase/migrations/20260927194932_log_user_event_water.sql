-- WATER-PLAN (2026-09-23): two new client events for the water-sizing ladder,
-- `water_run` (a water-sided polyline committed: side, size, the fixture units
-- and flow at its head, whether the S moment's suggestion was taken) and
-- `wsfu_prefill` (a counter created with a fixture-unit reading: accepted or
-- overwritten), WATER-PLAN.md §8. The client fires them behind the
-- `water-telemetry` feature flag until this migration is on prod (punch row
-- WATER-TELEM), so nothing 400s in the meantime.
--
-- Re-creates the function from the chain-latest body
-- (20260918053207_log_user_event_bend_fittings.sql, thirty-four types) with the
-- two added. Migration chain discipline (_INDEX.md conflict note 6): a
-- re-creation carries every type an earlier migration allowed;
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
    'bend_fittings_toggle',
    'water_run', 'wsfu_prefill'
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
