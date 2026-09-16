# TO DO — hand-off of the remaining build queue (written 2026-09-13)

> **COMPLETE 2026-09-14.** D19–D25 shipped (Wave 3), the after-the-queue items are ticked below. What is still open is not a build: the three `[decision]` slots in [_STAGE6.md](_STAGE6.md), the day-7 telemetry re-read on 2026-09-19, and the standing drift patrol.
>
> **Re-opened 2026-09-14 (evening) with one unit:** [D26 — drift patrol after the sample-plan promotion](#d26--drift-patrol-after-the-sample-plan-promotion). The candidate-A hand-off below shipped the same day (CT #94).
>
> **Re-opened 2026-09-15 with a field fix shipped DORMANT:** [R1 — review: our own Turn In was reported as an admin force](#r1--review-our-own-turn-in-was-reported-as-an-admin-force) (PR #97, merged to main behind the per-device flag `?ff=self-release`; OFF for everyone). **Open, in order:** [R1-TEST — a tester walks it on counttooling.com](#r1-test--a-tester-walks-the-fix-on-counttoolingcom-own-login) → [R1-FLIP — make it live for everyone](#r1-flip--make-the-fix-live-for-everyone-after-r1-test) → the side finding [R2 — 13 client event types 400 against the deployed `log_user_event` allowlist](#r2--13-client-event-types-400-against-the-deployed-log_user_event-allowlist) (needs a migration; Will's go). **Until R1-FLIP lands, wendi's bug is still live.**

> Will's call: stop after D18 lands; the rest is handed to whoever picks it up
> next (a person or a fresh Claude session). Every unit below is a complete
> brief — read this file, the ledger row, and the cited plan sections, and
> you can run the unit without any of the conversation that produced it.
> Decisions are already made (Will, 2026-09-13, "Build it all" after the
> ratchet pass); nothing here needs a product call unless a row says ⚑.

## How a unit runs here (the loop that shipped D1–D18)

1. **One unit at a time.** Cut `claude/<unit-branch>` from the latest `main`
   (`git pull --ff-only origin main` first). Never commit on `main` directly;
   never touch a checkout another session is using.
2. **Read completely** before editing: the unit row in
   [_INDEX-DUCT.md](_INDEX-DUCT.md) (Wave 3 table), the JOURNEY-MAP.md Tier-3
   row B19 (its "Ratchet 2026-09-13" clause wins over the original wording),
   [_STAGE6.md](_STAGE6.md) for the X-rows, the J19 dossier
   [../duct-takeoff.md](../duct-takeoff.md) for reproductions, and AGENTS.md.
   Re-grep every file anchor — the codebase moves daily.
3. **Tests are the deliverable, not an afterthought:** a `*.spec.js` per unit
   (Playwright; from a `.claude/worktrees/*` checkout use
   `--config=playwright.worktree.config.js`), node tests for any pure logic,
   deliberate updates to any byte-pinned copy specs.
4. **Gates before merge:** `npm run test:unit`, the unit's targeted specs,
   `npm run check` (every step green; regenerate toc/filemap/guides/sw with
   the build scripts — never hand-edit sw.js), then ONE full Playwright suite
   run to completion with a real exit code (redirect to a log file; never pipe
   through `tail`; a full suite outlasts a 10-minute shell cap, so run it
   detached and poll).
5. **Test-environment gotchas** (they have bitten every session): another
   session may leave an orphaned `serve` on port 3456 — `lsof -nP -iTCP:3456
   -sTCP:LISTEN`; if a listener you didn't start exists, check its cwd, and
   never run concurrently with someone else's Playwright (reuseExistingServer
   would test the WRONG tree). A fresh worktree needs the gitignored
   `config.local.js` (an 8-byte stub, copy from any sibling worktree) or every
   console-clean spec 404-fails.
6. **Merge, gate, push, verify live:** `git merge --no-ff` into `main`
   (sw.js conflicts: take one clean side, then `node scripts/build-sw.js`;
   ARCHITECTURE.md conflicts are generated counts — take either side and run
   `npm run build:filemap && npm run build:toc`), full suite again on the
   merged tree, push at the checkpoints marked below, then confirm
   `curl -s https://counttooling.com/sw.js | grep CACHE_VERSION` matches the
   pushed sw.js. Flip the ledger row in _INDEX-DUCT.md in the same commit.
7. **Commit style:** one-topic branches, house commit messages, trailer
   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
8. **Never** apply a Supabase migration or push to production without Will's
   explicit go; create-only until then. None of the units below needs one.

## The remaining units, in order

### D19 — B19 part 2 (Tier-3 papercuts, ratcheted)  · push after
Branch `claude/duct-d19-b19b`. Six items, all on existing surfaces:
1. **"More ▸ air & mounting" disclosure** on the counter Create tab and Quick
   Count: the CFM / Flex drop / Mount height fields fold under it; it opens by
   itself on HVAC and Electrical trade profiles and remembers its state per
   project. (Hiding the fields outright was rejected: the FIRST CFM device on a
   fresh project would be impossible to create.) Legend Settings' duct toggles
   (show duct rows / ghost) appear only once a duct run exists.
2. **Delete Area** previews and removes duct runs and their fittings
   (`deleteZonePreview` + the delete walk enumerate counters/lines/notes/zones/
   rooms today — add ductRuns/ductFittings), one undo snapshot; preview text
   `… 1 duct run (61' · 438 lb, 2 fittings)`.
3. **Email Bid Check block** (Copy Summary): skip rows whose verdict is `na`
   (the panel's setup hints); verdict rows and manual rows only.
4. **Flex leaders:** attached CFM devices paint a dashed leader from the
   device to its run (the vocabulary the DUCT-PLAN mockup used); an unattached
   device shows no leader — attachment becomes visible instead of announced;
   right-click a stray device → "Attach to nearest run" (or tap the run while
   the device is selected). Attachment rule lives in duct-model §3c.
5. **Footer at ~1380 px:** compact the local-save stamp ("Saved · 9:46 PM")
   BEFORE dropping the duct hint/readout (B11's own narrow-bar rule), so the
   "S = size · length · lb" line survives with a save stamp present.
6. **Room type on the Room Size dialog** (D7 put it on Edit Room only): the
   type dropdown + derived target CFM on the dialog that draws the box.
Tests: duct-b19b.spec.js covering each; render-pixels must stay unchanged
(no duct in the fixture). Ledger checkpoint: **push after D19**.

### D20 — X3 scale re-edit in EDIT mode + J5-A parked drafts
Branch `claude/duct-d20-scale-reedit`. _STAGE6.md § "The three build
candidates" (X3) and § "Re-rank inputs" (J5-A).
- The header Set Scale button no longer hides once a scale is set: it stays in
  a "set" state reading the value (`1/4" = 1' · 18 px/ft`, the sidebar twin's
  `setScaleContent` already formats it). Clicking it opens Set Scale on the
  tab that set the scale with the current value preloaded (preset highlighted
  / custom value filled / two-point offering "re-verify"). Delete the hide
  rule (styles.css + app.js updateUI). The sidebar twin stays for now.
- J5-A: `setScaleClick` (features/scale.js) sets Move and clears no draft, so
  a polyline / quick-line draft survives "in Move" with dead clicks. Generalize
  the duct guard: a live draft is PARKED for the modal and RESUMES on
  close/cancel; Esc still pops one vertex. Spec: draft survives S → Cancel and
  commits normally afterwards.
Tests: scale-reedit.spec.js; update scale.spec.js pins deliberately.

### D21 — J5-D trade-aware strip + "Pin to strip"  · push after
Branch `claude/duct-d21-strip`. Decision: option (b). The trade profile
(HVAC / Electrical / Plumbing Quick profiles already exist) seeds which
drawing tools sit inline in the header strip vs behind the ⋯ overflow
(features/header-more.js `OVERFLOW_TOOLS`, D14 added `strip:true` for Duct):
HVAC shows Duct inline and Polyline in ⋯; Plumbing the reverse. The ⋯ menu
gains a per-tool "Pin to strip" / "Unpin" that overrides the profile and is
remembered per project (`state.stripPins`). The strip must never re-order on
its own mid-session (only on profile change or a pin). Mobile: B9's padded
scroll unchanged. Tests: header-strip-trade.spec.js (each profile's inline
set, pin persists across reload, no reorder on tool use). Checkpoint: **push
after D21**.

### D22 — X2 mobile peek
Branch `claude/duct-d22-mobile-peek`. _STAGE6.md X2. In the phone footer
layers menu (`#canvasLayersBtn` → `#canvasMenu`, features/canvas-layers.js)
add a "Show all layers" row toggling the existing `state.showAllCanvases`,
shown only when the page has 2+ layers (the flag auto-clears below that —
canvas-switcher.js). Rename the menu title "Canvases" → "Layers" (B4
dialect). No new state. Tests: mobile viewport spec (B9's mobile-touch
pattern). Size S.

### D23 — X1 zone handles  · push after
Branch `claude/duct-d23-zone-handles`. _STAGE6.md X1. In Move, a scale zone or
multiply zone drags to move (body) and resizes (corner handles), cursor swap
as the only chrome; the label / multiply factor re-tally live; one
`pushUndoSnapshot` per drag. hitTest rung sits AFTER T2-03's
`if (state.hideMarks) return null`; must coexist with the 280 ms aim loupe
(T2-10's rule for rectangle drawing) and with T2-10's drag-to-complete on the
zone TOOLS (Move only). Fold a `zone_edit` route into the existing `scale_set`
zone-flavor event if trivial. Tests: zone-handles.spec.js (move, resize,
re-tally, undo, loupe coexistence, hideMarks inert). Size M. Checkpoint:
**push after D23**.

### D24 — X4 option D: room names from the plan
Branch `claude/duct-d24-room-labels`. _STAGE6.md X4 option D. When a Room box
is drawn, call the D10 text-layer primitive (`App.queryPdfTextNear` /
features/tag-reader.js) for printed text inside the box; if a room-name-shaped
string is found (letters + optional number, not a dimension/callout — extend
duct-model §8's grammar with `parseRoomNameCallout`), prefill the Room Size
dialog's name with a "from the plan" note (exactly like the duct starting
size). The on-plan label then paints ONLY the totals as a small tag
(`5,670 ft³ · 450 CFM · ✓`) placed where the printed text isn't (collision
check against the text items, corner-first, then edge midpoints). Multi-box
rooms label their union once (largest box). No text layer → per-box
name-only labels (option B) silently. render-pixels: the fixture room box has
no printed text — assert baselines unchanged. Tests: room-labels.spec.js with
an in-page pdf-lib PDF carrying "OPEN OFFICE 204" inside a box.

### D25 — X6 option D: layer-aware copy  · final push + LIVE WALK
Branch `claude/duct-d25-copy-layers`. _STAGE6.md X6 option D. Copy Summary and
Copy to /Tooling: scopes become This sheet / Everything plus a layer picker
that appears only when some page has >1 layer, pre-checked to the layers
visible at copy time (active + the show-all peek set); the paste header names
the layers included ("Counts — <project> · every sheet · layers: Main, Gas").
The copy content honors the picked set; the D14 "Every layer with marks"
precedent is the visual pattern. Re-pin output.spec.js / copy-tooling-feet /
takeoff-handoff byte pins deliberately. Prerequisite noted in _STAGE6.md:
re-drive J11 Friction #2 on main first (the "(visible layers)" label vs the
mode). After merge: full gate, **final push**, live CACHE_VERSION match, and
the **LIVE WALK** on counttooling.com in a real browser (the ledger's FINAL
STEP recipe, extended: draw a zone and drag its handle; open Set Scale from
the header value; copy with two layers and read the header; trim a room name
from the plan).

## After the queue
- ☑ (early read 2026-09-14, re-read 2026-09-19) Day-7 `duct_run` telemetry look (~2026-09-19): read-only `user_activity`
  pull, note counts in _INDEX-DUCT.md — zero duct_run in prod so far, pipe healthy.
- ☑ 2026-09-14 Update JOURNEY-MAP's B19 row and _STAGE6.md `[decision]` slots to ☑ as
  units land; the KB stays true the same way the guides do. (The three product-call
  slots — X4 label design, the X6 re-drive ☑, the sequencing slot — are Will's.)
- ☑ 2026-09-14 Drift patrol again after D25 (a single-journey re-walk of J5, J6, J11 and
  J19 — the standing practice in _NEXT.md) — P3 in _INDEX-DUCT.md; its four papercuts shipped as B20.

## Sample plan A — polish hand-off (2026-09-14, for whoever knows the trade better)

> **SHIPPED 2026-09-14 (CT #94):** candidate A is the simple (design-build) sample plan on a true ANSI B sheet, the three tours / their spec / the guide screenshots re-pinned, the room schedule and the LP-1 / RTU-1 / service notes added. Plan of record: [SAMPLE-PLANS.md](SAMPLE-PLANS.md). The steps below are kept as the record of what the promotion touched.

**What it is.** `scripts/sample-plan-candidates.js` → `candidateA()`: the *simple*
plan (Suite 200 Office TI, A-101, 1/8" = 1'-0" at 12 px/ft), meant to replace
today's `samples/sample-plan.pdf` as the sheet the three tours walk. Candidate B in
the same module is the *advanced* plan and is already live
(`samples/sample-plan-advanced.pdf`, `npm run build:sample-plan-advanced`).
Candidate A is **parked: drawn, not wired** — nothing in the app or the tours reads
it yet.

**Render it.** `node scripts/sample-plan-candidates.js` writes
`samples/candidates/candidate-a-office-ti.pdf/.png` (gitignored). Drop the PDF on
the empty canvas to count on it. Room walls, doors and fixtures are plain SVG
in `candidateA()`; the fixture symbols are the helpers at the top of the file
(`wc`, `lavCtr`, `urinal`, `mopSink`, `floorDrain`, `waterHeater`, `drinkFtn`,
`stallEnc`, `door`, `dimH`/`dimV`, `scaleBar`, `titleBlock`).

**Done today (Will, live review, 2026-09-14):**
- Restrooms: stalls now ENCLOSE each water closet (`stallEnc`: partitions down to
  the wall, front line on top, adjacent stalls share a partition), water closets
  rotated to face in with the tank against the bottom wall, both stall banks
  flush off the room's LEFT wall (the first partition sits on the wall line),
  lav counters moved to the top wall clear of the door swings, the men's two
  urinals on the bottom wall beside the stalls.
- JAN. 106: mop sink and water heater in the top-right corner, clear of the door.
- Corridor C-1: the drinking fountains moved right, clear of the conference door.
- Legend: the water-heater symbol at the room's size; rows opened up under it.
- Scale labels: the graphic-scale caption read 1/4"; the sheet is drawn at 1/8"
  (12 px/ft on a 918 pt sheet). Fixed on both candidates; B's title block too.

**Still open (polish — the trade eye):**
- Corridor dimension: `dimV(112, COR_T, COR_B, "5'-0\"")` labels a 44 px band
  (3'-8" at 12 px/ft) as 5'-0". Either widen the corridor to 60 px or relabel;
  the vertical total then has to agree with 20 + corridor + 18.
- Door swings: every top-row office door swings into the corridor; check which
  way a real TI would hang them (egress usually swings out of the room).
- Break 104's counter, sink and REF are placeholders; Lobby 100 is empty.
- Restroom fixture counts against occupancy (IPC Table 403.1 for a B occupancy
  of this size) — the women's three WCs / men's two + two urinals is a guess.
- Grid bubbles / dimension strings: 24'-0" + 18'-4" + 25'-0" = 67'-4" ✓;
  re-check after any wall move.
- Whether A should keep today's room NAMES and numbers (MEN 105 / WOMEN 106 /
  OPEN OFFICE 104 …) so the tours' scripts change as little as possible — a
  decision before adoption, not after.

**Adopting A (when the polish is done) — the cost is the tours, not the drawing:**
1. Fold `candidateA()` into `scripts/build-sample-plan.js` (or point it at the
   module) and regenerate `samples/sample-plan.pdf`.
2. Re-derive the tour targets in `features/tutorial.js` (PDF pts = SVG px × 0.75):
   `DIM_20FT` (the proved dimension), `WC_SPOTS`, `LAV_SPOTS`, `RFI_SPOT`,
   `OPEN_OFFICE`, `DIFFUSER_SPOTS`, `MAIN_VERTICES`, `RECEPTACLE_SPOTS`,
   `CHAIN_SPOTS`, and every step body that names a room ("Men 105", "Women
   106", "OPEN OFFICE 104").
3. Re-tune `takeoffSetup` / `roomSetup` in `scripts/build-screenshots.js` and
   regenerate the guide screenshots (`npm run build:screenshots`).
4. Re-pin the six specs that read the sheet's geometry: copy-tooling-feet,
   render-worker, scale-modal-clamp, tutorial, zoom-no-updateui-during-gesture,
   zoom-canvas-cap.
5. The house loop: targeted specs + `npm run check` per unit, the full suite at
   the push, a live walk of all three tours before calling it done.

## R1 — review: our own Turn In was reported as an admin force

Branch `claude/self-turn-in-not-a-force`, cut from main @ 55bca6d (PR #95), **open as
PR #97** (2026-09-15, NOT merged) and written to ship **DORMANT behind the per-device flag
`?ff=self-release`** — Robert's call: another individual tests it on the real site before
it goes live for anyone. With the flag off, prod behaves exactly as before (a fifth node
test pins that). **Review pass 2026-09-15** (a second session, at the owner's ask "what
else would this touch?"): the diff was re-read against main rather than taken from this
brief; the AND-gate dormancy was verified line by line, `doTurnIn`'s flush-before-release
confirmed (so the skipped post-release flush loses nothing), `pushSaveEvent` confirmed to
be the in-app log only (so the two new event kinds need no allowlist migration and are
untouched by R2), and ONE real gap was found and closed — see the project scope below.
The test is [R1-TEST](#r1-test--a-tester-walks-the-fix-on-counttoolingcom-own-login);
making it live is [R1-FLIP](#r1-flip--make-the-fix-live-for-everyone-after-r1-test).
Written by the session that diagnosed it; nothing below depends on that conversation.

### The report
wendi@clickplumbing.com, 2026-09-15, through Robert: "count tooling keeps kicking me
to view only after i check things out", screenshot of the force-turn-in notice
(`#forceTurnInNoticeModal`: "An admin turned this project in while you had it
checked out. You're now viewing only.") over "PONLY Palmer winery Plans 2".

### What the evidence showed (Supabase project `mep-plans-markup`, all read-only)
- Palmer is her own project, no `project_shares` rows; the only admin (robert@) was last
  seen 2026-09-14; one live `auth.sessions` row (Mac Chrome). No second device, no
  admin action, no shared login.
- Edge logs 16:34–16:48 UTC from her IP/UA: `check_out_project` 16:34:56, 16:35:34;
  `check_in_project` 16:35:53 and 16:36:04 with an EMPTY `x-client-info` header (the
  engine's raw-fetch fallback, which only `doTurnIn` uses for check-in), each ~3 s after a
  `check_out_project`; `check_out_project` 16:37:26; `check_in_project` 16:48:35 with
  the supabase-js header (`checkInCurrentProjectIfHeld`, i.e. close / load another). The
  request "pairs" in the log are CORS preflights (OPTIONS+POST), not two tabs.
- **Not explained:** the two check-outs at 16:34:56 and 16:35:34 with no check-in
  between. Edge logs don't carry RPC bodies; the first may have returned `ok:false`, or
  been a different project (she reloaded the app three times 16:22–16:27:
  `restore_prompt_shown`, `session_start` ×2 in `user_activity`). Doesn't change the
  diagnosis; recorded so nobody thinks it was checked.
- `user_activity` has NO `project_close` rows for anyone — see R2.

### The reproduction (prod-identical shell, `CACHE_VERSION 5834c3a8c8d2`, test account)
Save & Open the advanced sample plan (creates + checks out) → click the header
`[Turn In]` → Save Status log: `turn_in_ok`, `force_turn_in`, `force_turn_in`; the
notice opens in the releasing tab on top of the "Project turned in." toast. Every time.

### Root cause
`doTurnIn` (save-engine.js) never clears `state.checkedOutBy`; `doTurnInAndHandleResult`
(features/turn-in.js) learns the release from `refreshProjectPermissions`, which ALSO
runs from the `projects` realtime UPDATE the check-in caused. Both refreshes see
`prevWasCheckedOut && isViewer`, lock not stale → the 2026-09-01 classifier's "GENUINE
FORCE" branch (`cf90903`), whose premise "only admins can break a LIVE lock" is false:
the holder can (`check_in_project`), and so can any other tab/device signed in as the
same user (`where checked_out_by = auth.uid()`, per user not per session). Before the
2026-08-31 notice modal (`f5ce075`) this was a redundant toast, so nobody noticed; the
2026-09-01 field report in `journeys/admin-onboards-a-team.md` ("keeps coming back")
was very likely the same estimator hitting the same button.

### What the branch changes (5 source files, 2 tests, 4 docs)
1. `constants.js` — `SELF_RELEASE_GRACE_MS = 15 * 1000` (+ export).
2. `save-engine.js` — `lastSelfReleaseAt` / `lastSelfReleaseProjectId` /
   `noteSelfRelease(atMs, projectId)` / `isSelfReleaseRecent(projectId)` declared just
   above `refreshProjectPermissions`; stamped in
   `doTurnIn` on `result.ok` AND on the `alreadyReleased` short-circuit; exported.
   In `refreshProjectPermissions`: `selfRelease = turnInInProgress ||
   isSelfReleaseRecent()`; when set, (a) the dirty-flush over the lost lock is skipped
   (`self_release_flush_skipped`), (b) the demotion branch logs `self_release_refresh`
   and does nothing else. The expiry and force branches are byte-identical otherwise;
   the "only admins" comments corrected.
3. `app.js` `checkInCurrentProjectIfHeld` — `if (data?.ok) saveEngine.noteSelfRelease()`.
   Belt-and-braces: verified pre-fix that this path (load another project) did NOT trip
   the notice, because load resets state before the UPDATE lands.
4. `app/index.html` — `#forceTurnInNoticeBody` gets an id; the shipped copy is unchanged.
   With the flag on, features/turn-in.js `openForceTurnInNoticeModal` swaps it to "This
   project was turned in while you had it checked out, by an admin or by another tab or
   device signed in as you." (R1-FLIP moves that text into the markup.)
4b. **The flag** (added before merge): app.js `// SECTION: Feature flags` —
   `featureFlagEnabled(name)` reads localStorage `clickcount-ff-<name>`; `?ff=<name>` on
   the URL sets it once per device, `?ff=-<name>` clears it. The engine reads
   `ctx.isSelfReleaseStampEnabled()` (app.js: `featureFlagEnabled('self-release')`) and
   ANDs it into `selfRelease`. Published as `App.featureFlagEnabled`. Not in the sign-out
   key list on purpose (a device preference). Conventions bullet in AGENTS.md.
5. Tests: 5 `save-engine.test.js` cases (own doTurnIn → no notice/no toast/
   `self_release_refresh`; the app-side stamp; the window closing → still a force; no
   flush over a self-released lock — all four RED on the old engine — and flag OFF → the
   old classification, i.e. the dormant ship is a no-op), 67/67 green.
   `turn-in-self-release.spec.js` (cloud-gated, self-skips without dev-auth), one project,
   both halves: flag off → a real `[Turn In]` still trips the notice with the shipped
   copy; flag on → turned-in toast, no notice, `[Check out to Edit]` works again,
   console-clean. RED on the old engine at the notice assertion.
6. Docs: CHANGELOG entry, ARCHITECTURE turn-in.js row, AGENTS "Save / sync" bullet,
   dossier addendum in admin-onboards-a-team.md.

### What a reviewer should check
- [ ] `turnInInProgress` is a `let` declared ~400 lines BELOW `refreshProjectPermissions`
      in the same closure. Call-time read only (both run long after `createSaveEngine`
      returns), so no TDZ; confirm no lint rule wants it hoisted.
- [x] **The cross-project leak — FOUND AND FIXED 2026-09-15 (review pass).** The stamp
      was a bare timestamp with no project id, so the window covered whatever project was
      current when the refresh landed: release A, check out B inside 15 s, an admin forces
      B, and B's genuine force was classified as our own release — a silent demotion with
      no notice, on a project the user never released. `noteSelfRelease` now records the
      project (defaulting to the current one at stamp time, which is the released one on
      every call path) and `isSelfReleaseRecent(projectId)` requires a match. Pinned by
      `refreshProjectPermissions: the stamp does not leak across projects` in
      save-engine.test.js, verified RED against the unscoped engine (0 notices, expected 1)
      and green after. 68 node tests.
- [ ] The window: 15 s is generous on purpose (a wedged supabase-js can delay the
      handler's own refresh by the 8 s `REFRESH_PERMISSIONS_TIMEOUT_MS` + retry). Cost of
      too long: an admin force within 15 s of our own turn-in is absorbed silently — we
      are already a viewer, nothing is lost. Cost of too short: the bug comes back.
- [ ] The flush skip: `willBecomeViewer && hadDirty && !hadInflight && selfRelease` now
      logs and leaves `autoSaveDirty` as is. Before, the flush would have hit
      `CHECKOUT_NOT_OWNED` and set `lastCloudSaveAttemptFailed` (yellow bell) for a lock
      we gave up. Confirm no caller relied on that flush after a self turn-in (doTurnIn
      flushes BEFORE releasing; `checkInCurrentProjectIfHeld` callers reset state).
- [ ] The admin's own Force turn-in on a project they hold (features/turn-in.js
      `settingsForceCheckIn`) sets `checkedOutBy = null` synchronously after the RPC; it
      does NOT stamp. Pre-existing tiny race with the realtime refresh; left alone. Decide
      whether to stamp there too (one line) or leave.
- [ ] Copy has no em dashes (house rule) and the sentence reads right to an estimator.
- [ ] Run: `npm run check` (10/10 green at hand-off), `node --test save-engine.test.js`,
      the targeted set (`close-project save-project save-status restore-last-session
      load-project load-project-delete upload-then-save user-activity
      turn-in-self-release` — 25/25 at hand-off), the full suite before merge (from a
      `.claude/worktrees/*` checkout: `--config=playwright.worktree.config.js`, own server
      + `BASE_URL`; the test account needs `config.local.js` with dev-auth).
- [ ] Live walk after deploy (dev account on counttooling.com): Save & Open the sample,
      `[Turn In]`, expect ONLY "Project turned in." and `[Check out to Edit]`; then have
      a second browser signed in as the same account turn it in and expect the notice
      with the new copy.

### Not in this branch, on purpose (product calls)
- **The re-click trap.** `[Check out to Edit]` and `[Turn In]` are the same button in
  the same pixels (app.js `updateUI`, the edit banner); the flip happens the instant
  checkout succeeds, so a second click releases the lock. Wendi's 16:36:01 → 16:36:04
  pair is this. Options: hold a "Checked out ✓" state ~2 s before showing `[Turn In]`;
  or a confirm on Turn In. Both change a flow the J13 walk verified. Will's call.
- **Confirming with wendi.** Her Save Status bell → Export logs: the event before each
  `force_turn_in` should be `turn_in_ok`. Closes the loop on the inference that she
  clicked the banner (only user buttons reach `doTurnIn`; WHY she clicked is inferred).
- **Same-account co-editing.** A second tab/device signed in as the same user becomes a
  silent co-editor (`can_edit` is per user) and both autosave to the same row. Not
  involved here (one session), but real: consider a session id on the lock.

## R1-TEST — a tester walks the fix on counttooling.com (own login)

For the person testing, not a developer. Takes about ten minutes. Use your own
CountTooling login and a project you own (or make a throwaway: open the sample plan
from the empty canvas and Save & Open it). Nothing you do here can affect anyone
else's project unless you pick a shared one — pick one that is yours alone.

**Turn the fix on for your browser (once):**
1. Open **https://counttooling.com/app/?ff=self-release** and sign in. That switch is
   remembered by this browser only; nobody else sees any change. (To turn it off again
   later: open `https://counttooling.com/app/?ff=-self-release`.)

**Walk A — the bug is gone:**
2. Open a project you own. The header shows `[Check out to Edit]` (if it shows
   `[Turn In]` you already have it checked out; skip to 4).
3. Click `[Check out to Edit]`. The button becomes `[Turn In]` and a toast says
   "Project checked out. You can now edit."
4. Click `[Turn In]`.
5. **Expected:** ONE small card, "Project turned in. Close project", top right, gone in
   about six seconds, and the header reads `[Check out to Edit]` again.
   **The bug (must NOT appear):** a dark dialog titled "Project turned in" saying "An
   admin turned this project in while you had it checked out. You're now viewing only",
   with Close project / Check out to edit / Keep viewing buttons.
6. Do 3 → 4 → 5 five times in a row, quickly. Same expectation every time.
7. Click `[Check out to Edit]`, place a counter or draw a line, wait ten seconds (the
   auto-save), then `[Turn In]`. Same expectation; reload the page and confirm the mark
   is still there.

**Walk B — a real turn-in from elsewhere still tells you (needs a second browser or
your phone, signed in as YOU):**
8. In browser 1, `[Check out to Edit]` on the project. In browser 2, open the same
   project — it will show you as editing (`[Turn In]`) because it is the same account.
   In browser 2 click `[Turn In]`. (Browser 2 has not opened the `?ff=` switch, so it
   may show the dark dialog to itself — that is today's behavior on an unswitched
   browser; ignore it there, browser 1 is the one under test.)
9. **Expected in browser 1 within a few seconds:** the dark "Project turned in" dialog
   DOES appear, and it now reads "This project was turned in while you had it checked
   out, by an admin or by another tab or device signed in as you." — not "An admin".
   Close it with Keep viewing.

**Walk C — nothing else moved:** open Project Settings, Save Status (the bell), Load
Project, Close project; open a view link if you have one. Everything as before.

**Report** (a line each is enough): which walks passed; the exact text of anything
unexpected; and, for anything odd, the bell → Export logs file. If the dark dialog
appeared in Walk A even once, that is a fail — attach the export.

⚑ Sign-off recorded here: `[tester] ____ [date] ____ [result] ____`

### Agent pre-walk, 2026-09-15 — evidence, NOT the sign-off

Run by the review session before handing the walk over, so the tester starts from a known
state rather than from a hand-off note. **The sign-off slot above stays blank on purpose:**
Robert's condition was that another *individual* walks it, and this was not a person.

- **The live bundle carries both PRs.** `save-engine.js`, `features/turn-in.js` and
  `app/index.html` fetched from counttooling.com: the scoping (`lastSelfReleaseProjectId`,
  `noteSelfRelease(atMs, projectId)`, `isSelfReleaseRecent(state.currentProjectId)`), the
  `self_release_refresh` / `self_release_flush_skipped` events, the flag-gated copy swap,
  and `#forceTurnInNoticeBody` still holding the OLD copy in the markup (correct until
  R1-FLIP). `CACHE_VERSION 77212f605f87` matched main.
- **The flag seam works on prod.** Opening `/app/?ff=self-release` set
  `clickcount-ff-self-release=1` and `App.featureFlagEnabled('self-release')` read `true`.
  First confirmation of the flag mechanism outside a test.
- **The cloud-gated spec ran for the first time** (dev-auth supplied):
  `turn-in-self-release.spec.js` PASSED in 28.8 s against the real backend, both halves.
- **Walk A — 6 check-out/turn-in cycles** (5 of them back to back) on a throwaway project
  made from the engineered sample plan: every one gave the small turned-in card and
  `[Check out to Edit]`, never the notice. Log: 6 `turn_in_ok`, 7 `self_release_refresh`
  (the extra is the documented double refresh: realtime UPDATE + the caller's own),
  **0 `force_turn_in`**. The field signature was `turn_in_ok, force_turn_in, force_turn_in`.
- **Walk B — a genuine outside release still warns.** A second tab signed in as the same
  user released the lock; the first tab raised the notice, logged `force_turn_in` (1), body
  text exactly: "This project was turned in while you had it checked out, by an admin or by
  another tab or device signed in as you. You're now viewing only."
- **Walk C** — Project Settings (post-#96 layout), the Save Status modal and its log all
  intact; **zero console errors** across the whole walk.

**What this evidence does not cover, and why the human walk still matters:**

1. It ran from `localhost:4571`, not counttooling.com. Same commit and the real Supabase
   backend, and the deployed artifact is verified identical by the CACHE_VERSION content
   hash, but it is not the prod URL (dev-auth is localhost-gated by design).
2. Walk B's second tab called `check_in_project` directly rather than loading the project
   and pressing Turn In. Same wire call another device makes, but not a button press.
3. It used the `dev-agent@clickplumbing.com` test account, not an estimator's own login on
   their own bid, which is the case wendi actually hit.
4. Nobody judged whether the new sentence *reads right to an estimator* — a human call the
   R1 checklist asks for explicitly.

## R1-FLIP — make the fix live for everyone (after R1-TEST)

**Do not run before R1-TEST is signed off above.** One topic branch, `claude/r1-flip`,
size S (an hour with the gates). It makes the flagged behavior the default and removes
the flag, leaving the code as if the fix had shipped plainly.

1. app.js engine ctx: `isSelfReleaseStampEnabled: () => true` is wrong — instead DELETE
   the ctx entry, and in save-engine.js drop the `ctx.isSelfReleaseStampEnabled` factor
   from `selfRelease` (leave `turnInInProgress || isSelfReleaseRecent()`); update the
   engine header's ctx-contract line.
2. app/index.html `#forceTurnInNoticeBody`: replace the shipped sentence with the new
   copy (no em dashes: "This project was turned in while you had it checked out, by an
   admin or by another tab or device signed in as you."). features/turn-in.js: delete
   the flag-gated `innerHTML` swap (keep the id).
3. app.js `// SECTION: Feature flags`: remove `self-release` from the "Live flags" list.
   Keep the mechanism (it is the house pattern now — AGENTS.md Conventions); if no flag
   is live, say so in the comment.
4. save-engine.test.js: delete the "flag OFF" pin and the four `isSelfReleaseStampEnabled:
   () => true` overrides; remove the default from `makeCtx`. turn-in-self-release.spec.js:
   drop the flag-off half and the localStorage set (keep flag-on assertions as the plain
   path). Expect 66 node tests.
5. Docs: CHANGELOG entry ("R1-FLIP: live for everyone, <date>, tested by <name>"), the
   AGENTS.md save/sync bullet and the ARCHITECTURE turn-in.js row lose their DORMANT
   clauses; flip this unit and R1-TEST to ☑ here.
6. Gates: `npm run check`, `node --test save-engine.test.js`, the targeted set from R1,
   `npm run build:sw`, the full suite, push, then `curl -s https://counttooling.com/sw.js
   | grep CACHE_VERSION` matches, then the live walk: R1-TEST Walks A and B WITHOUT the
   `?ff=` switch (open `?ff=-self-release` first so the device flag is not masking).
7. Tell wendi it is live and ask her to confirm the loop is gone.

## R2 — 13 client event types 400 against the deployed `log_user_event` allowlist

Found 2026-09-15 while running R1's spec (its cleanup's `closeProject` produced a console
`400 /rest/v1/rpc/log_user_event`). Diffed `logUserEvent('…')` call sites in app.js +
features/*.js against `pg_get_functiondef(public.log_user_event)` on prod. These are
called by the client and REJECTED ("invalid event type") on every call, no migration
ever added them:

`bid_check_row_state`, `ceiling_set`, `child_count_from_rule`, `codes_set`, `drop_set`,
`ghost_placed`, `ghost_stamped`, `project_close`, `restore_prompt_deferred`,
`rule_open`, `tag_suggestion_accepted`, `tour_step`, `trade_set`.

Consequences: `user_activity` has none of them (the telemetry re-reads in _NEXT.md were
blind to tours, trade choice, Bid Check ticks, closes); every signed-in Close project
logs a console error in prod (the console-clean specs never saw it because they run
signed out). The client swallows the error, so nothing else breaks.

Unit: one migration `supabase/migrations/<stamp>_log_user_event_allowlist_catchup.sql`
re-creating `public.log_user_event` with the CURRENT deployed body plus the 13 (copy the
deployed body from `pg_get_functiondef`, never the 20260326230000 original — the
migration-chain rule in _INDEX.md conflict note 5). Also add a node test that diffs the
client's `logUserEvent('…')` literals against the newest migration's allowlist so this
cannot drift again (`rules.test.js` has the pattern for reading migrations). ⚑ Applying
the migration is Will's go (AGENTS.md: Supabase MCP `apply_migration`). Size S.

## D26 — Drift patrol after the sample-plan promotion

Branch `claude/d26-sample-plan-drift-patrol`. The standing practice in
[_NEXT.md](_NEXT.md) ("after any major feature ships, re-walk the affected journey
and update its dossier"), owed since `samples/sample-plan.pdf` became candidate A
(CT #94, 2026-09-14) and the engineered plan moved to a true ANSI B sheet. The
dossiers are dated walk logs: **do not rewrite them** — add a dated addendum per
journey, and re-walk the one whose headline stumble no longer reproduces.

1. **Re-walk J5 (set-a-scale-you-can-trust) on the new sheet.** Its blocker — the
   Set Scale dialog pre-selecting a sheet correction on a non-standard sheet, the
   65'-0" wall reading 173'-1" — cannot happen on the sample any more (both sample
   plans are true ANSI B now; `getPageSheetAnalysis(0).isStandard` is true). Walk
   the preset path and the verify path on the 67'-4" dimension; record what a user
   sees today; keep the old finding as history with a "no longer on the sample"
   note. The rescaled-PDF case still exists in the wild — say where a walker can
   reproduce it (any 918 × 594 pt print).
2. **Dated addenda, no re-walk needed** (the sheet changed under the walk, the
   findings did not): [count-fixtures.md](../count-fixtures.md) (7 WC → 5 WC + 2
   urinals; rooms are 107 / 108), [measure-runs.md](../measure-runs.md) (stumble #4,
   the preset correction, is sample-specific history now), [multi-scale-and-repeats.md](../multi-scale-and-repeats.md)
   (line 159's "synthetic 921.6×597.6pt sheet"), [hvac-room-sizing.md](../hvac-room-sizing.md)
   (Office 101 is 14'-2" × 20'-0" = 283 ft²; Break Room 102 is BREAK 104; Open
   Office 104 is 105; the non-standard-sheet precondition is gone), [fix-mistakes.md](../fix-mistakes.md),
   [annotate-and-review.md](../annotate-and-review.md), [first-plan-to-first-count.md](../first-plan-to-first-count.md),
   [field-tablet-offline.md](../field-tablet-offline.md), [save-load-return.md](../save-load-return.md),
   [reuse-standards-across-bids.md](../reuse-standards-across-bids.md), [share-and-collaborate.md](../share-and-collaborate.md),
   [share-with-an-outsider.md](../share-with-an-outsider.md) (environment lines only).
3. **Plans that cite the old rooms as history stay as written** — [H1-HVAC-TOUR.md](H1-HVAC-TOUR.md),
   [T1-04.md](T1-04.md), [T1-01.md](T1-01.md) — with one line at the top: "sheet
   replaced 2026-09-14, see SAMPLE-PLANS.md".
4. **Dossier screenshots** (`journeys/img/*`) are not regenerated; the addendum says
   the images show the old sheet.
5. Gates: docs only, `npm run check` (the TOC / guides stamps). One PR.

Size S–M (an afternoon: one walk, a dozen addenda).
