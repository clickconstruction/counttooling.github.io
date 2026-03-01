-- ClickCount Supabase Phase 2: PDF Storage
-- Run this in Supabase Dashboard > SQL Editor after Phase 1

-- Add pdf_path column to projects
alter table public.projects add column if not exists pdf_path text;

-- Create private bucket for PDFs (if not exists)
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do update set public = false;

-- RLS policies for storage.objects

-- Users can upload files only to their own folder: {user_id}/...
create policy "Users can upload own PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read files only from their own folder
create policy "Users can read own PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete files only from their own folder
create policy "Users can delete own PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (upsert) files only in their own folder
create policy "Users can update own PDFs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
