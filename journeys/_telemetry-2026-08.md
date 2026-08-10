# Telemetry baseline — 2026-08-02 (read-only pull from production)

Evidence input for the Journey Program (see [JOURNEY-MAP.md](../JOURNEY-MAP.md) Phase 1).
Aggregates only — no user identities. Source: `public.user_activity` + row counts.

## The headline numbers

- **10 users (1 admin), 7 active in the last 90 days.** Small, real, engaged base.
- **673 projects; 492 touched in the last 30 days.** Daily-driver usage, not trials.
- Marked projects average **56 counters and 223 lines** — measuring is the heavier
  activity, and real bids are dense.
- **107 view links created, but only 56 total accesses logged.** Links get minted
  roughly twice as often as they get opened — the outsider journey (J14) deserves
  scrutiny on both the sending side (is Copy-link doing its job?) and the receiving
  side (does the email gate cost opens?).
- 5 of 7 active users have a saved Artboard.

## Event distribution (all time / last 90d)

| Event | All-time | Users | 90d | 90d users |
|---|---:|---:|---:|---:|
| line_added | 5,467 | 5 | 3,151 | 5 |
| counter_marker_added | 4,152 | 7 | 2,702 | 7 |
| project_save | 3,107 | 7 | 2,114 | 7 |
| session_start | 1,335 | 7 | 1,285 | 7 |
| export_canvas | 147 | 4 | 68 | 2 |
| project_open | 140 | 6 | 101 | 6 |
| export_pdf | 104 | 4 | 55 | 3 |

Monthly: ~2.6k–4k events/month since April; July saw 7 active users and 271 distinct
projects touched (up from ~50/month — likely the copy-project / sample-plan work).

## What this says for journey weighting

1. **J5 (measure runs) and J4 (count fixtures) are the daily core** — every active
   user, thousands of events. Friction there is multiplied by everything.
2. **Exports are rare relative to marking** (~250 export events vs ~9,600 marks) and
   concentrated in 2–4 users — either most takeoffs dead-end (a problem) or the
   Copy-to-PipeTooling path (untracked!) is the real exit. Phase 2 must find out.
3. **J14 (outsider view) under-converts**: 107 links / 56 accesses.

## The instrumentation gap (a finding in itself)

Only 7 event kinds exist. **Telemetry-blind**: scale setting (J3!), zones (J6),
Room Sizer (J7), notes/highlights/layers (J8), Delete Area/undo (J9), report/print
(J10), Copy to PipeTooling & Copy Summary (J11 — the flagship handoff is invisible),
sharing/checkout (J13), offline/install (J15), Artboard/Palette Insights loads (J16).
Any Tier-1 rework should ship with a `logUserEvent` so its effect is measurable.
Cheap standalone candidate: log `tooling_copy` and `scale_set` — the two most
decision-relevant blind spots.
