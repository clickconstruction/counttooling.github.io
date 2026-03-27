-- Migrate existing user_airboard data to user_artboards
insert into public.user_artboards (user_id, name, sort_order, counters, line_types, icon_names, icon_order, plumbing_modifiers, line_modifiers, custom_icon_paths, created_at, updated_at)
select
  ua.user_id,
  'Default',
  0,
  ua.counters,
  ua.line_types,
  coalesce(ua.icon_names, '{}'),
  ua.icon_order,
  coalesce(ua.plumbing_modifiers, '{}'),
  coalesce(ua.line_modifiers, '{}'),
  null,
  ua.updated_at,
  ua.updated_at
from public.user_airboard ua
where (jsonb_array_length(ua.counters) > 0 or jsonb_array_length(ua.line_types) > 0)
  and not exists (select 1 from public.user_artboards uab where uab.user_id = ua.user_id);;
