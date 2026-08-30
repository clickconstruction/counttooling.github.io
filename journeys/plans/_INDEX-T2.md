# Phase-4 Tier-2 plans — execution index

Sequencing review 2026-08-30 (sequencing critic pass over the fifteen T2 plans in
this directory plus the Tier-2 table and Stage-2 re-rank blockquote in
JOURNEY-MAP.md). The plan numbering already encodes the approved re-rank order —
T2-NN is execution slot NN — and the critic pass verified that order against real
file overlaps: **no swap is cheaper than the approved sequence**. All fifteen
plans were re-anchored 2026-08-29/30 on this worktree; every plan still mandates
re-grep before editing (each landed branch drifts the anchors for the next).

## Recommended execution order (sequential — one plan fully lands before the next starts)

| # | Plan | Tier-2 item | Branch topic | Why here |
|---|------|-------------|--------------|----------|
| 1 | [T2-01](T2-01.md) | #13 | Clear Page reachable again | Blocker-grade findability, CSS-only, S; its styles.css deletions (:205/:206/:439) sit just above T2-04's toast-rule region (:542) — landing it first means T2-04 absorbs the −3-line drift, not the reverse. |
| 2 | [T2-02](T2-02.md) | #22 | Polyline Esc staged like Quick Line | The tier's one work-loss item; its Esc-ladder branch (app.js:6339) sits ~70 lines below the rungs T2-04 deletes — land first so T2-04's deletions rebase over a settled branch. |
| 3 | [T2-03](T2-03.md) | #25 | Hidden marks stop catching the mouse | Silent-data-mutation fix; one hitTest guard, disjoint from everything before it; T2-10 later edits the surrounding mouse handlers and rebases trivially over it. |
| 4 | [T2-04](T2-04.md) | #15 | Non-blocking toasts + honest stacking | The platform fix: creates `#toastRegion`, the `.toast-interactive` hook, and deletes the toast Esc-ladder rungs + Ghost pre-clear hack. Everything toast-adjacent after this slot builds on the new region — T2-06 is a hard dependent. |
| 5 | [T2-05](T2-05.md) | #17+#18+#19 | Counter-modal cluster (one branch, three commits) | Highest-traffic surface; ships the private twin-guard color rotate T2-07 lifts, and the Create-tab shape T2-13 later adds a link row to — must precede both. |
| 6 | [T2-06](T2-06.md) | #23 | Scale-gate toast becomes a link | HARD dependency on T2-04 (`.toast-interactive` + Esc-rung deletion); direct answer to the 36 `unscaled_ft_block` hits; supersedes T2-04's "durations unchanged" for this one toast (3s→6s). |
| 7 | [T2-07](T2-07.md) | #16 | Quick Count stops minting identical marks | Consumes T2-05's twin-rotate semantics: ships the shared `nextUnusedCounterColor` in recent-colors.js and swaps T2-05's private counter.js rotate for it (the plan works in either order, but T2-05-first is the approved one). |
| 8 | [T2-08](T2-08.md) | #20 | Create arms the tool everywhere | Adds `showSetScaleFirstToast` call sites after T2-06 upgraded the toast — new arms get the link for free; removes `#polylineNewLineType` from the modal block T2-12 later edits. |
| 9 | [T2-09](T2-09.md) | #21 | Live length readout while drawing | Second status-bar.js lander after T2-04's `#statusMeasure` chip — this plan owns the footer-wording reconciliation (stated in its risks); the wrap-cache worst-case key is load-bearing. |
| 10 | [T2-10](T2-10.md) | #14 (drag half) | Rectangle tools accept drag | Widest-spread M item; edits the mouse handlers T2-03 guarded (no hunk overlap) and must keep the aim-loupe specs green unmodified — the band-color half already shipped, do not redo. |
| 11 | [T2-11](T2-11.md) | #24 | Raw vs multiplied counts labeled honestly | Rebases mechanically onto T2-05's landed counter.js (different function: `populateCounterChooseList`); extends counter.spec.js after T2-05 grew it. |
| 12 | [T2-12](T2-12.md) | #28 | Polyline without the dialog tax | Last polyline lander: updates T2-02's polyline-esc.spec.js arm path, edits the index.html block T2-08 already cleaned, and reuses T2-02's tool-independent Esc branch unchanged. |
| 13 | [T2-13](T2-13.md) | #29 | Manage Icons out from under Advanced | ⚑ Placement (Create-tab link row) is Will's veto point until this executes. Rebases onto T2-05's `prepCreatePanel` refactor of the same Create-tab region — its spec asserts the post-T2-05 prefill by rendered value, not the old line. |
| 14 | [T2-14](T2-14.md) | #27 | Double-click sheet rename works | Isolated (features/pages-list.js only); trim/organize traffic was light this window, so it sits late; template for the identical lines-list.js disease (out of scope). |
| 15 | [T2-15](T2-15.md) | #26 | Thumbnail-grid trim (Prepare PDF) | ⚑ Will confirmed IN 2026-08-30, slotted last: biggest build, lowest current traffic. Owns the tier's ONLY migration (`prepare_trim` allowlist). Must land BEFORE batch B15, which shares features/prepare-pdf.js and gets rescoped by this restructure. |

No swap proposed: the one pair where order genuinely matters beyond textual drift
is T2-04 → T2-06 (hard dependency, already ordered), and every same-file pair
below lands its structural/refactor member first under the approved sequence.

## Conflict ledger (verified against the plan texts and current worktree anchors)

1. **T2-04 → T2-06 — hard dependency, the tier's only one.** T2-06's link lives
   inside T2-04's `.toast-interactive` opt-in and assumes the Esc-ladder toast
   rungs are gone. T2-06 also lengthens the gate toast 3s→6s, deliberately
   superseding T2-04's "durations unchanged" for that one toast (both plans now
   say so). Rebase direction: T2-06 re-greps everything — T2-04 moves the toast
   markup wholesale.
2. **T2-01 ↔ T2-04 — adjacent styles.css regions.** T2-01 deletes rules at
   :205/:206/:439 (keeping the :541 `!important` kill); T2-04 works at :542
   (`.modal-overlay`) and the comments at :545/:1284. No shared hunks, but
   T2-01's deletions shift T2-04's anchors ~3 lines. T2-01 first; T2-04 re-greps
   (its plan already says the :475→:542 drift story).
3. **T2-02 ↔ T2-04 — same app.js Escape ladder, disjoint hunks.** T2-04 deletes
   the Ghost pre-clear (:6252-6264) and three toast rungs (:6271-6276 + the
   copied-modal entry); T2-02 edits the `state.drawingPolyline` branch at :6339,
   ~70 lines below. T2-02 first; T2-04's deletions rebase over it with line
   drift only. (T2-02's toast-eats-Esc caveat is pre-existing and T2-04 fixes it
   for free — no coupling.)
4. **T2-05 → T2-07 — the twin-rotate hand-off.** T2-05 ships a private
   pure-shaped rotate in features/counter.js; T2-07 ships the shared
   `nextUnusedCounterColor` in recent-colors.js and REPLACES T2-05's private
   copy (T2-07's plan carries the either-order fallback, unused under this
   sequence). Direction: T2-07 edits landed T2-05 code.
5. **T2-05 → T2-13 → (T2-11) — the counter.js / Create-tab chain.** T2-05
   refactors the create path into `prepCreatePanel()` (kills the counter.js:113
   unconditional prefill) and edits `#counterCreatePanel` markup; T2-13 adds its
   "Manage icons…" link row to that same form-group and its spec now asserts the
   post-T2-05 prefill by rendered value (fixed in this pass). T2-11 touches only
   `populateCounterChooseList` — same file, different function, mechanical
   rebase. counter.spec.js grows at slots 5, 11, and 13 in that order.
6. **T2-04 → T2-09 — same `updateStatus` function in features/status-bar.js.**
   T2-04 adds the `#statusMeasure` chip render (~:203-217 region); T2-09 edits
   the LINE/POLYLINE toolHint branches (:165-167) and the wrap cache (:174-186)
   between them. Different lines, real adjacency. T2-04 first; T2-09 is the
   named reconciler of footer wording (stated in its risks).
7. **T2-02 → T2-08 → T2-12 — the polyline path.** T2-08 removes the dead
   `#polylineNewLineType` (index.html:737) from the block T2-12's Part 3 edits;
   T2-12 also updates T2-02's polyline-esc.spec.js arm path and
   snap-angles.spec.js:104-112 (both hang on `#polylineModal.visible` waits
   otherwise — T2-12 owns those updates). T2-02's Esc branch is keyed on
   `state.drawingPolyline` alone, so T2-12's immediate-arm drafts unwind
   identically with zero edits to the ladder. T2-09's polyline-hint overlap is
   read-only.
8. **T2-06 → T2-08 — showSetScaleFirstToast surface.** T2-06 rewrites the
   toast's internals (static markup, textContent, 6s timer); T2-08 only ADDS a
   call site (`armLineToolAfterCreate`) — signature unchanged, the new arm paths
   inherit the link for free. No collision; ordered for the free ride.
9. **T2-03 ↔ T2-10 — canvas input plumbing.** T2-03's `hitTest` guard (:1058)
   vs T2-10's mousedown/move/up insertions (:5432+): no shared hunks; T2-10
   re-greps after seven intervening app.js landings. The aim-loupe specs are
   T2-10's binding contract and must pass unmodified.
10. **Shared spec files (sequential extension, no forks):**
    toast-region.spec.js (created T2-04, extended T2-06);
    scale.spec.js (T2-04, T2-06); room-sizer.spec.js (T2-04, T2-10);
    footer-hint.spec.js (T2-04, T2-09); counter.spec.js (T2-05, T2-11, T2-13);
    polyline-esc.spec.js (created T2-02, arm path updated T2-12);
    quick-modals.spec.js (T2-07); snap-angles.spec.js (T2-12). The only NEW spec
    files are T2-02's polyline-esc, T2-04's toast-region, T2-10's rect-drag, and
    T2-12's polyline-arm — no two plans create the same file.
11. **Toast-wait audit (the T2-04 blast-radius question).** ~13 existing specs
    wait toasts out or hide them manually; T2-04 preserves ids and `.visible`
    semantics so they pass unmodified (update only on failure). Plans BEFORE
    T2-04 (T2-01/02/03) have no toast-dependent tests; plans after it write
    against the non-blocking region. T2-06's 6s timer was audited against
    room-sizer/scale-gate/ghost/scale-zone specs — all resilient.
12. **Migration chain (cross-cutting).** ONLY T2-15 ships a migration
    (`prepare_trim` allowlist). Verified 2026-08-30 on this worktree: the
    chain-latest `log_user_event` body is
    `supabase/migrations/20260810160000_log_user_event_view_link_dead.sql`
    (it re-creates the function; no later migration touches it) — T2-15's plan
    names exactly that file and still mandates the re-verify grep before
    writing, since Will's separate sessions can extend the chain. T2-10's
    `rect_drag_complete` is a Save-Status debug event, NOT `user_activity` — no
    migration. Every other plan's Telemetry section is explicitly "none".
13. **Downstream batch fences.** T2-15 before B15 (same prepare-pdf.js; B15's
    Undo-jump item shrinks to sheet-view-only and its Escape-discard confirm
    becomes MORE urgent — rescope B15 after T2-15 lands). B8's
    zone-stays-armed rider is gated on T2-10 but not implemented there. The
    empty-legend hitTest mirror belongs to B10, not T2-03. T2-01 makes the
    Clear-Page confirm-wording polish (B14) more urgent but does not ship it.

## Per-plan one-liners

- **T2-01** — Un-dead the sidebar Clear Page button (CSS-only: −3 rules +1
  has-pdf gate); the sign-in-gated Project Settings detour stops being the only
  desktop route.
- **T2-02** — Polyline Esc unwinds one vertex per press (Ghost/Quick Line
  convention), then exits — a stray Esc never costs more than the last click.
- **T2-03** — `if (state.hideMarks) return null` first in hitTest: hidden marks
  can't be dragged, edited, or context-menued; the bare drawing is just a drawing.
- **T2-04** — Toasts become passive corner cards (z 350, pointer-events:none,
  stacked), turn-in gets its own real blocking overlay, and the Measure Distance
  moves to a footer chip; the Ghost Esc hack and toast Esc rungs die.
- **T2-05** — C lands on a prefilled Create tab, prefill walks to the next
  unused icon, exact twins get a numbered suffix + rotated color, the icon
  search un-hides, and SVG uploads scroll-and-flash into view.
- **T2-06** — The "Set Scale ⚖" words in the gate toast become a real button
  opening the Set Scale dialog (6s timer, `.toast-interactive` card).
- **T2-07** — Quick Count never mints a counter whose icon+color duplicate an
  existing one: shared `nextUnusedCounterColor` rotates, panel previews WYSIWYG.
- **T2-08** — Every line-type create surface arms the drawing tool
  (`armLineToolAfterCreate`), the dead polyline-modal link is removed, and Quick
  Line skips the chooser at exactly one type.
- **T2-09** — The footer coaching slot shows live feet-inches while tracing
  (Quick Line + cumulative polyline), px fallback when unscaled; worst-case
  wrap-cache key prevents layout thrash.
- **T2-10** — Press-drag-release completes rectangles on all five rect tools
  (6px/280ms race with the aim loupe), and the Room dialog refuses ~zero-size
  boxes; two-click and touch unchanged.
- **T2-11** — Counters/Choose badges show the multiply-adjusted total everywhere
  ("7 placed · 13 with repeats" in the hover title); one arithmetic via the new
  pure `counterTally`.
- **T2-12** — With an active line type, P starts tracing immediately (auto-name,
  type color); a mid-draw P resumes the draft instead of nuking it; "—" can no
  longer commit a type-less polyline.
- **T2-13** — The Manage Icons opener re-homes from Settings→Advanced to a
  "Manage icons…" link under the Create-tab icon grids (hide-then-open keeps the
  Esc chain honest). ⚑ Placement vetoable by Will until execution.
- **T2-14** — One delegated listener on `#pagesList` makes double-click/double-tap
  sheet rename survive the rebuild race that killed the per-row binding.
- **T2-15** — Prepare PDF defaults to a thumbnail grid with tap-to-keep/drop and
  Keep all/none (lazy IntersectionObserver thumbs, per-modal cache); the sheet
  walk survives as the zoom view; ships `prepare_trim` + its allowlist migration.

## Standing rules (apply to every plan above)

1. **Strictly sequential execution (Will, 2026-08-30).** One plan at a time, in
   the order above; a plan starts only after the previous branch is merged and
   `main` is pulled. No parallel Tier-2 branches — the conflict ledger assumes it.
2. **One-topic branches.** Each plan is one branch/PR using the branch name in
   its plan; nothing opportunistic rides along (the plans' "What does NOT
   change" sections are binding). T2-05 is the one three-commit branch (same
   modal surface, each commit leaves `npm run check` green).
3. **`npm run check` before every merge** (lint, unit tests,
   toc/filemap/macros/guides/sw staleness, brand tokens), plus the plan's named
   Playwright specs locally. Every plan touches precached shell files —
   `npm run build:sw` every time; never hand-edit `CACHE_VERSION`. Fresh
   worktrees: `echo '// stub' > config.local.js` before specs.
4. **Pushes batched at coherent checkpoints** rather than per-merge — suggested:
   after T2-03 (the three S safety fixes), after T2-06 (the toast platform +
   its dependent link), after T2-09 (the counter/line ergonomics run), after
   T2-12 (the drag/labeling/polyline block), and after T2-15 (tier complete).
5. **JOURNEY-MAP.md status column flipped as each lands** (☐ → ◐ on branch,
   ☑ on merge), in the same PR — the shared table is a standing reason parallel
   branches stay banned.
6. **Will's open calls.** T2-13's placement (Create-tab link row) is an
   orchestrator recommendation Will can veto any time before slot 13 executes;
   T2-15 was confirmed in scope 2026-08-30 — if that changes, nothing else in
   the order moves (it is last and nothing depends on it except B15's rescope).
7. **Re-verify line anchors before editing.** All anchors were verified
   2026-08-29/30 pre-sequence; each landed branch drifts them for the next.
   Navigate app.js by `// SECTION:` markers, grep the quoted anchors elsewhere.
8. **Migration chain discipline.** T2-15 only: copy the then-latest deployed
   `log_user_event` body (chain-latest as of 2026-08-30:
   `20260810160000_log_user_event_view_link_dead.sql`; re-verify with
   `grep -l log_user_event supabase/migrations/*.sql | sort | tail -1`), apply
   via Supabase MCP `apply_migration` per AGENTS.md. No other Tier-2 plan may
   grow a migration without flagging it here first.
