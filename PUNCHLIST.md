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
| R1-WENDI | Ask wendi for her Save Status export to confirm `turn_in_ok` precedes each `force_turn_in` | chore | dev | — | [_TODO.md](journeys/plans/_TODO.md#r1--review-our-own-turn-in-was-reported-as-an-admin-force) |
| SAMPLE-A | Sample plan A polish hand-off, for whoever knows the trade better | chore | dev | — | [_TODO.md](journeys/plans/_TODO.md#sample-plan-a--polish-hand-off-2026-09-14-for-whoever-knows-the-trade-better) |
| EXPIRY-30 | 30-minute checkout expiry under contention is still unwalked (time-gated; machinery covered by unit and spec) | test | tester | — | [_NEXT.md](journeys/plans/_NEXT.md) |
| TURNIN-FLAKE | Still unexplained: in one of about sixteen parallel runs of the five cloud spec files (one test account, 4 workers), turn-in-self-release's flag-on Turn In never showed "Project turned in." inside 15 s; six more parallel runs with diagnostics in place were green, so it has not recurred. The spec now reports the save-status log, the toasts and the open dialogs on that timeout, so the NEXT failure names its cause (the candidates are doTurnIn's refusals: the pre-probe reading offline under load, "Sync in progress", "already running"). When it fails again, read that report and fix what it names | bug | agent | — | [CHANGELOG.md](CHANGELOG.md#testturn-in-the-flag-on-turn-in-wait-reports-why-it-timed-out-2026-09-20) |
| PC-REVIEW | Someone with the trade reads chapters 2 to 6 of the plumbing course, and the fixture units on P-501, before it is offered on the landing (researched: the dossier lists what to confirm and what to decide) | test | tester | — | [TESTER-DOSSIER-PLUMBING-COURSE.md](journeys/plans/TESTER-DOSSIER-PLUMBING-COURSE-2026-09-27.md#for-the-tester) |
| HC-REVIEW | Someone with the trade reads chapters 2 to 7 of the HVAC course, and the room air and diffuser schedules on M-501, before it is offered on the landing (researched: the dossier lists what to confirm and what to decide) | test | tester | — | [TESTER-DOSSIER-HVAC.md](journeys/plans/TESTER-DOSSIER-HVAC-2026-09-27.md#for-the-tester) |
| WATER-TABLES | The six water-sizing rules were settled 2026-09-27 from the dossier except two figures nobody has read: the CPVC rows of plumb.water.pipe-id (move them to the tolerance-allowing bore, decided, once a CPVC maker's published inside diameters for 1/2 to 2 in are read), and the two limits of Table 604.5's manifold footnote (the dossier's reading and the text as Claude remembers it disagree, so the rule's body states neither) | test | tester | — | [TESTER-DOSSIER-PLUMBING-RULES.md](journeys/plans/TESTER-DOSSIER-PLUMBING-RULES-2026-09-27.md#for-the-tester) |
| PC-TRADE | Someone with the trade settles the plumbing course's trade findings (P-401 against P-101, the trap-arm and gas-hanger citations, the gas main's two sizes, U-1's DFU, the cleanout note) before they are edited (researched: the dossier lists what to confirm and what to decide) | test | tester | — | [TESTER-DOSSIER-PLUMBING-COURSE.md](journeys/plans/TESTER-DOSSIER-PLUMBING-COURSE-2026-09-27.md#for-the-tester) |
| HC-TRADE | Someone with the trade settles the HVAC course's trade findings (the diffuser neck velocity band, exhaust and make-up air counted on RTU-1's capacity, where the main changes size) before they are edited (researched: the dossier lists what to confirm and what to decide) | test | tester | — | [TESTER-DOSSIER-HVAC.md](journeys/plans/TESTER-DOSSIER-HVAC-2026-09-27.md#for-the-tester) |
| PT-TRADE | Someone with the trade checks three numbers the plumbing tour teaches: the 8 fps cold velocity cap (code or design practice?), sizing the cold branch on a public lavatory's 2 WSFU total rather than its cold load, and 32 in PEX hanger spacing (IPC Table 308.5) (researched: the dossier lists what to confirm and what to decide) | test | tester | — | [TESTER-DOSSIER-PLUMBING-COURSE.md](journeys/plans/TESTER-DOSSIER-PLUMBING-COURSE-2026-09-27.md#for-the-tester) |
| MAP-PERMS | `supabase/migrations/20260927030000_get_project_permissions.sql` was applied to prod on 2026-09-27 (the owner's go, verified there), so the permissions refresh now reads the one-project RPC. What is left: on or after 2026-10-04, after a week of normal use, delete the list fallback in save-engine.js `refreshProjectPermissions` (the `permissionsRpcMissing` latch, `isMissingRpcAnswer`, the client-recycle reset) and trim the PGRST202 fallback cases in save-engine.test.js | chore | agent | — | [CHANGELOG.md](CHANGELOG.md#featsave-a-lean-permissions-read-behind-a-fallback-until-its-rpc-is-applied-map-perms-2026-09-27) |
| RULEBOOK-SIGN | Someone with each trade reads the 32 draft rules the courses cite (13 plumbing, 15 electrical (14 signed 2026-09-27 on the owner's delegation; open: elec.hood.shunt-trip, NFPA 96 not opened, and the 2023 letter of 700.12's duration paragraph, see [the electrical dossier](journeys/plans/TESTER-DOSSIER-ELECTRICAL-2026-09-27.md#settled-2026-09-27)), 4 HVAC, `status: draft` under content/rules/, each with a Verify against your edition paragraph naming what the drafter doubted: the IMC fire-damper subsection, the section numbers written from memory) and signs each before it turns `applied`; a rule that is wrong is fixed on the card in the same commit (researched, one dossier per trade: every draft has a recommendation). Plumbing: the 13 drafts were settled 2026-09-27 from the dossier (a fuel gas hanger rule added, the trap-arm and gas-hanger cards fixed); still open there, only the NFPA 96 sub-section numbers under 10.4 in plumb.gas.hood-shutoff, which nobody has read in NFPA 96 itself | test | tester | — | [TESTER-DOSSIER-PLUMBING-RULES.md](journeys/plans/TESTER-DOSSIER-PLUMBING-RULES-2026-09-27.md#for-the-tester) |
| EC-TOUR-WIRE | The five-minute electrical tour, the landing's electrical film and the electrical takeoff guide still teach 3 #12 THHN + 1 #12 G on one 120 V circuit; the course now teaches 2 #12 + G (R1, settled 2026-09-27). Bring the tour's line type, its fill figure and its spec to 2 #12 + G, then re-shoot the film and the guide's pictures | chore | agent | — | [TESTER-DOSSIER-ELECTRICAL.md](journeys/plans/TESTER-DOSSIER-ELECTRICAL-2026-09-27.md#settled-2026-09-27) |
