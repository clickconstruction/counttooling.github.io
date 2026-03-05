-- Add projects table to Realtime publication for instant checkout notifications.
-- When a user checks in, waiting users receive the update immediately.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
end
$$;
