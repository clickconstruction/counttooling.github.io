-- R2 (journeys/plans/_TODO.md): the allowlist catch-up. Fifteen event types the
-- client sends today are rejected by the deployed public.log_user_event with
-- "invalid event type" (a console 400 on every signed-in Close project, and a
-- user_activity feed blind to tours, trade choice, Bid Check ticks, closes, the
-- rulebook chip, the tag reader and the ghost). No migration ever added them:
--
--   bid_check_row_state, ceiling_set, child_count_from_rule, codes_set, drop_set,
--   ghost_placed, ghost_stamped, project_close, restore_prompt_deferred, rule_open,
--   tag_suggestion_accepted, tour_step, trade_set
--     (the thirteen R2 diffed against pg_get_functiondef on prod, 2026-09-15)
--   client_error, client_unhandled_rejection
--     (app.js reportClientError mirrors field errors to the feed; no migration in
--     the repo allowlists them either, so they ride the same catch-up)
--
-- Re-creates the function from the latest body in the migration chain
-- (20260913025935_log_user_event_duct_run.sql, itself on the T2-15 / T1 chain and
-- the original 20260326230000) with the fifteen added. Migration chain discipline
-- (_INDEX.md conflict note 6): a re-creation must carry the DEPLOYED body, because
-- copying an older one silently un-allowlists the events later branches shipped.
-- Before applying, diff the allowlist below against
--   select pg_get_functiondef('public.log_user_event(text, uuid, jsonb)'::regprocedure);
-- on prod; if prod carries a type this file lacks, add it here first.
-- log-user-event-allowlist.test.js keeps this file's list a superset of every
-- earlier migration's and of every logUserEvent('…') literal in the client.
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
    'client_error', 'client_unhandled_rejection'
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
