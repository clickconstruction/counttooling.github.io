# J6 — Details at other scales; typical floors multiplied

Personas: P E · Status: ● walked 2026-08-02 · re-walked 2026-08-09 (headless Chromium 1380×900, local static server on 4106, sample-plan.pdf; view-link leg stubbed locally — no cloud; re-walk aborted all supabase/functions requests at the driver)

> Seeded from the Phase-1 cross-index workflow (2026-08-02). Phase 2 walk done: route
> corrected below, friction/proposals/demo added, open questions answered inline.

## Entry points

- **header** — #multiplyZoneBtn — title "Multiply Zone (right-click for settings)" (click to arm; right-click opens Multiply Zone Settings via #toolContextMenu)
- **header** — #scaleZoneBtn — title "Scale Zone (region-specific scale)" (Set Scale glyph rotated 180) (click to arm; right-click toasts (NO_SETTINGS_TOOLS) *(stale as of commit 6f3d75e — right-click now opens "Scale Zone Settings…", see Verification)*; activation refused with set-scale-first toast if page has no scale)
- **sidebar** — #multiplyZoneBtnSidebar — "Multiply Zone (right-click for settings)" (click; right-click for settings)
- **sidebar** — #scaleZoneBtnSidebar — labeled "Scale zone" (click)
- **hotkey** — X — Multiply Zone mode (Macros table row "Multiply Zone mode"); Scale Zone has no hotkey (Macros shows em-dash) (keypress)
- **right-click** — #ctxEditMultiplyZone "Edit multiplier" / #ctxEditScaleZone "Edit scale" + Delete on an existing zone mark (owner-only; hidden for viewers) (right-click (long-press on touch) a zone on canvas)
- **modal** — Scale modal (#scaleModal) reused for scale-zone create/edit via scaleModalApplyTarget === 'zone' (features/scale.js applyScaleObjectToZoneOrPage) (opens automatically after drawing a scale-zone rect, or from the zone's context-menu Edit scale)
- **header** — #deleteZoneBtn / #deleteZoneBtnSidebar "Delete area" — rectangle-delete that also removes zones, with #deleteZoneModal confirm (click tool, drag rectangle)

## Current route (walked 2026-08-02) — 6 steps, 4 decision points

0. *Precondition:* set the page scale. On this (non-standard-size) sheet the Set Scale dialog opens with "⚠ This page isn't a standard sheet size" and a best-guess sheet (ANSI D) preselected — **decision 1**: accept the correction or pick "Non-standard — don't correct". Taking the preset with the wrong guess made the 65'-0" wall measure 173'-1" (img/multi-scale-and-repeats-01.png); the "Scale set — verify it against a known dimension" toast is the only nudge to check.
1. Pick the Scale Zone tool (header or sidebar; no hotkey) and click **two corners** around the detail — footer hints "Click first corner" → "Click second corner". Dragging does NOT draw the rectangle (mousedown sets corner 1, release is ignored — see friction #3).
2. The same scale dialog opens retitled "Scale for zone" (no sheet warning in zone mode) — **decision 2**: two-point / preset / custom. Applying a preset drops the zone with its label (default: centered, e.g. `1/4" = 1'`) on the sheet. **Trap on compressed sheets:** if the page scale took the sheet-size correction (the dialog's own preselected recommendation), zone presets do NOT take it — page and zone numbers then disagree by the correction factor (see friction #10).
3. Verify with Measure fully inside the zone — it uses the zone's scale automatically (the 19'-9" conference width reads 9'-3" under a 1/4" zone, img/multi-scale-and-repeats-05.png). A measure with one point outside the zone silently falls back to the page scale (25'-11").
4. Pick the Multiply Zone tool (button or X) and click two corners around the repeated area. The value dialog previews the catch: "In this area: 3 counter(s), 0 line run(s) (0.00 ft)" (img/multi-scale-and-repeats-04.png) — **decision 3**: multiplier value (default from settings = 2).
5. Apply — **decision 4** is silent: whose anchor point is inside counts (an icon straddling the edge with its anchor outside stays 1×). Apply also silently drops the tool back to Move (both zone tools are one-shot; re-verified 2026-08-09) — a second typical floor means re-arming the tool, and clicks in between pan/select instead of drawing.
6. Read the totals — sidebar Summary `WC [13]`, footer `[13 | 0.00 ft]`, and legend all reflect the multiplication; the COUNTERS row keeps showing the raw 7 placed marks — while the LINE TYPES row (re-walk) shows the *multiplied* footage (Waste `1 · 35.41 ft` → `1 · 106.22 ft` after ×3): counts stay raw, footage goes effective, in the same sidebar. The sheet itself is unchanged apart from the dashed zone + ×3 label.

## Evidence

- **Telemetry visibility:** Journey start rides session_start + project_open (and project_save fires on the saves that persist zone edits, via maybeLogProjectSaveEvent). counter_marker_added / line_added fire only if the user places marks during this journey — they carry no zone context. Blind spots: zone creation (both kinds), the multiplier value chosen, zone edit/delete, Measure-inside-zone, and settings changes emit no dedicated event; export_canvas / export_pdf fire only if the journey continues into an export. There is no zone_added event.
- **Guide coverage:** [scale-zones-and-multiply-zones.md](/guides/scale-zones-and-multiply-zones/) — Primary article: create steps for both zones, containment rules (line fully inside = zone scale; anchor inside = multiplied), Measure respects zones, scale zones can't overlap, multiply zones change totals not marks, edit/delete via right-click menu; [setting-the-scale.md](/guides/setting-the-scale/) — Tips bullet pointing mixed-scale sheets to scale zones instead of re-scaling the page; [how-to-do-a-pdf-takeoff.md](/guides/how-to-do-a-pdf-takeoff/) — When to reach for each zone within the overall takeoff flow; [measuring-runs-lines-and-polylines.md](/guides/measuring-runs-lines-and-polylines/) — Measure tool uses the zone's scale when both points fall inside a scale zone; [fixing-mistakes.md](/guides/fixing-mistakes/) — Zone context menu (edit multiplier/scale, delete); Delete Area confirmation counts zones; right-click Multiply Zone button for settings; [working-faster-with-the-keyboard.md](/guides/working-faster-with-the-keyboard/) — X hotkey; right-click on Multiply Zone opens its settings directly; [reports-and-exports.md](/guides/reports-and-exports/) — Footer totals run with multiply and scale zones already applied; [measuring-room-volumes.md](/guides/measuring-room-volumes/) — Room boxes respect scale zones; multiply zones deliberately do NOT multiply volumes; [verifying-your-scale.md](/guides/verifying-your-scale/) — A wrong page scale flows into scale-zone comparisons and exports; [electrical-takeoff.md / hvac-takeoff.md / plumbing-takeoff.md](/guides/electrical-takeoff / hvac-takeoff / plumbing-takeoff/) — Trade-context use: x10 typical floors (electrical), detail scale zones (plumbing isometrics, HVAC details)
- **Specs:** scale-zone-tool.spec.js — activation gated on page scale, inside/partial/outside endpoint rules, getEffectiveScaleForLine, straddling lines fall back to page scale, zone-modals.spec.js — Multiply Zone Apply creates zone with typed multiplier, edit path updates multiplier, Cancel clears pending state, Delete Zone cancel/confirm, multiply-zone-settings.spec.js — settings modal persists {showLabelOnZone, defaultMultiplier, labelSize, labelPosition} to state, tool-context-menu.spec.js — right-click Multiply Zone → Settings; Scale Zone in NO_SETTINGS_TOOLS toasts, line-metrics.test.js — unit: scale-zone override in effectiveScaleForLine, multiply-zone factor in lineLengthForTotals, render-pixels.spec.js — multiply + scale zones in the pixel-regression fixture (live overlay + both export renders), summary-detail.spec.js — multiply-zone-adjusted counts in the Summary count-detail modal, output.spec.js — scale zone around a line passes the pre-export scale check without a page scale, view-only.spec.js / viewer-scale.spec.js — viewer gating (zone tools hidden; scale zones stay owner-only)
- **Modals:** `multiplyZoneModal`, `multiplyZoneSettingsModal`, `deleteZoneModal`, `scaleModal`, `setScaleFirstModal`
- **Hotkeys:** X — Multiply Zone mode (constants.js TOOL.MULTIPLY_ZONE; Macros table + working-faster-with-the-keyboard.md), Scale Zone — no hotkey (Macros table shows em-dash; tool reached only via buttons), S — Set Scale (prerequisite: scale zone activation is gated on a page scale), Esc — cancel / close (resetScaleModalZoneMode branch clears zone-entry state)
- **Features touched:** Scale zones, Multiply zones, Live footer totals, Right-click tool settings, Per-page scale (two-point, presets, or custom), Always-feet totals

## Guide gaps (doc-derived)

- Multiply zones ALSO can't overlap each other — app.js toasts 'Cannot place multiply zone: It overlaps an existing zone. Items cannot be multiplied more than once.' — but the guide's Good-to-know states the no-overlap rule only for scale zones
- Scale Zone activation requires a page scale first (refuses with the set-scale-first toast, pinned in scale-zone-tool.spec.js); no guide mentions this gate
- Multiply Zone Settings modal contents (Show label on zones, Default multiplier, Label size, Label position) are nowhere documented — keyboard guide only says right-click opens settings
- The Multiply Zone value modal's live preview line ('In this area: N counter(s), N line run(s) (N ft)') is not described in any guide
- Viewer visibility of zones is undocumented: sharing-and-view-links.md covers viewer scale sharing but never says whether view-link recipients see zones or that zone creation/edit is owner-only (ARCHITECTURE: multiply/scale/delete-zone tools hidden for viewers; scale zones stay owner-only)
- 'First containing zone wins' precedence when a point could match multiple zones (ARCHITECTURE bullet) is not in the guides
- Exact containment semantics for lines in multiply zones: guide says 'anchor falls inside', ARCHITECTURE says 'endpoints fall inside', and scale zones require 'fully inside' — the user-facing rule for a line straddling a multiply-zone boundary is not spelled out
- The pre-export scale check (Copy to PipeTooling) accepts a scale zone around a page's lines in lieu of a page scale (output.spec.js) — reports-and-exports.md doesn't mention zones satisfying the check

## Terminology on screen (recorded, not judged)

- "Multiply Zone (right-click for settings)" — header/sidebar button title
- "Scale Zone (region-specific scale)" — button title; sidebar label is lowercase "Scale zone"
- "Delete area" — button title, vs guide heading "Delete Area" and ARCHITECTURE's "Delete Zone tool" (ids are deleteZoneBtn/deleteZoneModal)
- "Enter multiplier" — value modal label; buttons "Cancel" / "Apply"
- "In this area: 0 counter(s), 0 line run(s) (0 ft)" — multiplyZonePreview line
- "Show label on zones" / "Default multiplier" / "Label size" / "Label position" — Multiply Zone Settings modal
- "Edit multiplier" / "Edit scale" — canvas context-menu items for zones
- "Cannot place multiply zone: It overlaps an existing zone. Items cannot be multiplied more than once." — overlap toast
- "Cannot place scale zone: it overlaps an existing scale zone." — overlap toast (lowercase 'it', unlike the multiply variant)
- "Multiply Zone mode" — Macros table wording for the X hotkey; scale-zone row reads "Scale Zone (rotated Scale icon in header/sidebar)"
- Guide uses "×10 zone" / "×3 multiply zone" notation for the multiplier
- *(walk-confirmed additions)* "Set Scale ⚖ first to use Scale Zone." — gate toast; "Scale for zone" / "Edit zone scale" — zone-mode titles of the Set Scale dialog; "Multiply Zone Settings…" — tool right-click menu item; "In this area: 0 counter(s), 0 line run(s) (0)" — unitless preview when no page scale; "Non-standard — don't correct" — sheet dropdown escape hatch; "It looks compressed or re-boxed" — sheet warning body (PDF jargon); footer bracket totals "[13 | 0.00 ft]"

## Open questions for the Phase-2 walk

- Is overlap blocked only within the same zone type — can a multiply zone legally overlap a scale zone, and what happens to a line inside both? → **Same-type only.** A multiply zone drawn fully inside the scale zone opened the value dialog normally (no toast). Overlapping an existing *multiply* zone never opens the dialog — toast: "Cannot place multiply zone: It overlaps an existing zone. Items cannot be multiplied more than once." A line inside both was not exercised (no lines placed inside the overlap) — walk-blocked this pass.
- Scale Zone without page scale: modal or toast, exact wording/next step? → **Toast-style modal** (#setScaleFirstModal): "Set Scale ⚖ first to use Scale Zone." Auto-dismisses ~2.5s, has **no button and is not clickable**; canvas clicks while it shows are swallowed; the previously armed tool stays armed (img/multi-scale-and-repeats-03.png).
- Rectangle interaction: two-click vs drag — and the tablet/phone aim-loupe variant? → **Two-click only.** Drag sets corner 1 on mousedown and ignores the release; footer keeps saying "Click second corner" and the next click completes a rectangle you didn't aim. Aim-loupe variant not walked (journey is desktop-only; Mobile: no).
- Does Esc mid-rectangle cancel cleanly, and is zone creation a single undo step? → **Yes and yes.** Esc after corner 1 resets to "Click first corner" with the tool still armed; Esc in the "Scale for zone" dialog discards the pending rectangle entirely (no zone created, tool stays armed). One Ctrl+Z removes a multiply zone *and* its multiplier effect (Summary 13→7); redo restores it — but only via Ctrl/Cmd+Shift+Z, Ctrl+Y is unbound.
- Multiply value modal on an empty rect: does Apply still create the zone? → **Yes.** "In this area: 0 counter(s), 0 line run(s)" + Apply creates a zone with no effect on totals; it exists invisibly (and would block a future overlapping multiply zone). With no page scale the preview length shows unitless "(0)" instead of "(0.00 ft)".
- Do view-link recipients see zone rectangles and ×N labels, with multiplied totals? → **Yes** (walked against a locally-stubbed get-view-project, no cloud): both zones render with their labels, Summary/footer read the multiplied [13], zone tools are hidden, and the COUNTERS row shows the raw 7 (img/multi-scale-and-repeats-07.png).
- Does 'Edit scale' reopen the modal pre-filled, and can zones be resized/moved? → **Not pre-filled** — dialog retitles "Edit zone scale" but no preset is highlighted and the custom fields are empty. Zones cannot be moved or resized: context menu offers only Edit scale/multiplier + Delete. ("Edit multiplier" *is* prefilled — input showed the current 3.)
- Where does the ×N label sit by default, and the label settings? → **Center**, size 14, "Show label on zones" on, five positions (Center/Top-left/Top-right/Bottom-left/Bottom-right) via right-click tool button → "Multiply Zone Settings…", which also holds Default multiplier = 2 (img/multi-scale-and-repeats-06.png). Centered labels sit on top of room names on a dense sheet ("×3" over MEN, "1/4" = 1'" over CONFERENCE).
- What counts as 'inside' for a counter icon straddling the boundary? → **The anchor (click point), pixel-exact.** A marker with its anchor ~5pt outside the edge but icon overlapping the zone stayed 1× (Summary +1); anchor just inside went 3× (+3).
- *(new, 2026-08-09)* Is it intentional that zone presets never take the sheet-size correction? `features/scale.js` justifies it as "zones … inherit the page scale", but a zone *preset* is an independent paper-scale claim on the same compressed paper — walk showed page (corrected) and zone (uncorrected) disagreeing 2.67× on one sheet. Needs a product decision → friction #10 / rework proposal.
- *(re-verified 2026-08-09)* Multiply-overlap toast fired live with the exact Phase-1 wording; Esc-mid-rectangle, "Scale for zone" Cancel (no zone created, tool stays armed), X hotkey, Ctrl+Z/Ctrl+Shift+Z round-trip, and the anchor-inside measure fallback (straddle 30'-7" vs inside 10'-2" for proportional spans) all reconfirmed.

## Naive attempt

Booted, loaded the plan, eye went straight to the header toolbar: the two tooltips
("Multiply Zone (right-click for settings)", "Scale Zone (region-specific scale)") made both
tools findable in seconds. Then three wrong turns before the goal:
(1) the Set Scale dialog opened with its title and tabs clipped above the 900px-tall window
and the wheel wouldn't scroll it, so only the preset list was workable; (2) clicking the
1/8" preset took the hidden ANSI-D "correction" with it — the 65' wall measured 173'-1",
caught only because the toast said to verify; recovered via the sheet dropdown →
"Non-standard — don't correct" (and by then the header Set Scale button had disappeared —
re-entry is the sidebar scale chip or S). (3) Tried to *drag* the multiply rectangle; the tool
half-armed, and a later stray click produced a zone previewing "0 counter(s)" — cancelled and
used two clicks. Also lost the first Scale Zone corner click to the "Distance:" toast overlay
left over from measuring. Goal reached with both zones verified in ~30 actions, roughly a
third of them recovery.

*Re-walk 2026-08-09 (independent naive pass):* same eye-path — both tooltips found the tools
unaided. Differences: this time the preselected ANSI-D correction was *accepted* (it is the
dialog's own recommendation), which set the trap in friction #10: the 1/4" zone preset then
disagreed with the corrected page scale by 2.67×. Also tried to drag the multiply rectangle
first (silent no-op, no hint anywhere — footer hint only appears after the first *click*),
and lost two scale-zone corner clicks to the 2s "Scale set" and 5s "Distance:" toast
overlays. ~25 actions to both zones confirmed; the multiply half behaved exactly as
expected, the scale half produced a number that only looked right.

## Friction findings

| # | severity | what happens | why it hurts | verdict |
|---|----------|--------------|--------------|---------|
| 1 | blocker (≤900px-tall windows) | Set Scale dialog is ~1109px tall; at 1380×900 the title, the "Select two points"/"Architectural & Engineering" tabs, and part of the sheet warning sit above the viewport and mouse-wheel won't scroll the overlay (img/multi-scale-and-repeats-02.png) | The exact path the warning recommends ("For an exact result, use **Select two points** instead") is invisible and unclickable on a normal laptop; users can only reach the presets — the risky path | CONFIRMED (verifier reproduced: card 1109px, top −104.5px at 900px, tabs at −41.5px, `overflow-y: visible` on card and overlay, wheel moved nothing) |
| 2 | stumble | On a non-standard sheet the warning preselects a best-guess sheet size; one preset click silently applies the correction — 65'-0" wall measured 173'-1" (img/multi-scale-and-repeats-01.png) | Wrong numbers look plausible; the only guards are the verify toast and the tiny "· ANSI D" suffix on the sidebar scale chip. Escape hatch is a dropdown option ("Non-standard — don't correct") living inside the possibly-clipped warning box | CONFIRMED (verifier reproduced the mechanism: ANSI_D preselected on the sample sheet, one preset click silently stamped `correctionFactor: 0.375`, chip suffix the only trace) |
| 3 | stumble | Zone rectangles are two-click only; dragging (what "draw a rectangle" suggests) sets corner 1 on mousedown, ignores the release, and the *next* click anywhere completes an unintended zone — preview reads "In this area: 0 counter(s)" | Half-armed state + stray zone; the 0-counter preview is the only clue something went sideways | CONFIRMED (verifier reproduced: mousedown-drag-release left corner 1 armed, no modal; next click opened the dialog previewing "In this area: 0 counter(s), 0 line run(s) (0.00 ft)") |
| 4 | stumble | The "Distance:" result is a centered modal overlay that dims the whole sheet for **5s** (`showToast(..., 5000)`), swallows every canvas click, and clicking it does NOT dismiss it (re-verified 2026-08-09); the 2s "Scale set" toast behaves the same. Arming Scale Zone right after measuring loses the first corner click | Silent click loss right at the measure→zone hand-off, which is exactly the order this journey runs in | CONFIRMED (verifier reproduced: `#airboardToastModal` is `position: fixed; inset: 0; pointer-events: auto; rgba(0,0,0,.6)`; two canvas clicks during the toast set no zone corner and did not dismiss it) |
| 5 | papercut | COUNTERS row shows placed marks (WC 7) while SUMMARY/legend/footer show multiplied totals (WC [13]) — and the LINE TYPES row shows *multiplied* footage (35.41→106.22 ft), so within one sidebar counts stay raw but footage goes effective, nothing labeled either way (img/multi-scale-and-repeats-05.png) | Estimator pauses to decide which number goes in the bid; a reviewer sees "7" and "13" for the same item | CONFIRMED (code-verified: `lineLengthForTotals` applies the zone factor — pinned in line-metrics.test.js — while the COUNTERS list renders placed marks; matches img-05) |
| 6 | papercut | "Set Scale ⚖ first to use Scale Zone." toast (img/multi-scale-and-repeats-03.png) auto-dismisses in ~2.5s, isn't clickable, and doesn't open Set Scale | Names the fix but makes you go find it; clicks on the canvas while it shows are swallowed | CONFIRMED (verifier reproduced: `#setScaleFirstModal` visible, exact wording, zero buttons) |
| 7 | papercut | Right-click zone → "Edit scale" opens the dialog titled "Edit zone scale" but blank — no preset highlighted, custom fields empty | To nudge 1/4"→3/8" you must remember what the zone was; the on-sheet label helps only if labels are on | KILLED (refuted by verifier re-drive: the dialog's info line reads `Current: 1/4" = 1'. Choose a new scale below.` — the zone's current scale IS displayed, and in edit mode the card is short enough that the line is visible. Only the preset highlight / custom-field prefill is missing, which is cosmetic: "nudge to 3/8" is one preset click either way) |
| 8 | papercut | Zones can't be moved or resized — context menu is Edit value / Delete only; empty-rect Apply also silently creates a no-op zone | A slightly-off rectangle means delete + re-click both corners; invisible empty zones can later block "overlap" placements | CONFIRMED (verifier reproduced: zone context menu offers only Edit multiplier / Edit scale / Delete; an empty-rect Apply created a totals-neutral zone) |
| 9 | papercut | Redo is Ctrl/Cmd+Shift+Z only — Ctrl+Y does nothing (undo of a multiply zone worked as one clean step; re-verified 2026-08-09) | Windows-habit users who undo a zone and hit Ctrl+Y think the zone is gone for good | CONFIRMED (code-verified: the ctrl/meta keydown branch handles only `z`; no `y` binding exists in app.js) |
| 10 | blocker | *(new, re-walk 2026-08-09)* Zone **presets skip the sheet-size correction** the page scale applied. With the dialog's own preselected ANSI-D correction accepted for the page (chip `1/8" = 1' · ANSI D`, 3.375 px/ft), a 1/4" zone preset applies raw 18 px/ft — the same span read 40'-10" (page) vs 7'-8" (zone) where the consistent detail read is 20'-5", i.e. wrong by the 2.67× correction factor, with no warning shown in zone mode (img/multi-scale-and-repeats-08.png). `features/scale.js` comments "PAGE SCALE ONLY — never zones (which inherit the page scale)" — but zone *presets* don't inherit anything | On exactly the compressed sheets the app detects and corrects for, every scale-zone preset number is silently wrong relative to the page; detail counts land in the bid at the wrong lengths | CONFIRMED (verifier reproduced end-to-end on 4306: page preset stored 3.375 px/ft with `correctionFactor: 0.375`; zone 1/4" preset stored raw 18 px/ft — ratio 5.33 where a consistent 1/4-vs-1/8 pair is exactly 2; the same horizontal span measured 9'-2" inside the zone vs 49'-0" outside, a clean 2.67× disagreement; explicit `// zone target: no sheet correction` comments at features/scale.js preset and custom apply paths) |
| 11 | papercut | *(new, re-walk 2026-08-09)* Both zone tools disarm to Move after a successful Apply, silently; the counter tool by contrast stays armed after each mark | Placing zones on several typical floors, the clicks after the first Apply pan/select instead of drawing — my own overlap test failed silently this way before re-arming | CONFIRMED (verifier reproduced: `state.tool === TOOL.NONE` immediately after multiply-zone Apply) |

## Proposals

- **keep** — Two-click zone + live "In this area: N counter(s)…" preview + totals-only multiplication (marks untouched). Spirit: (1) happy path is 2 clicks + 1 number; (2) "In this area" is plain trade talk; (3) removes copy-pasting repeated floors entirely; (4) both buttons sit in the header with honest tooltips — found in seconds unaided. spiritPass: true [verified]
- **keep** — The "Set Scale first to use Scale Zone." gate wording and the automatic zone-scale pickup by Measure. Spirit: (1) zero extra steps when scale exists; (2) seven plain words; (3) removes a whole class of unscaled-zone errors; (4) the gate itself teaches the order. spiritPass: true [verified]
- **rework** — Cap the Set Scale dialog height to the viewport with internal scrolling (friction #1). Spirit: (1) removes wheel-fighting and blind spots — fewer steps to the two-point tab; (2) no language change; (3) deletes an invisible dead-end rather than adding chrome; (4) dialog just works on any laptop. spiritPass: true [verified — defect reproduced; the fix removes an existing dead-end rather than adding anything]
- **polish** — When the sheet-size guess is applied, put the correction in the user's face at apply time (e.g. toast "Scaled as if printed on ANSI D — measure a known wall to check") and make "Non-standard — don't correct" a visible button, not a dropdown entry (friction #2). Spirit: (1) no new steps on the correct path; (2) "as if printed on…"/"measure a known wall" is trade language; (3) removes silent 2.7× errors and the dropdown hunt; (4) the warning is where the eye already is. spiritPass: true [verified]
- **polish** — Let a drag complete the zone rectangle (mousedown = corner 1, mouseup = corner 2 when moved past a threshold), keeping two-click for tablets (friction #3). Spirit: (1) one gesture instead of two clicks; (2) matches the guide's own "draw a rectangle"; (3) removes the half-armed state and stray zones; (4) it's what an unguided hand does first. spiritPass: true [verified — drag no-op reproduced; note the highlight/room-box tools share the same two-click pattern, so the fix should cover all rectangle tools or none]
- **polish** — Move the "Distance:" readout off the canvas center (footer chip or cursor tag) and let clicks pass through it (friction #4). Spirit: (1) no lost clicks = fewer redone steps; (2) no language; (3) removes a phantom-click failure mode; (4) n/a — invisible fix. spiritPass: true [verified]
- **polish** — Name the two tallies with trade words: COUNTERS row "7 placed", SUMMARY "13 with repeats" (friction #5). Spirit: (1) removes a which-number-is-real decision; (2) "placed"/"with repeats" over "raw"/"effective"; (3) dissolves a recurring double-take without new UI; (4) reads inline where the numbers already are. spiritPass: true [verified]
- **polish** — Prefill "Edit zone scale" with the zone's current scale (highlight its preset / fill the custom boxes) (friction #7). Spirit: (1) edit becomes glance-and-adjust; (2) no language change; (3) removes remembering; (4) same dialog people already use. spiritPass: true [rejected: premise refuted — the dialog already states `Current: 1/4" = 1'.` in its info line, so "removes remembering" is a rhetorical simplicity budget (fails spirit #3); the residual preset-highlight is cosmetic]
- **rework** — Carry the page's active sheet correction into zone presets (friction #10): when the page scale holds a `correctionFactor`, apply the same factor to zone preset/custom entries and show the same "as if printed on ANSI D" note in the "Scale for zone" dialog. Two-point stays untouched (already ground truth). Spirit: (1) zero added steps — the correct number appears on the same preset click; (2) reuses the existing "printed on ANSI D" trade phrasing; (3) removes a silent 2.67× error class and removes the need to even know the sheet was compressed; (4) invisible fix — the preset just reads right. spiritPass: true [verified — error class reproduced end-to-end; needs the product decision the walker flagged, since the skip is deliberate in code]
- **polish** — Keep the zone tool armed after Apply (match the counter tool), Esc or Move to leave (friction #11). Spirit: (1) second and third typical floors are two clicks each instead of re-arm + two clicks; (2) no language; (3) removes a silent dead-click state; (4) matches what the hand already does after placing the first zone. spiritPass: true [verified — with a caution: an armed zone tool makes the post-Apply pan click a silent corner 1, the inverse papercut; ship only with the drag-completes-rectangle fix or a visible armed-state hint]
- **teach** — The straddle rule (a measure or line touching outside the zone uses the *page* scale, silently) and the anchor rule (the click point decides multiplication, not the icon) are sound but invisible. One line each in scale-zones-and-multiply-zones.md; any on-canvas UI for this would add chrome to the common case. spiritPass: false (fails #3 as UI — hence teach) [verified]
- **teach** — Ctrl+Y as a redo alias is a one-line binding, but the honest fix for friction #9 is the keyboard guide listing redo explicitly; Macros/keys already documents it in-app. spiritPass: false (fails #4 as-is for Windows-habit users; document first, alias if it recurs) [verified]

## Guide actions

*(Phase 5)*

## Walk notes

**Not walked**
- Real cloud view link — NO CLOUD rule; the viewer leg used a locally-stubbed `get-view-project` (Playwright route fulfilled on-machine; all non-localhost requests aborted by the driver). No sign-in surface was touched; the app ran signed-out ("Sign In" link visible in footer throughout). No wall text encountered because no cloud step was attempted.
- Tablet/phone aim-loupe for the zone tools — journey Mobile field: no.
- Scale-zone-over-scale-zone overlap toast ("Cannot place scale zone: it overlaps an existing scale zone.") — same-type blocking verified on the multiply side only; scale-side wording taken from Phase-1 evidence.
- A line straddling / inside both overlapping zone types (no lines were drawn inside the overlap).
- Sidebar duplicates #multiplyZoneBtnSidebar/#scaleZoneBtnSidebar (used header buttons + X throughout); Delete-area-removes-zones path (belongs to the fix-mistakes journey).
- *(re-walk)* Zone presets on a genuinely compressed real-world sheet (friction #10 was proven on the synthetic sample, where the correction itself is a false positive; the arithmetic is the same either way, but a true compressed-ARCH-D fixture would make the demo undeniable).
- *(re-walk)* Mobile/375×812 pass — journey Mobile field: no.

**Duplicate-surface moments**
- Raw vs effective counts: COUNTERS "WC 7" vs SUMMARY "WC [13]" vs footer "[13 | 0.00 ft]" vs on-plan legend "WC [13]" — four surfaces, two different answers for the same item, none labeled. Re-walk: the LINE TYPES row splits the difference — it shows the raw line *count* but the *multiplied* footage ("Waste 1 · 106.22 ft" for one 35.41 ft line inside a ×3 zone).
- Set Scale entry moves: header ruler button before a scale exists; once set, that button hides and re-entry is the sidebar scale chip ("1/8" = 1' · 1 ft = 9.0 px") or the S key — same dialog, different door depending on state.
- One dialog, three titles: #scaleModal is "Set Scale" (page, with sheet warning + verify), "Scale for zone" (create, no warning), "Edit zone scale" (edit, no prefill) — behaves differently in each costume.
- Header vs sidebar tool buttons for both zone tools (title-case tooltip in header, lowercase "Scale zone" label in sidebar).

**Environment quirks**
- 1380×900 viewport, deviceScaleFactor 2, headless Chromium; the modal-clipping finding (#1) is viewport-height-dependent — retest at ≥1050px tall before dismissing it. Re-walk measured the mechanism: `.modal-card` is 1109px tall with `overflow-y: visible`, rect top −104.5px at 900px viewport, and `mouse.wheel` moves neither `scrollTop` nor the card — the clip is structural, not a scrollbar quirk.
- Toast timings from code: default 2000ms (`showToast`), "Distance:" 5000ms, zone-overlap 4000ms — all as the full-screen `#airboardToastModal` overlay (`.modal-overlay`, `background: rgba(0,0,0,0.6)`), which is why clicks die during them; header toolbar stays clickable above it (z-index 300 vs 200), the canvas doesn't.
- Re-walk 2026-08-09 ran on port 4106 with all `supabase|functions/v1` requests aborted by the Playwright driver; app stayed signed-out throughout.
- samples/sample-plan.pdf is a synthetic 921.6×597.6pt sheet, so the "isn't a standard sheet size" warning fires on *every* fresh scale-set here; true ANSI/ARCH sheets won't see it (but compressed real-world PDFs will, which is who finding #2 protects/bites).
- Viewer session shows the page row as "document.pdf" instead of the project name.
- Zone-tool footer hint "| Click first corner" keeps showing while the multiply value dialog is open.

**Screenshot index**
- img/multi-scale-and-repeats-01.png — naive trap: 65'-0" wall reads "Distance: 173'-1"" after a corrected preset (chip: 1/8" = 1' · ANSI D)
- img/multi-scale-and-repeats-02.png — Set Scale dialog clipped past the top at 900px; tabs unreachable, wheel won't scroll
- img/multi-scale-and-repeats-03.png — "Set Scale ⚖ first to use Scale Zone." gate toast (no button)
- img/multi-scale-and-repeats-04.png — Multiply Zone dialog, live preview "In this area: 3 counter(s), 0 line run(s) (0.00 ft)"
- img/multi-scale-and-repeats-05.png — Measure inside the 1/4" zone reads 9'-3"; ×3 zone on MEN; Summary [13] vs COUNTERS 7
- img/multi-scale-and-repeats-06.png — Multiply Zone Settings (label toggle, default multiplier 2, size 14, position Center)
- img/multi-scale-and-repeats-07.png — Stubbed view-link recipient: zones + labels render, totals multiplied, zone tools hidden
- img/multi-scale-and-repeats-08.png — *(re-walk)* friction #10: chip reads `1/8" = 1' · ANSI D` (corrected page scale) while Measure inside the uncorrected 1/4" zone reads "Distance: 7'-8"" across most of the 23'-4" open office — consistent read would be 20'-5"; also shows the 5s toast dimming the whole sheet

## Demo moment

Measure the conference room: **19'-9"**. Two clicks to ring it with a Scale Zone, tap the
1/4" preset, measure the same wall again: **9'-10"** — the label sits right on the sheet.
Then ring the men's room with a ×3 zone: the dialog already knows it caught "3 counter(s)",
and the Summary jumps **7 → 13** while the plan stays clean (img/multi-scale-and-repeats-05.png).
Under ten seconds once the scale is set, and both numbers explain themselves.

## Verification (2026-08-02)

*Adversarial verifier pass, run 2026-08-09. Method: read features/scale.js, features/tool-context-menu.js, features/scale-zone-settings.js and the app.js zone/toast/keydown handlers, then re-drove the real app headlessly (Playwright Chromium 1380×900, static server on port 4306, sample-plan.pdf via #pdfInput, all `supabase|functions/v1` requests aborted at the driver — no cloud). Nine of eleven findings re-driven live; #5 and #9 verified against code and unit tests.*

**Reproduced (headline items):**
- **#10 (blocker)** end-to-end: accepted the dialog's own preselected ANSI-D correction → page preset stored `pixelsPerUnit: 3.375, correctionFactor: 0.375, label "1/8" = 1' · ANSI D"`; drew a scale zone with two clicks, tapped the 1/4" preset → zone stored raw `pixelsPerUnit: 18` (no correctionFactor, no warning — `refreshSheetWarning` early-returns for zone mode and both zone apply paths carry a `// zone target: no sheet correction` comment). Zone/page ratio 5.33 where a consistent 1/4-vs-1/8 pair is exactly 2. Same horizontal span measured **9'-2" inside** the zone vs **49'-0" outside** — the 2.67× silent disagreement, exactly as the walker reported.
- **#1 (blocker at ≤900px)** structurally: `.modal-card` 1109px, top −104.5px, tabs at −41.5px, `overflow-y: visible` on both card and overlay, `mouse.wheel` moved neither `scrollTop` nor the card (img/multi-scale-and-repeats-v1-clip.png). The walker's "structural, not a scrollbar quirk" mechanism is exact.
- **#3, #4, #6, #8, #11** all reproduced as written (drag no-op then stray-click zone; toast overlay `fixed inset:0 pointer-events:auto` eating both a corner click and a dismiss-click; buttonless gate modal; edit-value/delete-only context menu + totals-neutral empty-rect zone; `state.tool → NONE` after Apply).

**Refuted:** finding #7. The "Edit zone scale" dialog is *not* blank in the sense claimed — its info line reads `Current: 1/4" = 1'. Choose a new scale below.` (set from the zone's own scale in `openScaleModal`, present since the scale.js split, and visible in edit mode where the shorter card isn't clipped). No preset is highlighted and the custom fields are empty, but the "must remember what the zone was" harm doesn't exist. Row killed; the matching prefill proposal rejected.

**Severity audit:** all other severities stand as evidenced — no upgrades, no downgrades. The two blockers are honestly scoped (#1 carries its viewport qualifier; #10 is unconditional on corrected sheets).

**New since the walk — features/scale-zone-settings.js (commit 6f3d75e, never walked; verifier friction-checked it live):**
- Right-clicking either Scale Zone button now opens a **"Scale Zone Settings…"** menu → modal (show label / size 8–24 / five positions). The **Entry points** line saying Scale Zone right-click "toasts (NO_SETTINGS_TOOLS)" is now stale, as is the Macros-table caveat implied there; Scale Zone now matches the Multiply Zone right-click convention.
- Scale-zone label default is now **top-left** (was center) — this resolves the walk-note complaint of the `1/4" = 1'` label sitting on CONFERENCE. Multiply-zone labels still default to center, so the "×3 over MEN" half of that observation stands.
- Quick friction check of the modal itself (img/multi-scale-and-repeats-v2-zone-settings.png): small card (~318px, no clipping risk), opens prefilled with current values, one **Done** button that commits and re-renders. Two papercut-grade observations, neither worth a new row: there is no Cancel (Done commits whatever the controls hold — same convention as the Multiply Zone sibling), and changes don't live-preview until Done. Findings #1–#11 are otherwise unaffected: the settings modal does not touch zone *scale values*, so #10, #7's edit path, and the zone-creation flow are unchanged.

**What the walker missed:** nothing material beyond the #7 info line. The dossier's mechanism notes (toast z-index layering, modal-card overflow measurements, anchor-point semantics) all checked out against code.
