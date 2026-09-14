# TO DO — hand-off of the remaining build queue (written 2026-09-13)

> **COMPLETE 2026-09-14.** D19–D25 shipped (Wave 3), the after-the-queue items are ticked below. What is still open is not a build: the three `[decision]` slots in [_STAGE6.md](_STAGE6.md), the day-7 telemetry re-read on 2026-09-19, and the standing drift patrol.

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
