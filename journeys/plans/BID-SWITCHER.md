# BID-SWITCHER — the header bid chip (Option B)

Plan of record. Written 2026-09-15 after Wendi's report ("is this small link at the
bottom of the window the only way to load project now? … two different buttons to
upload pdf on top bar, none to load project") and the before/after mockup round.
Will picked Option B (the bid switcher) over Option A (a plain "Open bid" button).

**The finding this closes.** On desktop, signed in, nothing open, the top bar carries
two controls that upload a PDF and none that open a saved bid. `Load Project` has
three doors in the markup and exactly one renders on desktop:

| Door | Where | Desktop |
|---|---|---|
| `loadProjectBtn` | header text button, `class="replaced-by-status-bar"` | **dead** — `.header .replaced-by-status-bar { display:none !important }`, not media-gated |
| `loadProjectBtnSidebar` | `.sidebar-header-buttons` | **phone only** — parent is `display:none` above 768px |
| `settingsLoadProject` | Project Settings → footer link | the only one |

The `replaced-by-status-bar` class was a promise: those header buttons were retired
because the status bar would carry them. Sign In got `statusBarAuth`; All Bids got
`statusBarBidBoard`; **Load Project never got its replacement.** It has been an orphan
since that migration. The 2026-09-15 settings layout pass did not cause this — it made
the last door smaller, which is when it got reported.

---

## What the pre-plan checks changed

Six checks against the running app and the code. Three moved the design.

**1. The collision I predicted is not a collision.** `headerEditStatusBanner`
(app.js:2714) carries *verb and state* only — `[Turn In]`, `[Check out to Edit]`,
`Unsaved`/`Save`, `<email> is editing`, `Viewing only`,
`[Edit session expired. Re-check out]`. It never carries identity. The chip carries
identity. They are complementary. **But** they would sit at opposite ends of the
header, which is decision **D2** below, not a blocker.

**2. The width budget is better than the mockup claimed.** `uploadPdf` and the
`.header-primary-divider` pair are hidden once `state.pages.length > 0`
(app.js:2801-2806). So with a bid open, the chip occupies a slot Upload PDF has
already vacated. Net header width: **+1 chip in the empty state, zero while working.**
The mockup's ledger said the opposite and is wrong — corrected here.

**3. ⚠ The recents list cannot be fetched when the menu opens.**
`list_accessible_projects` returns a **`data jsonb`** column — the entire takeoff
payload for every accessible project (supabase/migrations/20260830010000). The Load
Project modal pays that on open, behind a spinner, on an explicit user action. A
header dropdown that opens instantly cannot. **Recents must be local-first**
(localStorage), written on successful load and successful save. Bonus: it then works
offline, which a PWA should.

The click can still pay the RPC — opening a recent bid costs exactly what opening
Load Project costs today, for the same action, with three fewer steps. Menu-open is
free; menu-click pays the status quo.

**4. No new load path is needed.** `App.loadCloudProjectRow(proj, ui)`
(features/load-project.js:420, published at :731) is already host-agnostic and already
shared with features/bid-board.js:137. The chip is its third consumer.

**5. ⚠ The save gate needs a target.** `openLoadProjectModalOrPromptSave`
(features/copy-project.js:239) always routes to the *full modal*. Jumping straight to
a named bid needs a pending-target, and the file already establishes the pattern with
`pendingCopyProject`. Follow that shape exactly — do not invent a second one.

**6. ⚠ The chip feeds a live layout measurement.** `updateHeaderCollapsed`
(features/burger-menu.js:165) toggles compact/burger mode on
`header.scrollWidth > header.clientWidth + 1`. A variable-width chip carrying a long
bid name can tip a laptop into burger mode. Mitigation: a hard `max-width` with
ellipsis on the chip, and a `App.scheduleHeaderCollapseCheck()` call whenever the
name changes. Pin it with a spec at 1280px and 1024px with a deliberately long name.

**7. The chip answers something nothing else does.** `state.currentProjectName` is
rendered in exactly one place today — the settings modal subtitle (app.js:4849). The
header never names the bid you are in.

---

## Stages

One branch per stage, `npm run check` green before each merge, per the _TODO.md loop.
Stage 0 is independent of the rest and should not wait for it.

### Stage 0 — delete the decoy `claude/kill-import-shield`

The Export button's empty-state costume. In `updateUI` (app.js:2908-2924) the
`shieldImportMode` branch swaps `aria-label` to `Import PDF`, `title` to
`Upload PDF to start`, drops `aria-haspopup`, and shows `exportDropdownIconImport`.
Clicking it opens the same picker as the Upload PDF button six inches to its left.

Remove the branch, the icon `<svg id="exportDropdownIconImport">` in app/index.html,
and hide the whole `#exportDropdown` when `state.pages.length === 0 && !state.isViewer`
instead. This is Wendi's second complaint, it is about a dozen lines, and it frees the
slot the chip wants.

Spec: extend `header-strip-trade.spec.js` or add to `output.spec.js` — assert no
element in the header has an upload-PDF affordance twice in the empty state.

### Stage 1 — the recents store `claude/bid-recents-store`

New pure module `recent-bids.js`, following the established `recent-colors.js` /
`recent-drops.js` shape exactly: a pure `nextRecentBids(list, entry, max)` with a
guarded CommonJS footer and a sibling `recent-bids.test.js` under `node --test`.

- Entry: `{ id, name, at }`. Max 5. Newest first, de-duped by `id`, rename wins.
- localStorage key `recentBids`. Add it to the sign-out key list (app.js:5087 and
  save-engine.js:2840 — **both**, they are separate copies of that array).
- Written on a successful `loadCloudProjectRow` and on a successful cloud save,
  beside the existing `clickcount-last-project` writes (save-engine.js:2382, :2744).
- Document it in AGENTS.md "Persisted settings".

No UI in this stage. It lands green and inert.

### Stage 2 — the chip, render only `claude/bid-chip-render`

New `features/bid-chip.js`. Renders into a new `#headerBidChip` in app/index.html,
placed per **D2**.

- Text: `state.currentProjectName || 'Untitled'`, or `No bid open` in the empty state.
- Gating: `SUPABASE_ENABLED`, and hidden entirely for `state.loadedViaViewLink`
  (**D5**). A viewer has no bids to switch between and the chip would offer a menu
  of projects they cannot open.
- Hard `max-width` + `text-overflow: ellipsis`; full name on `title=`.
- Calls `App.scheduleHeaderCollapseCheck()` after any text change.
- `updateUI` invokes it defensively: `App.renderBidChip && App.renderBidChip()`.

Spec `bid-chip.spec.js`: empty state, named state, long-name ellipsis, the two
collapse widths, view-link hidden, Supabase-disabled hidden.

### Stage 3 — the menu `claude/bid-chip-menu`

The dropdown. Reuse the `#headerMoreMenu` / `.export-dropdown-menu` patterns already
in the file rather than inventing a third menu idiom.

Rows: **Recent bids** (up to 5 from Stage 1, current one marked and inert) ·
separator · `All my bids…` (→ `openLoadProjectModalOrPromptSave`) ·
`Upload a new plan` (→ the existing `#pdfInput` click).

Empty recents (a new user, or a cleared device) renders the two action rows only —
no empty-state copy, no placeholder rows.

### Stage 4 — direct load through the save gate `claude/bid-chip-direct-load`

Clicking a recent row loads that bid directly.

- Add `pendingDirectLoad` to features/copy-project.js beside `pendingCopyProject`,
  and honour it in all three `saveBeforeLoad*` handlers (Cancel clears it, Discard
  and Save both route to it).
- The load itself: one `list_accessible_projects` call, find the row by id, hand it
  to `App.loadCloudProjectRow(proj, ui)`. If the id is gone (deleted, access
  revoked), drop it from recents, toast `That bid is no longer available.`, and open
  the full list.
- Chip shows a loading state while it resolves; the whole chip is disabled during.

Spec `bid-chip.spec.js` additions: clean switch, dirty switch through each of the
three gate buttons, and the stale-id path.

### Stage 5 — the orphan sweep `claude/load-project-orphans`

Close the inversion the investigation turned up.

- `.sidebar-header-buttons` is `display:none` above 768px, so a phone has a Load
  Project door the desktop lacks. Make them agree: the chip is the desktop door, so
  the phone's sidebar button stays and `loadProjectBtnSidebar` is left alone — but
  `bidBoardBtnSidebar` ("All Bids") has the same problem and no desktop equivalent
  except the status-bar link. Decide once, sweep both.
- Delete the four dead `replaced-by-status-bar` header buttons, or finish the
  migration they promised. They are markup that renders nowhere (**D6**).

---

## Gates (AGENTS.md)

- `recent-bids.js` and `features/bid-chip.js` are **new shell files**: add the
  `<script>` tags to app/index.html **and** `PRECACHE_URLS` in sw.js, then
  `npm run build:sw`. Never hand-edit `CACHE_VERSION` / `PRECACHE_SHA256`.
- `npm run test:unit`, the stage's targeted specs, then `npm run check` (ten steps),
  then one full Playwright run to a real exit code, detached.
- From this worktree: `--config=playwright.worktree.config.js`, and the gitignored
  `config.local.js` stub must exist.
- No native `alert`/`confirm`/`prompt`. The stale-bid case is `App.showToast`.
- Copy style: no em dashes in user-facing strings.

## Open decisions

| # | Decision | Recommendation |
|---|---|---|
| **D1** | The noun: **bid** or **project**? The app currently says "project" in the settings footer, "Bids" in the board, "bid review" in the settings card; FEATURES.md and the dossiers say "bid". | **bid** — it is what estimators say and what our docs already use. Sweep the rest in a follow-up, not in these branches. |
| **D2** | Chip on the **left** (the slot Upload PDF vacates) or the **right** (beside `headerEditStatusBanner`, so identity and checkout state read as one unit)? | Left, per the mockup — but this is genuinely open, and the right has the better argument. Worth walking the six banner states before committing. |
| **D3** | Recents: local-only, or a lightweight `list_recent_projects(limit)` RPC later for cross-device? | Local for v1 (free, offline, no migration). Revisit if estimators report the list being empty on a second machine. |
| **D4** | Does the chip replace the settings-modal subtitle, or do both name the bid? | Both. The subtitle costs nothing and the settings card should still say what it is editing. |
| **D5** | What does a view-link viewer see? | Nothing — hide the chip entirely. |
| **D6** | Finish or retire `replaced-by-status-bar`? | Retire. Four buttons carry it with nothing replacing them; delete the markup. |

## Still to verify before Stage 2 is written

1. Walk all six `headerEditStatusBanner` states with a bid open at 1280px and 1024px,
   with the chip mocked in, and decide **D2** from what it looks like rather than from
   this document.
2. Measure a real `list_accessible_projects` response on an account with many bids —
   if the Load Project modal is already slow to open, **D3** gets more urgent and the
   lightweight RPC moves into Stage 4.

---

## Built 2026-09-15/16 — what the stages changed about the plan

All six stages shipped. Three of the plan's own claims were wrong and are
corrected here, because the plan is the thing the next session reads.

**The width budget in "What the pre-plan checks changed" was measured wrong.**
Forcing `.header-tools-scroll` to `flex:0 0 auto` and zeroing the `.spacer` to
read an "intrinsic width" removed the slack the real layout runs on, and
reported a 139px chip cost and a 1391px header that do not exist. The correct
method is to compare the SAME state with the chip against without it, and to
ask "is the chip what tips the header" rather than "does the header fit". Done
that way, with the wordmark yielding: the chip is free at 1100px and up, and
below that no chip wide enough to name a bid is safe. The ladder lives in
styles.css beside the measurements.

**D2 resolved: the chip takes the wordmark's slot** (Will, 2026-09-16), which
is what buys the reach down to 1100 instead of 1280. That made
`#statusBarSidebar` load-bearing rather than a nicety: `#headerLogo` was the
only VISIBLE desktop sidebar toggle, its only companion an unlabelled spacebar
binding.

**D6 was wrong.** The `.replaced-by-status-bar` buttons are NOT dead markup.
They are hidden command hubs: the handlers hang off them and other surfaces
reach the action by dispatching a click (`authBtn`, `saveProjectBtn`,
`exportBtn`, `manageUsersBtn`, `importBtn`, `clearPage`). Deleting them would
break a dozen call sites. `#loadProjectBtn` was the one true orphan, never
dispatched, and it is gone; the block now carries a comment saying what the
rest are.

**D1 resolved: bid.** D3 stands (local, no new RPC). D4 stands (both the chip
and the settings subtitle name the bid). D5 stands (no chip for a view link).

### Known limits, not done

- The breakpoint ladder is a proxy. The real spare width depends on which
  right-side controls a session has up, so a state with an unusually wide
  banner could still tip at a width the ladder calls safe. Making the chip
  yield only when it is ACTUALLY the cause belongs in burger-menu's measure
  pipeline, not a fourth independent measurer.
- **769px to 1239px has no chip**: too narrow for one, too wide for the
  `.sidebar-header-buttons` block that carries the mobile door. The door there
  is Project Settings, exactly as it was before this work, so it is not a
  regression, but it is the one desktop band the fix does not reach. The
  threshold moved up twice during the build: once when the sidebar-toggle icon
  that replaces the wordmark was counted, and once for margin, because the
  ladder is a proxy and CI's Linux metrics differ slightly from a Mac's.
- **The status bar is a budgeted surface, not spare room.** A `sidebar` link
  there broke footer-hint.spec.js (one line at 1050px) and then duct-b19b.spec.js
  Friction #5 (the save stamp's words are spent before the tool hint). The
  toggle lives in the header instead. Treat that bar as full.
- Recents are per device. A second machine starts empty (D3).
