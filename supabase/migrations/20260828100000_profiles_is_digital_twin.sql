-- Digital twins (PipeTooling docs/DIGITAL_TWINS_PLAN.md, Phase E2 — CountTooling half):
-- agent-operated accounts are flagged at the profile so the twin-login edge function can
-- refuse to mint sessions for real people, and so the app can badge twin sessions later.
-- Estimator-only program: twins here do takeoffs on their own projects (ownership RLS is
-- already the fence — a twin can only edit projects it owns or is explicitly shared).

alter table public.profiles add column if not exists is_digital_twin boolean not null default false;

comment on column public.profiles.is_digital_twin is
  'Digital twin account (agent-operated, not a person). twin-login only mints sessions for flagged profiles; see PipeTooling docs/DIGITAL_TWINS_PLAN.md.';
