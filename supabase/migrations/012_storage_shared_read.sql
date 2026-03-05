-- Shared users can read project PDFs
-- Run after 011_project_rpcs.sql
-- Storage path format: {owner_id}/{project_id}/document.pdf
-- Uses foldername to extract project_id; avoids join with projects (which caused 42P17)

create policy "Shared users can read project PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (array_length(storage.foldername(name), 1) >= 2)
    and exists (
      select 1 from public.project_shares ps
      where ps.project_id = ((storage.foldername(name))[2])::uuid
      and ps.user_id = auth.uid()
    )
  );
