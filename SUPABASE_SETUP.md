# Supabase Setup

## Overview

Phase 1 adds admin-provisioned auth and cloud project persistence. Phase 2 adds PDF storage so projects store the PDF file in Supabase Storage. Users sign in with credentials provided by an admin. Admins create users via Add User and delete users via Manage User, both in User Settings.

## 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project
2. Note your project URL and anon key (Settings > API)

## 2. Run SQL Migrations

**Option A: Supabase MCP** (if available): Use `list_migrations` to see applied migrations, then `apply_migration` with each migration's `name` (snake_case) and `query` (SQL contents). Apply in order: 001 through 006.

**Option B: Supabase Dashboard** — Apply migrations in SQL Editor, in order:

**001_initial_schema.sql** — Creates:
- **profiles** — `user_id`, `is_admin` (identifies admins)
- **projects** — `user_id`, `name`, `data` (JSONB)

The migration does **not** include the first admin insert. Do that in step 4.

**002_pdf_storage.sql** (Phase 2) — Adds:
- `pdf_path` column to `projects`
- Private `pdfs` storage bucket (if the insert fails, create it manually: Dashboard > Storage > New bucket, name `pdfs`, private)
- RLS policies so users can upload/read/delete only their own PDFs (path: `{user_id}/{project_id}/document.pdf`)

**003_admin_list_users_rpc.sql** — Creates `list_users_for_admin()` RPC. Run this if admins see 401 when loading the user list in User Settings. The RPC bypasses Edge Function gateway JWT verification.

**004_project_size.sql** — Adds `size_bytes` column to `projects` for displaying project size (MB) in the Load Project modal.

**005_admin_list_projects_rpc.sql** — Creates `list_projects_for_admin()` RPC for admins to list all projects across users (used by Manage Projects in Project Settings).

**006_pdf_hash.sql** — Adds `pdf_hash` column to `projects` for hash-based skip on upload (avoids re-uploading unchanged PDFs) and IndexedDB cache validation.

## 3. Deploy Edge Functions

Admin functions use `verify_jwt = false` in `supabase/config.toml` so the gateway does not reject requests; each function validates auth in-code via `getUser()`.

**Option A: Supabase MCP** (if available): Use the MCP server to deploy `admin-create-user`, `admin-delete-user`, `admin-delete-project`, and `admin-list-users`.

**Option B: Supabase CLI**:

```bash
supabase link   # link to your project
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-delete-project
supabase functions deploy admin-list-users
```

**401 on admin functions:** The gateway verifies JWT by default and can reject valid tokens. You must deploy with `--no-verify-jwt`:

```bash
supabase link --project-ref YOUR_PROJECT_REF   # ref = part before .supabase.co in your URL
supabase functions deploy admin-list-users --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
supabase functions deploy admin-delete-project --no-verify-jwt
```

Each function still validates auth in-code via `getUser()`.

## 4. Create First Admin

1. In Supabase Dashboard > Authentication > Users, click "Add user" > "Create new user"
2. Enter admin email and password
3. Copy the new user's UUID
4. Run the following in SQL Editor (replace `YOUR_ADMIN_USER_UUID`):

```sql
insert into public.profiles (user_id, is_admin)
values ('YOUR_ADMIN_USER_UUID', true)
on conflict (user_id) do update set is_admin = true;
```

## 5. Configure the App

1. Create `config.js` from `config.js.example` (or create it with `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`)
2. Add your Supabase URL and anon key
3. Ensure `<script src="config.js"></script>` is in `index.html` head, before the pdf.js script

## Limits

- **PDF file size** — Maximum 50 MB (Supabase storage limit). Uploading a larger file shows an alert and is rejected.

## PDF Transfer Optimizations

- **Hash-based skip** — When saving, if the PDF bytes are unchanged (hash match), the upload is skipped; only project data is updated.
- **IndexedDB cache** — Loaded PDFs are cached locally (up to 10 projects, 500 MB). Repeat loads use the cache when the stored hash matches.
- **Range requests** — On cache miss, PDF.js fetches via signed URL with range requests for faster first-page display.

## Usage

- **Sign In** — Click "Sign In", enter credentials (provided by admin)
- **Save Project** — When logged in, click "Save Project", enter name. The PDF is uploaded to Storage when you save (if you uploaded one).
- **Load Project** — When logged in, click "Load Project", select from list. Projects with stored PDFs load the PDF automatically. Legacy projects (no PDF): upload your PDF first, then load.
- **Add User** (admin only) — In User Settings, create new users with email + password; share password with user. Admin-created users are auto-confirmed and can sign in immediately. If an existing user sees "Email not confirmed", confirm them in Dashboard > Authentication > Users (or run `update auth.users set email_confirmed_at = now() where email = 'user@example.com';` in SQL Editor).
- **Manage User** (admin only) — In User Settings, open Manage User to list all users and delete accounts (cannot delete yourself).
- **All Users** (admin only) — In User Settings, view all users with role and last sign-in.
- **Manage Projects** (admin only) — In Project Settings, open Manage Projects to list all projects across users and delete any project (removes project and stored PDF).

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 1: Auth + Project CRUD | Complete |
| Phase 2: PDF storage | Complete |
| Phase 3: Auto-save / sync | Not started |
| Phase 4: Sharing & collaboration | Not started |
