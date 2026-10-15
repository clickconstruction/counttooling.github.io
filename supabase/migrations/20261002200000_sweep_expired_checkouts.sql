-- STALE-LOCK (2026-10-02): clear expired checkouts on a timer.
--
-- The lock has always expired LAZILY: check_out_project takes a lock whose
-- checked_out_at is older than 30 minutes, the UPDATE policy stops honouring
-- its holder, can_edit / can_check_out read it as free, but nothing ever
-- nulls checked_out_by. The row kept its last holder's name for good, and a
-- client that read the name without the stamp showed "grace is editing" on a
-- lock 50.8 hours dead (Wendi's Save Status export, 2026-10-02).
--
-- The fix is on the client (every surface asks checkoutLockIsLive before
-- naming a holder). This is the backstop: every 15 minutes, a lock older than
-- the same 30-minute window is cleared, so the row itself says free, the
-- realtime UPDATE repaints every open tab, and a surface the client fix
-- missed cannot show a dead lock as live. The window is the one the RPCs and
-- policies use (20260305030845_inactivity_checkout.sql); change both or
-- neither.
--
-- The UPDATE bumps updated_at through projects_set_updated_at, the same way a
-- Turn In or a keep-alive does; a swept project was touched inside the last
-- 45 minutes, so the list order does not move.
--
-- For the holder's own open tab (if one is still visible) the row UPDATE
-- arrives as a permissions refresh whose last-known stamp is past the window:
-- save-engine.js classifies that as EXPIRY (the one-shot toast and the quiet
-- auto re-checkout), never as a force.

create or replace function public.sweep_expired_checkouts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swept integer;
begin
  update public.projects
  set checked_out_by = null, checked_out_at = null
  where checked_out_by is not null
    and checked_out_at is not null
    and checked_out_at < now() - interval '30 minutes';
  get diagnostics v_swept = row_count;
  return v_swept;
end;
$$;

-- Server-side only: pg_cron calls it as the scheduling role. No client grant.
revoke execute on function public.sweep_expired_checkouts() from public;
revoke execute on function public.sweep_expired_checkouts() from anon;
revoke execute on function public.sweep_expired_checkouts() from authenticated;

create extension if not exists pg_cron;

select cron.unschedule('sweep-expired-checkouts')
where exists (select 1 from cron.job where jobname = 'sweep-expired-checkouts');

select cron.schedule(
  'sweep-expired-checkouts',
  '*/15 * * * *',
  $$ select public.sweep_expired_checkouts(); $$
);
