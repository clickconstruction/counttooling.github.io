# Supabase Setup

## Overview

Phase 1 adds admin-provisioned auth and cloud project persistence. Phase 2 adds PDF storage so projects store the PDF file in Supabase Storage. Users sign in with credentials provided by an admin. Admins create users via Add User and delete users via Manage User, both in User Settings.

## 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project
2. Note your project URL and anon key (Settings > API)

## 2. Run SQL Migrations

**Option A: Supabase MCP** (if available): Use `list_migrations` to see applied migrations, then `apply_migration` with each migration's `name` (snake_case) and `query` (SQL contents). Apply in order: 001 through 029.

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

**007_user_airboard.sql** — Creates `user_airboard` table (one row per user) for saving counters and line types to the user's profile. Used by Save Artboard / Load from Cloud in User Settings.

**008_auth_profile_trigger.sql** — Auto-creates profile and user_airboard when a new user signs up.

**009_project_shares.sql** — Creates `project_shares` table (project_id, user_id, role, invited_by) for sharing projects. RLS: members can read/add shares; owner, inviter, or admin can remove.

**010_project_checkout.sql** — Adds `checked_out_by`, `checked_out_at` to `projects` for checkout/check-in (one editor at a time).

**011_project_rpcs.sql** — Replaces projects RLS for sharing; adds RPCs: `check_out_project`, `check_in_project`, `force_check_in_project` (admin only), `list_accessible_projects`, `add_project_share`, `remove_project_share`, `list_project_shares`.

**012_storage_shared_read.sql** — Storage policy so shared users can read project PDFs.

**013_storage_shared_read_fix.sql** — Fixes 42P17 error: replaces inline EXISTS with `storage_can_read_shared_pdf()` SECURITY DEFINER helper. Run after 012 if shared users get "database error, code: 42P17" when loading PDFs.

**014_fix_rls_recursion.sql** — Fixes infinite recursion between projects and project_shares RLS. Adds `user_can_access_project()` SECURITY DEFINER helper; both tables use it instead of cross-referencing each other in policies. Run if you get "infinite recursion detected in policy for relation project_shares" when saving.

**015_list_users_for_invite.sql** — Creates `list_users_for_project_invite(project_id)` RPC. Returns all users (except project owner) for project members who can add shares. Used by Share Project modal dropdown.

**Realtime (optional):** Migration 017 adds `projects` for instant checkout notifications. For role promotion updates, add `project_shares` to the Realtime publication. In Dashboard: Database > Replication > Edit publication `supabase_realtime` > add `project_shares`. Without `projects` in the publication, checkout notifications fall back to visibility-based refresh when the user switches tabs.

**016_owner_subject_to_checkout.sql** — Owners must check out to edit (same as shared editors). RLS UPDATE policy: only checkout holder or admin can update. `list_accessible_projects` can_edit: only when user has valid checkout. Auto-checkout trigger on project insert so creator is checked out when creating a new project.

**017_projects_realtime.sql** — Adds `projects` table to `supabase_realtime` publication. Enables instant checkout notifications: when a user checks in, waiting users receive the update immediately and see a toast that the project is available to check out.

**018_inactivity_checkout.sql** — Changes checkout expiry from 12 hours to 30 minutes of inactivity. Adds `refresh_checkout_activity(project_id)` RPC; lock extends on user activity (edits, saves). Lock expires only after 30 minutes with no activity.

**019_project_view_links.sql** — Creates `project_view_links` (token, project_id, created_by, expires_at, name) and `view_link_access_log` (view_link_id, token, project_id, email, accessed_at) for view-only share links with email domain gate.

**020_view_link_rpcs.sql** — Creates `create_view_link`, `list_view_links`, `revoke_view_link`, `get_view_link_access_log` RPCs.

**021_view_link_owner_editor_only.sql** — Restricts `create_view_link` to owners and editors only (not viewers).

**022_admin_see_all_projects.sql** — Admins see all projects in Load Project from Cloud. `list_accessible_projects` includes admin in `can_check_out` and in the WHERE clause so admins can load any project.

**023_storage_admin_read.sql** — Storage policy so admins can read any project PDF.

**024_admin_access_project.sql** — Updates `user_can_access_project()` to include admins. Fixes 406 when restoring last project or loading non-owned project as admin.

**025_admin_list_projects_checkout.sql** — Extends `list_projects_for_admin()` to return `checked_out_by`, `checked_out_at`, `checked_out_email`. Used by Manage Projects modal for Force turn-in (admin) button on checked-out projects.

**026_project_counts.sql** — Adds `counter_count` and `line_count` to projects; computed on save, displayed in Manage Projects.

**027_view_link_allow_viewers_admins.sql** — Allows project share viewers and admins to create view links. Updates `create_view_link` to use `user_can_access_project()`.

**028_list_project_shares_include_owner.sql** — Extends `list_project_shares` to include the project owner in the returned list.

**029_admin_check_out_project.sql** — Allows admins to check out any project. Updates `check_out_project` RPC to include admin permission (aligns with `list_accessible_projects`).

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
supabase functions deploy invite-to-project
supabase functions deploy get-view-project
```

**401 on admin functions / CORS on invite-to-project:** The gateway verifies JWT by default and can reject valid tokens (and block CORS preflight). `config.toml` sets `verify_jwt = false` for admin functions, `invite-to-project`, and `get-view-project`. Deploy with:

```bash
supabase link --project-ref YOUR_PROJECT_REF   # ref = part before .supabase.co in your URL
supabase functions deploy admin-list-users --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
supabase functions deploy admin-delete-project --no-verify-jwt
supabase functions deploy invite-to-project --no-verify-jwt
supabase functions deploy get-view-project --no-verify-jwt
```

Each function still validates auth in-code via `getUser()` (except `get-view-project`, which is unauthenticated and validates domain server-side).

**View links:** `get-view-project` validates tokens and email domain (default: clickplumbing.com). Set `VIEW_LINK_ALLOWED_DOMAINS` in Supabase Dashboard (Functions > get-view-project > Secrets) if different.

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

- **Sign In** — Click "Sign In", enter credentials (provided by admin). If you have a saved artboard, it is restored automatically.
- **Save Project** — When logged in, click "Save Project", enter name. The PDF is uploaded to Storage when you save (if you uploaded one).
- **Load Project** — When logged in, click "Load Project", select from list. Projects with stored PDFs load the PDF automatically. Legacy projects (no PDF): upload your PDF first, then load.
- **Add User** (admin only) — In User Settings, create new users with email + password; share password with user. Admin-created users are auto-confirmed and can sign in immediately. If an existing user sees "Email not confirmed", confirm them in Dashboard > Authentication > Users (or run `update auth.users set email_confirmed_at = now() where email = 'user@example.com';` in SQL Editor).
- **Manage User** (admin only) — In User Settings, open Manage User to list all users and delete accounts (cannot delete yourself).
- **All Users** (admin only) — In User Settings, view all users with role and last sign-in.
- **Manage Projects** (admin only) — In Project Settings, open Manage Projects to list all projects across users and delete any project (removes project and stored PDF).
- **Share** — In Project Settings, open Share to add users by email (viewer or editor). Any project member can add users. Editors can check out to edit; one editor at a time. Turn in releases the lock. 30-minute inactivity expiry (lock extends on edits/saves). System admins can force turn-in any project.
- **View links** — In Share modal, view links section: Create view link (copy URL), list links, Access log (email, timestamp), Revoke. Recipients open the link, enter email (clickplumbing.com domain required), view plans. No sign-in. Cached in IndexedDB for repeat mobile visits.
- **Save Artboard** — In User Settings, save your counters and line types to your account. They are restored when you sign in on any device.
- **Load from Cloud** — In User Settings, replace your current artboard with the saved version from your account.

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 1: Auth + Project CRUD | Complete |
| Phase 2: PDF storage | Complete |
| Phase 3: Auto-save / sync | Not started |
| Phase 4: Sharing & collaboration | Complete (checkout/turn-in, 30min inactivity expiry, admin force turn-in) |
| Phase 5: View links | Complete (email domain gate, access log, IndexedDB cache) |
