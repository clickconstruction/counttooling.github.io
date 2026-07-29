-- Advisor remediation (function_search_path_mutable, 2026-07-24 scan): pin the
-- search_path on the two trigger functions that had none. Both bodies touch
-- only NEW.* and now() (pg_catalog), so an empty path cannot break resolution —
-- it just closes the search-path-hijack class for SECURITY DEFINER-adjacent
-- trigger execution. Config-only; no behavior change.
alter function public.set_projects_updated_at() set search_path = '';
alter function public.auto_checkout_on_project_insert() set search_path = '';
