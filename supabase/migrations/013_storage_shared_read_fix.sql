-- Fix 42P17: Replace inline EXISTS with SECURITY DEFINER helper
-- Run after 012_storage_shared_read.sql
-- Storage path format: {owner_id}/{project_id}/document.pdf

drop policy if exists "Shared users can read project PDFs" on storage.objects;

-- Helper: returns true if the current user can read the project PDF at the given storage path
create or replace function public.storage_can_read_shared_pdf(storage_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_id uuid;
begin
  if array_length(string_to_array(trim(both '/' from storage_path), '/'), 1) < 2 then
    return false;
  end if;
  proj_id := ((string_to_array(trim(both '/' from storage_path), '/'))[2])::uuid;
  return exists (
    select 1 from public.project_shares ps
    where ps.project_id = proj_id and ps.user_id = auth.uid()
  );
exception when others then
  return false;
end;
$$;

grant execute on function public.storage_can_read_shared_pdf(text) to authenticated;

-- Recreate policy using the helper
create policy "Shared users can read project PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and array_length(storage.foldername(name), 1) >= 2
    and public.storage_can_read_shared_pdf(name)
  );
