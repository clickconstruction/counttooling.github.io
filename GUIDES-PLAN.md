# Guides Expansion Plan — 11 → 26 articles in three tiers

Goal: cover all ~65 features in [FEATURE-CATALOG.md](FEATURE-CATALOG.md) with substantial,
maintainable how-to articles — no thin pages, nothing uncovered. Built on the existing pipeline:
Markdown in `content/guides/`, `npm run build:guides` (CI-checked), generated screenshots via the
`SHOTS` manifest in `scripts/build-screenshots.js`.

Status legend: ☐ not started · ◐ drafted · ● published

---

## Phase 0 — Infrastructure & hygiene (do first, ~half a day)

These make the next 15 articles cheaper and safer:

- ☐ **Fix the known drift**: `content/guides/measuring-runs-lines-and-polylines.md` still says
  "Snap to horizontal/vertical (press J)" — it's 8-way 45° snap now. Edit + `build:guides`.
- ☐ **Category sections on the guides index**: `category` front-matter is currently
  informational-only; with 26 articles the flat index becomes a wall. Update the index template in
  `scripts/build-guides.js` to group cards under category headings (order within category by
  `order`). Update `guides.test.js`/`guides.spec.js` expectations.
- ☐ **Screenshot seeding helpers**: `build-screenshots.js` currently seeds one sample takeoff
  inline. Extract reusable helpers (`seedTakeoff(page, opts)`, `openModal(page, id)`,
  `callout(n, selector)`) so each new SHOT is a ~10-line manifest entry, not a bespoke script.
- ☐ **A "compressed PDF" sample fixture**: the scale-verification article needs a rescaled sheet
  to show the sheet-size warning honestly. Add a `--compressed` variant to
  `scripts/build-sample-plan.js` (render the same plan at ~60% MediaBox).
- ☐ **New icon shortcodes as needed**: `ICON_BTN` in build-guides.js currently maps 19 button ids.
  Tier 1 needs at least: `layers` (canvas switcher), `undo`, `export` — add ids as articles need
  them (buttons and status-bar spans both work).
- ☐ **Docs-drift guard (cheap version)**: add one line to AGENTS.md's conventions: "when changing
  user-visible behavior, `grep -ri <feature-term> content/guides/` and update articles in the same
  PR." (The J-snap drift happened because nothing prompted this.)

---

## Phase 1 — Tier 1: nine standalone how-tos (the core)

Work in three batches so screenshot sessions are shared. Per-article recipe at the bottom.

### Batch A — "Getting plans in & trusting the numbers"

**1. ☐ `preparing-a-plan-set.md`** — *Preparing a plan set*
- Front-matter: order 1.5 · category "Getting started" · icon `set-scale`→ better: none yet (use `move`)
- Covers (7): multi-file upload · 50 MB cap · Prepare PDF keep/drop · reorder · rotate ·
  append-pages mode · page renaming · marked-page badges & Shift+arrow navigation
- Screenshots: Prepare PDF modal with ①keep/drop ②rotate ③Save-and-open callouts; sidebar with
  scale/marks badges highlighted
- Links: → how-to-do-a-pdf-takeoff, setting-the-scale

**2. ☐ `verifying-your-scale.md`** — *Is your scale lying to you?*
- Front-matter: order 2.5 · category "Getting started" · icon `set-scale`
- Covers (4): sheet-size correction (compressed-PDF warning + picker) · verify-by-measuring check
  mode (% error) · synthetic scale bar · the verify advisory/toast
- Screenshots: the yellow sheet warning + picker on the compressed fixture; the check panel
  showing Expected vs. reads + % error; the dashed scale bar on-plan
- This is the differentiation article — no competitor documents this failure mode. Also the most
  care-intensive: verify every claim in the live app first.
- Links: → setting-the-scale (and add a forward link from that article to this one)

**3. ☐ `fixing-mistakes.md`** — *Fixing mistakes and editing marks*
- Front-matter: order 4.5 · category "Working with plans" · icon `delete-area`
- Covers (6): undo/redo 50 steps · Delete Area with confirm count · right-click context menu on
  marks · item details modal (rename/recolor a whole type) · Line Properties (drops, vertices) ·
  right-click tool settings menu
- Screenshots: Delete Area rubber band + confirm modal; context menu on a counter with name row

### Batch B — "Counting depth"

**4. ☐ `custom-icons.md`** — *Custom icons: make the plan read like your trade*
- Front-matter: order 3.5 · category "Counting" · icon `counter`
- Covers (3): bundled trade icon library · SVG upload (requirements: path/rect/circle/ellipse/line,
  viewBox) · Manage Icons (rename, reorder, delete, edit mode) · icons following your account via
  Artboard (cross-ref)
- Screenshots: Create Counter icon grid with the upload cell highlighted; Manage Icons modal
- Source material: CUSTOM_ICONS.md already documents SVG requirements — reuse.

**5. ☐ `organizing-a-busy-sheet.md`** — *Keeping a dense takeoff organized*
- Front-matter: order 3.7 · category "Counting" · icon `counter`
- Covers (6): groups + subtotals + show-group-colors · show-only-on-current-page · sidebar search ·
  counter settings (size/rings/opacity/numbers) · line type settings · sidebar collapse/reorder
- Screenshots: a deliberately busy sheet before/after groups + show-only filtering

**6. ☐ `quick-creators.md`** — *Building your palette in two clicks*
- Front-matter: order 3.9 · category "Counting" · icon `line`
- Covers (3): Quick Count (Size/Type/Material) · Quick Line (Size/Material) · modifier management
  (add/remove options) · type-to-icon mapping · modifiers riding the Artboard (cross-ref)
- Screenshots: the Quick tab with ①size ②type ③material callouts and the live name preview

### Batch C — "Layers, saving, and your palette across bids"

**7. ☐ `canvas-layers.md`** — *Canvas layers: alternates and options on one sheet*
- Front-matter: order 5.7 · category "Working with plans" · icon `layers` (new shortcode)
- Covers (5): multiple canvases per page · add/duplicate layer · Up/Down switching · show-all peek ·
  canvas JSON export/import (move marks between projects; hash-matched re-attach)
- Screenshots: footer layers menu open; show-all peek on a two-layer sheet

**8. ☐ `how-your-work-is-saved.md`** — *How your work is saved (and how to tell)*
- Front-matter: order 7.5 · category "Collaboration" · icon `save-status`
- Covers (6): 5-second autosave · local backups (IndexedDB) · Save Status bell states
  (gray/yellow/dim) · the Save Status modal + export logs · restore-last-session prompt ·
  what checkout expiry looks like and how recovery works (user-facing view only)
- Screenshots: the bell states; the Save Status modal
- Tone: reassurance — this article exists so users trust the tool with a day's work.

**9. ☐ `artboard-and-palette-insights.md`** — *Your palette, every bid*
- Front-matter: order 6.8 · category "Working faster" · icon `keys`
- Covers (5): Artboard save/load/export/clear · what rides it (counters, line types, modifiers,
  Quick Keys, custom icons) · Palette Insights (cross-project usage, min-projects filter,
  one-click adds)
- Screenshots: My Settings Artboard rows; Palette Insights modal

Tier 1 exit criteria: every feature in FEATURE-CATALOG.md sections 1–8 is covered by at least one
article (see coverage map below).

---

## Phase 2 — Tier 2: four SEO/marketing plays

These mirror `plumbing-takeoff.md` — trade- and situation-keyed landing content. Write only from
real features; the honesty rule in content/guides/README.md applies doubly here.

**10. ☐ `hvac-takeoff.md`** — *Doing an HVAC takeoff* — order 9.1 · "By trade" · icon `room`
- Hook: Room Sizer (areas/volumes → airflow & equipment sizing), counters for
  diffusers/grilles/equipment, polylines for duct runs, always-feet totals.
**11. ☐ `electrical-takeoff.md`** — *Doing an electrical takeoff* — order 9.2 · "By trade" · icon `counter`
- Hook: counters for devices/fixtures, polylines + drops for conduit/homeruns, multiply zones for
  typical floors, groups per panel/circuit.
**12. ☐ `takeoff-on-a-tablet.md`** — *Takeoffs on a tablet in the field* — order 8.5 · "On the job site" · icon `move`
- Hook: touch gestures, aim loupe, burger menu, install + offline, viewer scale sharing from the
  field. Absorbs the tablet section currently squeezed into the offline article.
**13. ☐ `browser-based-vs-desktop-takeoff.md`** — *Browser-based vs. desktop takeoff software* —
  order 10 · new category "Choosing a tool"
- The FEATURE-CATALOG market-context section as honest comparison content (per-seat pricing,
  Windows-only installs, cloud-required tools, the offline gap). Name categories of tools, not
  competitor grievances; keep every claim sourced and current.

SEO notes for this phase: each description written to ~150 chars with the query in it; titles are
the query ("HVAC takeoff software" patterns); sitemap regenerates automatically; interlink each
trade article to the Tier 1 how-tos it leans on.

---

## Phase 3 — Tier 3: folds, edits, and the admin handbook

**14. ☐ `annotating-and-reviewing.md`** — *Highlights, notes, and reading the bare drawing* —
  order 5.8 · "Working with plans" · icon `note`
- Covers (4): highlights · notes (move/resize/edit) · hide marks · legend settings (appearance,
  rooms rows) — pulled out of the reports article where legend settings never quite fit.
**15. ☐ Edit `reports-and-exports.md`**: add download-current-page modes, the summary count-detail
  drill-down (thumbnails), canvas JSON export as a hand-off path, bundle-highlights/notes toggles.
**16. ☐ Edit `sharing-and-view-links.md`**: add viewer scale sharing (the field loop), the access
  log + revoke walk-through, and a pointer to how-your-work-is-saved for expiry recovery.
**17. ☐ Edit `working-faster-with-the-keyboard.md`**: add the right-click tool-settings menu and a
  pointer to quick-creators.
**18. ☐ `admin-handbook.md`** — *Admin handbook* — order 11 · new category "For admins"
- Covers (6): create users · passwords/reset · transfer ownership · Manage Projects + force
  turn-in · User Activity / My Activity · global force reload.
- Low SEO value, high onboarding value. Consider listing it on the index but keeping tone
  internal; it's fine indexed (no secrets — it documents UI that requires admin auth anyway).

---

## Coverage map (all 65 catalog features → articles)

| Catalog section | Features | Covered by |
|---|---|---|
| 1 Getting plans in | upload, prepare, append, rotate, rename, badges/nav | #1 (new) + existing how-to |
| 2 Scale & calibration | per-page scale, presets, custom | existing setting-the-scale |
| | sheet correction, verify mode, scale bar | #2 (new) |
| | scale zones, multiply zones | existing scale-zones article |
| 3 Counting | counters, live tally | existing counting article |
| | custom icons, bundled library | #4 (new) |
| | groups, show-only, settings | #5 (new) |
| | quick creators | #6 (new) |
| 4 Measuring | lines, polylines, arcs, drops, measure, 45° snap, grid | existing measuring article (+ Phase 0 drift fix) |
| | Room Sizer | existing room-volumes article |
| | always-feet totals | existing measuring + reports articles (one added sentence each) |
| 5 Annotating | highlights, notes, hide marks, legend | #14 (new) |
| | canvas layers, peek, JSON export/import | #7 (new) |
| | context menus, delete area, undo, item details, tool right-click | #3 (new) |
| 6 Speed & navigation | zoom/pan/warm-up/caching | not article-worthy as features — one "it stays fast" paragraph in the tablet + desktop-comparison articles |
| | zoom rail, aim loupe | #12 (new, field context) |
| | hotkeys, keyboard map, quick keys | existing keyboard article |
| 7 Output | footer totals, summary, report, export PDFs, PipeTooling, email copy, page download, JSON | existing reports article + #15 edits |
| 8 Cloud & collab | autosave, backups, save status | #8 (new) |
| | sharing, checkout, view links, viewer scale | existing sharing article + #16 edits |
| | artboard, palette insights | #9 (new) |
| | admin toolkit | #18 (new) |
| 9 Platform | PWA, offline, works-without-cloud | existing offline article |
| | tablet/touch | #12 (new) |

Every catalog feature lands in at least one article; the render-performance features are
deliberately covered as supporting claims, not how-tos (there's nothing for a user to *do*).

---

## The per-article production recipe

1. **Verify in the app first.** Run the flow in the live app locally (`npx serve -l 3456`,
   `/app/`). Every claim in the draft must be something you just did. (This is where the J-snap
   class of drift is prevented.)
2. **Draft** `content/guides/<slug>.md` — front-matter per content/guides/README.md (title,
   ~150-char description, updated, order, category, icon), `##` sections, `[[icon]]` shortcodes,
   internal links to sibling guides.
3. **Screenshots**: add `SHOTS` entries to `scripts/build-screenshots.js` (extend `ICON_BTN` /
   seeding helpers as needed) → `npm run build:screenshots` → commit PNGs. Number article steps to
   match the ①②③ callouts.
4. **Build + check**: `npm run build:guides` → preview `/guides/<slug>/` locally → `npm run check`
   (link integrity, canonical/JSON-LD, sitemap freshness all gate in CI).
5. **Commit** the `.md` + generated `guides/**` + `sitemap.xml` + PNGs in one commit.

Estimated effort per article with the Phase-0 helpers in place: **1.5–3 hours** (drafting + one
screenshot session + verification), the scale-verification and comparison articles at the high end.
Full plan ≈ 5–7 working days spread across the three phases.

## Sequencing & review gates

1. Phase 0 (half day) → ship as its own PR.
2. Batch A → B → C, one PR per batch (3 articles each; screenshots batched per session).
3. Phase 2 after Tier 1 is live (the trade articles want Tier-1 articles to link into).
4. Phase 3 edits last — they touch existing published pages, so batch them into one careful PR.
5. After each phase: re-run the coverage map, and spot-check three random older articles against
   the app (drift patrol).
