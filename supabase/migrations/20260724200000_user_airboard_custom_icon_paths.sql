-- Custom icons ride the Artboard. The client's artboard apply-sites have
-- checked `airboard.customIconPaths` since the artboard shipped, but
-- fetchUserAirboard never selected such a column — user-uploaded icon
-- libraries lived only in per-browser IndexedDB, so a user moving devices got
-- their palette back but not their icons. This column makes the existing
-- apply code live. Shape: the getUserCustomIcons() array of
-- { value, viewBox, name } SVG-path entries. Nullable + additive; older
-- clients ignore it. (User-approved 2026-07-24, same batch as the RLS/revoke
-- migrations.)
alter table public.user_airboard
  add column if not exists custom_icon_paths jsonb;
