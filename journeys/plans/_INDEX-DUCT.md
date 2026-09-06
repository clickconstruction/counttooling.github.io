# Duct build ledger — executing DUCT-PLAN.md (started 2026-09-06, Will's go)

Strictly sequential, one agent per unit on `claude/duct-dNN-<slug>` cut from
latest main. Loop: agent (full tests + `npm run check`, no push/merge) →
orchestrator verify on branch → merge in main-integration → ledger row here →
push at the checkpoints below. DUCT-PLAN.md is the plan of record — every
agent reads it COMPLETELY first.

**Visibility rule:** the Duct tool stays behind a preview flag
(`localStorage 'clickcount-duct-preview'`, plus `App.enableDuctPreview()` for
specs) until D5 completes the shippable core loop — D5 removes the flag and
ships the header button for everyone. Pre-D5 pushes are therefore inert for
live users (new modules precached, no UI change).

**Telemetry:** none until the core ships; a `duct_run` allowlist migration
(create-only, Will approves application) rides D5.

| Unit | Scope (DUCT-PLAN.md sections) | Branch | Status |
|---|---|---|---|
| D1 | Pure math + model: duct-model.js — size/segment/fitting types on the annotation model, SMACNA gauge tables by pressure class, lb/ft (rect + round), liner/wrap sq ft, ductulator (CFM→size @ friction rate, velocity cap, round equivalents), fitting lb-eq table; CommonJS footer + heavy node tests. NO UI. | claude/duct-d01-model | queued |
| D2 | Drawing tool: TOOL.DUCT behind the preview flag, continuous trace with size segments, S popover (step-down grid + custom), stroke width steps with size, commit into the model, Esc ladder rung, size tags on segments | claude/duct-d02-tool | queued |
| D3 | Auto fittings: corner=elbow / size-step=transition / run-on-run=tap; canvas markers (diamond/chevrons/ring); context-menu reclassify + delete; hitTest respect for hideMarks | claude/duct-d03-fittings | queued |
| D4 | Sidebar + organization: Duct section (runs → size segments → fittings line → All duct total), airside property (Supply/Return/Exhaust chip, trade colors, per-system plenum-return toggle), system = group + equipment/capacity field, run/device system inheritance | claude/duct-d04-sidebar | queued |
| D5 | **Shippable core:** Duct Schedule modal (straight/fittings + Counted|Factor toggle/insulation/seam %/Bid weight; round rows show LF + joints), Copy Schedule, Export PDFs integration, legend rows; REMOVE the preview flag — header button live; `duct_run` migration created (NOT applied); guides article | claude/duct-d05-schedule | queued — **checkpoint push #1 after** |
| D6 | Design-build layer 1: CFM attribute on counters, per-system downstream accumulation along traces, ductulator suggestion in the size chip + S popover (friction default 0.08, velocity cap setting, names the binding constraint) | claude/duct-d06-suggest | queued |
| D7 | Design-build layer 2: room-type CFM defaults on Room Sizer (editable table + per-room override, device prefill), air-balance badges (room needs/served ⚠ on Rooms rows, capacity line on system groups), equipment-first suggestion (area totals → system count/CFM) | claude/duct-d07-balance | queued — **checkpoint push #2 after** |
| D8 | Polish: rise/drop field in the S popover + project deck-height default + per-device flex-drop defaults + max-flex warning; VD-per-tap toggle (fittings rows, right-click remove); round-first dual suggestions ("10"Ø or 12×8"); neck-size prefill from CFM; true-width ghost | claude/duct-d08-polish | queued |
| D9 | Bid Check: sidebar panel (AUTO rows computed-with-numbers, MANUAL rows persistent checkboxes), export/copy gate badge + interactive toast ("Review · Export anyway", T2-04/T2-06 machinery), worked row "Fits the roof" (manual→auto when deck+ceiling+size known), S-popover depth line | claude/duct-d09-bidcheck | queued — **checkpoint push #3 after** |
| D10 | Plan-and-spec: PDF text-layer query primitive (callouts near a point), starting-size prefill, step-down offers while tracing ("Plan says 20×12 — S accepts") | claude/duct-d10-callouts | queued — **final push** |

Conflict/sequencing notes:
- D2 owns the S popover; D6 (suggestion line), D8 (rise/drop, dual sizes),
  D9 (depth line) each EXTEND it — strict order matters.
- D4's system groups must land before D6's per-system accumulation.
- D7 touches features/room-sizer.js (shipped 2026-07); re-grep, extend.
- D9 reuses the T1-05 gate moment in features/output.js — B3/B4 rebuilt
  that file; re-grep everything.
- Static-path and plenum-depth AUTO rows: D9 ships "Fits the roof" auto
  only if D8's deck-height landed (it will have); static-path auto is
  DEFERRED past D10 (equivalent-length table + critical-path walk — its
  manual row ships in D9).
- render-pixels: D8's true-width ghost may touch painted output → linux
  baselines via the regen-baselines workflow (ci/regen-baselines/* ref).

**FINAL STEP (Will, 2026-09-06): test it LIVE.** After the final push +
CACHE_VERSION match, drive the deployed app at counttooling.com in a real
browser end-to-end: upload a plan → set scale → trace a run with size
step-downs (S popover) → verify auto-fittings appear and reclassify one →
open the Duct Schedule and sanity-check the bid weight against hand math →
place CFM devices and confirm a ductulator suggestion → tick a Bid Check
manual row → hit Export/Copy and confirm the gate toast + "Export anyway".
The build is not done until this live walk passes.
