-- Add size_bytes to projects for display in Load Project modal
-- Size = JSON data length + PDF file size (when stored)
alter table public.projects add column if not exists size_bytes bigint;
