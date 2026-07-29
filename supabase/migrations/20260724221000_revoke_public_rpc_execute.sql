-- Completes 20260724220000: that migration revoked the DIRECT anon grants,
-- but Postgres functions also carry the default PUBLIC grant (`=X/postgres`
-- in proacl) and anon INHERITS execute through it — has_function_privilege
-- ('anon', ...) stayed true. Revoking PUBLIC removes the inherited path;
-- authenticated and service_role keep their EXPLICIT grants (verified present
-- in every ACL before this ran), so nothing signed-in changes. Note for
-- future functions: CREATE FUNCTION grants PUBLIC execute by default — new
-- RPCs need the same revoke (or an ALTER DEFAULT PRIVILEGES policy decision).

revoke execute on function public.add_project_share(p_project_id uuid, p_target_user_id uuid, p_role text) from public;
revoke execute on function public.admin_trigger_global_reload(p_reason text) from public;
revoke execute on function public.check_in_project(p_project_id uuid) from public;
revoke execute on function public.check_out_project(p_project_id uuid) from public;
revoke execute on function public.create_view_link(p_project_id uuid, p_name text, p_expires_at timestamp with time zone) from public;
revoke execute on function public.force_check_in_project(p_project_id uuid) from public;
revoke execute on function public.get_view_link_access_log(p_view_link_id uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.list_accessible_projects() from public;
revoke execute on function public.list_project_shares(p_project_id uuid) from public;
revoke execute on function public.list_projects_for_admin() from public;
revoke execute on function public.list_user_activity_for_admin(p_limit integer, p_user_id uuid, p_since timestamp with time zone) from public;
revoke execute on function public.list_user_activity_summary_for_admin() from public;
revoke execute on function public.list_users_for_admin() from public;
revoke execute on function public.list_users_for_project_invite(p_project_id uuid) from public;
revoke execute on function public.list_view_links(p_project_id uuid) from public;
revoke execute on function public.log_user_event(p_event_type text, p_project_id uuid, p_metadata jsonb) from public;
revoke execute on function public.refresh_checkout_activity(p_project_id uuid) from public;
revoke execute on function public.remove_project_share(p_project_id uuid, p_target_user_id uuid) from public;
revoke execute on function public.revoke_view_link(p_token uuid) from public;
revoke execute on function public.storage_can_read_shared_pdf(storage_path text) from public;
revoke execute on function public.touch_presence() from public;
revoke execute on function public.user_activity_detail_for_admin(p_user_id uuid) from public;
revoke execute on function public.user_can_access_project(p_project_id uuid) from public;
