-- Project sharing: who can view/edit projects
-- Run after 008_auth_profile_trigger.sql

create table if not exists public.project_shares (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  invited_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  primary key (project_id, user_id)
);

create index if not exists project_shares_project_id_idx on public.project_shares(project_id);
create index if not exists project_shares_user_id_idx on public.project_shares(user_id);

alter table public.project_shares enable row level security;

-- Users can see shares for projects they own or are shared on
create policy "Users can read project shares for accessible projects"
  on public.project_shares for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
      and (p.user_id = auth.uid() or exists (select 1 from public.project_shares ps2 where ps2.project_id = p.id and ps2.user_id = auth.uid()))
    )
  );

-- Project owner or any existing member can add shares
create policy "Project members can add shares"
  on public.project_shares for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
      and (p.user_id = auth.uid() or exists (select 1 from public.project_shares ps2 where ps2.project_id = p.id and ps2.user_id = auth.uid()))
    )
  );

-- Owner, inviter, or system admin can remove shares
create policy "Owner inviter or admin can remove shares"
  on public.project_shares for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where user_id = auth.uid() and is_admin = true)
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
    or invited_by = auth.uid()
  );;
