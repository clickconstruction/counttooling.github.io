-- Auto-create profile when a new user is created in auth.users
-- Ensures users created via Dashboard (not admin-create-user) get a profile row
-- Run in Supabase Dashboard > SQL Editor

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, is_admin)
  values (new.id, false)
  on conflict (user_id) do nothing;
  insert into public.user_airboard (user_id, counters, line_types, icon_names, icon_order)
  values (new.id, '[]', '[]', '{}', null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
