# Phase-4 Tier-1 plans — execution index

Sequencing review 2026-08-10 (sequencing critic pass over the nine plans in this
directory plus the Tier-1 table in JOURNEY-MAP.md:185-201). Rows 3 and 10 are ◐ fix in
flight in Will's separate sessions and have no plan file here — coordinate via the
per-plan risk notes (T1-04/T1-07 watch T1-03's `scale_set`; T1-05 watches T1-10's
report.js:334 edit).

## Recommended execution order (sequential — one plan fully lands before the next starts)

| # | Plan | Branch topic | Why here |
|---|------|--------------|----------|
| 1 | [T1-01](T1-01.md) | Signed-out restore prompt + clobber guard | Highest stakes (Tier-1 rows 1–2, active data loss) and the largest, most anchor-fragile diff — land it first so the small overlapping plans rebase around it, not the reverse. |
| 2 | [T1-08](T1-08.md) | Append never renames the project | S-size; its `handleFreshUpload` hunks interleave with T1-01's §6 intake hook and both extend pdf-upload.spec.js — rebasing the ~10-line guard+toast onto landed T1-01 is the cheap direction. |
| 3 | [T1-06](T1-06.md) | Arc length FP-drift fix | Independent pure-math fix on the daily core; must precede T1-05 so the shared geometry/line-metrics test files merge cleanly and render-pixels snapshots regenerate exactly once, with the totals shift attributable to this fix alone. |
| 4 | [T1-05](T1-05.md) | ft/px split + Copy Summary gate | Widest surface count (6 rollup surfaces + report); lands on top of T1-06's corrected math; must precede Tier-2 #24 and Tier-3 B3, which build on its `doCopy`/split shapes. |
| 5 | [T1-04](T1-04.md) | Corrected apply → verify hand-off | Scale-pair leader — both plans name T1-04-first as the preferred order; first-to-land owns the `scale_set`/`scale_verify` allowlist migration (built on the then-latest `log_user_event` body). |
| 6 | [T1-07](T1-07.md) | Zone applies inherit sheet correction | Mechanical rebase onto T1-04's landed apply handlers (wraps the zone early-out argument; T1-04 branches sit after it); skips the migration T1-04 shipped. Its spec is already written order-resilient (Esc if `scaleCheckMode`). |
| 7 | [T1-09](T1-09.md) | Load-from-Cloud re-links marks | Independent surface (annotation-model + my-settings); only touchpoint is registry-tail adjacency in app.js; its `artboard_load` migration must copy the migration-chain-latest function body. |
| 8 | [T1-12](T1-12.md) | Dead view link full-screen message | Shares only the app.js boot IIFE with T1-01 (different hunks — re-verify anchors post-T1-01); its `view_link_dead` migration is last in the `log_user_event` chain and must include every earlier branch's event types. |
| 9 | [T1-11](T1-11.md) | Choose-tab badges sum canvases | One-line fix with zero overlap against anything above — safe closer; keeps features/counter.js diff minimal ahead of Tier-2 #17. |

Rationale for the two orderings that could reasonably flip: T1-08-before-T1-01 would
also work (small first), but T1-01 is the tier's top data-loss item and its plan is the
one whose many app.js/save-engine anchors rot fastest — it goes first. T1-06 could land
anywhere before T1-05; slot 3 keeps the two snapshot-touching branches adjacent.

## Conflict notes (verified against the plan texts, not just the summaries)

1. **T1-04 ↔ T1-07 — same file, same two functions.** Both edit the preset `btn.onclick`
   and `#scaleCustomApply` handlers in features/scale.js (:260/:328) and extend the same
   `scale.spec.js` describe block. Semantically independent (page path vs zone path) but
   textually adjacent — a rebase conflict in those two hunks is expected and fine.
   T1-04 first (both plans agree); whichever lands first ships the `scale_set` allowlist
   migration, the second skips it. Also both watch T1-03 (in flight) for an
   opportunistic `scale_set` add — grep before duplicating.
2. **T1-01 ↔ T1-08 — same function, under-flagged by both plans (now fixed).** T1-01 §6
   adds an upload-hash stash + `maybeReapplyLocalBackupMarks` hook inside
   `handleFreshUpload` (after :350, before the prompt gate at :361); T1-08's rename guard
   (:344-348) and append toast (after :350) sit in the same region. Both extend
   pdf-upload.spec.js with new describes. T1-08 originally claimed "no coordination
   needed" — corrected in the plan file. Order: T1-01 → T1-08.
3. **T1-05 ↔ T1-06 — shared test files + snapshot baselines.** Both edit geometry.js,
   geometry.test.js, and line-metrics.test.js (different functions/tests), and both can
   move `render-pixels.spec.js-snapshots/`. T1-06 first; T1-05 then verifies/regenerates
   baselines once on top. Cross-machine snapshot regen churns the full set — regenerate
   on the baseline machine both times.
4. **T1-01 ↔ T1-12 — same app.js boot IIFE.** T1-12's catch rework (:6389-6392) vs
   T1-01's restore-block rework (:6434-6506): different hunks, no logic overlap, but
   T1-01 shifts line anchors — T1-12 re-greps before editing (its plan already says to).
5. **`log_user_event` migration chain (cross-cutting, owned by no single plan).** Four
   branches re-create `public.log_user_event` to extend the event-type allowlist:
   T1-01 (`restore_prompt_shown`/`restore_keep`), T1-04-or-T1-07 (`scale_set`/
   `scale_verify`), T1-09 (`artboard_load`), T1-12 (`view_link_dead`). Each later
   migration MUST copy the then-latest deployed function body — copying the original
   20260326230000 body silently un-allowlists every earlier branch's events. All four
   plans now carry this warning; the execution order above is also the migration order.
6. **app.js registry-tail adjacency.** T1-05 (`getLineLengthSplitForTotals`,
   `formatFeetPx`) and T1-09 (`planPaletteRelink`, `applyPaletteRelink`) both add
   publishes in the `// SECTION: App feature registry` block — trivial textual
   adjacency, resolved by sequential execution.
7. **JOURNEY-MAP.md status column.** Every plan flips its own row on merge — the shared
   table is why parallel branches are banned (standing rule below).
8. **Acceptance-criteria cross-checks (no invalidations found).** T1-06 shifts all arc
   lengths ~5%, but no other plan's fixtures or assertions use arc line types (T1-05's
   fixtures are straight 240-pt/367.2-pt lines; T1-04/T1-07 assert px-per-ft values) —
   any future spec adding length assertions must use post-T1-06 math. T1-07's spec
   pre-handles T1-04's verify hand-off. T1-05's footer `0` vs `0.00 ft` cosmetic delta
   may trip an existing assertion — its plan says update the assertion. No two plans
   create the same new spec file (T1-05's `scale-gate-page-switch.spec.js` is the only
   new one).

## Per-plan one-liners

- **T1-01** — Offer the Keep/Discard restore prompt on signed-out boots, key the boot
  backup aside so the 5s interval can never clobber it, and re-apply marks on
  hash-matched same-PDF re-upload (rows 1+2, one PR).
- **T1-04** — A preset/custom scale apply with a sheet correction in play flows straight
  into the escapable two-point verify instead of a 2s toast.
- **T1-05** — Length rollups keep feet and px in separate buckets on all six surfaces,
  Copy Summary gets the pre-copy scale gate, and the gate re-fires on page switch.
- **T1-06** — `quadraticBezierLength` integer-step loop so arcs stop under-measuring ~5%
  (arc >= chord pinned by unit test).
- **T1-07** — Zone preset/custom applies inherit the page scale's stamped sheet
  correction (product decision 2026-08-09); two-point stays ground truth.
- **T1-08** — Uploading an addendum appends without renaming the open project and toasts
  "Added N sheets to <project>".
- **T1-09** — Load-from-Cloud plans a name-match relink, warns with real numbers, pushes
  an undo snapshot, and reconciles leftovers into visible "Unknown" rows.
- **T1-11** — Choose-tab counter badges sum `canvases[].annotations` instead of the dead
  pre-refactor `p.annotations` (one line).
- **T1-12** — Dead/revoked/unreachable view links land on a full-screen plain message
  (Retry on network failure); server-confirmed revocation beats the offline cache.

## Standing rules (apply to every plan above)

1. **Sequential execution.** One plan at a time, in the order above; a plan starts only
   after the previous branch is merged and `main` is pulled. No parallel Tier-1 branches
   — the conflict notes above assume it.
2. **One-topic branches.** Each plan is one branch/PR using the branch name in its plan;
   nothing opportunistic rides along (the plans' "What does NOT change" sections are
   binding).
3. **`npm run check` before every merge** (lint, unit tests, toc/filemap/macros/guides/sw
   staleness, brand tokens), plus the plan's named Playwright specs locally. Every plan
   touches precached shell files — `npm run build:sw` is required every time; never
   hand-edit `CACHE_VERSION`.
4. **JOURNEY-MAP.md status column updated as each lands** (☐ → ◐ on branch, ☑ on merge),
   in the same PR.
5. **Re-verify line anchors before editing.** All plans' anchors were verified
   2026-08-09/10 pre-sequence; each landed branch drifts them for the next. Navigate
   app.js by `// SECTION:` markers, grep the quoted anchors elsewhere.
6. **Migration chain discipline.** Any `log_user_event` re-creation copies the latest
   deployed body (see conflict note 5); apply via Supabase MCP `apply_migration`
   (name = filename without `.sql`) per AGENTS.md.
