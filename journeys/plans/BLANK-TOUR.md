# The blank-sheet tour: every button, once (the fourth tour)

> Plan of record, written 2026-09-21 after a docs pass and an audit of what the three
> trade tours, the thirteen lessons and the three courses actually press. The owner's
> ask: "see how well each tutorial teaches the user how to use all the various parts of
> the app," then "add a 4th tutorial, one that operates on a blank piece of paper and
> shows the user how to use all of the buttons available to them." Built the same day.

## The audit: what each teaching surface presses

The table is generated from the code, not from memory: a ✓ means a step in that surface
lists the control (by id) in its `target` ladder or presses it in its action, so the step
lights it and its check reads what it did. A control a step only *names* in its text is
not a ✓ (the trade tours' hand-off steps name the export buttons, for instance). Sidebar
duplicates of header buttons are folded into the header row.

| Control | id | Trade tours | Lessons | Courses | Blank-sheet tour |
|---|---|---|---|---|---|
| Upload PDF | `uploadPdf` | ✓ | ✓ |  | ✓ |
| Set Scale | `setScale` | ✓ | ✓ | ✓ | ✓ |
| Move | `moveBtn` |  |  |  | ✓ |
| Counter | `counterBtn` |  | ✓ |  | named |
| Quick Line | `quickLine` | ✓ |  | ✓ | named |
| Snap to 45° | `lineTypeSnapToHVHeaderBtn` |  | ✓ |  | ✓ |
| Chain | `chainBtn` | ✓ | ✓ | ✓ | ✓ |
| Drop | `dropBtn` | ✓ | ✓ | ✓ | ✓ |
| Measure | `measureBtn` | ✓ | ✓ | ✓ | ✓ |
| Polyline | `polylineBtn` |  | ✓ | ✓ | ✓ |
| Duct | `ductBtn` | ✓ |  | ✓ | ✓ |
| Highlight | `highlightBtn` |  | ✓ | ✓ | ✓ |
| Multiply Zone | `multiplyZoneBtn` | ✓ | ✓ | ✓ | ✓ |
| Scale Zone | `scaleZoneBtn` |  | ✓ | ✓ | ✓ |
| Room Sizer | `roomBtn` | ✓ |  | ✓ | ✓ |
| Ghost | `ghostBtn` |  |  |  | ✓ |
| Delete area | `deleteZoneBtn` |  | ✓ |  | ✓ |
| Note | `noteBtn` | ✓ | ✓ | ✓ | ✓ |
| Summary legend | `legendBtn` | ✓ |  |  | ✓ |
| Grid overlay | `gridBtn` |  |  |  | ✓ |
| More tools ⋯ | `headerMoreBtn` | ✓ | ✓ | ✓ | ✓ |
| Hide marks | `hideMarksBtn` |  | ✓ |  | ✓ |
| Drop sizes | `dropSizesBtn` |  |  |  | ✓ |
| Notes ledger | `notesLedgerBtn` |  | ✓ | ✓ | ✓ |
| Project Settings | `settingsGearBtn` | ✓ | ✓ | ✓ | ✓ |
| Save status | `saveStatusBtnHeader` |  |  |  | ✓ |
| Export project | `exportDropdownBtn` |  |  |  | ✓ |
| Close this project | `headerCloseProjectBtn` |  |  |  | ✓ |
| Share / Copy view link | `headerShareBtn`, `copyViewLinkBtn` |  |  |  | named (cloud only) |
| Download current page (phone) | `downloadCurrentPageBtn` |  |  |  | named |
| Fold the sidebar (logo, spacebar) | `headerLogo`, `headerSidebarToggle` |  |  |  | ✓ |
| Counters + Add | `addCounter` | ✓ | ✓ | ✓ | ✓ |
| Counters funnel | `counterShowOnlyOnPageInlineBtn` |  | ✓ |  | named |
| Line Types + Add | `addLineType` | ✓ |  | ✓ | ✓ |
| Line Types / Lines funnels | `lineTypeShowOnlyOnPageInlineBtn`, `linesShowOnlyOnPageBtn` |  |  |  |  |
| Groups + Add | `addGroup` | ✓ | ✓ | ✓ | ✓ |
| Show group colors | `showGroupColorsBtn` |  |  |  | named |
| Duct Schedule | `ductScheduleBtn` | ✓ |  | ✓ | named |
| Bid Check | `bidCheckSectionTitle` | ✓ | ✓ | ✓ | ✓ |
| Summary (the proof) | `summaryList` | ✓ | ✓ | ✓ | ✓ |
| Show Report | `printReport` |  | ✓ | ✓ | named |
| Export PDFs | `specificPages` |  | ✓ | ✓ | named |
| Copy to /Tooling | `forPipeTooling` | ✓ | ✓ | ✓ | named |
| Open in TakeoffTooling | `forTakeoffTooling` |  |  | ✓ |  |
| Copy Summary | `copySummaryText` |  | ✓ |  | named |
| Copy RFI Flags, Highlight Pages, Note Pages | `copyRfiFlags`, `bundleHighlights`, `bundleNotes` |  |  |  | named |
| Clear Page | `clearPageSidebar` |  |  |  | ✓ |
| ‹ › sheets | `prevPage`, `nextPage` |  |  |  | ✓ |
| ‹‹ ›› marked sheets | `prevMarkedPage`, `nextMarkedPage` |  | ✓ (‹‹) |  | named |
| Add canvas (a layer) | `addCanvasBtn` |  | ✓ | ✓ | ✓ |
| Show all canvases | `showAllCanvasesBtn` |  |  |  | named |
| Zoom + / − / Fit | `zoomIn`, `zoomOut`, `zoomFit` |  |  |  | ✓ (+, Fit) |
| Zoom percentage (the rail) | `zoomPct` |  | ✓ |  | named |
| Rotate | `rotatePage` |  | ✓ | ✓ | ✓ |
| Undo / Redo | `undoBtn`, `redoBtn` |  | ✓ (Undo) |  | ✓ |
| quick keys | `statusBarQuickKeys` |  | ✓ | ✓ | ✓ |
| shortcuts (the keyboard map) | `statusBarMacros` |  | ✓ |  | named |

What the audit says about the three surfaces that existed:

- **The trade tours** press what their loop needs and nothing else. That is right for a
  front door, and it means twelve header and footer controls (Move, Ghost, Grid, Hide
  marks, Drop sizes, Save status, Export, Close project, the sidebar fold, the sheet
  arrows, zoom, Undo) were never pressed by any tour.
- **The lessons** are the broadest surface: 27 of the controls above, and the only one
  that presses the funnel, the marked-page jump, the keyboard map and the zoom rail.
- **The courses** teach the trade, and reach the app through the same handful of tools the
  lessons do; they add nothing to coverage and are not meant to.
- **Never pressed by any step before this tour**: Move, Ghost, Grid overlay, Drop sizes,
  Save status, Export project, Close this project, the sidebar fold, ‹ ›, + / Fit, Redo,
  Clear Page. All twelve are pressed by the blank-sheet tour.
- **Still only named, never pressed**: Share and Copy view link (they exist only on a cloud
  project, which no tour runs on: LEARN-PLAN decision 3), Download current page (a phone's
  button), the two line funnels, Show group colors, Show all canvases, the − zoom, ›› and
  the four small export buttons. Each is named in the step that shows its neighbour.

## Decisions (2026-09-21)

1. **One tour, 36 steps, not a set of lessons.** LEARN-PLAN decided "short lessons, not one
   long tutorial" for learning the app by doing a takeoff; this is a different thing, a
   walk along the toolbar, and the owner asked for one tutorial. Every step is one button
   and the smallest honest thing it does, so the whole walk is about fifteen minutes; Skip
   is on every step, and the titles carry the region (Header, Footer, Sidebar) so a reader
   who leaves knows where they were.
2. **The sheet is made in the browser**, not shipped. Two ANSI B pages from the vendored
   pdf-lib: a border, a bottom-right title block that says 1/8" = 1'-0", and on SK-1 one
   20'-0" dimension so the scale can be proved. A blank sheet with nothing to measure
   would teach Set Scale without Measure; one line is the least that keeps both honest. It
   goes through `#pdfInput` like a dropped file, so the intake, the sheet-size analysis
   and the local backup all run for real.
3. **No trade is stamped.** The tour speaks in trade-neutral words (Fixture, Pipe, Area A)
   and reaches every tool through the ladder, so a plumbing device finds Duct behind the
   ⋯ and an HVAC device finds Polyline there, exactly as it would on a real bid.
4. **Toggles are pressed and pressed back.** A step for Hide marks, Grid, the legend, the
   sidebar fold or Save status is done only once the reader has seen both states, held in
   a latch; a step for a dialog is done once it has been open (`hold`, so the reader reads
   it and leaves with Next). Snap to 45° is a device setting and goes back on stop.
5. **The palette baseline is taken when the sheet opens.** An Artboard's counters ride into
   every new project, so "make a counter" means one that was not there at open, never
   "counters exist".

## The route

| # | id | Region | The reader does | check() |
|---|---|---|---|---|
| 1 | welcome | | opens the blank sheet (hands off) | two pages of `blank-sheet`, settled |
| 2 | scale | Header | Set Scale → presets → 1/8" | ppu 9 on SK-1 |
| 3 | measure | Header | Measure the 20'-0" line, in circles | 20 ± 0.6 ft |
| 4 | move | Header | Move, drag the sheet | tool NONE and pan or zoom changed |
| 5 | counter | Sidebar | + Add → Create → Fixture | a counter not in the baseline |
| 6 | count | Sheet | three circles | markZones |
| 7 | quickkeys | Footer | bind 1, press 1, click the circle | binding + the mark |
| 8 | linetype | Sidebar/Header | + Add → Create → Pipe, draw a line circle to circle | pathZones on quickLines |
| 9 | snap | Header | Snap to 45° on | the device flag |
| 10 | polyline | Header | three corners, Enter | pathZones on polylines |
| 11 | chain | Header | two circles | marks + a run between them |
| 12 | drop | Header | 3 ft on the run end, then Drop sizes | dropAt + showDropSizes |
| 13 | duct | Header | Start Tracing, two circles, Enter | pathZones on ductRuns |
| 14 | highlight | Header | a box over the three marks | boxZone |
| 15 | multiply | Header | ×2 around the chained pair | boxZone, multiplier > 1 |
| 16 | scalezone | Header | a box at 1/4" | boxZone, ppu 18 |
| 17 | room | Header | a box named Office | boxZone + a room |
| 18 | ghost | Header | box the three marks, drop the copy in the circle | a ghost |
| 19 | deletearea | Header | box the quick-key mark, confirm | no mark there |
| 20 | note | Header | a note in the circle, then the ledger | note + ledger seen |
| 21 | toggles | Header | legend off/on, grid (Apply) on/off, hide marks on/off | three latches |
| 22 | undo | Footer | Undo, Redo | Redo lit then dark |
| 23 | layers | Footer | Add canvas → Alternate 1, back to Main | 2 canvases, Main active |
| 24 | pages | Footer | › to SK-2, Rotate, ‹ back | page 2 seen, a rotation, back on SK-1 |
| 25 | zoom | Footer | +, then Fit | zoomed in, then at fit |
| 26 | sidebar | Header | logo (or spacebar) twice | collapsed seen, open |
| 27 | groups | Sidebar | Use groups on, + Add → Area A | a group not in the baseline |
| 28 | summary | Sidebar | the counter's total → proof | the breakdown open (hold) |
| 29 | bidcheck | Sidebar | expand | collapsed false |
| 30 | settings | Header | the gear | seen (hold) |
| 31 | savestatus | Header | the bell | seen (hold) |
| 32 | exportmenu | Header | the download arrow | menu seen |
| 33 | exports | Sidebar | read: the seven export buttons, Share on a cloud project | read |
| 34 | clearpage | Sidebar | Clear Page, confirm | active layer at 0 marks |
| 35 | close | Header | Close this project, confirm | no pages |
| 36 | done | | read | read |

Every doing step's `action.run` is the engine's spec seam (`App.tutorialDoStep`), and
tutorial.spec.js walks all 36 that way, asserting the real state after each.

## Engine changes that came with it (features/tutorial.js)

- `?tour=<id>` is resolved when the link fires, against every registered tour, so a tour
  another file registers is reachable; `?tour=1` still means electrical.
- A registered tour may carry `onStart()` (the blank tour resets its latches and reads the
  snap setting there) beside the `onStop(finished)` the lessons already had.
- The card's step number stays on one line and the dots squeeze on a long tour (36 dots
  used to wrap the "1 / 36" onto three lines).

## Open (not blocking)

- ⚑ The Learn menu screenshot in the guide (`guides/img/learn-menu.png`) shows three tour
  buttons; it needs a `build:screenshots` run to show four.
- ⚑ On a phone the header is a drawer and several of these buttons live behind ☰; the tour
  is written desktop-first like the lessons (LEARN-PLAN decision 4) and only its wording
  adapts.
