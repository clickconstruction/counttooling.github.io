# CountTooling — Punch List

**Every open item, one line each, in one place.** This file is an INDEX, not a
container: a row carries status and a pointer, the detail lives in the document
that owns it. If an item needs more than one line, write the detail into the
right plan file or dossier and link it here. That way there is exactly one place
to be wrong.

- **Not a priority surface.** Ranking stays in [JOURNEY-MAP.md](JOURNEY-MAP.md)'s
  tier tables. Rows here are in insertion order; `Who` and `Blocked by` carry the
  sequencing that matters.
- **Who**: `agent` (a Claude session can run it) · `dev` (a developer) ·
  `tester` (a person walking the live site) · `⚑ call` (needs Will's product
  decision before anyone builds).
- **Detail** is optional. A row that fits in one line needs no link; a row with a
  link must have one that resolves ([scripts/check-punchlist.js](scripts/check-punchlist.js)
  fails `npm run check` on a dead one).
- **Closing a row**: delete it and record the outcome where the work landed
  (CHANGELOG, the plan file, the dossier). This file holds what is OPEN. A row
  that is done and still here is a bug in the list.

How agents add to this list: AGENTS.md, "Recording a to-do".

## Open

| ID | Item | Kind | Who | Blocked by | Detail |
|---|---|---|---|---|---|
| R1-TEST | A tester walks the self-release fix on counttooling.com with `?ff=self-release` and signs the line | test | tester | — | [_TODO.md](journeys/plans/_TODO.md#r1-test--a-tester-walks-the-fix-on-counttoolingcom-own-login) |
| R1-FLIP | Make the self-release fix live for everyone: drop the flag, move the copy into the markup | build | dev | R1-TEST | [_TODO.md](journeys/plans/_TODO.md#r1-flip--make-the-fix-live-for-everyone-after-r1-test) |
| R1-WINDOW | Decide the 15 s self-release grace window: too long absorbs a real admin force silently, too short brings the bug back | decision | ⚑ call | — | [_TODO.md](journeys/plans/_TODO.md#r1--review-our-own-turn-in-was-reported-as-an-admin-force) |
| R1-ADMIN | Decide whether an admin's own Force turn-in stamps `noteSelfRelease` too (one line) or keeps the pre-existing race | decision | ⚑ call | — | [_TODO.md](journeys/plans/_TODO.md#r1--review-our-own-turn-in-was-reported-as-an-admin-force) |
| R1-WENDI | Ask wendi for her Save Status export to confirm `turn_in_ok` precedes each `force_turn_in` | chore | dev | — | [_TODO.md](journeys/plans/_TODO.md#r1--review-our-own-turn-in-was-reported-as-an-admin-force) |
| SAMPLE-A | Sample plan A polish hand-off, for whoever knows the trade better | chore | dev | — | [_TODO.md](journeys/plans/_TODO.md#sample-plan-a--polish-hand-off-2026-09-14-for-whoever-knows-the-trade-better) |
| EXPIRY-30 | 30-minute checkout expiry under contention is still unwalked (time-gated; machinery covered by unit and spec) | test | tester | — | [_NEXT.md](journeys/plans/_NEXT.md) |
| LEGEND-FACE | The sheet legend draws in DM Sans; the mock assumed a condensed face, which is most of the block's extra width (compact 203 pt wide vs the mock's 148). Vendoring one (Barlow Condensed, OFL) would narrow it about a fifth: a font in the shell and the precache, so a call first | decision | ⚑ call | — | [CHANGELOG.md](CHANGELOG.md#featlegend-the-sheet-legend-compact-by-default-for-electrical-and-hvac-2026-09-19) |
| TURNIN-FLAKE | Still unexplained: in one of about sixteen parallel runs of the five cloud spec files (one test account, 4 workers), turn-in-self-release's flag-on Turn In never showed "Project turned in." inside 15 s; six more parallel runs with diagnostics in place were green, so it has not recurred. The spec now reports the save-status log, the toasts and the open dialogs on that timeout, so the NEXT failure names its cause (the candidates are doTurnIn's refusals: the pre-probe reading offline under load, "Sync in progress", "already running"). When it fails again, read that report and fix what it names | bug | agent | — | [CHANGELOG.md](CHANGELOG.md#testturn-in-the-flag-on-turn-in-wait-reports-why-it-timed-out-2026-09-20) |
| PC-REVIEW | Someone with the trade reads chapters 2 to 6 of the plumbing course, and the fixture units on P-501, before it is offered on the landing | test | tester | — | [PLUMBING-COURSE.md](journeys/plans/PLUMBING-COURSE.md#open-and-not-blocking) |
| EC-REVIEW | Someone with the trade reads chapters 2 to 7 of the electrical course, and LP-1's panel schedule on E-501, before it is offered on the landing | test | tester | — | [ELECTRICAL-COURSE.md](journeys/plans/ELECTRICAL-COURSE.md#open-and-not-blocking) |
| HC-REVIEW | Someone with the trade reads chapters 2 to 7 of the HVAC course, and the room air and diffuser schedules on M-501, before it is offered on the landing | test | tester | — | [HVAC-COURSE.md](journeys/plans/HVAC-COURSE.md#open-and-not-blocking) |
| WATER-TABLES | Someone with the trade checks the six water-sizing rules (the WSFU loads, the demand curve, the velocity caps, the pipe inside diameters, the fixture supply minimums, the 3/4 in service) against the printed IPC 2021 Appendix E and Chapter 6 before the S moment (WATER-PLAN rung 4) is offered | test | tester | — | [WATER-PLAN.md](journeys/plans/WATER-PLAN.md#2-the-rulebook-slice-ipc-2018--2021-appendix-e--transcribed-not-typed) |
| WATER-TELEM | Apply `supabase/migrations/20260923190000_log_user_event_water.sql` to prod (the `water_run` / `wsfu_prefill` allowlist, Will's go like R2), then flip the `water-telemetry` feature flag on by default and delete its reads | chore | ⚑ call | — | [WATER-PLAN.md](journeys/plans/WATER-PLAN.md#8-telemetry-the-day-7-line-again) |
| PC-TRADE | Someone with the trade settles the plumbing course's trade findings (P-401 against P-101, the trap-arm and gas-hanger citations, the gas main's two sizes, U-1's DFU, the cleanout note) before they are edited | test | tester | — | [PLUMBING-COURSE.md](journeys/plans/PLUMBING-COURSE.md#trade-findings-from-the-2026-09-24-read) |
| EC-TRADE | Someone with the trade settles the electrical course's trade findings (two 208 V two-pole circuits, the GFCI duplex counted twice, E-601's three-phase dishwasher, the rise and the clearance) before they are edited | test | tester | — | [ELECTRICAL-COURSE.md](journeys/plans/ELECTRICAL-COURSE.md#trade-findings-from-the-2026-09-24-read) |
| HC-TRADE | Someone with the trade settles the HVAC course's trade findings (the diffuser neck velocity band, exhaust and make-up air counted on RTU-1's capacity, where the main changes size) before they are edited | test | tester | — | [HVAC-COURSE.md](journeys/plans/HVAC-COURSE.md#trade-findings-from-the-2026-09-24-read) |
| PERSONA-PASS | The text pass over every tour, lesson and course, then the live pass on the steps it flags (one step per episode, the prober beside the personas), triaged into fixes, drafts, tester rows and calls | test | agent | PERSONA-PROBER | [PERSONA-PLAN.md](journeys/plans/PERSONA-PLAN.md#who-does-what-the-owner-gives-as-little-input-as-possible) |
| RULEBOOK-GAPS | 29 course steps cite a code section the rulebook has no entry for (`node scripts/check-lesson-rules.js --gaps`): steel pipe and EMT supports, drainage slope, trap arms, GFCI locations, working space, fire dampers, make-up air and the rest. Each becomes a `status: draft` rule, and a tester signs it before it is `applied` | build | agent | — | [PERSONA-PLAN.md](journeys/plans/PERSONA-PLAN.md#rulebook-gaps) |
| PERSONA-PROBER | The harness changes the calibration asks for: one step per episode with a list of actions per call, a flag on a step that turns Done with no reader action, a prober that does what each step should reject, and the dialogs' labels for the text pass | build | agent | — | [PERSONA-PLAN.md](journeys/plans/PERSONA-PLAN.md#calibration-results-2026-09-25) |
| PT-TRADE | Someone with the trade checks three numbers the plumbing tour teaches: the 8 fps cold velocity cap (code or design practice?), sizing the cold branch on a public lavatory's 2 WSFU total rather than its cold load, and 32 in PEX hanger spacing (IPC Table 308.5) | test | tester | — | [PERSONA-PLAN.md](journeys/plans/PERSONA-PLAN.md#calibration-results-2026-09-25) |
