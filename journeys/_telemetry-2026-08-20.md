# Telemetry pull — 2026-08-20 (deploy watch, day+10)

Second read-only production pull — Stage-1 item 3 of [plans/_NEXT.md](plans/_NEXT.md).
Baseline: [_telemetry-2026-08.md](_telemetry-2026-08.md) (2026-08-02, pre-Tier-1).
Aggregates only, no identities. Source: `public.user_activity` on the production
project. Window: the 10 days since the Tier-1 push landed 2026-08-10.

## Verdict: clean landing

- **Zero `client_error` rows** mirrored to the activity feed in the window —
  the _NEXT.md "client_error flat" condition is met.
- **Marking volume undisturbed**: 562 `counter_marker_added`, 487 `line_added`,
  477 `project_save` since deploy — the pre-Tier-1 daily rate.
- Two numbers that look alarming and are not: `projects` 673 → 241 and
  touched-30d 492 → 47 are the `cleanup-test-accounts` pg_cron purge (landed
  2026-08-13) working as designed, and `session_start` spikiness (222 on deploy
  day, 0–9 after) predates the deploy — reload days inflate it; it is not a
  DAU proxy.

## All six new event kinds flow

| Event | Since deploy | Users | Shipped by |
|---|---:|---:|---|
| `scale_set` | 62 | 5 | T1-04 |
| `restore_prompt_shown` | 56 | 6 | T1-01 |
| `unscaled_ft_block` | 36 | 2 | T1-05 |
| `render_worker_fallback` | 23 | 6 | pre-Tier-1; first field data ever |
| `restore_keep` | 14 | 6 | T1-01 |
| `copy_summary` | 13 | 2 | T1-05 |

The Phase-1 "only 7 event kinds exist" gap is materially closed.

## Four Tier-1 fixes: zero field activations (untriggered, NOT broken)

Each emitter was verified present in code. They are unfalsified, not validated —
do not cite them as proven:

| Fix | Event (emitter) | Why it never fired |
|---|---|---|
| T1-04 corrected-apply → verify | `scale_verify` (features/scale.js:455) | `correctionFactor` was null on all 62 `scale_set` events; `verifyHandoff` false on all 60 carrying it — nobody scaled a compressed sheet in the window |
| T1-09 Load-from-Cloud re-link | `artboard_load` (features/my-settings.js:126) | no mid-bid Artboard loads |
| T1-12 dead view link | `view_link_dead` (features/view-only.js:336) | no dead-link hits; 12 new links minted |
| T1-01 signed-out restore | `restore_prompt_shown{source:'local'}` (app.js) | all 56 prompts were cloud-source — the active base is entirely signed in |

The signed-in half of T1-01 IS proven: 14 `restore_keep`, all with nonzero
`markers` — the clobber guard holds; the row-2 `{markers:0}` poisoning has not
reproduced in production.

## Net-new finding: render-worker teardown race (now fixed in this batch)

`render_worker_fallback` fired 23× across 6 of ~8 active users — every event
the identical signature:

```
doc-load: PDFWorker.fromPort - the worker is being destroyed
```

Not the dense-CAD worker crash already in CHANGELOG — a teardown race on every
document swap into a live worker (project switch, append, prepare-PDF rebuild):
`doc.destroy()` was fire-and-forget while pdf.js 3.11.174's `fromPort` throws
for any `getDocument` inside the `_pendingDestroy` window, and the resulting
`ok:false` tripped the session fallback to main-thread rasters. Fixed on
`claude/f5-render-worker-teardown` (serialize the doc lifecycle; await destroy
before adopt); watch this event go quiet post-deploy.

## Re-ranking signal for the ⚑ Stage-2 gate

1. **Copy to /Tooling is the measured exit path** — 13 `copy_summary` vs
   5 `export_pdf` / 1 `export_canvas` since deploy. Phase 1's open question
   ("most takeoffs dead-end, or the untracked /Tooling path is the real exit")
   is answered. Promotes B3 (shipped in this batch); demotes B4/B5.
2. **Scope choosers are near-unused**: 12 of 13 copies were scope `all`.
   B3's "skip the chooser" item and B4's scope-dialect pass were descoped on
   this evidence.
3. **The px/ft trap is still walked into ~3.6×/day** (36 `unscaled_ft_block`,
   all `source:'page-switch'`, 2 users) — T1-05's re-check is earning its keep.
4. **The restore prompt is a nuisance ~75% of the time** (56 shown / 14 kept,
   all cloud-source). Candidate: only offer it when the local backup beats the
   server copy.

## Recommended order (as executed in the 2026-08-20 batch)

1. Render-worker teardown race (net-new, 6 users) — done
2. #13 Clear Page unreachable — done
3. #15 toast rework — **deliberately deferred**: it cuts across app.js +
   styles.css and must land alone, not inside a parallel batch
4. B3 copy cluster (promoted) — done, chooser item descoped
5. B4/B5 — demoted, unscheduled
