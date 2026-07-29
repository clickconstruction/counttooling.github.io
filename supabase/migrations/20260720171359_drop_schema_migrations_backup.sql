-- Drops the leftover migration-history backup table from the 2026-06-12
-- schema_migrations reconciliation. It was created outside the migration
-- system, had RLS disabled (flagged by the security advisor), and is no
-- longer needed. IF EXISTS keeps this a no-op on fresh databases.
drop table if exists public._schema_migrations_backup_20260612;
