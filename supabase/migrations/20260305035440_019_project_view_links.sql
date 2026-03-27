-- View-only share links: token-based links with email domain gate
-- Run after 018_inactivity_checkout.sql

create table if not exists public.project_view_links (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  name text
);

create index if not exists project_view_links_token_idx on public.project_view_links(token);
create index if not exists project_view_links_project_id_idx on public.project_view_links(project_id);

alter table public.project_view_links enable row level security;

-- Project members can read their view links
create policy "Project members can read view links"
  on public.project_view_links for select
  to authenticated
  using (public.user_can_access_project(project_id));

-- Project members can insert view links
create policy "Project members can insert view links"
  on public.project_view_links for insert
  to authenticated
  with check (public.user_can_access_project(project_id));

-- Project members can delete their view links
create policy "Project members can delete view links"
  on public.project_view_links for delete
  to authenticated
  using (public.user_can_access_project(project_id));

create table if not exists public.view_link_access_log (
  id uuid primary key default gen_random_uuid(),
  view_link_id uuid not null references public.project_view_links(id) on delete cascade,
  token uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  accessed_at timestamptz not null default now()
);

create index if not exists view_link_access_log_view_link_id_idx on public.view_link_access_log(view_link_id);
create index if not exists view_link_access_log_view_link_accessed_idx on public.view_link_access_log(view_link_id, accessed_at desc);

alter table public.view_link_access_log enable row level security;

-- Access log: project owner or admin can read
create policy "Project owner or admin can read access log"
  on public.view_link_access_log for select
  to authenticated
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true)
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- Service role (Edge Function) can insert access log; no policy for anon
-- Edge Function uses service role client;
