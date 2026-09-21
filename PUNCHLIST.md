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
| R1-RECLICK | Decide the re-click trap: `[Check out to Edit]` and `[Turn In]` are the same pixels, so a second click releases the lock | decision | ⚑ call | — | [_TODO.md](journeys/plans/_TODO.md#r1--review-our-own-turn-in-was-reported-as-an-admin-force) |
| SAMPLE-A | Sample plan A polish hand-off, for whoever knows the trade better | chore | dev | — | [_TODO.md](journeys/plans/_TODO.md#sample-plan-a--polish-hand-off-2026-09-14-for-whoever-knows-the-trade-better) |
| P4-WATER | Water sizing by fixture units: IPC first, water only, mockups before code | build | dev | — | [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) |
| EXPIRY-30 | 30-minute checkout expiry under contention is still unwalked (time-gated; machinery covered by unit and spec) | test | tester | — | [_NEXT.md](journeys/plans/_NEXT.md) |
| LEGEND-FACE | The sheet legend draws in DM Sans; the mock assumed a condensed face, which is most of the block's extra width (compact 203 pt wide vs the mock's 148). Vendoring one (Barlow Condensed, OFL) would narrow it about a fifth: a font in the shell and the precache, so a call first | decision | ⚑ call | — | [CHANGELOG.md](CHANGELOG.md#featlegend-the-sheet-legend-compact-by-default-for-electrical-and-hvac-2026-09-19) |
| TURNIN-FLAKE | Seen once, not reproduced (2026-09-20): with the five cloud spec files running in parallel on the one test account, turn-in-self-release's flag-on Turn In never showed "Project turned in." inside its 15 s wait; four serial and two other parallel runs were green. Find out whether it is the spec sharing an account or a real intermittent in Turn In (the area R1 is about): have the spec print the save-status log and the toast state on that timeout, then run the five files in parallel until it recurs | bug | agent | — | [CHANGELOG.md](CHANGELOG.md#chorepunchlist-dev-auth-closed-the-cloud-specs-run-green-2026-09-20) |
| FILM-DRAG | Hero film generator: a room drag can miss in a full render. Two of three HVAC renders stopped at `boxRoom`'s wait for `#roomBoxModal` (the Lobby once, the Conference room once, on two browsers); every `--chapters-only` pass, which takes no screenshots, runs clean, so it is timing under the frame capture. Make the drag settle (wait for the Room tool's drag state after mouse down and before mouse up) so a render never needs a re-run | bug | agent | — | [LANDING-REFRESH.md](journeys/plans/LANDING-REFRESH.md#gotchas-worth-not-rediscovering) |
