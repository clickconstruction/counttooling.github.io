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
| P4-WATER | Water sizing by fixture units: IPC first, water only, mockups before code | build | dev | — | [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) |
| EXPIRY-30 | 30-minute checkout expiry under contention is still unwalked (time-gated; machinery covered by unit and spec) | test | tester | — | [_NEXT.md](journeys/plans/_NEXT.md) |
| LEGEND-FACE | The sheet legend draws in DM Sans; the mock assumed a condensed face, which is most of the block's extra width (compact 203 pt wide vs the mock's 148). Vendoring one (Barlow Condensed, OFL) would narrow it about a fifth: a font in the shell and the precache, so a call first | decision | ⚑ call | — | [CHANGELOG.md](CHANGELOG.md#featlegend-the-sheet-legend-compact-by-default-for-electrical-and-hvac-2026-09-19) |
| TURNIN-FLAKE | Still unexplained: in one of about sixteen parallel runs of the five cloud spec files (one test account, 4 workers), turn-in-self-release's flag-on Turn In never showed "Project turned in." inside 15 s; six more parallel runs with diagnostics in place were green, so it has not recurred. The spec now reports the save-status log, the toasts and the open dialogs on that timeout, so the NEXT failure names its cause (the candidates are doTurnIn's refusals: the pre-probe reading offline under load, "Sync in progress", "already running"). When it fails again, read that report and fix what it names | bug | agent | — | [CHANGELOG.md](CHANGELOG.md#testturn-in-the-flag-on-turn-in-wait-reports-why-it-timed-out-2026-09-20) |
| LOAD-DEVICE-PDF | Load Project has the door Keep just lost: opening a cloud project that has no PDF in the cloud goes straight to "This project has annotations but no PDF" (features/load-project.js `loadCloudProjectRow`, the `!proj.pdf_path` branch) without looking at the device backup, which may hold the file (a PDF upload cut short by a reload). Try the backup's blob there first, the way the restore now does, and hand it to the engine to upload; `resolvePdfBufferForCloudProject` has the same `useIdbBackup` gate on the PDF | bug | dev | — | [CHANGELOG.md](CHANGELOG.md#fixrestore-keep-uses-the-devices-pdf-when-the-cloud-has-none-and-uploads-it-2026-09-20) |
| CI-NETWORKIDLE | The e2e job's flakes are one wait: on PR #161's runs 19 of 19 flaky errors and the one hard failure were `page.waitForLoadState('networkidle')` timing out (5, 13, 19, 22, 16 flaky tests on five runs of 2026-09-21; the job takes 35 minutes). Every fresh context installs the service worker and precaches about 155 files, so on a slow runner the network does not go quiet inside a 30 s test. tutorial.spec.js now waits on `App.bootSettled` instead and lessons.spec.js always did (zero flakes). Convert the other specs' networkidle waits the same way, or block service workers in the Playwright config for every spec but pwa.spec.js, and measure the job's time before and after | chore | dev | — | [CHANGELOG.md](CHANGELOG.md#fixboot-the-boot-no-longer-outruns-the-feature-scripts-2026-09-21) |
| PC-REVIEW | Someone with the trade reads chapters 2 to 6 of the plumbing course, and the fixture units on P-501, before it is offered on the landing | test | tester | — | [PLUMBING-COURSE.md](journeys/plans/PLUMBING-COURSE.md#open-and-not-blocking) |
| EC-REVIEW | Someone with the trade reads chapters 2 to 7 of the electrical course, and LP-1's panel schedule on E-501, before it is offered on the landing | test | tester | — | [ELECTRICAL-COURSE.md](journeys/plans/ELECTRICAL-COURSE.md#open-and-not-blocking) |
