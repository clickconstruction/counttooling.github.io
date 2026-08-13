-- Daily purge of TEST-ACCOUNT projects older than 7 days (rows + storage
-- files) so spec-run leftovers never accumulate again (2026-08-13 cleanup
-- removed 610 projects / 904 orphaned PDFs that had built up).
--
-- Mechanism: pg_cron invokes the cleanup-test-accounts Edge Function via
-- pg_net. The function (service-role) deletes the stale projects' PDFs FIRST,
-- then the rows, plus sweeps unreferenced test-folder files older than the
-- cutoff — so files can never orphan. The request token is read from Vault
-- ('cleanup_test_accounts_token', created out-of-band — deliberately NOT in
-- this migration so no secret lands in the public repo). The Authorization
-- header carries the anon key, which is public by design (shipped in
-- config.js).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-test-accounts-daily',
  '30 8 * * *',
  $$
  select net.http_post(
    url := 'https://hrqxvfydmvtvwhvefmqc.supabase.co/functions/v1/cleanup-test-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXh2ZnlkbXZ0dndodmVmbXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODM0NTMsImV4cCI6MjA4Nzk1OTQ1M30.dqn8DwO-dc0z2GwunCfEo5VO8lPRUGaN6ruzAm33HSs'
    ),
    body := jsonb_build_object(
      'token', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_test_accounts_token')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
