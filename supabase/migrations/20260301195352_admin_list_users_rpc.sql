create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  role text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.last_sign_in_at,
    case when p.is_admin then 'Admin' else 'User' end
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where exists (
    select 1 from public.profiles
    where user_id = auth.uid() and is_admin = true
  )
  order by u.email
$$;

grant execute on function public.list_users_for_admin() to authenticated;
grant execute on function public.list_users_for_admin() to service_role;;
