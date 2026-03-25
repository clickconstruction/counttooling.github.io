-- Remove orphan migration history row for drop_claim_dev_with_code (version 20260306034155).
-- That migration only ran: DROP FUNCTION IF EXISTS public.claim_dev_with_code(text);
-- It was applied without a matching file in this repo; deleting the row cleans migration history.
-- Idempotent: no-op if the row is already absent.
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260306034155' AND name = 'drop_claim_dev_with_code';
