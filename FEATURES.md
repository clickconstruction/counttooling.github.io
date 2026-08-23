# CountTooling — Feature List

Every user-facing feature in the app, with one sentence on why it's useful.
Compiled 2026-07-31 from the live app, ARCHITECTURE.md's feature catalog, and the /guides/ articles.

## Getting plans in

- **PDF upload (multi-file, up to 50 MB)** — Start the takeoff directly on the actual plan set, with no printing, converting, or importing into a desktop tool first.
- **Prepare PDF (keep/drop, reorder, rotate pages)** — Cut a 200-sheet set down to just the sheets you're bidding before you ever start counting.
- **Append pages** — Add the addendum or a late sheet to an in-progress takeoff without redoing anything.
- **Page rotation (R)** — Fix a sideways-scanned sheet so the drawing and all your marks read right-side up.
- **Page renaming + title truncation** — Call sheets what estimators call them ("P-201 Underground") so the sidebar is navigable at a glance.
- **Marked-page badges & navigation** — Yellow badges show which sheets have a scale and which have marks, and Shift+arrows jump straight between marked sheets on a big set.

## Scale & calibration

- **Per-page scale (two-point, presets, or custom)** — Calibrate each sheet its own way — click a known dimension, pick `1/4" = 1'`, or type a ratio — so every measurement is real feet, not pixels.
- **Sheet-size correction for compressed PDFs** — Detects when a PDF was rescaled from its original sheet size and corrects preset scales, so a half-size print doesn't silently cut every length in half. A corrected apply flows straight into the verify check (two clicks on a printed dimension; Esc keeps the applied scale).
- **Verify-your-scale check mode** — Measure a known dimension and see the % error before you trust a whole bid to an assumed scale.
- **Synthetic scale bar** — A dashed reference bar drawn on the sheet lets you eyeball a preset scale against a known dimension at any time.
- **Scale zones** — A detail or isometric drawn at a different scale on the same sheet measures correctly without re-scaling the page. On a compressed/rescaled sheet, zone presets carry the same sheet-size correction as the page, so detail and plan agree.
- **Multiply zones** — Count one typical floor, wrap it in a ×10 zone, and the totals reflect all ten — no duplicate clicking.

## Counting

- **Counters (custom name, color, icon)** — One click per fixture with a symbol that reads on a busy sheet, tallied live as you go.
- **Custom SVG icon upload + bundled trade icon library** — Your counters can look like the actual fixture (P-trap, floor drain, 45-elbow), so the marked-up plan stays legible to anyone.
- **Groups** — Subtotal related items (one restroom group, one riser) so a dense sheet stays organized and auditable. Per-project and out of the way: the Groups section only appears when a project uses groups (or opts in via Project Settings), so the sidebar stays clean for everyone else.
- **Counter settings (size, opacity, rings, numbers, outline)** — Marks stay legible at any zoom level and print scale.
- **Quick Count / Quick Plumbing / Quick Line creators** — Build a properly-named palette item ("2\" PVC Waste") from Size/Type/Material pickers in two clicks instead of typing.
- **Show only counters / line types used (this page or this project)** — Filter the sidebar palettes to what's actually placed — on the sheet you're counting or anywhere in the bid — with an "N hidden by filter" note so nothing looks lost.
- **Child counts** — Attach "2 × connector per run" to a conduit type or "2 × ground screw per count" to a box, and the fittings tally themselves into the summary and every export — including per-N-ft rules for straps and supports.

## Measuring

- **Quick lines & polylines** — Trace straight runs and bending runs alike and get the real-world length off the page scale instantly.
- **Chain tool (T)** — One click per fixture: each click drops a counter and draws the connecting run back to the last one automatically — a 10-head sprinkler branch is 10 clicks, not 28.
- **Arc line types** — Curved runs measure along the sweep, not the chord, so long-radius work isn't undercounted.
- **Line drops** — Add vertical rise/fall at either end of a run so risers and stacks are in the footage, not forgotten.
- **Measure tool (D)** — A two-click distance check without adding anything to the takeoff.
- **Snap to 45° angles (J)** — Lines lock to horizontal, vertical, and 45° — the angles real pipe and conduit actually run — so the takeoff looks as clean as the drawing.
- **Grid overlay with snapping** — Lines follow a regular module for tidy, aligned tracing.
- **Room Sizer (V)** — Draw room boxes with ceiling heights and get ft² and ft³ per room — the inputs for airflow, air changes, and equipment sizing.
- **Always-feet totals** — Every tally, summary, and export sums in decimal feet regardless of the sheet's scale unit, so numbers agree across mixed plan sets.

## Annotating & viewing

- **Highlights** — Flag a region for attention without affecting any counts.
- **Notes (movable, resizable)** — Put questions and reminders right on the sheet where they matter.
- **Legend overlay** — A draggable on-canvas summary keeps live counts and lengths in view while you work — and prints with the sheet.
- **Hide marks (eye toggle)** — Peel the whole takeoff off the drawing to read the bare plan, then flip it back — purely visual, data untouched.
- **Canvas layers (multiple canvases per page)** — Keep alternates, trades, or bid options as separate overlays on the same sheet and switch with the arrow keys.
- **Show-all-canvases peek** — See every layer at once to compare, without changing what you're editing — or right-click the peek button to show just the current layer plus one or two chosen others.
- **Context menus (right-click / long-press)** — Edit or delete any mark in place instead of hunting the sidebar.
- **Right-click tool settings** — Right-click any tool button for its settings menu, so options are discoverable where the tool lives — including Set / edit scale on the Move and Measure tools, so a set scale is never buried.
- **Delete Area tool** — Rubber-band a rectangle and clear every mark inside it, with a confirming count before anything is deleted.
- **Undo/redo (50 steps)** — Rapid clicking is safe; mistakes are a keystroke away from gone.

## Speed & navigation

- **Instant zoom & pan (wheel, pinch, zoom rail)** — Big, dense sheets stay responsive — zoom commits are served from cache so the view sharpens immediately instead of re-rendering for seconds.
- **Background page warm-up** — After a document opens, every page pre-renders in idle time, so jumping deep into a 40-page set is instant instead of a cold multi-second load.
- **Offline-grade caching of rendered pages** — Sheets you visited render from a persisted cache on reopen — yesterday's project opens warm today.
- **Aim loupe (mobile)** — Press-and-hold magnifier for precise mark placement with a finger.
- **Hotkeys for every tool** — M/S/C/L/P/D/H/N/V/X/R and friends keep one hand on the keyboard and one on the mouse.
- **Keyboard Map** — A visual keyboard where every mapped key lights up — see the whole shortcut surface at a glance instead of reading a list.
- **Hold Cmd to peek hotkeys** — Hold Cmd (or Alt) for a beat and every tool button shows its hotkey badge in place — learn the shortcuts without leaving the sheet.
- **Quick Keys (number row)** — Bind your own counters and line types to 1–0, so switching what you're placing is a keystroke, not a sidebar trip; bindings ride your saved Artboard between bids.

## Output & reporting

- **Live footer totals** — A running `[counts | length]` across all pages and canvases, zones applied, always in view.
- **Summary panel + count detail** — Click any total for a per-page breakdown with thumbnails showing exactly where the items are.
- **Show Report** — A printable report scoped to this canvas, this page, or the whole project.
- **Export PDFs** — A marked-up deliverable PDF with adjustable marker/line sizes, the report, and highlights/notes bundled in — ready to send.
- **Copy to PipeTooling** — The whole takeoff as tab-delimited counts on the clipboard, with a view link back to the source plan, ready to paste into a bid. A pre-copy scale check (shared with Copy Summary) flags any page whose lines have no scale (pages without marks are ignored), and unscaled runs export as separate `px of` rows — pixel lengths are never summed into a feet total. The Copied confirmation says what went over, by unit — "29 counts (1,122 ea) · 6 line types (444.74 ft)" — the same split PipeTooling reports on import, so the two ends reconcile.
- **Copy Summary (email/text)** — A plain-text summary for dropping straight into an email. Runs the same pre-copy scale check, and unscaled runs appear as their own `px` bullets flagged "no scale set".
- **Download current page** — One sheet, marks included, as a quick PDF.
- **Canvas JSON export/import** — Move a takeoff between projects or people as a small file, PDF not required.

## Cloud & collaboration

- **Auto-save every 5 seconds + local backups** — Work is continuously saved to the cloud and to on-device backups, so a crash, a dead battery, or a bad connection costs you nothing. The "Project from Last Session" restore prompt works signed-out and fully offline — the backup lives on your device — and re-uploading the same PDF brings your marks back even when the backup lost its copy of the file.
- **Save Status bell** — Always know whether you're synced, saving, or offline — with an exportable log when something needs diagnosing.
- **Project sharing (viewer/editor roles)** — Colleagues see or edit the same takeoff without emailing files around.
- **Check-out / turn-in (one editor at a time)** — Two people can never save over each other; the lock frees itself after 30 idle minutes so a project is never stuck.
- **View links (no sign-in)** — Send a GC or inspector an email-gated link to the live takeoff — no account, access-logged, revocable anytime.
- **Viewer scale sharing** — A view-link recipient can set a page scale and it shares back to the project, so field questions get answered without a round trip.
- **Artboard (cloud palette)** — Your counters, line types, modifiers, and Quick Key layout follow your account to any device — set up once, reuse every bid; loading mid-bid re-links your placed marks by name, nothing stops counting.
- **Palette Insights** — See which counters and line types you actually use across all your projects and add the standards to your Artboard in one click.
- **Admin toolkit** — Create/manage users, transfer project ownership, force turn-in, audit per-user activity, and push a global reload — all inside the app.

## Platform

- **Installable app (PWA)** — Add to home screen for a one-tap, full-screen app on phone, tablet, or desktop.
- **Full offline mode** — Once a takeoff is loaded, counting, measuring, and marking all work with no signal — built for basements and mechanical rooms — and sync when you're back.
- **Touch-first tablet support** — Pan, pinch, long-press, and the aim loupe make field markup on a tablet feel natural.
- **Works without the cloud** — With no account at all, the app is still a fully functional local takeoff tool.
