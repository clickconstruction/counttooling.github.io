-- Add counter_count and line_count to projects; computed on save, displayed in Manage Projects

alter table public.projects add column if not exists counter_count int;
alter table public.projects add column if not exists line_count int;

-- Backfill existing projects from data JSONB
update public.projects set
  counter_count = (
    select coalesce(sum(cnt), 0)::int from (
      select (select coalesce(sum(jsonb_array_length(value)), 0)::bigint from jsonb_each(coalesce(page->'annotations'->'counterMarkers', '{}'::jsonb))) as cnt
      from jsonb_array_elements(coalesce(data->'pages', '[]'::jsonb)) as page
    ) sub
  ),
  line_count = (
    select coalesce(sum(
      jsonb_array_length(coalesce(page->'annotations'->'quickLines', '[]'::jsonb))::int +
      jsonb_array_length(coalesce(page->'annotations'->'polylines', '[]'::jsonb))::int
    ), 0)::int
    from jsonb_array_elements(coalesce(data->'pages', '[]'::jsonb)) as page
  )
where counter_count is null or line_count is null;

-- Extend list_projects_for_admin to return counts
drop function if exists public.list_projects_for_admin();

create or replace function public.list_projects_for_admin()
returns table (
  id uuid,
  name text,
  user_id uuid,
  updated_at timestamptz,
  pdf_path text,
  size_bytes bigint,
  owner_email text,
  checked_out_by uuid,
  checked_out_at timestamptz,
  checked_out_email text,
  counter_count int,
  line_count int
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.name,
    p.user_id,
    p.updated_at,
    p.pdf_path,
    p.size_bytes,
    u.email::text as owner_email,
    p.checked_out_by,
    p.checked_out_at,
    u_checkout.email::text as checked_out_email,
    p.counter_count,
    p.line_count
  from public.projects p
  left join auth.users u on u.id = p.user_id
  left join auth.users u_checkout on u_checkout.id = p.checked_out_by
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  )
  order by p.updated_at desc
$$;

grant execute on function public.list_projects_for_admin() to authenticated;
grant execute on function public.list_projects_for_admin() to service_role;
