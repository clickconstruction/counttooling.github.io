-- View link RPCs: create, list, revoke, access log
-- Run after 019_project_view_links.sql

create or replace function public.create_view_link(p_project_id uuid, p_name text default null, p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token uuid;
  v_link_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not public.user_can_access_project(p_project_id) then
    return jsonb_build_object('ok', false, 'error', 'No permission to create view link');
  end if;

  insert into public.project_view_links (project_id, created_by, name, expires_at)
  values (p_project_id, v_uid, nullif(trim(p_name), ''), p_expires_at)
  returning id, token into v_link_id, v_token;

  return jsonb_build_object('ok', true, 'token', v_token, 'id', v_link_id);
end;
$$;

grant execute on function public.create_view_link(uuid, text, timestamptz) to authenticated;

create or replace function public.list_view_links(p_project_id uuid)
returns table (
  id uuid,
  token uuid,
  name text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.token, l.name, l.created_at, l.expires_at
  from public.project_view_links l
  where l.project_id = p_project_id
  and public.user_can_access_project(p_project_id)
  order by l.created_at desc;
$$;

grant execute on function public.list_view_links(uuid) to authenticated;

create or replace function public.revoke_view_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_deleted int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select project_id into v_project_id
  from public.project_view_links
  where token = p_token;

  if v_project_id is null then
    return jsonb_build_object('ok', false, 'error', 'View link not found');
  end if;

  if not public.user_can_access_project(v_project_id) then
    return jsonb_build_object('ok', false, 'error', 'No permission to revoke');
  end if;

  delete from public.project_view_links where token = p_token;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('ok', true, 'deleted', v_deleted > 0);
end;
$$;

grant execute on function public.revoke_view_link(uuid) to authenticated;

create or replace function public.get_view_link_access_log(p_view_link_id uuid)
returns table (
  email text,
  accessed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.email, a.accessed_at
  from public.view_link_access_log a
  join public.project_view_links l on l.id = a.view_link_id
  where a.view_link_id = p_view_link_id
  and (
    exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true)
    or exists (select 1 from public.projects p where p.id = l.project_id and p.user_id = auth.uid())
  )
  order by a.accessed_at desc;
$$;

grant execute on function public.get_view_link_access_log(uuid) to authenticated;;
