-- Quick Keys: carry the number-row bindings with the user's saved Artboard.
--
-- state.numberKeyBindings is per-project (ids are uid()-scoped), which left the
-- muscle-memory story with a hole: every NEW bid started with an empty number
-- row even though Save/Load Artboard restores the same counter/line-type ids
-- the bindings point at. Storing the bindings alongside the artboard closes it:
-- sign-in (or My Settings -> Load from Cloud) restores the palette AND its key
-- layout together.
--
-- Shape mirrors the client field: { "1"..."0": { "kind": "counter"|"lineType",
-- "id": "<uid>" } }. Nullable + additive — rows saved by older clients simply
-- have no bindings, and older clients ignore the column entirely.
alter table public.user_airboard
  add column if not exists number_key_bindings jsonb;
