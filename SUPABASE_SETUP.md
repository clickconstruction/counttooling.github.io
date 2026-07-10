# Supabase Setup

## Overview

Phase 1 adds admin-provisioned auth and cloud project persistence. Phase 2 adds PDF storage so projects store the PDF file in Supabase Storage. Users sign in with credentials provided by an admin. Admins create users via Add User and delete users via Manage User, both in User Settings.

## 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project
2. Note your project URL and anon key (Settings > API)

## 2. Run SQL Migrations

**Option A: Supabase MCP** (recommended if you do not use the Supabase CLI): Each migration is a single file under `supabase/migrations/`. Use `list_migrations` to see what is already applied, then `apply_migration` with `name` set to the **filename without `.sql`** (e.g. `20260326230000_user_presence_and_activity`) and `query` set to the **entire file contents** of that SQL file—do not retype SQL by hand. Apply files in filename order (every file is timestamped — see **Migration file naming** below). If you previously applied 032/033 (user_artboards, now reverted), also apply 034 (`20260319192450_034_revert_user_artboards.sql`). The Dashboard SQL Editor (Option B) is equivalent: paste the same file contents there.

**Option B: Supabase Dashboard** — Apply migrations in SQL Editor, in filename (timestamp) order (same SQL as in each file under `supabase/migrations/`):

**001 — initial_schema** — Creates:
- **profiles** — `user_id`, `is_admin` (identifies admins)
- **projects** — `user_id`, `name`, `data` (JSONB)

The migration does **not** include the first admin insert. Do that in step 4.

**002 — pdf_storage** (Phase 2) — Adds:
- `pdf_path` column to `projects`
- Private `pdfs` storage bucket (if the insert fails, create it manually: Dashboard > Storage > New bucket, name `pdfs`, private)
- RLS policies so users can upload/read/delete only their own PDFs (path: `{user_id}/{project_id}/document.pdf`)

**003 — admin_list_users_rpc** — Creates `list_users_for_admin()` RPC. Run this if admins see 401 when loading the user list in User Settings. The RPC bypasses Edge Function gateway JWT verification.

**004 — project_size** — Adds `size_bytes` column to `projects` for displaying project size (MB) in the Load Project modal.

**005 — admin_list_projects_rpc** — Creates `list_projects_for_admin()` RPC for admins to list all projects across users (used by Manage Projects in Project Settings).

**006 — pdf_hash** — Adds `pdf_hash` column to `projects` for hash-based skip on upload (avoids re-uploading unchanged PDFs) and IndexedDB cache validation.

**007 — user_airboard** — Creates `user_airboard` table (one row per user) for saving counters and line types to the user's profile. Migration 031 adds `plumbing_modifiers` and `line_modifiers`. Used by Save Artboard / Load from Cloud in User Settings.

**008 — auth_profile_trigger** — Auto-creates profile and user_airboard when a new user signs up.

**009 — project_shares** — Creates `project_shares` table (project_id, user_id, role, invited_by) for sharing projects. RLS: members can read/add shares; owner, inviter, or admin can remove.

**010 — project_checkout** — Adds `checked_out_by`, `checked_out_at` to `projects` for checkout/check-in (one editor at a time).

**011 — project_rpcs** — Replaces projects RLS for sharing; adds RPCs: `check_out_project`, `check_in_project`, `force_check_in_project` (admin only), `list_accessible_projects`, `add_project_share`, `remove_project_share`, `list_project_shares`.

**012 — storage_shared_read** — Storage policy so shared users can read project PDFs.

**013 — storage_shared_read_fix** — Fixes 42P17 error: replaces inline EXISTS with `storage_can_read_shared_pdf()` SECURITY DEFINER helper. Run after 012 if shared users get "database error, code: 42P17" when loading PDFs.

**014 — fix_rls_recursion** — Fixes infinite recursion between projects and project_shares RLS. Adds `user_can_access_project()` SECURITY DEFINER helper; both tables use it instead of cross-referencing each other in policies. Run if you get "infinite recursion detected in policy for relation project_shares" when saving.

**015 — list_users_for_invite** — Creates `list_users_for_project_invite(project_id)` RPC. Returns all users (except project owner) for project members who can add shares. Used by Share Project modal dropdown.

**Realtime (optional):** Migration 017 adds `projects` for instant checkout notifications. For role promotion updates, add `project_shares` to the Realtime publication. In Dashboard: Database > Replication > Edit publication `supabase_realtime` > add `project_shares`. Without `projects` in the publication, checkout notifications fall back to visibility-based refresh when the user switches tabs.

**016 — owner_subject_to_checkout** — Owners must check out to edit (same as shared editors). RLS UPDATE policy: only checkout holder or admin can update. `list_accessible_projects` can_edit: only when user has valid checkout. Auto-checkout trigger on project insert so creator is checked out when creating a new project.

**017 — projects_realtime** — Adds `projects` table to `supabase_realtime` publication. Enables instant checkout notifications: when a user checks in, waiting users receive the update immediately and see a toast that the project is available to check out.

**018 — inactivity_checkout** — Changes checkout expiry from 12 hours to 30 minutes of inactivity. Adds `refresh_checkout_activity(project_id)` RPC; lock extends on user activity (edits, saves). Lock expires only after 30 minutes with no activity.

**019 — project_view_links** — Creates `project_view_links` (token, project_id, created_by, expires_at, name) and `view_link_access_log` (view_link_id, token, project_id, email, accessed_at) for view-only share links with email domain gate.

**020 — view_link_rpcs** — Creates `create_view_link`, `list_view_links`, `revoke_view_link`, `get_view_link_access_log` RPCs.

**021 — view_link_owner_editor_only** — Restricts `create_view_link` to owners and editors only (not viewers).

**022 — admin_see_all_projects** — Admins see all projects in Load Project from Cloud. `list_accessible_projects` includes admin in `can_check_out` and in the WHERE clause so admins can load any project.

**023 — storage_admin_read** — Storage policy so admins can read any project PDF.

**024 — admin_access_project** — Updates `user_can_access_project()` to include admins. Fixes 406 when restoring last project or loading non-owned project as admin.

**025 — admin_list_projects_checkout** — Extends `list_projects_for_admin()` to return `checked_out_by`, `checked_out_at`, `checked_out_email`. Used by Manage Projects modal for Force turn-in (admin) button on checked-out projects.

**026 — project_counts** — Adds `counter_count` and `line_count` to projects; computed on save, displayed in Manage Projects.

**027 — view_link_allow_viewers_admins** — Allows project share viewers and admins to create view links. Updates `create_view_link` to use `user_can_access_project()`.

**028 — list_project_shares_include_owner** — Extends `list_project_shares` to include the project owner in the returned list.

**029 — admin_check_out_project** — Allows admins to check out any project. Updates `check_out_project` RPC to include admin permission (aligns with `list_accessible_projects`).

**030 — list_accessible_projects_counts** — Extends `list_accessible_projects` to return `counter_count` and `line_count`. Used by Load Project modal for counts badge (X cnt · Y ln).

**031 — user_airboard_modifiers** — Adds `plumbing_modifiers` and `line_modifiers` (JSONB) to `user_airboard`. Used by Artboard Save/Load for Quick Count (Size/Type/Material) and Quick Line (Size/Material) preferences across devices.

**034 — revert_user_artboards** — Reverts the aborted user_artboards feature. Run only if you previously applied 032_user_artboards and 033_migrate_airboard_to_artboards. Drops `user_artboards` table.

**035 — list_project_shares_admin** — Updates `list_project_shares` so admins can list shares for any project (same visibility as `list_accessible_projects`).

**036 — list_accessible_projects_access_filters** — Extends `list_accessible_projects` with `owner_email` (project owner) and `my_access_role` (`owner` | `editor` | `viewer` | `admin` | `unknown`). Used by the Load Project modal for filters (Mine/Shared, role, admin owner dropdown).

**037 — remove_drop_claim_migration_entry** — Idempotent cleanup: removes orphan migration history row `drop_claim_dev_with_code` (20260306034155) if present. The original migration only ran `DROP FUNCTION IF EXISTS public.claim_dev_with_code(text);`. Safe to apply on fresh databases (no-op).

**038 — checkout_server_time** — `check_out_project` and `refresh_checkout_activity` now return `server_now` (and `checked_out_at`) in their JSONB result so the client can compute its clock offset and do checkout-expiry math against the server clock instead of the (possibly skewed) browser clock. Preserves the admin permission path from 029.

**039 — projects_updated_at_trigger** — Adds a `set_projects_updated_at()` BEFORE UPDATE trigger on `public.projects` so `updated_at` is set to `now()` server-side on every UPDATE. Makes the row mtime authoritative, eliminating multi-tab races caused by skewed client clocks when comparing IndexedDB takeoff backups against the cloud copy.

**040 — check_in_server_time** — Extends `check_in_project` and `force_check_in_project` to return `server_now` (same pattern as 038), so every check-in roundtrip also refreshes the client's `serverClockOffsetMs`.

**041 — global_force_reload** — Adds a `system_settings` key/value table (with RLS read for authenticated users) holding a `force_reload_after` timestamp, and an admin-only `admin_trigger_global_reload(reason)` RPC that bumps it. Adds `system_settings` to the `supabase_realtime` publication so open tabs see the change immediately. Clients compare the timestamp against a localStorage stamp on boot and reload (clearing the PDF IndexedDB cache + selected localStorage keys) when the server value is newer; open tabs surface a banner with a manual Reload button via the realtime subscription.

**user_presence_and_activity** — Adds `profiles.last_seen_at`; table `user_activity` (event log); RPCs `touch_presence()`, `log_user_event(text, uuid, jsonb)`, `list_user_activity_for_admin(int, uuid, timestamptz)`; extends `list_users_for_admin()` with `last_seen_at`. Used by in-app presence heartbeat and admin **Activity** on user rows.

**user_activity_summary_for_admin** — Adds RPC `list_user_activity_summary_for_admin()` returning per-user rows: `user_id`, `email`, `last_sign_in_at`, rolling event counts (`events_1d`, `events_7d`, `events_30d`) from `user_activity`. Used by the User Activity modal **Summary** tab (admin).

**list_users_for_admin_project_count** — Drops and recreates `list_users_for_admin()` with an added `project_count` (owned projects) column. Powers the **Projects** column in Manage Users / All Users (clicking the count opens a per-user Projects list, filtered from `list_projects_for_admin`).

**user_activity_detail_for_admin** — Adds the per-user activity RPC `user_activity_detail_for_admin(uuid)` returning a single jsonb: identity/presence (email, role, member-since, last sign-in/seen, project count), all-time totals, per-event-type breakdown, rolling 1d/7d/30d windows, active days (CST), distinct projects touched, and the recent timeline (with resolved project names). Security-definer; a `guard` CTE is the single auth choke point. Applied in three steps: admin-only (`…000000`), guard relaxed to **self-or-admin** so a user can view their own (`…001000`), and the recent feed widened 40 → 200 events (`…002000`). Powers the **Activity overview** modal (admin: click a user row's stacked dates or heart icon; self: User Settings → **My Activity**). The client renders it as a summary card + stat tiles + a day-grouped, run-collapsed feed.

### Migration file naming

Every migration is a single file named `YYYYMMDDHHMMSS_<label>.sql` — a 14-digit timestamp version plus a descriptive label, the format the Supabase CLI expects. The `version` recorded in `supabase_migrations.schema_migrations` is the timestamp, and it matches the filename one-to-one.

The per-migration section headers above keep the historical **sequence number** where one exists (e.g. **029 — admin_check_out_project**) purely as a human reference for the inline cross-links ("from 029", "same pattern as 038"); the file on disk and its tracking row are keyed by the timestamp, not the number. A handful of early labels still embed their old number inside the timestamped filename (e.g. `20260301171417_001_initial_schema.sql`) — that is cosmetic and fully CLI-valid.

> **History note:** earlier this repo carried a dual scheme — legacy `NNN_name.sql` files alongside Supabase-CLI timestamped twins, with the same migrations recorded twice in `schema_migrations`. That was consolidated to the single timestamped scheme above (duplicate numbered files removed; the four numbered-only migrations `038`–`041` re-timestamped), and the tracking table was reconciled to match 1:1.

On a **fresh** database, apply every file once, in filename (timestamp) order. On an **existing** database, run `list_migrations` (MCP) first and apply only what is missing. Add new migrations with the Supabase MCP `apply_migration` tool (or `supabase migration new`), always with a timestamped filename.

## 3. Deploy Edge Functions

Admin functions use `verify_jwt = false` in `supabase/config.toml` so the gateway does not reject requests; each function validates auth in-code via `getUser()`.

**Option A: Supabase MCP** (if available): Use the MCP server to deploy `admin-create-user`, `admin-delete-user`, `admin-delete-project`, `admin-list-users`, `admin-reassign-projects`, and `admin-set-password`.

**Option B: Supabase CLI**:

```bash
supabase link   # link to your project
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-reassign-projects
supabase functions deploy admin-set-password
supabase functions deploy admin-delete-project
supabase functions deploy admin-list-users
supabase functions deploy invite-to-project
supabase functions deploy get-view-project
supabase functions deploy set-view-scale
```

(Or run `./deploy-admin-functions.sh`, which deploys the admin functions with `--no-verify-jwt`.)

**401 on admin functions / CORS on invite-to-project:** The gateway verifies JWT by default and can reject valid tokens (and block CORS preflight). `config.toml` sets `verify_jwt = false` for admin functions, `invite-to-project`, and `get-view-project`. Deploy with:

```bash
supabase link --project-ref YOUR_PROJECT_REF   # ref = part before .supabase.co in your URL
supabase functions deploy admin-list-users --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
supabase functions deploy admin-reassign-projects --no-verify-jwt
supabase functions deploy admin-set-password --no-verify-jwt
supabase functions deploy admin-delete-project --no-verify-jwt
supabase functions deploy invite-to-project --no-verify-jwt
supabase functions deploy get-view-project --no-verify-jwt
supabase functions deploy set-view-scale --no-verify-jwt
```

`admin-reassign-projects` (standalone Transfer ownership) and `admin-set-password` share the same in-code admin check and the `_shared/reassignProjects.ts` ownership-move engine that `admin-delete-user`'s optional reassign uses.

Each function still validates auth in-code via `getUser()` (except `get-view-project` and `set-view-scale`, which are unauthenticated and validate the view token + email domain server-side).

**View links:** `get-view-project` validates tokens and email domain (default: clickplumbing.com). Set `VIEW_LINK_ALLOWED_DOMAINS` in Supabase Dashboard (Functions > get-view-project > Secrets) if different. The function also returns the project's `updated_at` (as `updatedAt`); the client (`initViewOnlyMode`) revalidates against the server on open and only re-renders/refreshes the view cache when it changed, so a viewer isn't pinned to a stale snapshot after the owner re-saves (the cached PDF blob is reused when its hash matches; offline falls back to the cache). The deployed function inlines its CORS headers (the repo source imports `_shared/cors.ts` — functionally identical; a CLI deploy bundles `_shared`). `set-view-scale` (same token + domain gate, also reads `VIEW_LINK_ALLOWED_DOMAINS`) lets a viewer set a page's scale for everyone: it sanitizes the scale payload and writes `projects.data.pages[i].scale` with a `viewerSet {email, at}` stamp that drives the owner's must-clear notice in the app.

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

1. Create `config.js` from `config.example.js` (or create it with `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`)
2. Add your Supabase URL and anon key
3. Ensure `<script src="config.js"></script>` is in `index.html` head, before the pdf.js script

## Limits

- **PDF file size** — Maximum 50 MB (Supabase storage limit). Uploading a larger file shows an alert and is rejected.
- **JWT expiry** — Access token expiry is set to 10 hours (Dashboard > Auth > JWT Settings). This reduces "session expired" issues during long work sessions. If users still see sync failures, they can refresh the page to continue.

## PDF Transfer Optimizations

- **Hash-based skip** — When saving, if the PDF bytes are unchanged (hash match), the upload is skipped; only project data is updated.
- **IndexedDB cache** — Loaded PDFs are cached locally (up to 10 projects, 500 MB). Repeat loads use the cache when the stored hash matches.
- **Range requests** — On cache miss, PDF.js fetches via signed URL with range requests for faster first-page display.

## Usage

- **Sign In** — Click "Sign In", enter credentials (provided by admin). If you have a saved artboard, it is restored automatically.
- **Name / Upload / Save Project to Cloud** — When logged in, click "Name / Upload / Save Project to Cloud", enter name. The PDF is uploaded to Storage when you save (if you uploaded one).
- **Load Project** — When logged in, click "Load Project", select from list. Projects with stored PDFs load the PDF automatically. Legacy projects (no PDF): upload your PDF first, then load. Use search and filters (Show: All / Mine / Shared; My access: Owner / Editor / Viewer / Admin; admins with multiple owners can filter by owner). Filters strip can be collapsed via **Filters** (preference in `localStorage` key `loadProjectFiltersExpanded`).
- **Add User** (admin only) — In User Settings, create new users with email + password; share password with user. Admin-created users are auto-confirmed and can sign in immediately. If an existing user sees "Email not confirmed", confirm them in Dashboard > Authentication > Users (or run `update auth.users set email_confirmed_at = now() where email = 'user@example.com';` in SQL Editor).
- **Manage User** (admin only) — In User Settings, open Manage User to list all users with role, an owned-**Projects** count, and last sign-in / last active. Per-row actions: **Set password** (🔑, reset any user's password via `admin-set-password`), **Transfer projects** (⇄, move all of a user's projects to someone else via `admin-reassign-projects`), **View activity** (♥, opens the activity overview), and **Delete**. Delete opens a dialog offering to either delete the user's projects too or **reassign** them to another user first (`admin-delete-user` with `reassignToUserId`). Click a user's **Projects** count to see their project list (name + last-edited), or their stacked **dates** cell / heart icon to open the **Activity overview**. Reassign/transfer moves the project rows *and* their owner-scoped PDF storage objects, preserves inherited view links, and clears redundant shares. You cannot delete yourself.
- **All Users** (admin only) — In User Settings, view all users with role, project count, last sign-in / last active, and per-row **View activity**.
- **My Activity** — In User Settings, any signed-in user can open **My Activity** to see their own activity overview (member-since, total events, counters/lines/exports, active days, rolling windows, and a day-grouped recent-activity feed). Backed by `user_activity_detail_for_admin` (self-or-admin guard).
- **Manage Projects** (admin only) — In Project Settings, open Manage Projects to list all projects across users and delete any project (removes project and stored PDF).
- **Share** — In Project Settings, open Share to add users by email (viewer or editor). Any project member can add users. Editors can check out to edit; one editor at a time. Turn in releases the lock. 30-minute inactivity expiry (lock extends on edits/saves). System admins can force turn-in any project.
- **View links** — In Share modal, view links section: Create view link (copy URL), list links, Access log (email, timestamp), Revoke. Recipients open the link, enter email (clickplumbing.com domain required), view plans. No sign-in. Cached in IndexedDB for repeat mobile visits. While viewing, the header **eye button (Hide marks)** peels the takeoff overlay off so they can read the bare drawing, then tap again to bring it back; the choice is remembered for that link. The **Copy to /Tooling** export also appends this view link as a trailing `View link:` footer (reusing an existing link, or creating one), so a pasted bid in PipeTooling / TakeoffTooling can link back to the source takeoff; revoking the link clears the export's cached copy.
- **Save Artboard** — In User Settings, save your counters, line types, and modifiers (Quick Count Size/Type/Material, Quick Line Size/Material) to your account. They are restored when you sign in on any device.
- **Load from Cloud** — In User Settings, replace your current artboard with the saved version from your account (counters, line types, modifiers).
- **Download PDF** — Project Settings "Download PDF" downloads the current project's PDF as-is. Prepare PDF modal "Download" downloads the edited PDF (with page deletions applied).

## Dev / Testing (localhost only)

- **Load test PDF** — In Project Settings > Advanced, a "Load test PDF" button fetches a sample PDF and opens the Prepare PDF modal. Visible only when served on localhost or 127.0.0.1.
- **Dev auth bypass** — For automated testing: add `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD` to `config.js` (create a test user in Supabase first). Then either:
  - Navigate to `http://localhost:PORT?devAuth=1` to auto sign-in on load, or
  - Open Sign In and click "Sign in as test user".

## Save debug logging (troubleshooting)

When diagnosing slow or failing cloud saves / auto-saves, enable structured `[SaveDebug]` lines in the browser console:

1. **Without redeploy:** open DevTools Console, run `localStorage.setItem('clickcount-debug-save', '1')`, then reload the page.
2. **In config:** set `window.CLICKCOUNT_DEBUG_SAVE = true` in `config.js` (copy from [config.example.js](config.example.js)) and reload.

Then reproduce the issue and capture logs (phases include `autosave.payload`, `autosave.request.start` / `request.ok` / `request.timeout`, `manual.save.*`, and payload size). Disable with `localStorage.removeItem('clickcount-debug-save')` or by removing the config flag.

For diagnosing **checkout / edit-session expiry after an idle tab**, additional phases are emitted:

- `probe.start` / `probe.ok` / `probe.expired` / `probe.error` — server-side lock probe via `refresh_checkout_activity` RPC (`probeCheckoutLock`). Logged with `runId`, `ageMs` (since `state.checkedOutAt`), and `roundTripMs`.
- `keepalive.tick` / `keepalive.skip` / `keepalive.expired` — the visible-tab keep-alive interval (`CHECKOUT_KEEPALIVE_MS`, every 10 minutes). Skip reasons: `not_visible`, `viewer`, `suspended`, `debounced`.
- `visibility.hidden` / `visibility.visible` — consolidated `visibilitychange` handler. Hidden side logs `autoSaveDirty` and whether a project is loaded. Visible side logs `hiddenForMs`, `sessionRefreshOk`, `probeResult` (`ok` | `expired` | `error` | `null`), and `permsRefreshed`.
- `autosave.suspended` / `autosave.resumed` — autosave loop halted after `CHECKOUT_EXPIRED` (`suspendAutoSaveUntilCheckout`), resumed on successful re-checkout. `autosave.resumed` includes a `trigger` (`header_banner_checkout` | `settings_checkout`).
- `autosave.skip { reason: 'checkout_expired', mode: 'probe' | 'hard_skew' }` — autosave preflight decided expiry via probe (25–31 min boundary) or unconditionally (>31 min, clock skew shortcut).
- `manual.save.expired { mode: 'probe' | 'hard_skew' }` — SaveProject modal expiry preflight.

In the Save Status modal (`saveStatusModal`), `pushSaveEvent('keepalive_expired')` rows mark a passive expiry detected by the keep-alive interval, separate from `pushSaveEvent('checkout_expired')` which is raised by save preflight or Turn In paths.

## CI / Automated Testing

Cloud tests (Load Project delete, empty PDF flow) require Supabase and a test user. To run them:

1. **Create a test user** in Supabase Dashboard > Authentication > Users (or via Add User as admin).
2. **Set environment variables** as secrets in your CI:
   - `SUPABASE_URL` — Your Supabase project URL
   - `SUPABASE_ANON_KEY` — Your anon key
   - `DEV_AUTH_EMAIL` — Test user email
   - `DEV_AUTH_PASSWORD` — Test user password
3. **Run** `npm run test:cloud` — This runs `precloudtest` (generates `config.js` from env) then the load-project specs.
4. **Optional:** `BASE_URL` — Defaults to `http://localhost:3456`; override if your dev server uses a different URL.

Tests skip gracefully when Supabase or dev auth is not configured.

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 1: Auth + Project CRUD | Complete |
| Phase 2: PDF storage | Complete |
| Phase 3: Auto-save / sync | Complete (5s auto-save when dirty, localStorage + IndexedDB backups, sync hardening — see CHANGELOG.md) |
| Phase 4: Sharing & collaboration | Complete (checkout/turn-in, 30min inactivity expiry, admin force turn-in) |
| Phase 5: View links | Complete (email domain gate, access log, IndexedDB cache) |
