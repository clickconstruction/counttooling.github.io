# The Lead role, and the lock that read "is editing" for two days

Will, 2026-10-02: Wendi (an estimator) should be able to take over projects. A role under
admin and over user, "allowing her a few more clean-up tools". And: why did the Lone Star
Market bid read "grace@clickplumbing.com is editing" after Grace had been signed out for
days? Thirty minutes is the right expiry, "if it works".

Two punch rows came out of it: **STALE-LOCK** (the bug, section 1) and **LEAD-ROLE** (the
build, section 2). This file holds the detail; the rows point here.

## 1. STALE-LOCK: the lock had expired, the words had not

### What Wendi saw

Project Settings and the header read "grace@clickplumbing.com is editing", the status bar
"Viewing, grace@clickplumbing.com is editing", no Check Out button anywhere, no force
button (she is not an admin). Grace said she had been signed out for days.

### What the export says

Wendi's Save Status export (`clickcount-save-logs-2026-10-02T19-35-39-786Z.json`,
tab `murbhk04-bbnykc7n`):

```
"checkedOutEmail": "grace@clickplumbing.com",
"checkedOutAt":    "2026-09-30T16:46:16.986758+00:00",
"checkedOutAgoMs": 182962785,          // 50.8 hours
"canCheckOut":     false,
```

Three permissions refreshes inside the hour (`permsRefreshed: true` on each tab return)
all re-read the same row. Nothing of Grace's was alive: the stamp never moved.

### Why

The expiry is lazy. No server code ever CLEARS `checked_out_by`; every RPC and policy
simply stops honouring a lock whose `checked_out_at` is older than 30 minutes
(`check_out_project` takes it, the UPDATE policy refuses the old holder, `can_edit` and
`can_check_out` are computed with the same window;
`supabase/migrations/20260305030845_inactivity_checkout.sql`,
`20260927194936_get_project_permissions.sql`). So the row keeps the LAST holder's name and
stamp forever, which is harmless as long as the client treats an old stamp as "free".

The client does not. Every surface that names the holder renders `checked_out_email`
off the row and never looks at `checked_out_at`:

| Surface | Code | With a stale lock |
|---|---|---|
| Header banner | `features/turn-in.js` `renderEditStatusBanner`, the `checkedOutEmail` rung | "grace is editing" |
| Status bar | `features/status-bar.js` (`'Viewing, ' + email + ' is editing'`) | same |
| Project Settings row | `app.js` `updateSettingsCheckoutSection` (yellow dot, force button for admins only) | same |
| Load Project list | `features/load-project.js` `lockBadge`: `can_edit` → **`checked_out_email` "Locked by"** → `can_check_out` "Available" | "Locked by grace", even for the OWNER, because the email rung is tested before the available rung |
| Manage Projects | `features/manage-projects.js` `metaLine2` | "Checked out by grace" |

The only staleness test on the client is `features/restore-last-session.js` (`lockExpired`),
and it serves the owner alone. For a role with no checkout arm (overseer today), the
"Available" rung is unreachable: `can_check_out` is false by definition, so every project
anyone ever touched reads "is editing" for good.

### The fix (30 minutes stays)

1. One pure predicate, `checkoutLockIsLive(checkedOutAt, nowMs)` (true when the stamp is
   inside `CHECKOUT_INACTIVITY_MS`), in a pure module with a node test, published on `App`.
   Every surface in the table asks it before naming a holder. Stale → "Available · last
   edited by grace, 2 days ago" (an owner / editor / admin / lead gets the Check Out button
   they already get from `can_check_out`; a viewer-only role gets the words). The
   server clock (`App.serverNowMs`) is the clock, as restore-last-session already does.
2. Load Project's `lockBadge` order becomes `can_edit` → `can_check_out` → live lock → free.
3. Manage Projects' "Force turn-in" stays offered on a stale lock (it still clears the
   row), but the row says "Lock expired · last held by grace".
4. Belt and braces: an hourly `pg_cron` sweep (the pattern of
   `20260813233000_cleanup_test_accounts_cron.sql`) that nulls `checked_out_by` /
   `checked_out_at` where the stamp is older than 30 minutes. The row then says free on
   its own, the realtime UPDATE repaints every open tab, and a surface this plan missed
   cannot show a dead lock as live. Not the fix; the fix is 1 to 3.
5. A Playwright spec with a routed `get_project_permissions` answer whose stamp is two
   days old, asserting the five surfaces; the node test pins the predicate at 29 and 31
   minutes.

## 2. LEAD-ROLE: a role under admin, over user

### Today's roles

| | User | Overseer | Admin |
|---|---|---|---|
| Sees | own + shared | every project, read-only | everything |
| Edits | own + editor shares, by checkout | never (by design: a reviewer who must not touch a bid) | any |
| Extra | | Bid Board, mark reviewed | users, passwords, delete, force, global reload |

Overseer (`profiles.is_overseer`, `20260828130000..132000`) stays read-only; Will's
reviewer role is not the role Wendi needs. Lead is a fourth flag, `profiles.is_lead`.

### What a Lead can do (Will's call, 2026-10-02: yes to reassign and shares)

| Capability | User | Overseer | **Lead** | Admin |
|---|---|---|---|---|
| See every project (Load Project, Bid Board) | shared only | ✓ | ✓ | ✓ |
| Open any project read-only, download its PDF | shared only | ✓ | ✓ | ✓ |
| Check out any project (a free or expired lock) | own / editor | – | ✓ | ✓ |
| Force turn-in a LIVE lock | – | – | ✓ | ✓ |
| Add / remove a project's editors and viewers | own | – | ✓ | ✓ |
| Hand ONE bid to another estimator (owner change) | – | – | ✓ | ✓ |
| Mark a bid reviewed | – | ✓ | ✓ | ✓ |
| Manage users, set passwords, delete users | – | – | – | ✓ |
| Delete projects, global force reload, others' User Activity | – | – | – | ✓ |

Clean-up tools, nothing that touches accounts or destroys data.

### Build

**Migration** (one file, mirrors the overseer set):
- `profiles.is_lead boolean not null default false`, column comment.
- SELECT policy on `projects` and the `pdfs` storage read policy, copied from the overseer
  pair with `is_lead`.
- The lead arm beside the admin arm in: `check_out_project`, `force_check_in_project`,
  `can_check_out` in `list_accessible_projects` AND `get_project_permissions` (the two must
  stay copies of each other), both functions' WHERE clause, `my_access_role` (report
  `'lead'`), `add_project_share` / `remove_project_share` / `list_project_shares`,
  `set_project_review_status` ('reviewed' arm).
- `admin_set_lead(uuid, boolean)` (admin-guarded, the Manage Users toggle's backend);
  `list_users_for_admin` gains `is_lead` and the label `Admin > Lead > Overseer > User`.
- **Per-project owner change is new.** Today's reassign is bulk (`admin-reassign-projects`:
  every project of user A to user B, admin only, through `_shared/reassignProjects.ts`,
  which also moves the owner-scoped PDF storage objects). Lead needs
  `reassign_project(p_project_id, p_to_user_id)` for ONE project: owner / lead / admin
  may call it; it changes `projects.user_id`, moves the PDF object to the new owner's
  prefix (or the Edge Function does, since storage moves need the service role: decide
  when building; the Edge Function route reuses `reassignProjects.ts` with a project
  filter), keeps the shares, logs a `project_reassigned` user event (allowlist migration
  if the type is new: `log-user-event-allowlist.test.js`).
- Apply with the Supabase MCP or the CLI (`AGENTS.md` "Supabase migrations"); redeploy
  `admin-list-users` (its role mapping mirrors `list_users_for_admin`).

**Client**:
- `state.isLead` loaded beside `isOverseer` at the five profile reads in app.js, cleared
  with them on sign-out; carried in the save-logs envelope's `user` block.
- Two predicates on `App`, so the next role is one line: `App.canOversee()` (admin,
  overseer, lead: Bid Board, owner filter in Load Project, every-project list) and
  `App.canTakeOver()` (admin, lead: force button in Project Settings and Manage Projects,
  Check Out on any project, share management, the owner-change control). The ~15
  `state.isAdmin` reads that mean "take over" switch to the predicate; the ~10 that mean
  "manage accounts" (Manage Users, passwords, delete, global reload, others' activity)
  stay `state.isAdmin`. Manage Projects itself is admin-only today because it deletes;
  Lead gets its take-over actions where the project already shows (Project Settings'
  checkout row, the Load Project row), not the delete list.
- Manage Users: a second toggle beside the overseer eye (a "lead" badge icon), on
  `admin_set_lead`.
- Copy: the force-notice modal's "An admin turned this project in" and the Manage
  Projects button's "(admin)" lose the word; "A lead or admin turned this project in".
  save-engine.js's demotion classifier comments say "only admins can break a live lock";
  update them (the logic is unchanged: a live lock cleared by someone else is a force).
- Share dialog (`features/share-links.js`, the `add_project_share` caller): opens for a
  lead on a project they do not own.
- Owner change: a "Hand to…" control on the Project Settings checkout row for lead / admin,
  a user picker from `list_users_for_admin` (lead needs a lighter list: a
  `list_estimators()` RPC returning id + email for authenticated leads/admins, so the
  admin-only user list stays admin-only).

**Tests**: node tests for the migration's SQL are not possible; the spec suite routes the
RPCs. `lead-role.spec.js`: a routed profile with `is_lead`, the Bid Board link shows, the
force button shows on a live lock, Check Out shows on a stale lock, Manage Users is hidden.
`manage-users.spec.js` gains the toggle. `save-engine.test.js` is untouched (the engine
reads `can_edit` / `can_check_out`, never the role).

**Docs**: SUPABASE_SETUP.md migration list; AGENTS.md "Cloud state" (`state.isLead`) and
"Save / sync" (force turn-in: admin or lead); ARCHITECTURE.md Files rows for any new file;
FEATURES.md one line.

**Then**: flip Wendi (the Manage Users toggle, or `select admin_set_lead('<wendi>', true)`).

### Order

STALE-LOCK first (small, and it is the bug Wendi reported), then LEAD-ROLE's migration,
then its client pass, then the owner change as its own PR (it is the one piece with a
storage move in it).

**STALE-LOCK landed 2026-10-02** (CHANGELOG "fix(checkout): an expired lock reads as
Available"): the predicate, the five surfaces, the sweep migration, the node test and
stale-lock.spec.js, as planned above. The holder's words live in features/turn-in.js
(`App.isCheckoutLockLive`, `App.checkoutHolderText`).

**LEAD-ROLE landed 2026-10-02** (CHANGELOG "feat(roles): Lead"): the migration
`20261002210000_lead_role.sql` on prod, `App.canOversee` / `App.canTakeOver`, the Manage Users
toggle, Hand to… (features/hand-off.js, `reassign_project`), lead-role.spec.js. Left for the
owner: `supabase functions deploy invite-to-project --no-verify-jwt --use-api`, and the
toggle on Wendi's row.
