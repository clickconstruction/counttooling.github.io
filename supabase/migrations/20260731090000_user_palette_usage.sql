-- user_palette_usage(): cross-project palette analysis for the signed-in user.
-- Powers the "Palette insights" modal (features/palette-insights.js): for every
-- counter / line type NAME across the caller's OWN projects, how many projects
-- define it and how many placements/runs it has — aggregated server-side so the
-- client never downloads whole data JSONB blobs just to count markers.
--
-- Identity is name-based (case-insensitive): counter/line-type ids are uid()-
-- scoped per project, so the same "Water Closet" has a different id in every
-- bid. item_id/icon/color/curve_style come from the MOST RECENTLY UPDATED
-- project that defines the name (distinct on ... order by updated_at desc), so
-- an add-to-artboard copies the user's latest styling and keeps a real id for
-- Quick Keys lineage.
--
-- Walks BOTH annotation shapes: the current pages[].canvases[].annotations and
-- the legacy pages[].annotations (older projects). Footage is deliberately not
-- computed here — real-world length needs per-page scale math that belongs to
-- the client; run/placement counts are the "do I use this?" signal.
--
-- SECURITY INVOKER + an explicit own-projects filter; house rule (2026-07-24
-- advisor sweep): revoke PUBLIC/anon execute, grant authenticated.

create or replace function public.user_palette_usage()
returns table (
  kind text,
  item_id text,
  name text,
  icon text,
  color text,
  curve_style text,
  project_count integer,
  placement_count bigint,
  last_used_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
with my_projects as (
  select p.id, p.data, p.updated_at
  from public.projects p
  where p.user_id = (select auth.uid())
    and p.data is not null
),
counter_defs as (
  select mp.id as project_id, mp.updated_at,
         c.value->>'id' as def_id,
         c.value->>'name' as def_name,
         c.value->>'icon' as def_icon,
         c.value->>'color' as def_color
  from my_projects mp
  cross join lateral jsonb_array_elements(coalesce(mp.data->'counters', '[]'::jsonb)) as c(value)
  where coalesce(c.value->>'name', '') <> ''
),
counter_marks as (
  select mp.id as project_id, m.key as def_id, sum(jsonb_array_length(m.value))::bigint as placed
  from my_projects mp
  cross join lateral (
    select q1.obj from jsonb_path_query(mp.data, '$.pages[*].canvases[*].annotations.counterMarkers') as q1(obj)
    union all
    select q2.obj from jsonb_path_query(mp.data, '$.pages[*].annotations.counterMarkers') as q2(obj)
  ) as cm(obj)
  cross join lateral jsonb_each(cm.obj) as m(key, value)
  where jsonb_typeof(m.value) = 'array'
  group by mp.id, m.key
),
counter_usage as (
  select lower(cd.def_name) as k,
         count(distinct cd.project_id)::integer as n_projects,
         coalesce(sum(cm.placed), 0)::bigint as n_placed,
         max(cd.updated_at) as latest_at
  from counter_defs cd
  left join counter_marks cm on cm.project_id = cd.project_id and cm.def_id = cd.def_id
  group by lower(cd.def_name)
),
counter_latest as (
  select distinct on (lower(cd2.def_name))
         lower(cd2.def_name) as k, cd2.def_id, cd2.def_name, cd2.def_icon, cd2.def_color
  from counter_defs cd2
  order by lower(cd2.def_name), cd2.updated_at desc
),
line_defs as (
  select mp.id as project_id, mp.updated_at,
         l.value->>'id' as def_id,
         l.value->>'name' as def_name,
         l.value->>'color' as def_color,
         coalesce(l.value->>'curveStyle', 'straight') as def_curve
  from my_projects mp
  cross join lateral jsonb_array_elements(coalesce(mp.data->'lineTypes', '[]'::jsonb)) as l(value)
  where coalesce(l.value->>'name', '') <> ''
),
line_runs as (
  select mp.id as project_id, r.obj->>'lineTypeId' as def_id, count(*)::bigint as placed
  from my_projects mp
  cross join lateral (
    select q1.obj from jsonb_path_query(mp.data, '$.pages[*].canvases[*].annotations.quickLines[*]') as q1(obj)
    union all
    select q2.obj from jsonb_path_query(mp.data, '$.pages[*].annotations.quickLines[*]') as q2(obj)
    union all
    select q3.obj from jsonb_path_query(mp.data, '$.pages[*].canvases[*].annotations.polylines[*]') as q3(obj)
    union all
    select q4.obj from jsonb_path_query(mp.data, '$.pages[*].annotations.polylines[*]') as q4(obj)
  ) as r(obj)
  where r.obj ? 'lineTypeId'
  group by mp.id, r.obj->>'lineTypeId'
),
line_usage as (
  select lower(ld.def_name) as k,
         count(distinct ld.project_id)::integer as n_projects,
         coalesce(sum(lr.placed), 0)::bigint as n_placed,
         max(ld.updated_at) as latest_at
  from line_defs ld
  left join line_runs lr on lr.project_id = ld.project_id and lr.def_id = ld.def_id
  group by lower(ld.def_name)
),
line_latest as (
  select distinct on (lower(ld2.def_name))
         lower(ld2.def_name) as k, ld2.def_id, ld2.def_name, ld2.def_color, ld2.def_curve
  from line_defs ld2
  order by lower(ld2.def_name), ld2.updated_at desc
)
select 'counter'::text, cl.def_id, cl.def_name, cl.def_icon, cl.def_color, null::text,
       cu.n_projects, cu.n_placed, cu.latest_at
from counter_usage cu
join counter_latest cl on cl.k = cu.k
union all
select 'lineType'::text, ll.def_id, ll.def_name, null::text, ll.def_color, ll.def_curve,
       lu.n_projects, lu.n_placed, lu.latest_at
from line_usage lu
join line_latest ll on ll.k = lu.k
order by 7 desc, 8 desc, 3 asc
$$;

-- House rule for every new RPC (see the 2026-07-24 advisor remediation):
-- CREATE FUNCTION grants PUBLIC execute by default — revoke it and anon's,
-- grant only authenticated.
revoke execute on function public.user_palette_usage() from public;
revoke execute on function public.user_palette_usage() from anon;
grant execute on function public.user_palette_usage() to authenticated;
