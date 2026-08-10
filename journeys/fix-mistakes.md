# J9 — Undo, Delete Area, context menus, editing what exists

Personas: P E H · Status: ● walked (Phase 2, 2026-08-02 — headless Chromium, desktop 1380×900, local sample-plan.pdf, signed out)

> Seeded from the Phase-1 cross-index workflow (2026-08-02). Phase-2 walk done;
> route corrected below, friction/proposals/demo filled in.

## Entry points

- **hotkey** — Ctrl+Z (Undo) (keypress)
- **hotkey** — Ctrl+Shift+Z (Redo) (keypress)
- **footer** — #undoBtn / #redoBtn in the bottom zoom-bar (title "Undo"/"Redo", disabled when stack empty) (click)
- **header** — #deleteZoneBtn toolbar button (title "Delete area") — WALK CORRECTION: not a drag; two clicks (corner, corner) then confirm
- **sidebar** — #deleteZoneBtnSidebar ("Delete area") — same two-click flow
- **right-click** — #contextMenu on any placed mark (counter, line, polyline, highlight, note, zone, room box) — ctxEdit / ctxLineProperties / ctxShowLength / ctxAssignGroup / ctxEditMultiplyZone / ctxEditScaleZone / ctxEditRoomBox / ctxDelete + ctxTargetNameRow name row (right-click desktop / long-press touch)
- **right-click** — #toolContextMenu on any tool button or active-item chip (settings + quick-add; no-settings tools answer with a toast; Move/Measure offer Set / edit scale) (right-click)
- **sidebar** — edit pen on a Counter / Line Type row opens #counterLineTypeDetailsModal (also lines-list edit / dblclick) (click)
- **modal** — context menu "Line Properties" opens #linePropertiesModal (also polyline vertex-edit entry) (click)
- **header** — #clearPage button (class replaced-by-status-bar) — WALK CORRECTION: never visible at any width (`.header .replaced-by-status-bar { display:none !important }` is unconditional, styles.css:474)
- **sidebar** — #clearPageSidebar "Clear Page" — WALK CORRECTION: never visible at any width; the mobile `display:block` (styles.css:170, inside `@media (max-width:768px)`) is overridden by the later unconditional `display:none` (styles.css:372) — dead CSS
- **status bar** — Clear Page status-bar action — WALK CORRECTION: does not exist; the status bar carries only keys / macros / Sign In
- **modal** — #settingsClearPage row in Project Settings menu (click)
- **modal** — #counterLineTypeDetailsDelete → #deleteCounterLineTypeConfirmModal (delete a whole type with mark count) (click)
- **header** — Move mode: click a line to select (thicker + glow), drag notes/legend; per counting-with-counters.md also the path to delete a single mark (click / drag)

## Current route (walked 2026-08-02) — 13 steps, 6 decision points

1. Press Ctrl+Z (or click the ↶ button in the bottom bar) to take back the last action — one mark per press; history keeps the last 50 steps (`UNDO_STACK_SIZE = 50`); both buttons are disabled until the first action ✅ walked
2. Press Ctrl+Shift+Z (or ↷) to redo — any new action clears the redo stack (verified) ✅ walked
3. Right-click a placed mark to open its context menu; the bottom row names what you hit ("Floor Drain", "Waste line") — long-press on touch NOT walked ✅ walked ([img/fix-mistakes-02.png](img/fix-mistakes-02.png))
4. Counter marks offer only **Assign to group / Delete** — there is no "Edit" on a single counter mark; Delete removes that one mark ✅ walked
5. For a line: **Line Properties [color, name, drops] / Show Length / Assign to group / Delete**. Line Properties = name field, color swatch (top-right), start/end drop with unit dropdown + ±1/±10/Clear; edits apply live, the only button is Close ([img/fix-mistakes-03.png](img/fix-mistakes-03.png), [img/fix-mistakes-04.png](img/fix-mistakes-04.png)). Show Length pins a length label ("35'-8"") on the line ✅ walked
6. Select the Delete area tool (eraser icon) — the status bar (bottom-left, small text) reads "Click first corner" ✅ walked
7. **DIVERGENCE:** you do NOT drag a rectangle. The tool is two-click: click one corner ("Click second corner"), click the opposite corner. A drag half-works by accident — mousedown registers corner 1, release does nothing, and there is no rubber-band preview on the canvas ✅ walked
8. Read the confirmation: "Delete in this area? — In this area: 10 counter(s), 1 line run(s) (35.70 ft), 1 note(s)" ([img/fix-mistakes-05.png](img/fix-mistakes-05.png)) ✅ walked
9. Click Delete to confirm; a single Ctrl+Z restores the whole region in one step (verified 13-for-13). The tool stays armed afterward; Esc mid-rectangle resets to corner 1, Esc with no pending corner drops back to Move; a rectangle with nothing inside is a silent no-op (no dialog, no toast) ✅ walked
10. To fix a whole type, click the pencil ✎ on its sidebar row → "Counter" details dialog: rename (applies live to every mark and the legend), recolor via the small top-right swatch → "Choose Color" modal, or pick a new icon; undo covers rename/recolor ([img/fix-mistakes-06.png](img/fix-mistakes-06.png)) ✅ walked
11. To remove a whole type: Delete in the details dialog → "Delete Hub Drain? This will remove 11 markers from the project. Continue?" — the count spans every page AND every canvas layer (verified 8 → 11 after adding a layer with 3 marks) ✅ walked
12. Right-click a tool button for its menu: Counter → "Counter Settings… / Add counter…"; Move/Measure → "Set / edit scale…"; tools without settings toast "No settings for this tool." ✅ walked
13. Clear a page: the ONLY live entry is Project Settings → "Clear Page" → confirm "Clear current canvas (Main)?" (undoable — verified). Signed out on desktop the gear opens the Sign In modal instead ([img/fix-mistakes-07.png](img/fix-mistakes-07.png), [img/fix-mistakes-08.png](img/fix-mistakes-08.png)); the dedicated header/sidebar Clear Page buttons are dead CSS at every width ⚠ effectively unreachable signed-out

## Evidence

- **Telemetry visibility:** None of the 7 events fires directly from this journey's actions. project_save fires indirectly when autosave persists the dirty state after any edit/delete/undo. Blind: undo/redo presses, Delete Area usage and confirm counts, context-menu opens (mark and tool), Clear Page, type rename/recolor/delete, Line Properties edits. (An unrelated 8th event, render_worker_fallback, exists but is not in the 7.)
- **Guide coverage:** [fixing-mistakes.md](/guides/fixing-mistakes/) — The whole journey: undo/redo 50 steps + bottom-bar undo button, mark context menu with name row and type-specific actions, Line Properties (rename/recolor/drops/vertex edit), Delete Area with pre-delete counts, details-modal rename/recolor/re-icon/page-jump/delete-with-count, tool right-click settings menus; [working-faster-with-the-keyboard.md](/guides/working-faster-with-the-keyboard/) — Ctrl+Z / Ctrl+Shift+Z table row (50 steps); 'Right-click a tool for its settings' section incl. Move/Measure Set / edit scale; [counting-with-counters.md](/guides/counting-with-counters/) — Undo for misclicks; Move tool to select and delete a mark; right-click a mark for options; [measuring-runs-lines-and-polylines.md](/guides/measuring-runs-lines-and-polylines/) — Drops set in Line Properties via right-click, ±1/±10 adjusters, screenshot; [organizing-a-busy-sheet.md](/guides/organizing-a-busy-sheet/) — Assign to Group from a mark's right-click menu or while editing; [takeoff-on-a-tablet.md](/guides/takeoff-on-a-tablet/) — Long-press any mark = same context menu as desktop right-click; [working-offline-and-installing.md](/guides/working-offline-and-installing/) — Long-press for the context menu listed among touch gestures; [measuring-room-volumes.md](/guides/measuring-room-volumes/) — Right-click room box → Edit room box (height/room/delete); Delete area tool removes room boxes too; screenshot; [scale-zones-and-multiply-zones.md](/guides/scale-zones-and-multiply-zones/) — Zones can be edited or deleted later from their right-click menu; [annotating-and-reviewing.md](/guides/annotating-and-reviewing/) — Notes edited by double-click or right-click menu; Legend Settings via right-click on the legend button; [canvas-layers.md](/guides/canvas-layers/) — Undo/redo covers layer operations; right-click the peek button for selective layer view; [hvac-takeoff.md](/guides/hvac-takeoff/) — Room boxes edited from their right-click menu
- **Specs:** item-details.spec.js (details modal rename/delete flow, Line Properties via context-menu path, deleteGroup), tool-context-menu.spec.js (map coverage, popover flow, Set / edit scale, Escape/dismissal, viewer gate), import-clear.spec.js (Clear Page confirm names active canvas, Cancel preserves, Confirm clears only current page's active canvas), zone-modals.spec.js (deleteZoneModal cancel/confirm handlers), line-drop-units.spec.js (Line Properties drop units), hotkeys.spec.js (asserts every non-bespoke HOTKEYS row works; undo rows are bespoke/documentation-only), room-sizer.spec.js (Edit room box context path, room delete confirm), annotation-model.test.js (node tests for undo stack + countItemsInRect/collectItemsToDeleteInRect/deleteCollectedItems Delete Area core)
- **Modals:** `contextMenu`, `toolContextMenu`, `deleteZoneModal`, `clearPageConfirmModal`, `counterLineTypeDetailsModal`, `deleteCounterLineTypeConfirmModal`, `linePropertiesModal`, `noteModal`, `multiplyZoneModal`, `roomDeleteConfirmModal`
- **Hotkeys:** Ctrl+Z — Undo (bespoke row, hand-written handler), Ctrl+Shift+Z — Redo (bespoke row), Esc — Close modal / Cancel, Enter — Finish polyline / Exit edit mode, (no hotkey for Delete Area, Clear Page, or the context menus)
- **Features touched:** Undo/redo (50 steps), Delete Area tool, Context menus (right-click / long-press), Right-click tool settings, Line drops, Groups

## Guide gaps (doc-derived)

- Clear Page is documented in NO guide: not the buttons (#clearPage/#clearPageSidebar/status bar/#settingsClearPage), not the confirm modal, not that it clears only the current page's active canvas, not whether it is undoable
- The Redo button (#redoBtn) is never mentioned — fixing-mistakes.md names only 'the undo button in the bottom bar'
- Context-menu 'Show Length' action (ctxShowLength) appears in no guide
- The exact context-menu labels 'Edit multiplier' / 'Edit scale' are not quoted anywhere (guides say only 'edit or delete from their right-click menu')
- How to delete a single selected mark in Move mode — counting-with-counters.md says 'select and delete' but no guide states the mechanism (key? button?)
- No guide states what undo does NOT cover (page delete, project-level settings, palette edits) — only positive claims (placements, deletions, moves, scale changes, layer ops)
- Tool context menu on phones: ARCHITECTURE.md says phone long-press + burger wiring is a planned follow-up, but working-faster-with-the-keyboard.md claims 'every tool button answers a right-click' with no platform caveat
- Delete Area cancellation (Esc mid-drag, Cancel button consequences) and its empty-rectangle behavior are undocumented
- Details-modal delete confirm (#deleteCounterLineTypeConfirmModal) count scope — all pages? all canvases? — not stated

## Terminology on screen (recorded, not judged)

- "Delete area" (toolbar button title, lowercase 'area') vs guides' "Delete Area" vs internal ids "deleteZone*" (Delete Zone) — three names for one tool
- "Delete in this area?" — the Delete Area confirm heading; buttons "Cancel" / "Delete"
- "Clear Page" — heading and danger button; static placeholder body text "Are you sure?"
- "Line Properties" with inline subtitle "[color, name, drops]" on the context-menu button
- "Assign to group" (on-screen button, lowercase g) vs organizing-a-busy-sheet.md's "Assign to Group"
- "Edit multiplier" / "Edit scale" / "Edit room box" / "Show Length" — context-menu items
- "Undo" / "Redo" — bottom zoom-bar button titles; guides call the row 'the bottom bar'
- "Set / edit scale…" — Move/Measure tool right-click entry

## Open questions for the Phase-2 walk

- What is the actual mechanism to delete a selected mark in Move mode (Delete/Backspace key? a button?) — docs never say → **answered: there is none.** A Move-tool canvas click does not select a line (`state.selectedLineId` is only set from the sidebar LINES list) and Delete/Backspace are no-ops. The real mechanism is right-click → Delete (or Delete area). The guide claim needs correcting.
- Does Esc cancel a Delete Area rectangle mid-drag, and what happens when the confirmed rectangle contains zero marks? → **answered: Esc after corner 1 resets to "Click first corner" (tool stays armed); Esc with no pending corner exits to Move. A zero-content rectangle is a silent no-op — #deleteZoneModal never opens, no toast, no message.**
- What does #clearPageConfirmMessage actually read at runtime, and is Clear Page in the undo stack? → **answered: "Clear current canvas (Main)?" — and yes, one Ctrl+Z restores everything cleared.**
- When does 'Show Length' appear in the context menu and what does it do? → **answered: appears for lines (hidden for counter marks); pins a persistent length label on the line ("35'-8"") — same walk also confirmed the counter-mark menu is only Assign to group / Delete + name row.**
- Undo/redo button disabled states: when do they enable, and does a new action clear the redo stack? → **answered: both disabled on load; undo enables on first action; redo enables after an undo; any new action empties redo (verified).**
- Phone behavior of the tool context menu — long-press on tool buttons? → not walked (journey is desktop-only; walk-blocked: needs the mobile pass of J-field-tablet)
- Long-press timing on tablet: how long, and does it conflict with pan/pinch near a mark? → not walked (touch input not simulated)
- Does the details-modal delete confirm count marks across all pages AND all canvas layers? → **answered: yes — "This will remove N markers from the project"; count went 8 → 11 after placing 3 marks on a second canvas layer.**
- Does undo cover page deletion, canvas add/delete, and Artboard/palette edits, or only annotation-level operations? → **partially answered: canvas ADD is undoable (verified — 4th undo removed the added layer); type rename/recolor is undoable (verified). Page deletion and Artboard/palette edits still untested — page deletion is destructive on a 1-page sample.**
- Where exactly does the Clear Page control appear at each breakpoint? → **answered: nowhere, at any width (tested 1380/900/700/375).** Header #clearPage: unconditional `.header .replaced-by-status-bar { display:none !important }`. Sidebar #clearPageSidebar: the ≤768px `display:block` (styles.css:170) loses to the later unconditional `display:none` (styles.css:372) — dead rule. No status-bar link exists. Only entry: Project Settings modal row (#settingsClearPage), whose desktop opener (gear) demands sign-in when signed out; at ≤768px the gear is hidden and the path is the burger drawer → Settings (drawer flow not walked).
- NEW (walk-blocked): does the signed-in gear → Project Settings → Clear Page flow behave identically to the programmatic settingsModal open used in this walk? (cloud sign-in required)

## Naive attempt

Persona: estimator who just mis-clicked forty times. Created "Floor Drain" via + Add (first stumble: the dialog has a tab labeled "Create" AND a button "Create Counter" — a blind click on "Create" does nothing new), placed 40 marks ([img/fix-mistakes-01.png](img/fix-mistakes-01.png)). Undo was found instantly — footer ↶ plus Ctrl+Z both worked, one mark per press. The eraser-looking "Delete area" toolbar button was found by hover title; first instinct was to DRAG a box — nothing visibly happened (the only hint is 11px status-bar text "Click first corner"), then two separate clicks accidentally produced the "Delete in this area? … 16 counter(s)" confirm. Right-click on a mark worked once I noticed click-away (not Esc) closes the menu. Rename/recolor found via the sidebar pencil ✎. **Clear a page: gave up.** Hunted the pages list (right-click: nothing), empty canvas right-click (nothing), then the gear — which opened a Sign In form. Roughly 2 minutes to do undo/area-delete/edit; clear-page never found.

## Friction findings

| # | severity | what happens | why it hurts | verdict |
|---|----------|--------------|--------------|---------|
| 1 | blocker | "Clear Page" has no visible control at any viewport width: the header button is killed by an unconditional `display:none !important`, the sidebar button's mobile `display:block` (styles.css:170) is overridden by a later unconditional `display:none` (styles.css:372), and the documented status-bar action doesn't exist. The only live path is Project Settings — and signed out on desktop the gear opens **Sign In** instead ([img/fix-mistakes-07.png](img/fix-mistakes-07.png)) | A local, offline-capable feature is gated behind a cloud login; a signed-out estimator literally cannot clear a page except by delete-area-ing the whole sheet, which nothing suggests | **CONFIRMED** — re-driven headlessly at 1380/900/700/375: both dedicated buttons invisible at every width; signed-out desktop `#settingsGearBtn` click opens the "Sign In" modal (gated on `state.supabaseSession?.user`). Scope note: at ≤768px the drawer gear `#sidebarLogoGear` opens Project Settings **without** sign-in and the Clear Page row is present (reproduced signed-out at 375) — the login gate is desktop-only |
| 2 | stumble | Delete area ignores the drag gesture everyone tries first (and the Phase-1 docs promised): mousedown silently becomes corner 1, mouseup does nothing, and there is no rubber-band preview — only tiny status-bar text "Click first corner / Click second corner" | The tool appears broken for the first 10 seconds; the persona discovered the two-click rhythm by accident | **DOWNGRADED** (two sub-claims refuted; core drag mismatch stands at stumble) — re-driven: press-drag-release → no modal, corner 1 registers **at the release point** (the trailing click event), not at mousedown, and status flips to "Click second corner". BUT a dashed rubber-band preview DOES exist (app.js:1789–1796, redrawn on every mouse move once corner 1 is set) — it is invisible only while the mouse is still. Screenshot-verified. Bonus bug the walker missed: `ctx.strokeStyle = 'var(--red)'` is an invalid canvas color, so the band renders in whatever stroke color was last used (green in repro), never the intended red |
| 3 | stumble | Clear Page confirm reads "Clear current canvas (Main)?" under a "Clear Page" heading ([img/fix-mistakes-08.png](img/fix-mistakes-08.png)) | User asked to clear a *page*, is asked about a *canvas* — software word, and the page/layer scope question it raises is exactly what a nervous user needs answered plainly | **CONFIRMED** — reproduced verbatim (heading "Clear Page", body "Clear current canvas (Main)?"). Verifier adds: the collision is worse than wording — "Clear Page" actually clears only the current page's *active layer* (import-clear.spec.js asserts this), so the heading itself is inaccurate |
| 4 | stumble | Guides say a single mark can be deleted by selecting it in Move mode — walked: a Move-tool click on a line does not select it (`state.selectedLineId` stays null; selection only exists in the sidebar LINES list) and Delete/Backspace do nothing | Users following the guide conclude deletion is broken; the real mechanism (right-click → Delete) goes unfound | **CONFIRMED** — guide quote verified (counting-with-counters.md:36 "Switch to the **Move** tool to select and delete a mark"); code verified: `state.selectedLineId` is written only from features/lines-list.js (sidebar rows) and no Delete/Backspace deletion handler exists in app.js, hotkeys.js, or features/* |
| 5 | papercut | Esc does not close the mark right-click menu (click-away does) — but Esc DOES close the tool right-click menu, modals, and the pending delete-area rectangle | Muscle-memory inconsistency between two nearly identical menus | **CONFIRMED** — re-driven: with `#contextMenu` open, Esc leaves it `display:block` (the global Esc chain has no contextMenu branch — it silently drops the armed tool instead); click-away closes it. `#toolContextMenu` closes itself with a capture-phase Escape handler (features/tool-context-menu.js:112) |
| 6 | papercut | After a delete-area confirm the tool stays armed with no visible mode indicator on canvas; two stray clicks queue another delete. An empty rectangle is a silent no-op (no feedback at all) | The persona right-clicked a mark while still armed and briefly believed the context menu was broken | **KILLED** (central claim false) — re-driven: an empty rectangle shows a 2-second toast modal "No items in this area." (app.js:4696 `showToast`; reproduced on screen, screenshot taken). The remaining half — tool stays armed — is the same persistence every drawing tool has, and any rectangle with contents is gated by the count-and-confirm dialog, so nothing destructive happens silently |
| 7 | papercut | Creating a counter arms the counter tool immediately (good), but creating a line type from + Add does NOT arm the line tool, and clicking Quick Line afterward opens the choose-type dialog again even when only one type exists | Inconsistent momentum: the persona placed 2 accidental counter marks while believing the line tool was active | **CONFIRMED** — re-driven: after `#addLineType` → Create, `state.tool` stays NONE (the `#lineTypeCreate` handler at app.js:3217 never sets it) while counter create arms TOOL.COUNTER (features/counter.js:173); `#quickLine` unconditionally opens the choose modal (app.js:3035 — no single-type shortcut). Precise scope: the choose-modal's own Create tab DOES arm the tool (features/choose-create-line-type.js:105) — only the sidebar + Add path is inconsistent |

## Proposals

- **rework — Delete area should accept press-drag-release as one gesture** (keep two-click for touch) and draw a live rubber band while a rectangle is pending. Spirit: (1) 3 actions → 1 gesture on the happy path; (2) n/a wording; (3) removes the need to notice status-bar micro-text and removes the "is it broken?" pause; (4) drag-a-box is the first thing every plumber tries — it would be found with zero reading. **spiritPass: yes** — [verified, NARROWED: the rubber-band half is already implemented (app.js:1789) and must be dropped from the proposal; what remains is (a) accept press-drag-release and (b) fix the band's broken color — `ctx.strokeStyle = 'var(--red)'` is invalid in canvas 2D so the band renders in a stale leftover color. The narrowed version still passes all four]
- **gap — Give Clear Page a visible, local home**: un-dead the sidebar button (delete the stale `display:none` at styles.css:372 or scope it) and/or add "Clear this page" to the pages-row context. Spirit: (1) 4 gated steps → 2; (2) label it "Clear this page"; (3) removes the sign-in dependency for a purely local action and removes two permanently-hidden dead buttons; (4) the pages list / a visible button is where an unguided user hunted first. **spiritPass: yes** — [verified: gap reproduced; note it is desktop-only — the ≤768px drawer gear already opens Project Settings (and Clear Page) without sign-in, so the fix targets desktop signed-out. Simplicity budget is real: deletes a dead CSS rule and removes the sign-in dependency]
- **polish — Reword the Clear Page confirm** to trade language: "Remove all marks from this page? (layer: Main)". Spirit: (1) same steps; (2) "marks/page" not "canvas"; (3) removes the page-vs-canvas terminology collision; (4) instantly understandable. **spiritPass: yes** — [verified, with a wording correction: "from this page" would overstate scope — the action clears only the active layer, so the layer qualifier must stay load-bearing, e.g. "Remove all marks from this page's Main layer?"]
- **polish — Esc closes the mark context menu**, matching the tool menu, modals, and the delete-area rectangle. Spirit: (1) one keystroke recovery everywhere; (2) n/a; (3) removes a behavioral fork between twin surfaces; (4) Esc is universal muscle memory. **spiritPass: yes** — [verified: inconsistency reproduced; the fix mirrors an existing pattern (features/tool-context-menu.js:112) rather than inventing UI]
- **polish — Arm the line tool after creating a line type from + Add**, exactly as counter creation already does; skip the re-choose dialog when only one type exists. Spirit: (1) removes one modal + one decision; (2) n/a; (3) removes an inconsistency between the two + Add flows; (4) matches the expectation the counter flow already teaches. **spiritPass: yes** — [verified: the choose-modal's Create tab already arms the tool (features/choose-create-line-type.js:105), so this copies proven in-app behavior to the sidebar path]
- **teach — Fix the guide claim about deleting a single mark**: counting-with-counters says "select in Move mode and delete"; reality is right-click → Delete (no canvas selection, no Delete key). Adding a selection+Delete-key model would add machinery the right-click already covers, so teach the existing 2-action path instead. **spiritPass: yes (as teaching; a new selection model would fail the simplicity budget)** — [verified: guide claim and code reality both checked; teach is the right verdict]
- **keep — Undo/redo exactly as it is**: visible footer buttons + hotkeys, disabled states that show stack state, redo cleared by new actions, 50 steps, and coverage that includes area deletes (one-step restore), type renames/recolors, and layer adds. Nothing to remove. **spiritPass: yes** — [verified: one-step area-delete restore re-driven during verification]
- **keep — The delete-area confirm that counts what's inside by kind** ("10 counter(s), 1 line run(s) (35.70 ft), 1 note(s)") — the single best trust moment in the journey. **spiritPass: yes** — [verified: confirm re-driven ("4 counter(s), 1 line run(s) (17.34 ft)") — the count is live and accurate]
- **keep — The type details dialog**: rename/recolor/re-icon propagates live to every placed mark, and the delete confirm states the project-wide count ("This will remove 11 markers from the project") across all pages and layers. **spiritPass: yes** — [verified against walker evidence + item-details.spec.js; not re-driven]

## Guide actions

*(Phase 5)*

## Walk notes

**Environment:** headless Chromium (Playwright) against a local static server on port 4109, `/app/` + samples/sample-plan.pdf loaded via #pdfInput, desktop viewport 1380×900, signed out, no cloud calls. Scale seeded programmatically (1/8" = 1') so line lengths read in ft — scale-setting belongs to J-set-a-scale, not this journey.

**Not walked (and why):**
- Long-press context menu on touch (mark + tool buttons) — journey Mobile: no; touch not simulated.
- Mobile burger-drawer → Settings → Clear Page flow — only button visibility was checked at 375×812 (both dedicated Clear Page buttons hidden; gear hidden; drawer not exercised).
- Signed-in Project Settings entry — cloud gate. Exact wall (signed out, desktop, gear click): a modal titled **"Sign In"** with fields **"Email" / "Password"** and buttons **"Cancel" / "Sign In"**. The walk opened #settingsModal programmatically instead to read the menu ("Name / Upload / Save Project to Cloud … Clear Page / Advanced") and drive the Clear Page confirm locally.
- Page-deletion undo coverage — destructive on the single-page sample; left open.
- 50-step depth not exhaustively pumped; `UNDO_STACK_SIZE = 50` confirmed in constants.js and behavior spot-checked.
- Polyline/zone/room-box context-menu variants (Edit multiplier / Edit scale / Edit room box) — items confirmed present-but-hidden in the menu DOM for non-matching marks; walking them belongs to J-multi-scale and J-hvac-room-sizing.

**Duplicate-surface moments observed:**
- Two right-click menus (#contextMenu on marks vs #toolContextMenu on tool buttons) behave differently on Esc: tool menu closes, mark menu doesn't.
- Two "edit this type" surfaces: sidebar pencil ✎ → Counter details dialog (name/color/icon/delete) vs counter-tool right-click → "Counter Settings…" — adjacent jobs, different dialogs, both one gesture apart.
- Clear Page (Settings) vs Delete area spanning the whole sheet — the second is the only discoverable way to do the first, and the first is undoable-but-hidden.
- Counter modal: tab "Create" vs button "Create Counter" — two controls named nearly identically in one dialog.
- + Add counter arms its tool on create; + Add line type doesn't — same surface pattern, different behavior.

**Software-language sightings (quoted):** "Clear current canvas (Main)?" · "Counter Settings…" · "No settings for this tool." · "This will remove 8 markers from the project." · "canvas" in the Clear Page confirm vs "Page" in its own heading · "[color, name, drops]" · "1 line run(s)" (pluralization) · status-bar "Click first corner" / "Click second corner" (good words, wrong visibility).

**Screenshot index:**
- [img/fix-mistakes-01.png](img/fix-mistakes-01.png) — the forty mis-clicks placed; live tally 40 in sidebar + legend
- [img/fix-mistakes-02.png](img/fix-mistakes-02.png) — mark right-click menu (Assign to group / Delete / name row)
- [img/fix-mistakes-03.png](img/fix-mistakes-03.png) — line right-click menu (Line Properties [color, name, drops] / Show Length)
- [img/fix-mistakes-04.png](img/fix-mistakes-04.png) — Line Properties dialog (name, color swatch, drops ±1/±10)
- [img/fix-mistakes-05.png](img/fix-mistakes-05.png) — demo moment: "Delete in this area?" counting 10 counters + 1 line run + 1 note
- [img/fix-mistakes-06.png](img/fix-mistakes-06.png) — type details dialog (rename/recolor/re-icon a whole type)
- [img/fix-mistakes-07.png](img/fix-mistakes-07.png) — friction: signed-out gear click answers with the Sign In modal (the road to Clear Page)
- [img/fix-mistakes-08.png](img/fix-mistakes-08.png) — Clear Page confirm: "Clear current canvas (Main)?"

## Demo moment

Click the eraser, tap two corners around the messiest part of the sheet, and the app answers with a receipt before touching anything: **"Delete in this area? — In this area: 10 counter(s), 1 line run(s) (35.70 ft), 1 note(s)."** Click Delete, then press Ctrl+Z once — every one of them comes back. Ten seconds, and it sells the whole safety story: the app counts before it deletes, and nothing is ever more than one undo away. ([img/fix-mistakes-05.png](img/fix-mistakes-05.png))

## Verification (2026-08-02)

**Method:** adversarial re-drive of the real app — headless Chromium (Playwright) against a throwaway static server on port 4309, `/app/` + samples/sample-plan.pdf via `#pdfInput`, seeded marks (4 counters, 1 line), signed out, zero cloud calls. Every friction row was either re-driven live or verified against the exact source lines; all six severity-bearing findings (1, 2, 3, 5, 6, 7) were reproduced in the browser, finding 4 was verified from the guide text plus code.

**Reproduced:**
- Clear Page visibility swept at 1380/900/700/375: `#clearPage` and `#clearPageSidebar` invisible at every width; signed-out desktop gear → "Sign In" modal. **New scope fact:** at ≤768px the drawer gear (`#sidebarLogoGear`) opens Project Settings *without* sign-in and the Clear Page row is present — the cloud gate is desktop-only.
- Delete area drag: press-drag-release registers corner 1 at the **release** point (via the trailing click event) and never completes — drag mismatch confirmed. But the dossier's "no rubber-band preview" was wrong: app.js:1789–1796 draws a dashed preview rectangle that follows the mouse once corner 1 exists (screenshot-verified). It is invisible only while the mouse is stationary, which is why a two-programmatic-clicks walk never saw it.
- Empty delete rectangle: **not** a silent no-op — a 2-second toast modal "No items in this area." appears (finding 6 killed).
- Esc vs `#contextMenu`: reproduced (menu stays open, Esc silently drops the armed tool instead); `#toolContextMenu` has its own capture-phase Esc close.
- Clear Page confirm wording reproduced verbatim; + Add line type leaves the tool unarmed while counter create arms; Quick Line always reopens the choose dialog; delete-area confirm counted live contents correctly ("4 counter(s), 1 line run(s) (17.34 ft)"); one Ctrl+Z restored the area delete.

**What the walker missed:**
1. **The rubber band exists but renders in the wrong color** — `ctx.strokeStyle = 'var(--red)'` (app.js:1793) is an invalid canvas-2D color, so the assignment is silently ignored and the dashed box strokes in whatever color the previous draw left behind (green in repro). One-line fix, and it materially strengthens the two-click tool's feedback story.
2. **The mobile drawer is an ungated path to Clear Page** — the blocker is real but desktop-scoped; the dossier's ⚠ on step 13 should not read as "all widths".
3. **"Clear Page" clears only the active layer** (import-clear.spec.js asserts this) — the heading, not just the body text, is inaccurate; any rewording must keep the layer qualifier.
4. The walker's summary carried an 8th finding (counter dialog tab "Create" vs button "Create Counter") that never made the friction table — correctly so: `#addCounter` opens directly on the Create tab, and a tab-plus-submit-button pair is a standard pattern. Not a finding; the naive-attempt narrative already covers it as color.

**Verdict tally:** 5 confirmed (1, 3, 4, 5, 7) · 1 downgraded-in-content (2 — drag mismatch stands at stumble, two sub-claims struck) · 2 killed (6; plus the untabled "Create tab" summary item). All 9 proposals audited: 8 verified as written or with corrections noted inline, 1 (the rework) narrowed because half of it is already built.
