-- Admin management of the overseer flag:
--   * admin_set_overseer(user, bool) — the Manage Users toggle's backend.
--   * list_users_for_admin gains is_overseer + an 'Overseer' role label
--     (Admin wins when both flags are set). Signature changes — drop first.
-- Preserves the is_digital_twin column added by 20260828110000 (this recreate
-- is a superset of that signature), and re-applies its 20260828120000
-- revoke-public follow-up inline so the CREATE's default PUBLIC grant never
-- survives this migration.

create or replace function public.admin_set_overseer(p_user_id uuid, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;

  insert into public.profiles (user_id, is_overseer)
  values (p_user_id, p_value)
  on conflict (user_id) do update set is_overseer = excluded.is_overseer;

  return jsonb_build_object('ok', true, 'is_overseer', p_value);
end;
$$;

grant execute on function public.admin_set_overseer(uuid, boolean) to authenticated;
grant execute on function public.admin_set_overseer(uuid, boolean) to service_role;
revoke execute on function public.admin_set_overseer(uuid, boolean) from anon;
revoke execute on function public.admin_set_overseer(uuid, boolean) from public;

drop function if exists public.list_users_for_admin();

create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text,
  last_seen_at timestamptz,
  project_count bigint,
  is_digital_twin boolean,
  is_overseer boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    case when p.is_admin then 'Admin' when p.is_overseer then 'Overseer' else 'User' end,
    p.last_seen_at,
    coalesce((select count(*) from public.projects pj where pj.user_id = u.id), 0)::bigint,
    coalesce(p.is_digital_twin, false),
    coalesce(p.is_overseer, false)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  )
  order by u.email
$$;

grant execute on function public.list_users_for_admin() to authenticated;
grant execute on function public.list_users_for_admin() to service_role;
revoke execute on function public.list_users_for_admin() from anon;
revoke execute on function public.list_users_for_admin() from public;
