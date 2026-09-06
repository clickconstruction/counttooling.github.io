# Duct takeoff — plan of record (draft for the Stage-6 session)

> Status 2026-09-06: model settled through three mockup rounds + an
> estimator walkthrough (canvas: "Duct Takeoff" artifact — six artboards).
> Will's framing decisions so far: **design-build is the primary mode**
> (most jobs design the duct while bidding; plan-and-spec copying is
> secondary), and the seven walkthrough gaps below are IN, each refined
> through the "best we can do / fits the whole" ratchet. Build order and
> the go decision belong to the Stage-6 Tier-5 session.

## The model (v2 core, mode-agnostic)

- **A duct run is one continuous trace with size segments.** Arm Duct
  with a starting size (Create tab sets size, pressure class, liner
  only). Mid-run, `S` (or tapping the size chip riding the cursor)
  opens the step popover: one-tap common step-downs, custom W×H, and
  a rise/drop field (see §4). Stroke width steps with the size.
- **Fittings count themselves from geometry, always overridable:**
  corner = 90° elbow of the current size; size step = transition;
  a run started on a run = tap on the parent. Every inferred fitting
  is a marker — right-click reclassifies (45°, boot, offset…) or
  deletes. Same philosophy as the SMACNA gauge auto-pick.
- **Pounds math:** perimeter ÷ 12 × gauge sheet weight (SMACNA
  pressure-class tables pick the gauge from the larger side; override
  chip). Round shows LF + joint count too (spiral is catalog-priced
  by LF as often as by weight).
- **The schedule prices like a bid:** straight duct by size (LF → lb),
  fittings section (counted, lb-eq each) with a one-tap **Factor %**
  fallback for quick bids, insulation sq ft (liner/wrap derived from
  the same LF × perimeter), seam & waste as its own labeled % line,
  one **Bid weight** number. Pounds and sq ft ride Copy Summary /
  Copy to /Tooling like everything else.

## Two modes, one machine

- **Design-build (primary):** architectural background, no duct to
  copy. Place air devices with CFM first; as the main is traced, every
  tap subtracts its air and the size chip suggests the ductulator
  answer for the remaining downstream CFM (equal-friction, default
  0.08"/100 ft). The true-width ghost over the floor plan makes the
  markup itself the submittable duct layout — Export PDFs = design
  drawing + bid from one trace.
- **Plan-and-spec (secondary):** an engineered M-sheet arrives; the
  PDF text layer already carries every printed callout with
  coordinates, so the trace pre-fills the starting size from the
  nearest callout and offers each step-down as the cursor passes it
  ("Plan says 20×12 here — S accepts"). Regex over pdf.js text, no
  AI, offline-safe.
- Everything downstream — runs, fittings, schedule, bid weight — is
  identical. The modes differ only in where a size comes from.

## The seven walkthrough additions (each ratcheted)

1. **Airside is a property of the run** — Supply / Return / Exhaust
   chip at create, trade colors, sidebar groups by airside. Return
   accumulates toward the unit (same math, reversed). Per-system
   **plenum-return toggle** skips ducted return and counts return
   grilles + boots only. No new tools.
2. **A system is a Group with an equipment tag.** Groups gain one
   optional field (unit + capacity CFM, e.g. "RTU-1 · 600"). Runs
   started from an equipment counter inherit the system; devices
   inherit from the run that taps them. Downstream-CFM math is
   system-scoped — suggestions stay sane with multiple RTUs.
3. **Air balance rides existing surfaces:** Δ badge on Rooms sidebar
   rows ("needs 450 · served 300 ⚠") and a capacity line on each
   system group ("600 designed / 600 capacity ✓"). Legend can carry
   the ⚠ so exports show it. No new panel.
4. **Vertical footage lives in the S popover** (rise/drop X ft at
   this point). Defaults absorb the common cases: per-project deck
   height auto-adds the RTU riser; each diffuser type carries a
   default flex-drop length.
5. **Velocity cap on suggestions:** suggested size = the larger of
   the friction answer and the velocity-cap answer (default max
   ~1,200–1,500 fpm, setting beside the friction rate); the chip
   names the binding constraint ("velocity-limited").
6. **Volume damper per tap** — duct-settings toggle, rows in the
   fittings section, right-click a tap to remove its VD. Fire
   dampers stay manual counters (the app can't know rated walls).
7. **CFM defaults hang on Room Sizer room types** (office 1.0
   CFM/ft², conference 1.5, break 1.5, storage 0.5 — editable table,
   per-room override). Rooms pre-fill device CFMs; Room Sizer is the
   design-build front door.

## Deliberately out (keep the spirit)

- **Auto-tracing runs** (vectorizing linework) — fragile in the way
  that breaks trust; belongs to the robot-pdf-intake lane if ever.
- **Labor/dollars** (lb → hours → price) — shop-specific; pounds and
  counts are the universal handoff, pricing stays in PipeTooling.
- **Full load calcs** (Manual J/N) — rules-of-thumb with editable
  defaults, yes; a load-calculation engine, no.

## Suggested build ladder (Stage-6 decides)

1. **Core:** runs + size segments + auto fittings + schedule/bid
   weight, WITH airside (§1) and system groups (§2) — the design is
   wrong without them, so they're core, not follow-on.
2. **Design-build layer:** CFM on devices, ductulator suggestions
   (+velocity cap §5), room-type CFM defaults (§7), air-balance
   badges (§3).
3. **Polish:** vertical entries + defaults (§4), VD-per-tap (§6),
   true-width ghost.
4. **Plan-and-spec layer:** callout reading (needs one new primitive:
   query the PDF text layer near a point).

Worked example numbers used across the mockups (for future specs):
24×12 @ 24 ga = 6.94 lb/ft; 20×12 @ 24 ga = 6.17; 16×10 @ 26 ga =
3.93; 12"Ø @ 26 ga = 2.85; elbow 24×12 ≈ 35 lb; transition ≈ 15 lb;
tap ≈ 12 lb; seam & waste +15%; fitting factor fallback ≈ 40%.
