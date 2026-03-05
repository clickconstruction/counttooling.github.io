-- Admins can read all project PDFs (for Load Project from Cloud)
-- Run after 013_storage_shared_read_fix.sql

create policy "Admins can read all PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_admin = true)
  );
