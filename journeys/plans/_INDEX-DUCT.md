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
| D1 | Pure math + model: duct-model.js — size/segment/fitting types on the annotation model, SMACNA gauge tables by pressure class, lb/ft (rect + round), liner/wrap sq ft, ductulator (CFM→size @ friction rate, velocity cap, round equivalents), fitting lb-eq table; CommonJS footer + heavy node tests. NO UI. | claude/duct-d01-model | ☑ merged 2026-09-06 |
| D2 | Drawing tool: TOOL.DUCT behind the preview flag, continuous trace with size segments, S popover (step-down grid + custom), stroke width steps with size, commit into the model, Esc ladder rung, size tags on segments | claude/duct-d02-tool | ☑ merged 2026-09-06 |
| D3 | Auto fittings: corner=elbow / size-step=transition / run-on-run=tap; canvas markers (diamond/chevrons/ring); context-menu reclassify + delete; hitTest respect for hideMarks | claude/duct-d03-fittings | ☑ merged 2026-09-06 |
| D4 | Sidebar + organization: Duct section (runs → size segments → fittings line → All duct total), airside property (Supply/Return/Exhaust chip, trade colors, per-system plenum-return toggle), system = group + equipment/capacity field, run/device system inheritance | claude/duct-d04-sidebar | ☑ merged 2026-09-06 |
| D5 | **Shippable core:** Duct Schedule modal (straight/fittings + Counted|Factor toggle/insulation/seam %/Bid weight; round rows show LF + joints), Copy Schedule, Export PDFs integration, legend rows; REMOVE the preview flag — header button live; `duct_run` migration created (NOT applied); guides article | claude/duct-d05-schedule | ☑ merged 2026-09-06, pushed ckpt 1 — DUCT LIVE |
| D6 | Design-build layer 1: CFM attribute on counters, per-system downstream accumulation along traces, ductulator suggestion in the size chip + S popover (friction default 0.08, velocity cap setting, names the binding constraint) | claude/duct-d06-suggest | ☑ merged 2026-09-06, pushed ckpt 2 |
| D7 | Design-build layer 2: room-type CFM defaults on Room Sizer (editable table + per-room override, device prefill), air-balance badges (room needs/served ⚠ on Rooms rows, capacity line on system groups), equipment-first suggestion (area totals → system count/CFM) | claude/duct-d07-balance | ☑ merged 2026-09-06, pushed ckpt 2 |
| D8 | Polish: rise/drop field in the S popover + project deck-height default + per-device flex-drop defaults + max-flex warning; VD-per-tap toggle (fittings rows, right-click remove); round-first dual suggestions ("10"Ø or 12×8"); neck-size prefill from CFM; true-width ghost | claude/duct-d08-polish | ☑ merged 2026-09-12 (true-width ghost split to D8b) |
| D9 | Bid Check: sidebar panel (AUTO rows computed-with-numbers, MANUAL rows persistent checkboxes), export/copy gate badge + interactive toast ("Review · Export anyway", T2-04/T2-06 machinery), worked row "Fits the roof" (manual→auto when deck+ceiling+size known), S-popover depth line | claude/duct-d09-bidcheck | ☑ merged 2026-09-12, pushed ckpt 3 (extends the upstream S5 Bid Check panel) |
| D10 | Plan-and-spec: PDF text-layer query primitive (callouts near a point), starting-size prefill, step-down offers while tracing ("Plan says 20×12 — S accepts") | claude/duct-d10-callouts | ☑ merged 2026-09-12, final push — QUEUE COMPLETE (also fixed the Create-tab focus-steal bug behind the duct-balance flake) |

| D11 | **Static-path AUTO row**: `espInWg` on system groups (beside capacity), fitting equivalent-length table in duct-model, critical-path walk per system (longest run + fittings' eq ft at the friction rate) → Bid Check row upgrades manual→auto with the number ("0.34" of 0.80" ESP · critical path 187 eq ft"), ⚠ names the long leg | claude/duct-d11-static | ☑ merged 2026-09-12, pushed ckpt 4 |
| D12 | **Orientation chip** (Flat / On edge, default Flat) on duct runs — context menu + run details; "Fits the roof" reads h when flat, the larger side when on edge; S-popover depth line follows | claude/duct-d12-orientation | ☑ merged 2026-09-12, pushed ckpt 4 |
| D13 | **True-width ghost** (was D8b): translucent band at true scaled width under each run's stroke, honoring rotation/zoom/export; render-pixels baselines regenerated via ci/regen-baselines/* (linux) + darwin locally | claude/duct-d13-ghost | ☑ merged 2026-09-12, pushed ckpt 4 (render-pixels baselines unchanged — fixture has no duct) |

| D14 | **Cleanup sweep** (Will 2026-09-12, "build all, keep the strip order"): Duct added to the header "…" overflow list ONLY (no strip reorder); remove the temp `rect_drag_complete` probe (T2-10 bake-in done) + its spec assertion; Export PDFs bulk button → "Every layer with marks" (B4 dialect; rendered only when a page has >1 layer; siblings de-Title-Cased); DUCT-PLAN.md worked numbers corrected to the shipped gauge table (16×10 @ 24 ga = 5.01) with the rule quoted; AGENTS.md feature-file count stamped by build:filemap | claude/duct-d14-cleanup | ☑ merged 2026-09-13, pushed ckpt 5 |
| D15 | **Deferred duct choices closed**: optional CFM box on Quick Count create; legend carries the room air ⚠ line (computeLegendRows gains the cross-page room-target dep D7 declined — keep render-pixels scenarios untouched); right-click marker → "CFM for this one…" per-marker override that feeds accumulation/balance | claude/duct-d15-deferred | ☑ merged 2026-09-13, pushed ckpt 5 |
| D16 | **HVAC icon set**: supply diffuser (boxed X), return grille (louvers), RTU (fan+coil), VAV box, fire/smoke damper — house 20px stroke style per the approved Cleanup Follow-ups canvas — shipped through my-counters/ → build:icons as an "HVAC" group on the Create tab; CFM-carrying counters default to the diffuser glyph | claude/duct-d16-icons | ☑ merged 2026-09-13, pushed ckpt 5 |
| P1 | **Drift patrol** (program, agents): J19 "Duct takeoff (design-build)" dossier walked + adversarially verified Phase-2 style; J5 / J6 / J11 re-walked against the duct tool; findings → a new Tier-3 batch row; day-7 `duct_run` telemetry line | claude/duct-p1-j19 + claude/duct-p1-rewalks | ☑ merged 2026-09-13, pushed — J19: 15 confirmed (6 stumbles → D17/B19); re-walks: 9 new (J6-G multiply-zone gap + J5-B dual drafts → D17); day-7 telemetry due ~2026-09-19 |
| P2 | **Stage-6 prep** (program, after D17): draft journeys/plans/_STAGE6.md — the 17 Tier-5 gap rows bucketed (build / product call / fold-in / defused / no-deliberately) with BLANK decision slots for Will; the session itself is Will's | — | queued after P1 |

| D17 | **J19 stumbles 1–3** (Will 2026-09-13, "keep going with your recommendations"): (1) system groups as a hidden precondition — the duct surfaces that say "edit in Groups" enable groups (or deep-link to the toggle) instead of pointing at a section that's off; a first duct run / equipment tag auto-enables `groupsEnabled`; (2) deck height settable BEFORE any run (project setting reachable from the Duct create modal + Room Sizer), and the auto-riser applied retroactively to runs that start at an equipment marker when deck height arrives; (3) Copy Summary and Copy to /Tooling carry the duct pounds (per-size LF · lb rows + bid weight) exactly as Copy Schedule does — the DUCT-PLAN promise. Stumbles 4–6 ride B19 (folded 2026-09-13). **Re-walk additions (2026-09-13):** (4) J6-G — multiply zones multiply duct like counters/lines (LF, lb, fittings, bid weight; zone dialog preview counts duct runs); (5) J5-B — Duct and Polyline drafts are mutually exclusive: arming one while the other is live cancels/finishes the other (same Esc ladder order), never two finish bars. J5-A (Set Scale mid-draw drops the tool but not the draft — pre-existing) and J5-D (Duct inline vs Polyline in ⋯ — ⚑ Will's product call, contra D14) stay "awaiting re-rank". | claude/duct-d17-stumbles | ☑ merged 2026-09-13, pushed ckpt 6 |

Item 2 (Bid Check label click) is Will's chip session task_4c782a3d — merged by the integrator when it lands, not a queue unit.

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

> **LIVE WALK PASSED 2026-09-12** on counttooling.com (CACHE_VERSION 0bf69debc470), driven in a real browser: 1-page plan with printed "24x12"/"20x12" callouts → scale 1/4"=1' → Duct armed → hovering the printed 20x12 produced "Plan says 20×12 here — S accepts" (2.3 pt from the callout); S popover showed FROM THE PLAN / STEP DOWN / CUSTOM / RISE-DROP in seam order; accepted → run committed 68' · 443 lb with 2 elbows + 1 transition auto-logged; right-click reclassified one elbow to 45°; Duct Schedule: straight 443 + fittings 64 = 507, +15% = **583 lb bid weight** (hand-checked); a 400 CFM diffuser placed → new trace read "400 CFM downstream · suggests 12"Ø or 16×8 @ 0.08″/100′ — S accepts"; Bid Check panel showed 4 auto rows + manual rows; ticking "Fits the roof" persisted (`duct-fits-roof: true`, badge 9→8 unchecked); Export PDFs with unresolved rows raised "Bid Check: Fits the roof? — Review · Export anyway", and Export anyway opened the Export modal. Papercut found: clicking a manual row's LABEL does not toggle it — only the box does (chip filed).

Follow-ups approved 2026-09-12 (Will: 'Build all of them') → queued as D11–D13 above; `duct_run` migration APPLIED 2026-09-12.
