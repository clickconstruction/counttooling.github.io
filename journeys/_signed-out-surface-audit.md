# Signed-out Settings surface audit — 2026-08-20 (mobile gear blast radius)

Evidence input for the Journey Program (see [JOURNEY-MAP.md](../JOURNEY-MAP.md)).
Decision brief only — no code changed. Method: every claim below was either
**runtime-verified** in the real app served from clean `main` (0f58263) at 390px
viewport, signed out, Supabase enabled (production `config.js`), or is marked
*(code-read)*. Interactions were driven through the live DOM handlers; visibility
read from computed styles and confirmed by screenshot.

## The asymmetry (the confirmed finding, restated with evidence)

- **Desktop gear** — `#settingsGearBtn.onclick` (app.js:4033) checks
  `state.supabaseSession?.user`; with no session it diverts to the auth modal.
  Runtime-verified at 1280px: gear visible, click → `authModal` opens,
  `settingsModal` never does.
- **Mobile sidebar gear** — `#sidebarLogoGear.onclick` (app.js:3976) has **no
  auth check**: it retitles and calls `showModal('settingsModal')`
  unconditionally. Runtime-verified at 390px signed out: Project Settings opens,
  and from it Advanced (`#settingsAdvancedBtn`, app.js:4173).
- Width gating is pure CSS: `.sidebar-logo-icons` is `display:none` at base
  (styles.css:95) and `display:flex` only inside the `@media (max-width: 768px)`
  block (styles.css:130/165). Runtime-verified: the gear's container computes
  `none` at 1280px, `flex` at 390px. So the ungated door exists **only at
  ≤768px** — this is a width asymmetry, not a hidden desktop hole.
- The other mobile/sidebar routes are all gated correctly (runtime + code):
  `#settingsSidebarBtn` hidden unless logged in (app.js:2271),
  `#sidebarLogoUser` → `openMySettings` self-gates to auth
  (features/my-settings.js:39), `#sidebarLogoShare` hidden without a session +
  project (app.js:2373), and the burger drawer's Share/Save-status rows carry
  their own session gates (features/burger-menu.js:72–91). **The single leak is
  `#sidebarLogoGear`.**

## What a signed-out user at ≤768px actually reaches

Two runtime passes: (A) fresh boot, no PDF; (B) after a local PDF upload with one
counter mark (the realistic signed-out state — the app supports full local
takeoffs by design, AGENTS.md "Keep the app functional with Supabase disabled").

### settingsModal

| Control | Visible signed-out? | Invoked with no session — what actually happens | Class |
|---|---|---|---|
| Save Project to Cloud (`#settingsSaveProject`, the yellow primary) | yes (A+B; only `isViewer` hides it, app.js:2377) | Save modal opens and lists contents; **Save → inline "Please sign in to save."** (features/save-project.js:170–175). No server call. Runtime-verified. | Cosmetic dead-end — 2 taps deep before the sign-in ask |
| Add additional PDF pages (`#settingsAddAdditionalPages`) | B only (app.js:2358) | Routes to Prepare-PDF append on the **local** buffer (app.js:4150). Legitimate local operation. | Works, local-only, fine |
| Download PDF (`#settingsDownloadPdf`) | B only (app.js:2360) | Downloads the user's own locally-uploaded PDF (app.js:4172). | Works, local-only, fine |
| Close Project (`#settingsCloseProject`) | B only (app.js:2279) | `confirm()` then resets local session (app.js:4278–4290). Same as desktop signed-in. | Works, local-only, confirmed |
| Check out / Turn in / Force turn-in + checkout section | no — section hidden without `state.currentProjectId` (app.js:3991); signed-out users can't have one | n/a | Gated |
| Share (`#settingsShareProject`) | no — session-gated (app.js:2366) | n/a | Gated |
| **Load Project from Cloud (`#settingsLoadProject`)** | **yes** — `.supabase-only` sweep un-hides it (app.js:2256) and no `loggedIn` re-hide exists for this id | Click → `openLoadProjectModal` self-gates: no session → **auth modal** (features/load-project.js:578). Runtime-verified. | Cosmetic inconsistency (row shows, then bounces to sign-in) |
| Manage Projects (`#settingsManageProjects`) | no — admin-gated (app.js:2267) | n/a | Gated |
| quick keys (`#settingsQuickKeys`) | yes | Quick Keys modal opens; bindings are per-project local state. Runtime-verified. | Works, local-only, fine |
| keyboard shortcuts (`#settingsMacros`) | yes | Macros modal opens (app.js:3869). Runtime-verified. | Works, fine |
| Clear Page (`#settingsClearPage`) | B only (app.js:2385) | Clear-page modal on local marks (app.js:3871) *(code-read)* | Works, local-only, own confirm |
| Use groups toggle (`#settingsUseGroupsBtn`) | yes | Toggles local `groupsEnabled`; runtime-verified aria-pressed flip both ways | Works, local-only, fine |
| Advanced (`#settingsAdvancedBtn`) | yes — unconditionally shown (app.js:2383) | Opens `settingsAdvancedModal` | The door to the next table |

### settingsAdvancedModal

| Control | Visible signed-out? | Invoked with no session — what actually happens | Class |
|---|---|---|---|
| Load test PDF (`#advancedLoadTestPdf`) | localhost only — `IS_DEV_HOST` is `location.hostname === 'localhost'||'127.0.0.1'` (app.js:3045, gate 2364) | Never rendered in production | Non-issue in prod |
| Manage Icons (`#advancedManageIcons`) | yes | **Fully opens and works** — runtime-verified, 249 icon rows. Renames persist to localStorage `iconNames`; custom icons read/write the anonymous IndexedDB key (`customIconsCurrentKey()` falls back to the shared `CUSTOM_ICONS_KEY` with no uid, app.js:745–748). | Works, local-only. Directly contradicts JOURNEY-MAP.md:280 (G5) "Manage Icons requires sign-in — intended design" |
| Export Canvas (`#advancedExport`) | B only (pages + markup, app.js:2362) | Downloads local marks JSON (app.js:4179 → `#exportBtn`). | Works, local-only, fine |
| Import Canvas (`#advancedImport`) | yes (only `isViewer` hides, app.js:2389) | File picker → imports into local state (app.js:4180). | Works, local-only, fine |
| Canvas Repair (`#advancedCanvasRepair`) | B only (app.js:2387) | **Fully works** — runtime-verified: applied a 90° rotation signed out, state mutated, then **undo restored it** (`pushUndoSnapshot` before mutation, features/canvas-repair.js:83). Local-only, undoable, Cancel/Apply modal. | Works, local-only, undoable — not a destruction vector |
| **Empty cache and hard reload (`#advancedEmptyCacheReload`)** | **yes, always** (no display gate anywhere) | Handler (app.js:4182–4196) has **no auth check**: native `confirm()` ("Unsaved work will be lost." — runtime-verified it fires signed out), then deletes the entire `clickcount-pdf-cache` IndexedDB (all 10 stores — PDF cache, **takeoff backups including the signed-out `local` backup**, custom icon paths; idb.js:16) plus a long localStorage key list including `takeoff-state` and `clickcount-last-project`, then reloads. | **The one genuinely destructive control**: 3 taps + 1 native confirm erases a signed-out user's unsaved takeoff *and* its recovery backups. Identical blast for signed-in users — it is destructive by design, with an explicit warning |
| Global force reload (`#advancedGlobalForceReload`) | no — admin-gated (app.js:2269) | Triple-gated: UI hide + handler `if (!state.isAdmin) return;` (app.js:4198) + server: `admin_trigger_global_reload` is SECURITY DEFINER with an in-body `profiles.is_admin` check raising `42501`, and `anon` execute is revoked (supabase/migrations/20260521141229_global_force_reload.sql:37–42, 20260724220000_revoke_anon_rpc_execute.sql:21) | Correctly gated, server-enforced |

## Does runtime row-hiding already prune the mobile modal? (markup ≠ row)

Yes, substantially — but by **session/admin/isViewer per-row**, never by width:

- The `.supabase-only` sweep (app.js:2256) actually **un-hides** — every
  `supabase-only` element gets `display:''` when the cloud is enabled, and only
  the ids with an explicit `loggedIn` re-hide go dark. `#settingsLoadProject`
  has no re-hide, which is why it leaks (harmlessly) into the signed-out modal.
- `viewerHideIds` (app.js:2204) is **viewer-mode** hygiene, not auth hygiene —
  it hides toolbar/sidebar ids for `state.isViewer` and touches none of the
  settings-modal rows. The settings rows carry their own inline `isViewer`
  checks (app.js:2358, 2360, 2362, 2377, 2385, 2387, 2389).
- Net effect, runtime-verified: the signed-out mobile modal is *not* the full
  markup — cloud-ops rows (Share, checkout, Manage Projects, Global reload) are
  correctly absent. What remains is the local-tool set plus two cloud rows that
  self-gate on click (Save → inline error; Load → auth modal).
- *(code-read)* A **view-link viewer** at mobile width can also open the gear
  (no `isViewer` check on `#sidebarLogoGear` either); their modal is pruned
  harder by the `isViewer` row gates, but Manage Icons, Import Canvas, Empty
  cache, quick keys/shortcuts, and the groups toggle would remain. Not
  runtime-verified; worth a one-line spec if the gate direction changes.

## Risk classification — honest read

**No cloud exposure.** Nothing reachable signed-out talks to the server with
effect: Save and Load self-gate client-side before any request, and the only
server-mutating resident (Global force reload) is enforced in Postgres, not just
the UI. RLS/RPC posture is intact; this is not a security incident.

**One real local-damage vector.** Empty cache is genuinely destructive to
on-device work and its backups, is reachable signed-out in 3 taps, and its only
brake is a native `confirm()`. That is the same brake every signed-in user gets
— the control is a support remedy that is *supposed* to do this. The signed-out
delta is exposure (who can reach it), not behavior.

**Everything else is either legitimate local capability or cosmetic.** Manage
Icons, Import/Export Canvas, Canvas Repair (undoable), Clear Page (confirmed),
Close Project (confirmed), quick keys, shortcuts, groups toggle — all operate on
data the signed-out user owns locally, consistent with the app's
works-without-the-cloud design. The costs are consistency costs: the yellow
"Save Project to Cloud" primary that dead-ends two taps in, and a "Load Project
from Cloud" row shown to someone it will bounce.

## The product decision (framed, not made)

The bug is the asymmetry, and it can be resolved in either direction:

**(a) Gate mobile like desktop** — add the session check to `#sidebarLogoGear`.
- Spirit test: JOURNEY-MAP's spirit is "the surface tells the truth about what
  you can do." But desktop's gate already lies in the other direction: a
  signed-out desktop user *can* do most of what Project Settings offers
  (download their PDF, repair a canvas, manage icons, clear a page) and the
  gear pretends they can't — the auth modal is a toll booth in front of mostly
  local, toll-free roads.
- Collides head-on with Tier-2 #29 (JOURNEY-MAP.md:244 — Manage Icons already
  "buried under a word that tells trade users don't touch"): gating mobile
  removes the *only* signed-out route to Manage Icons on any width and buries
  it one gate deeper for everyone on a phone.
- Also removes the signed-out route to Empty cache — the classic "app is
  wedged" support remedy — precisely for the population (signed-out /
  can't-sign-in users) most likely to need it. Note desktop signed-out users
  have **no** route to Empty cache today; gating mobile extends that gap to all
  widths.

**(b) Ungate desktop** — drop the session check from `#settingsGearBtn` (the
mobile behavior becomes the spec).
- Spirit test: matches what the modal's own per-row gates already implement —
  the rows, not the door, know what needs a session, and they demonstrably
  handle the signed-out case (runtime table above: every cloud row either hides
  or self-gates gracefully). Arguably what Tier-2 #29 wants: Manage Icons and
  the repair/cache tools become reachable pre-sign-in everywhere, and the
  sign-in ask moves to the moment it's true (Save/Load/Share).
- Costs: the signed-out desktop gear currently doubles as a prominent "Sign In"
  affordance; ungating loses that nudge (the header Sign In button remains,
  app.js:2259). And the two self-gating rows (Save's inline error, Load's
  bounce) go from mobile-only oddities to the universal signed-out experience —
  worth tightening their copy/visibility if (b) is chosen.
- If (b) is chosen, decide deliberately whether view-link viewers keep the gear
  too (today they get it on mobile only, by the same accident).

Either way, `#settingsLoadProject` should get the same `loggedIn` re-hide as its
header/sidebar siblings (app.js:2261–2262) or its bounce embraced as intended —
right now it is the one row whose visibility is accidental in *both* modes.

## JOURNEY-MAP.md corrections owed (do not edit here — single status commit)

1. **B18 "Verified-keep" (JOURNEY-MAP.md:267)** — the now-wrong claim, exact
   text: "Advanced's remaining residents (Canvas Repair, Empty cache, Global
   force reload, dev Load test PDF) are correctly gated and genuinely advanced".
   Canvas Repair and Empty cache are reachable **signed out** at ≤768px via
   `#sidebarLogoGear` (app.js:3976); only Global force reload and Load test PDF
   are actually gated as claimed.
2. **G5 (JOURNEY-MAP.md:280)** — "Settings → Advanced → Manage Icons requires
   sign-in — intended design, undocumented cost (J4)" is false at ≤768px:
   Manage Icons opens and works signed out (runtime-verified).
