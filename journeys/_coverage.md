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
