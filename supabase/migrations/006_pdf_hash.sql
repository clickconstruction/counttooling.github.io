-- Add pdf_hash for hash-based skip on upload (avoid re-uploading unchanged PDFs)
alter table public.projects add column if not exists pdf_hash text;
