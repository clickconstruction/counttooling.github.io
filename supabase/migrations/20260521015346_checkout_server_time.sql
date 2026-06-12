-- Return server now() from check_out_project and refresh_checkout_activity
-- so clients can compute clock offset for expiry math. Preserves the admin
-- permission path added in 029_admin_check_out_project.sql.
-- Run after 037_remove_drop_claim_migration_entry.sql

create or replace function public.check_out_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_can_check_out boolean;
  v_updated int;
  v_now timestamptz := now();
  v_checked_out_at timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated', 'server_now', v_now);
  end if;

  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
    and (
      p.user_id = v_uid
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = v_uid and ps.role = 'editor')
      or exists (select 1 from public.profiles pr where pr.user_id = v_uid and pr.is_admin = true)
    )
  ) into v_can_check_out;

  if not v_can_check_out then
    return jsonb_build_object('ok', false, 'error', 'No permission to check out', 'server_now', v_now);
  end if;

  update public.projects
  set checked_out_by = v_uid, checked_out_at = v_now
  where id = p_project_id
  and (checked_out_by is null or checked_out_at < v_now - interval '30 minutes')
  returning checked_out_at into v_checked_out_at;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'Project is checked out by someone else', 'server_now', v_now);
  end if;

  return jsonb_build_object('ok', true, 'checked_out_at', v_checked_out_at, 'server_now', v_now);
end;
$$;

create or replace function public.refresh_checkout_activity(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
  v_now timestamptz := now();
  v_checked_out_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated', 'server_now', v_now);
  end if;

  update public.projects
  set checked_out_at = v_now
  where id = p_project_id and checked_out_by = auth.uid()
  returning checked_out_at into v_checked_out_at;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'You do not have this project checked out', 'server_now', v_now);
  end if;

  return jsonb_build_object('ok', true, 'checked_out_at', v_checked_out_at, 'server_now', v_now);
end;
$$;
