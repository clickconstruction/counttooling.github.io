-- MAP-PERMS (DECOMPOSITION_MAP.md D28): a lean permissions read for ONE
-- project. The app's refreshProjectPermissions (save-engine.js) runs on every
-- checkout-channel UPDATE, subscribe, tab return, turn-in and recovery, and
-- until now read list_accessible_projects to keep one row's can_edit /
-- can_check_out / checked_out_* fields: every project the user can see, each
-- with its whole takeoff (`data` jsonb). For an admin or overseer that is the
-- whole projects table per refresh, on the same connection the autosave uses.
--
-- SAFE TO APPLY IN EITHER ORDER. The client asks get_project_permissions
-- first; while this function is absent PostgREST answers PGRST202 (404) and
-- the client falls back to list_accessible_projects for that refresh and
-- stops asking until its Supabase client is recycled. Once this is applied a
-- follow-up deletes the fallback (PUNCHLIST MAP-PERMS).
--
-- Shape: the columns list_accessible_projects returns (latest definition:
-- 20260831100000_projects_external_ref.sql), same names, types and order,
-- MINUS `data` (the takeoff) and `pdf_path` / `pdf_hash` (the permissions
-- read never opens the PDF). Every expression below is copied from the list
-- function unchanged, so a row here is the list's row for the same project.
--
-- Access: the list's WHERE clause (owner, any share, admin, overseer) plus
-- p.id = p_project_id. A project the caller cannot see returns NO ROW, which
-- the client reads as "you no longer have access", the same verdict the
-- list's missing row gave. Security model as the list: SECURITY DEFINER with
-- search_path public, auth (it joins auth.users for the two emails), execute
-- for authenticated + service_role only, anon and PUBLIC revoked (see
-- 20260724221000: CREATE FUNCTION grants PUBLIC by default). One difference:
-- declared STABLE (a pure read; the list's definition simply omits it).

create or replace function public.get_project_permissions(p_project_id uuid)
returns table (
  id uuid,
  name text,
  user_id uuid,
  updated_at timestamptz,
  size_bytes bigint,
  checked_out_by uuid,
  checked_out_at timestamptz,
  checked_out_email text,
  is_owner boolean,
  can_edit boolean,
  can_check_out boolean,
  counter_count int,
  line_count int,
  owner_email text,
  my_access_role text,
  review_status text,
  review_requested_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  external_ref text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.name,
    p.user_id,
    p.updated_at,
    p.size_bytes,
    p.checked_out_by,
    p.checked_out_at,
    cu.email::text as checked_out_email,
    (p.user_id = auth.uid()) as is_owner,
    (p.checked_out_by = auth.uid() and (p.checked_out_at is null or p.checked_out_at >= now() - interval '30 minutes')) as can_edit,
    (
      (
        p.user_id = auth.uid()
        or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor')
        or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
      )
      and (p.checked_out_by is null or p.checked_out_at < now() - interval '30 minutes')
    ) as can_check_out,
    p.counter_count,
    p.line_count,
    ou.email::text as owner_email,
    (
      case
        when p.user_id = auth.uid() then 'owner'
        when exists (
          select 1 from public.project_shares ps
          where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'editor'
        ) then 'editor'
        when exists (
          select 1 from public.project_shares ps
          where ps.project_id = p.id and ps.user_id = auth.uid() and ps.role = 'viewer'
        ) then 'viewer'
        when exists (
          select 1 from public.profiles pr
          where pr.user_id = auth.uid() and pr.is_admin = true
        ) then 'admin'
        when exists (
          select 1 from public.profiles pr
          where pr.user_id = auth.uid() and pr.is_overseer = true
        ) then 'viewer'
        else 'unknown'
      end
    ) as my_access_role,
    p.review_status,
    p.review_requested_at,
    p.reviewed_at,
    p.review_note,
    p.external_ref
  from public.projects p
  left join auth.users cu on cu.id = p.checked_out_by
  left join auth.users ou on ou.id = p.user_id
  where p.id = p_project_id
    and (
      p.user_id = auth.uid()
      or exists (select 1 from public.project_shares ps where ps.project_id = p.id and ps.user_id = auth.uid())
      or exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and (pr.is_admin = true or pr.is_overseer = true))
    );
$$;

comment on function public.get_project_permissions(uuid) is
  'One project''s list_accessible_projects row without data / pdf_path / pdf_hash, for the client''s permissions refresh (MAP-PERMS). No row = the caller cannot see the project.';

grant execute on function public.get_project_permissions(uuid) to authenticated;
grant execute on function public.get_project_permissions(uuid) to service_role;
revoke execute on function public.get_project_permissions(uuid) from anon;
revoke execute on function public.get_project_permissions(uuid) from public;
