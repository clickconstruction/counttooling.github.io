-- 20260828110000 recreated list_users_for_admin() (adding is_digital_twin), and
-- CREATE FUNCTION grants PUBLIC execute by default — exactly the trap the
-- 20260724221000 revoke-public migration's closing note warns about. Anon could
-- execute again (the internal is_admin gate still returned nothing — verified —
-- so this is defense-in-depth, not a leak fix). Re-apply the house rule:
-- authenticated and service_role keep their explicit grants.

revoke execute on function public.list_users_for_admin() from public;
revoke execute on function public.list_users_for_admin() from anon;
