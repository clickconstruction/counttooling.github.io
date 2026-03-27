-- Per-user activity counts (rolling windows) and last sign-in for admin dashboard.
create or replace function public.list_user_activity_summary_for_admin()
returns table (
  user_id uuid,
  email text,
  last_sign_in_at timestamptz,
  events_1d bigint,
  events_7d bigint,
  events_30d bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    coalesce(count(*) filter (where a.created_at >= now() - interval '1 day'), 0)::bigint as events_1d,
    coalesce(count(*) filter (where a.created_at >= now() - interval '7 days'), 0)::bigint as events_7d,
    coalesce(count(*) filter (where a.created_at >= now() - interval '30 days'), 0)::bigint as events_30d
  from auth.users u
  left join public.user_activity a on a.user_id = u.id
  where exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_admin = true
  )
  group by u.id, u.email, u.last_sign_in_at
  order by u.email asc nulls last;
$$;

grant execute on function public.list_user_activity_summary_for_admin() to authenticated;
grant execute on function public.list_user_activity_summary_for_admin() to service_role;
