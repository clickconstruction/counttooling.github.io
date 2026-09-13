# Journey↔feature coverage check — Phase 1 (2026-08-02)

## Features claimed by NO journey (orphans)

- Page rotation (R)
- Background page warm-up
- Keyboard Map
- Summary panel + count detail

## Cross-cutting (claimed by 3+ journeys)

- Per-page scale (two-point, presets, or custom) (5 journeys)
- Quick Count / Quick Plumbing / Quick Line creators (4)
- Right-click tool settings (4)
- Context menus (right-click / long-press) (4)
- Always-feet totals (4)
- Custom SVG icon upload + bundled trade icon library (3)
- Auto-save every 5 seconds + local backups (3)
- Works without the cloud (3)
- Quick Keys (number row) (3)
- Copy to PipeTooling (3)
- Save Status bell (3)
- Full offline mode (3)
- Check-out / turn-in (one editor at a time) (3)

## Critic notes

- FEATURES.md actually contains 64 feature bullets (6+6+6+8+10+7+8+9+4 across its 9 sections), not 65 as the task brief states — worth reconciling before Phase 2 so the count everyone quotes matches the file.
- Orphan caveat: 'Page rotation (R)' could be generously matched by 'Prepare PDF (keep/drop, reorder, rotate pages)' and 'Hotkeys for every tool', but FEATURES.md lists it as its own feature (mid-takeoff rotation of an already-imported sheet, distinct from Prepare-time rotation), so no journey truly walks it.
- Blind spot — audit/verification route: 'Summary panel + count detail' (click a total, get per-page breakdown with location thumbnails) is the app's main 'prove the number' drill-down, and no journey claims it even though Show Report and Live footer totals are claimed repeatedly. A 'double-check my counts before sending the bid' route is missing.
- Blind spot — learning/discovery route: 'Keyboard Map' is unclaimed and 'Hotkeys for every tool' is only claimed as a supporting feature; no journey represents a new user discovering the shortcut surface (Keyboard Map + right-click tool settings as discoverability path).
- Blind spot — performance/large-set experience: 'Background page warm-up' is unclaimed and 'Instant zoom & pan' is claimed only once (apparently by the mobile/tablet journey). The desktop big-set experience (40+ page set, warm-up, cached zoom) has no dedicated journey; it may be intentional (passive features), but Phase 2 should decide whether warm-up behavior gets observed anywhere.
- Coverage otherwise dense: 60 of 64 features are claimed at least once, and the 13 multi-claimed features cluster into three cross-cutting themes worth shared treatment: (a) scale correctness (Per-page scale, Always-feet totals, scale/multiply zones), (b) palette ergonomics (Quick creators, Quick Keys, Custom SVG, right-click settings/context menus), (c) sync-and-offline trust (Auto-save, Save bell, Full offline, Works without cloud, Check-out/turn-in, Copy to PipeTooling).

## Duct surfaces — drift patrol addendum (2026-09-13, J19)

The D1–D16 duct build added a feature family no Phase-1 journey could claim. J19 (`duct-takeoff`, persona H) now claims: Duct tool + S popover (step-downs, custom, rise/drop, orientation), auto fittings + reclassify, Duct Schedule + Copy Schedule (counted | factor, seam & waste, Bid weight), CFM devices (Create tab, Quick tab CFM box, per-marker override) + ductulator suggestions (round-first, velocity cap), room types + air balance (Rooms badge, legend ⚠ line), system groups (equipment tag / capacity / ESP / plenum), deck riser + flex drops + neck prefill, true-width ghost, plan-and-spec callouts, Bid Check duct rows (auto + manual, Fits the roof, static path) + the export gate, HVAC icon set, legend duct rows, report Duct Schedule table.

- **Still claimed by NO journey after J19** (walked-adjacent, not exercised): Plenum return toggle behavior; VD per tap remove/add; Boot / Offset reclassify; On edge applied to a run; multi-sheet schedule scope (This sheet / Every sheet); 2" / 3" / 1/2" pressure classes; liner sq ft; Legend "Show duct true width" off; Copy Schedule's scale gate; duct rows in the Summary drill-down (J18). **Now claimed by the 2026-09-13 re-walks:** duct runs inside scale zones (J6 — zone scale applied, 10' · 69 lb) and multiply zones (J6 — NOT multiplied, finding G); Delete Area over duct (J6 — ignored, finding H); duct + Copy to /Tooling / Copy Summary handoff content (J11 — no pounds, and the email block carries the panel's `na` hints, finding I); the duct Esc ladder beside a live polyline draft and the S seam (J5 — findings A/B); the duct fields on the counter dialogs and the Legend Settings toggles as seen by a plumber (J5 — findings C/E).
- **Re-walk dates (duct drift patrol):** J5 `measure-runs` re-walked 2026-09-13 · J6 `multi-scale-and-repeats` re-walked 2026-09-13 · J11 `hand-off-to-pricing` re-walked 2026-09-13 — each dossier carries a "Drift patrol 2026-09-13 (post-duct)" section with the per-step ✓/✗ table. Day-7 `duct_run` telemetry line due ~2026-09-19 (migration applied 2026-09-12).
- **Cross-cutting after J19:** system groups are now claimed by J4 (palette organizer), J16 (artboard) and J19 (systems) with three different meanings — the per-project "Use groups" toggle (Project Settings) gates all three; J19 files it as a hidden precondition (stumble #1). The Bid Check section is claimed by J19 and the electrical track (S5); the export gate machinery (T1-05 scale gate → duct bid gate) is claimed by J10, J11 and J19.
- **Spec-coverage note:** every duct spec that needs a system group sets `state.groupsEnabled = true` or calls `App.openGroupModal(null)` directly — the toggle route is exercised by no spec (groups-per-project.spec.js covers the toggle, not the duct path to it).
