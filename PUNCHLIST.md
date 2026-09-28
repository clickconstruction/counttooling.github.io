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
| MAP-PERMS | `supabase/migrations/20260927030000_get_project_permissions.sql` was applied to prod on 2026-09-27 (the owner's go, verified there), so the permissions refresh now reads the one-project RPC. What is left: on or after 2026-10-04, after a week of normal use, delete the list fallback in save-engine.js `refreshProjectPermissions` (the `permissionsRpcMissing` latch, `isMissingRpcAnswer`, the client-recycle reset) and trim the PGRST202 fallback cases in save-engine.test.js. The clean-up is mostly tests: about 20 permission tests in save-engine.test.js walk the fallback today and have to move to the lean read | chore | agent | — | [CHANGELOG.md](CHANGELOG.md#featsave-a-lean-permissions-read-behind-a-fallback-until-its-rpc-is-applied-map-perms-2026-09-27) |
| RULEBOOK-SIGN | What is left of the rulebook's sign-off is one standard nobody has opened: NFPA 96 section 10.4. The sub-section numbers (10.4.1 shutoff, 10.4.2 steam, 10.4.3 unprotected gas appliances, 10.4.4 manual reset) are quoted alike by several secondary sources and by the fire code's extract, and plumb.gas.hood-shutoff and elec.hood.shunt-trip stay `draft` until someone reads them in the standard. Everything else was settled 2026-09-27 on the owner's delegation with no printed book opened, and each rule file says what was read and where; a local amendment still governs | test | tester | — | [TESTER-DOSSIER-PLUMBING-RULES.md](journeys/plans/TESTER-DOSSIER-PLUMBING-RULES-2026-09-27.md#for-the-tester) |
| DUCT-RUN-SYSTEM | A new duct run joins whatever group is lit under GROUPS, so an exhaust or make-up run traced with RTU-1 lit lands on RTU-1's capacity (the HVAC course read 4,575 of 3,000 until its chapter 7 let RTU-1 go). The trade side is settled, each fan is its own system; the app's rule is not: by airside misses make-up air, by what the run touches strands a second trunk off another drop with no way to move a run to a system afterwards (a System choice in the Duct dialog?). Where it lives in the code, and what to unify first, is in the map | decision | ⚑ call | — | [DECOMPOSITION_MAP.md](DECOMPOSITION_MAP.md#s09-one-duct-system-rule-then-a-way-to-set-a-runs-system) |
| WATER-TAP | Two water runs that leave one point each get both runs' fixture units, so the pipe is sized for twice the load (reproduced in node, 2026-09-27). A first fix (#262: treat runs off one point as siblings, as duct does) was reverted the same day: the plumbing tour's size step traces the main FROM the riser the lavatory branch also starts at and reads the branch's 4.5 WSFU on it, so the tour depends on exactly that link. Water has no source marker the way duct has its unit, so which of two runs off one point is upstream is not known. Decide that first (the run with no fixtures of its own feeds the other? a drawn direction? a marked source?), then fix, and run tutorial.spec.js with the water specs | bug | agent | — | [DECOMPOSITION_MAP.md](DECOMPOSITION_MAP.md#s01-water-tap-rule-siblings-off-one-point) |
| TRADE-DEFAULT | A project that never named a trade: does the device's default trade count as the project's? The app answers three ways today, so Bid Check on such a project shows water rows and the IPC edition but no hanger, fitting or plumbing rows. Decide, then one resolver | decision | ⚑ call | — | [DECOMPOSITION_MAP.md](DECOMPOSITION_MAP.md#s10-one-trade-resolver) |
| DUCT-TAP-LOOP | Two duct runs drawn head to tail (each starts on the other's end) are each the other's child in `ductChildLinks`, so the system has no root (reproduced in node, 2026-09-28; the airflow walk still ends). The sibling guard covers only runs that leave one point. Break the loop, then pin it in duct-model.test.js | bug | agent | — | |
| ICON-STORE | Opening a project merges its `customIconPaths` into the user's own icon store, and they ride the user's later saves. Since #268 they are inert, but should a project be able to add icons to a user's store at all? Decide, then build | decision | ⚑ call | — | |
| FLAKE-WATER-FIELD | water-runs.spec.js "the Water field on the four line-type surfaces" fails now and then with the Cold radio unchecked: once in main's CI on 2026-09-27 and once in a local full run on 2026-09-28; it passed 6 of 6 alone. Find the race | test | agent | — | |
| TOUR-MOVE-HOLD | The blank-sheet tour's Move card moves on 0.9 s after the reader's drag, so its two closing lines (the mouse wheel zooms, Esc brings you back) are barely read. Hold it for Next, as the Measure card does, at the cost of one extra click? The same question the owner's list asks of the plumbing tour's `wsfu` card and the electrical course's `circuits/load` | decision | ⚑ call | — | [CHANGELOG.md](CHANGELOG.md#fixtour-the-move-card-waits-for-the-readers-own-drag-tour-move-glide-2026-09-28) |
| FLAKE-START-UNDO | lessons.spec.js "Start here: a fresh device's empty canvas…" fails now and then at the undo card: the click above the circle places no mark, and the status line stays "Click outside the circle first". Seen 2026-09-28 once in a parallel run of the six teaching specs and once in 18 repeats at 4 workers (0 in 12 on main before the line type ring fix, which does not reach this card: its lit target is the whole sheet). Passes alone. Find the race | test | agent | — | |
