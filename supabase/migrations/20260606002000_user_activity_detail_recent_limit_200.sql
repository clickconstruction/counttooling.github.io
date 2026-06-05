-- Widen the activity overview's recent feed from 40 to 200 events so the client's
-- day-grouped, run-collapsed timeline spans several days of real activity. Only the
-- `recent` CTE limit changes; guard (self-or-admin) and aggregates are unchanged.
create or replace function public.user_activity_detail_for_admin(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  with
  guard as (
    select p_user_id as uid
    where p_user_id is not null
      and (
        exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
        or p_user_id = auth.uid()
      )
  ),
  ident as (
    select u.email::text as email,
           case when pr.is_admin then 'Admin' else 'User' end as role,
           u.created_at as member_since, u.last_sign_in_at, pr.last_seen_at,
           coalesce((select count(*) from public.projects pj where pj.user_id = g.uid),0)::bigint as project_count
    from guard g join auth.users u on u.id = g.uid
    left join public.profiles pr on pr.user_id = g.uid
  ),
  agg as (
    select count(*)::bigint as total_events, min(a.created_at) as first_event_at, max(a.created_at) as last_event_at,
      count(*) filter (where a.created_at >= now() - interval '1 day')::bigint  as events_1d,
      count(*) filter (where a.created_at >= now() - interval '7 days')::bigint as events_7d,
      count(*) filter (where a.created_at >= now() - interval '30 days')::bigint as events_30d,
      count(distinct (a.created_at at time zone 'America/Chicago')::date) filter (where a.created_at >= now() - interval '30 days')::bigint as active_days_30d,
      count(distinct a.project_id) filter (where a.project_id is not null)::bigint as distinct_projects_touched,
      count(*) filter (where a.event_type='counter_marker_added')::bigint as counters_added,
      count(*) filter (where a.event_type='line_added')::bigint           as lines_added,
      count(*) filter (where a.event_type='project_save')::bigint         as project_saves,
      count(*) filter (where a.event_type='project_open')::bigint         as project_opens,
      count(*) filter (where a.event_type='export_pdf')::bigint           as exports_pdf,
      count(*) filter (where a.event_type='export_canvas')::bigint        as exports_canvas,
      count(*) filter (where a.event_type='session_start')::bigint        as sessions
    from guard g join public.user_activity a on a.user_id = g.uid
  ),
  recent as (
    select coalesce(json_agg(jsonb_build_object(
        'event_type', r.event_type, 'created_at', r.created_at,
        'project_id', r.project_id, 'project_name', r.project_name) order by r.created_at desc), '[]'::json) as items
    from (select a.event_type, a.created_at, a.project_id, pj.name as project_name
          from guard g join public.user_activity a on a.user_id = g.uid
          left join public.projects pj on pj.id = a.project_id
          order by a.created_at desc limit 200) r
  )
  select jsonb_build_object(
    'user_id', p_user_id, 'email', (select email from ident), 'role', coalesce((select role from ident),'User'),
    'member_since', (select member_since from ident), 'last_sign_in_at', (select last_sign_in_at from ident),
    'last_seen_at', (select last_seen_at from ident), 'project_count', coalesce((select project_count from ident),0),
    'total_events', coalesce((select total_events from agg),0), 'first_event_at', (select first_event_at from agg),
    'last_event_at', (select last_event_at from agg),
    'events_1d', coalesce((select events_1d from agg),0), 'events_7d', coalesce((select events_7d from agg),0),
    'events_30d', coalesce((select events_30d from agg),0), 'active_days_30d', coalesce((select active_days_30d from agg),0),
    'distinct_projects_touched', coalesce((select distinct_projects_touched from agg),0),
    'breakdown', jsonb_build_object(
      'counters_added', coalesce((select counters_added from agg),0), 'lines_added', coalesce((select lines_added from agg),0),
      'project_saves', coalesce((select project_saves from agg),0), 'project_opens', coalesce((select project_opens from agg),0),
      'exports_pdf', coalesce((select exports_pdf from agg),0), 'exports_canvas', coalesce((select exports_canvas from agg),0),
      'sessions', coalesce((select sessions from agg),0)),
    'recent', coalesce((select items from recent), '[]'::json));
$$;

grant execute on function public.user_activity_detail_for_admin(uuid) to authenticated;
grant execute on function public.user_activity_detail_for_admin(uuid) to service_role;
