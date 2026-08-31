# Tier-3 execution ledger (Stage 4) — started 2026-08-30

Queue: B1 → B17 in numeric order, strictly sequential, one agent per batch on
`claude/t3-bNN-<slug>` cut from latest main. Same loop as Tier 2: agent (full
tests + check, no push/merge) → orchestrator verify on branch → merge in
main-integration → row status updated here → pushes batched at checkpoints.
Batch contents are the Tier-3 table rows in JOURNEY-MAP.md — each row IS the
plan; no separate plans of record (per _NEXT.md Stage 4: mechanical, small PRs).

B18 is NOT in the queue: shipped 2026-08-17 except (a) the status-bar
"keys"/"macros" dialect rename, which travels with B4's naming pass, and
(b) the coarse-pointer keyboard-links question — RESOLVED 2026-08-31, delegated
call: KEEP visible (phones' only route; tablets with keyboards use Quick Keys).

## Rescope notes (Tier-1/Tier-2 landings since the batches were written)

- **B1** — the Esc ladder moved: T2-02 added the polyline per-vertex pop,
  T2-13 added the counterModal→manageIcons hide-then-open chain. Re-grep
  app.js `:5775` anchors; new rows must slot into the CURRENT ladder order.
- **B4** — carries B18's queued item: status-bar "keys"/"macros" →
  "keyboard shortcuts" dialect (drags working-faster-with-the-keyboard.md and
  its `[[macros]]` ICON_BTN chip along). Advanced "Export PDF" delete and the
  Export Canvas demotion already shipped 2026-08-17 — do not redo.
- **B8** — the "zone tools stay armed after Apply" item was gated on Tier-2
  #14 (rect drag): landed 2026-08-30, gate satisfied, item ships.
- **B11** — was "ship WITH Tier-1 #1": T1-01 shipped 2026-08-10, unblocked.
- **B15** — rescoped by T2-15 (grid trim replaced the sheet walk): the
  Escape/Cancel discard confirm is MORE urgent (a grid mis-tap drops the whole
  upload); "Undo jumps the preview" applies to sheet view only; re-check the
  pdf-intake.js:361 signed-out gate against the new grid entry path.
- **B17** — distinct from the shipped T2 row 18 fix (that was the Create-tab
  ICON search): this batch hides the modal-level "Search counters…" box
  (index.html:569-71) that filters neither Create nor Quick. Re-grep — T2-05
  rewrote this modal's markup.

## Status

| Batch | Branch | Status |
|---|---|---|
| B1 Esc ladder | claude/t3-b01-esc-ladder | ☑ merged 2026-08-30, pushed ckpt 1 |
| B2 intake/import feedback | claude/t3-b02-intake-feedback | ☑ merged 2026-08-30, pushed ckpt 1 |
| B3 copy cluster | claude/t3-b03-copy-cluster | ☑ merged 2026-08-30, pushed ckpt 1 |
| B4 export naming (+B18 dialect) | claude/t3-b04-export-naming | ☑ merged 2026-08-30, pushed ckpt 2 |
| B5 pdf-bundle pagination | claude/t3-b05-bundle-pagination | ☑ merged 2026-08-30, pushed ckpt 2 |
| B6 viewer/share trim | claude/t3-b06-viewer-trim | ☑ merged 2026-08-30, pushed ckpt 2 |
| B7 sign-in wall copy | claude/t3-b07-signin-copy | ☑ merged 2026-08-30, pushed ckpt 3 |
| B8 scale modal small fixes | claude/t3-b08-scale-fixes | ☑ merged 2026-08-30, pushed ckpt 3 |
| B9 mobile/touch | claude/t3-b09-mobile-touch | ☑ merged 2026-08-30, pushed ckpt 3 |
| B10 legend & proof | claude/t3-b10-legend-proof | ☑ merged 2026-08-30, pushed ckpt 4 (PR #60 CI vehicle; +regen-baselines workflow) |
| B11 signed-out save signal | claude/t3-b11-local-save-signal | ☑ merged 2026-08-30, pushed ckpt 4 |
| B12 import canvas row | claude/t3-b12-import-canvas-row | ☑ merged 2026-08-30, pushed ckpt 4 |
| B13 reuse-standards naming | claude/t3-b13-reuse-standards-naming | ☑ merged 2026-08-31 |
| B14 cannot-be-undone honesty | claude/t3-b14-cannot-be-undone-honesty | ☑ merged 2026-08-31 |
| B15 prepare-pdf batch (rescoped) | claude/t3-b15-prepare-pdf-batch | ☑ merged 2026-08-31 — shipped: discard confirm, undo jump, "Trim your set" retitle + Save&Open hidden signed-out. The ⚑ signed-out auto-open was RESOLVED 2026-08-31 (delegated call) as **B15b, middle path**: fresh signed-out uploads of 3+ sheets auto-open the trim step; 1-2 sheets go straight in (full parity would modal the make-or-break first upload and invalidate ~90 spec fixtures) |
| B16 cold start drag-drop | claude/t3-b16-cold-start | ☑ merged 2026-08-31 |
| B17 dead-UI removal | claude/t3-b17-dead-ui-removal | ☑ merged 2026-08-31 — queue complete; ckpt 5-6 push pending |

Checkpoint pushes after: B3, B6, B9, B12, B15, B17 (row flips + ledger update
ride each checkpoint commit).
