# Journey Program — open-items processing plan (2026-08-10)

Phases 0–5 complete; 4 pushes live. This is the plan for everything still open,
in order, with Will's decision gates marked ⚑.

## Stage 1 — Deploy watch (this week, cheap)
1. Will: the 15-minute hand-walk (_RELEASE-CHECKLIST.md) on real projects.
2. Will: one PipeTooling paste of a mixed scaled/unscaled line type (two-row check).
3. Orchestrator: read-only telemetry pulls at day+1 and day+7 — `client_error`
   flat (clean landing) + new events flowing (`restore_prompt_shown`, `scale_set`,
   `copy_summary`, `artboard_load`, `view_link_dead`, `render_worker_fallback`,
   which now records for the first time ever). Anything hot → fix-forward PR.
4. Housekeeping: delete the 13 merged `claude/*` topic branches.

## Stage 2 — ⚑ Tier-2 scope gate (after ~1 week of telemetry)
Re-rank the 16 Tier-2 rows with real usage data before planning. Standing
candidates for the top: Clear Page unreachable (#13, blocker-grade), the toast
system rework (#15 — it obstructed three Tier-1 implementations), the Esc-ladder
omnibus (must honor T1-01's restore-prompt comment), drag-gesture completion
(#14's remaining half), and the J1 first-ten-minutes pair (PDF drag-and-drop,
blank-name counter). ⚑ Will approves the scope + order.

## Stage 3 — Tier-2 execution (the machine, again)
Phase-4-style planning pass (plans of record + sequencing critic) → the proven
sequential loop: one agent per plan, one-topic branch, full gates, merge, batch
pushes. Instrumentation gaps (room-sizer events, `report_open`) ride the PRs
that touch their surfaces, per the standing rule.

## Stage 4 — Tier-3 batches (interleave or follow)
17 pre-grouped papercut batches (~50 items), each one small PR. Mechanical;
suitable for slack time between Tier-2 plans or a dedicated cleanup week.

## Stage 5 — ⚑ Supervised cloud-interior walk (schedule with Will)
The 115 not-walked items behind sign-in (J13/J14/J17 interiors: checkout
lifecycle under contention, real view-link round trip, admin flows). Needs:
⚑ a staging/test-account decision (never walk as a real customer identity),
Will present or explicitly delegating. Output: dossier addenda + any new
findings into the Tier-2/3 queues.

> **STATUS 2026-08-31:** delegated; the account decision resolves to the
> repo's own dev-auth test-account harness (`?devAuth=1` +
> `DEV_AUTH_EMAIL`/`DEV_AUTH_PASSWORD` in config.local.js — the same
> mechanism the cloud-gated specs and the `cleanup-test-accounts` purge
> already assume; never a real customer identity).
>
> **WALKED 2026-08-31 (scoped)** — credential supplied, J14 walked
> end-to-end (mint → gate → live viewer → scale share-back → access log →
> revoke → branded dead card: ALL VERIFIED on prod) and J13's
> single-account lifecycle (save → auto-checkout → turn-in) verified.
> Addenda in share-with-an-outsider.md / share-and-collaborate.md /
> admin-onboards-a-team.md. New findings: (1) **hidden-tab save stall** —
> save-engine's rAF-based `tick()` never fires in a hidden tab, stalling
> manual saves indefinitely with no error (stumble/blocker-grade; 1-line
> fix candidate); (2) the access log is still a native `alert()` (X8
> sweep); (3) `cleanup-test-accounts` isn't keeping up (113 CI-debris
> projects on the test account — ops check the pg_cron job); (4)
> viewer `#hideMarksBtn` visibility-matrix check-later. **Still open**:
> J13 contention + multi-user roles (needs a second account), J17 admin
> interiors (test account isn't admin).
>
> **WALKED 2026-08-31 (second pass, two accounts)** — `test2@clickplumbing.com`
> minted; J13 contention walked end-to-end (Share roles honored, lock
> hand-off live both directions in ~3 s, same-account stale-lock takeover,
> mobile matrix → sidebarCheckoutBanner consolidation: ALL VERIFIED against
> prod backend; addendum in share-and-collaborate.md). Finding resolutions:
> (1) hidden-tab save stall FIXED (claude/t3-save-stall-hidden-tab, merged);
> (3) cleanup-test-accounts **verdict revised — purge appears healthy**: the
> test account's oldest project row is 2026-08-30 and zero rows are week-old,
> so the 113 (now 132) debris rows are all fresh churn from the Aug 29–31
> execution burst, not backlog — re-check ~Sep 7; if the Aug 30–31 rows
> persist then, the pg_cron job is genuinely dead (side nit: specs
> double-create identically-named rows); (4) viewer `#hideMarksBtn`
> RESOLVED not-a-bug (matrix walked 375–1400 px; addendum in
> share-with-an-outsider.md). Still open: (2) access-log native `alert()`
> (queued with the X8 sweep), J17 admin interiors + force turn-in
> (needs an admin account; destructive admin actions stay out of scope on
> prod), 30-min expiry under contention (time-gated).
>
> **WALKED 2026-08-31 (third pass, admin credential) — Stage 5 COMPLETE.**
> J17 admin interiors walked read-only + open-and-cancel (addendum in
> admin-onboards-a-team.md): all four User Settings openers, the Manage
> Users table + its three destructive dialogs (opened, cancelled), both
> activity modals (501 events), All Users, the 425-row admin Load Project
> and Manage Projects, and the per-project **force turn-in — executed once
> against the walk's own test project: works, confirm-gated, demotes the
> other session live in ~3 s**. New findings: (5) stumble — the forced-out
> editor's only notice was a transient toast (the walk initially recorded
> "none"; corrected on code review) — **FIXED 2026-08-31** (branch
> claude/force-turnin-notice-modal): a notice modal with saved /
> unsaved-edits variants, approved via mock-up review; the dirty-edits
> question resolved (engine already flushes before demotion); (6) the
> dossier predates two admin surfaces — per-row "Email a one-time sign-in
> link" and "Make/Remove overseer" (+ Overseer and twinUser roles in the
> table); (7) papercut — activity-log timezone wording differs between
> Events and Summary views (B4-style dialect). Nothing on the Stage-5 list
> remains unwalked except the 30-min expiry-under-contention (time-gated;
> machinery covered by unit/spec).

> **RE-CHECKED 2026-09-14 — finding (3) RESOLVED: the purge is healthy.** `cron.job_run_details` shows `cleanup-test-accounts-daily` succeeding every day 2026-08-21 → 2026-09-13 at 08:30 UTC; the 2026-09-13 pg_net response is HTTP 200 `{ok:true, rowsDeleted:0, filesRemoved:0}` with the 7-day cutoff; and `projects` holds **zero rows** for either test account (the 132 Aug 30–31 debris rows are gone). Nothing for ops. The side nit (specs double-creating identically-named rows) stands as a nit.

## Stage 6 — ⚑ Tier-5 product session (roadmap, not code)
The 17 verified `gap` rows, intersected with the standing HVAC direction
(duct-by-size → pounds remains the named #1 product gap). One conversation:
which gaps become features, which become "no, deliberately."

> **STATUS 2026-08-31:** session document prepared ("The Seventeen Gaps",
> private artifact — ask Stephen for the link): all 17 rows bucketed with
> recommendations — 3 build (X1 zone handles, X2 mobile peek, X3 scale
> re-edit), 2 needing the product call (X6 copy-matches-screen semantics,
> X4 room-label design), 5 fold-into-passes, 3 already defused by shipped
> tiers, 4 recommended "no, deliberately" — with duct-by-size framed as
> the session's one sequencing decision. The conversation itself remains.
>
> **STATUS 2026-09-13:** session doc drafted in-repo:
> [journeys/plans/_STAGE6.md](_STAGE6.md) — the 17 rows re-bucketed against
> main after D17 (3 build / 2 call / 5 fold-in / 3 defused / 4 no — unchanged),
> the three drift-patrol stumbles still awaiting re-rank (J5-A, J5-D ⚑, J6-H),
> and the sequencing slot re-asked now that duct-by-size has shipped. Every
> `[decision]` slot is blank — the conversation remains.

> **STATUS 2026-09-14 — the sequencing slot is decided.** Will: candidate 3, plumbing fixture-unit sizing, IPC first, water only, mockups first. [WATER-PLAN.md](plans/WATER-PLAN.md) is the plan of record (model, rulebook slice, Bid Check, ladder, worked example, the six walkthrough questions); the "Water Sizing" artifact carries the six artboards for the plumber walkthrough. The X4 label-design slot and the X6 re-drive ☑ remain the open product calls.
>
> **2026-09-14 — the water-sizing mockup round is decided** (six of six, recorded in WATER-PLAN.md's status block: new run from here · velocity cap at S with the pressure check in Bid Check · project occupancy + per-counter flip · side on the line type · size-first chip · water first, DWV next). The §6 ladder is unblocked; rung 1 is the rulebook slice.

> **2026-09-14, sample plans:** two sheets now — A (simple, office TI, parked in
> `scripts/sample-plan-candidates.js`, polish hand-off in [plans/_TODO.md](plans/_TODO.md))
> and B (advanced, restaurant plumbing, live). Both draw 12 px/ft = 1/8" = 1'-0".

## Standing practice — drift patrol
After any major feature ships (e.g. HVAC duct), re-run a single-journey walk +
verify for the affected journey and update its dossier — the KB stays true the
same way the guides do.

## Hand-off (2026-09-13)
The remaining build queue (Wave 3, D19–D25 — the B19 papercuts, X1/X2/X3, the X4/X6 decisions, the strip call) is written up as self-contained briefs in [plans/_TODO.md](plans/_TODO.md) for whoever picks it up next, with the run loop, gates and environment gotchas included. D18 was the last unit this session ran.
