-- Migration 041: global force reload (admin-triggered)
-- Adds a tiny system_settings key/value table holding a force_reload_after timestamp.
-- Admin calls admin_trigger_global_reload(reason) to bump the timestamp; clients
-- compare it against a localStorage stamp on boot and reload (clearing IndexedDB +
-- selected localStorage keys) when the server value is newer. A realtime
-- subscription on the same row lets currently-open tabs surface a banner with a
-- manual Reload button immediately.

create table if not exists public.system_settings (
  key text primary key,
  value_ts timestamptz not null default to_timestamp(0),
  value_text text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.system_settings (key, value_ts)
values ('force_reload_after', to_timestamp(0))
on conflict (key) do nothing;

alter table public.system_settings enable row level security;

drop policy if exists system_settings_read_auth on public.system_settings;
create policy system_settings_read_auth on public.system_settings
  for select to authenticated using (true);

create or replace function public.admin_trigger_global_reload(p_reason text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_now timestamptz := now();
begin
  select coalesce(is_admin, false) into v_is_admin
    from public.profiles
   where user_id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.system_settings
     set value_ts = v_now,
         value_text = p_reason,
         updated_at = v_now,
         updated_by = auth.uid()
   where key = 'force_reload_after';
  return v_now;
end;
$$;

revoke all on function public.admin_trigger_global_reload(text) from public;
grant execute on function public.admin_trigger_global_reload(text) to authenticated;

-- Add to realtime publication so postgres_changes events fire on UPDATE
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.system_settings';
  exception
    when duplicate_object then null;
  end;
end;
$$;
