-- Advisor remediation (anon_security_definer_function_executable, 2026-07-24
-- scan; user-approved): revoke anon EXECUTE on all 24 exposed SECURITY DEFINER
-- functions. Defense-in-depth — every function already guards internally on
-- auth.uid()/is_admin, but anon had no business reaching them at all.
--
-- Safety audit (2026-07-24, before applying): NO code path invokes any of
-- these as anon. The client's rpcSupabase wrapper refuses without a session
-- access token; every supabase-js .rpc() site lives in signed-in flows; the
-- view-link (anon) path talks only to Edge Functions + signed URLs; and the
-- Edge Functions call zero public RPCs (service-role table access only —
-- service_role grants are unaffected by these revokes). The two SQL-side
-- helpers (user_can_access_project, storage_can_read_shared_pdf) are invoked
-- from policies during AUTHENTICATED queries and inside SECURITY DEFINER
-- functions (definer context), never by anon queries.
--
-- handle_new_user is an auth.users trigger function (runs as definer when the
-- trigger fires): nothing should call it via the API at all, so it loses
-- EXECUTE from authenticated too.

revoke execute on function public.add_project_share(p_project_id uuid, p_target_user_id uuid, p_role text) from anon;
revoke execute on function public.admin_trigger_global_reload(p_reason text) from anon;
revoke execute on function public.check_in_project(p_project_id uuid) from anon;
revoke execute on function public.check_out_project(p_project_id uuid) from anon;
revoke execute on function public.create_view_link(p_project_id uuid, p_name text, p_expires_at timestamp with time zone) from anon;
revoke execute on function public.force_check_in_project(p_project_id uuid) from anon;
revoke execute on function public.get_view_link_access_log(p_view_link_id uuid) from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.list_accessible_projects() from anon;
revoke execute on function public.list_project_shares(p_project_id uuid) from anon;
revoke execute on function public.list_projects_for_admin() from anon;
revoke execute on function public.list_user_activity_for_admin(p_limit integer, p_user_id uuid, p_since timestamp with time zone) from anon;
revoke execute on function public.list_user_activity_summary_for_admin() from anon;
revoke execute on function public.list_users_for_admin() from anon;
revoke execute on function public.list_users_for_project_invite(p_project_id uuid) from anon;
revoke execute on function public.list_view_links(p_project_id uuid) from anon;
revoke execute on function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb) from anon;
revoke execute on function public.refresh_checkout_activity(p_project_id uuid) from anon;
revoke execute on function public.remove_project_share(p_project_id uuid, p_target_user_id uuid) from anon;
revoke execute on function public.revoke_view_link(p_token uuid) from anon;
revoke execute on function public.storage_can_read_shared_pdf(storage_path text) from anon;
revoke execute on function public.touch_presence() from anon;
revoke execute on function public.user_activity_detail_for_admin(p_user_id uuid) from anon;
revoke execute on function public.user_can_access_project(p_project_id uuid) from anon;
