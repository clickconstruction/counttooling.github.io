# Landing page refresh — three trades on the front door (2026-09-16)

> Plan of record for the (closed) punch row **LANDING-REFRESH**. Status: **BUILT 2026-09-16
> on `claude/landing-refresh`, direction A as mocked; see "Built" at the foot.** Robert's ask (2026-09-16): "now that we have HVAC and
> Electrical I think we could give it a refresh." The mockup is the deliverable of that
> session; this file is what the next session needs to build it without the conversation.

## The mockup

**Canvas:** https://claude.ai/artifact/AgiJcDJ1dmjfF9qvWRwPJ4 (Claude Design canvas, owned by
Robert's account; a Claude session reads it with the Artifact tool, `action: "read"`, and can
pull the artboards back out as HTML with the design skill's `--extract`). Four frames:

| Frame | What it is |
|---|---|
| **Direction A: Trade-led (desktop)** | The proposed page at 1440 px, built on today's marketing system exactly (the `marketing.css` tokens, DM Sans + Instrument Serif, the yellow gradient button, 12 px card radius). Every claim on it is shipped behavior. |
| **Direction A at phone width** | The same page at 390 px; the grids collapse, the trade nav hides, the hero CTA stacks. |
| **Direction B: Proof first (sketch)** | Low-fi: lead with "the number you can defend" (scale check + rulebook + derived fittings), trades second. Tradeoff: a plumber has to scroll to find their trade. |
| **Direction C: Field first (sketch)** | Low-fi: the tablet-in-the-field story as the hero. Tradeoff: sells the delivery model, not the takeoff. |

## What Direction A changes against today's `index.html`

1. **Hero.** Three trade chips above the headline; headline "Plumbing, electrical, and HVAC
   takeoffs, right on the plan."; sub-copy "Count fixtures and devices, measure pipe, conduit,
   and duct, and hand a bid-ready takeoff to your pricing app. Nothing to install, works
   offline, on a tablet in the field." Same two CTAs, same phone line, same hero screenshot.
2. **Header nav** gains Plumbing / Electrical / HVAC (to the three trade guides) before
   Guides and Rules. Hidden at phone width.
3. **New section "Built for the way each trade reads a plan"**: one card per trade, four
   check-lines each, a "Five-minute walkthrough" link (`/app/?tour=plumbing|electrical|hvac`)
   and a Guide link. Copy is in the artboard; it names only shipped things (91 bundled
   symbols, drops, rulebook hangers, PipeTooling; mount heights, chain, derived conductors,
   NEC fill and voltage drop, TakeoffTooling; room boxes to CFM, duct with size steps,
   self-counting fittings, SMACNA gauge, one Bid weight, CFM on diffusers).
4. **New section "Every figure shows its work"** (eyebrow "Numbers you can defend"): the
   `guides/img/scale-check.png` screenshot with the verify-scale story, beside a **mocked**
   Bid Check panel with three § chips and the rulebook paragraph ("thirteen public trade
   rules", link `/rules/`). The panel's values are invented; see decision 2.
5. **"Everything the takeoff needs"** keeps six cards but rewrites them: Count anything ·
   Measure runs · Big sets and repeats · Mark up and annotate · Report and export · Share
   and audit. No icons (the old card icons go).
6. **Browser-not-desktop** becomes one band with the four promises as a 4-up grid; the
   PipeTooling / TakeoffTooling hand-off lives in its fourth cell (no separate section).
7. **Testimonials** unchanged in words; each cite gains a trade tag (Electrical ×2,
   Plumbing ×2). The one em dash in Bryan's quote becomes a period.
8. **FAQ**: "What trades is it for?" first and open; answer rewritten for the three trades;
   the export answer names TakeoffTooling for electrical. The rest closed by default.
9. CTA band and footer as today; footer gains a Rules link.

Cut on the second pass (do not add back): a separate hand-off section and a stats row.

## Decisions before building (Will's or Robert's)

1. **Headline.** "Plumbing, electrical, and HVAC takeoffs, right on the plan." vs keeping
   today's "Markup plans, generate takeoffs, right in your browser." under the trade chips.
   `[decision]` the new headline, as mocked (2026-09-16, the "build it" call).
2. **The Bid Check panel** in "numbers you can defend": replace the mock with a real
   screenshot (needs an electrical project with a voltage-drop row, a fill row and a
   hanger row; `scripts/build-screenshots.js` can stage one) or keep it as drawn.
   `[decision]` kept as drawn (an HTML/CSS panel, values illustrative, `aria-label` says so).
   A real screenshot stays a follow-up if anyone wants it.
3. **Direction.** A as mocked, or build out B or C instead. `[decision]` A (2026-09-16).

## Build notes (one unit, one branch `claude/landing-refresh`)

- Files: `index.html` (markup, the FAQ `FAQPage` JSON-LD must match the visible FAQ, the
  `<title>` / `og:` / `twitter:` / `description` metas should say the three trades),
  `marketing.css` (new classes: trade tags, eyebrow, chip, the 3-up / 4-up grids, FAQ
  summary marker; keep `:root` untouched, `check-brand-tokens` mirrors it),
  `guides/img/scale-check.png` is already generated and precached? No: `img/` and
  `guides/img/` are NOT in the service worker (the landing is outside SW scope), so no
  `build:sw` for images; `index.html` is not precached either.
- **seo.spec.js pins** (keep green): canonical `/`, one `WebApplication` JSON-LD first, a
  loaded `img.hero-shot`, a visible `tel:` link, ≥3 `.quote`, >3 `.faq details`, the FAQ
  JSON-LD, no `robots` meta. Keep the class names `hero-shot`, `quote`, `faq`.
- `og-image.png` (`npm run build:og-image`) may deserve the three-trade line too; manual,
  not in `npm run check`.
- Gates: `npm run check`, `seo.spec.js`, `guides.spec.js` (nav parity with the guides
  chrome in `scripts/lib/site.js`: if the header gains trade links here, decide whether
  `/guides/` and `/rules/` headers follow), a look at 390 px and 1440 px.
- Copy rule: no em dashes in user-facing text (AGENTS.md).

## Built (2026-09-16, `claude/landing-refresh`)

Direction A as mocked, with two copy changes asked for at review: the hero sub-copy ends
"even on a tablet or phone in the field." (was "on a tablet in the field."), and the
"numbers you can defend" lede breaks after "ruins a bid." on wide screens (a `br.br-wide`,
shown from 900 px; the same device carries the hero headline's break). Files: `index.html`
(the whole page, metas and both JSON-LD blocks say the three trades, the FAQ JSON-LD
matches the visible FAQ, the hero image is no longer `loading="lazy"` since it is the
page's largest paint and the SEO spec reads it at network idle) and `marketing.css` (one
"Landing: the three-trade refresh" block plus the responsive rules; `:root` untouched).

Walked at 1440, 1024, 768, 600, 390 and 320 px. Tablet (700 to 899 px) keeps the three
trade cards in one row with tighter padding rather than leaving a 2 + 1 orphan; the proof
pair and the four-up band stack there. Testimonials sit two-by-two from 760 px up. Gates:
`npm run check` (11/11), `seo.spec.js` and `guides.spec.js` green.

Left as they were, on purpose: the `/guides/` and `/rules/` header chrome (the trade links
are on the landing only; whether the shared chrome follows is the sticky note's open
question for Will), and `og-image.png` (manual regeneration, not in `npm run check`).

### The hero video (2026-09-16, same branch)

Robert's ask after the build: "a gif showing someone using the software and drawing
lines", plumbing, electrical and HVAC one after the other. Shipped as a muted looping
`<video>` over the poster still (a 24 s GIF at hero size would be 10 to 20 MB; the MP4 is
about 1 MB; one H.264 source, a VP9 WebM hit a Chromium decode error and was dropped), 24 seconds, framed tight on the rooms being worked, captions in frame, and the
hero's trade chips light up with the act in progress. `scripts/build-hero-video.js` makes
it from the real app on the sample plan with the three tours' own click targets: plumbing
(three water closets, the lav battery chained on 1in PEX, the 3 ft riser), electrical
(three receptacles chained on 3/4" EMT with their drops, the conductors row), HVAC (box
OPEN OFFICE 105, trace the 24×12 main stepping to 16×10, four diffusers that attach and
flip the room tag from ⚠ to ✓). Each trade draws on its own layer. Reduced-motion readers
keep the still; the still is also the last frame, so it shows all three trades.
`build:screenshots` no longer writes `img/landing-hero.png`.

### The per-trade films (2026-09-17, in progress)

Review of the three-trade take: no arc, marks too small (the default counter size draws an
11 px dot at hero size), the chain palette covering the tallies. Decision: three films, one
per trade, sharing one spine ("Done by nine": the set lands, the work flows, the fear of
missing something is answered, the hand-off), the hero's trade chips becoming the selector.
Scripts agreed in the session (plumbing "Kitchen, Tuesday" on P-101; electrical "Circuit 7"
and HVAC "Pounds, not feet" on A-101), each opening on a thirty-sheet set trimmed in Prepare
PDF, Quick Keys in the count, a hide-marks blink in the pull-back.

**Plumbing, first cut, shipped as `img/hero-plumbing.{mp4,png}`** (`npm run build:hero-video`,
33 s, 3.2 MB): Prepare PDF (name, Keep none, three plumbing sheets), the scale proved on the
31'-8" string in the app's own check dialog, the count with the number row (ten floor drains,
three hand sinks, two water closets, two three-comp sinks), the 2" cold water main traced,
the 3 ft riser and the hangers row (IPC 308.5), an RFI flag at the grease interceptor, the
pull-back with marks off and on, Copy to PipeTooling. Marks run at counter size 72, ring
170 percent, outline 3, numbers 26. The thirty-sheet set is built in the generator from the
restaurant sheet with pdf-lib (the P-101 copy left unstamped).

**Second cut, 2026-09-17 (punch rows HERO-PIPES and HERO-TRIM, one render pass), 29.5 s,
3.0 MB.** The film traces the sheet's own domestic water instead of one invented main: the
cold service and the cold trunk on `2in Cu` (blue), then the hot supply leg and the hot
trunk with its recirc return on `1-1/4in HW Cu` (red), captions "Cold in." and "Hot back.",
so the legend gains a second row and the hangers row appears twice (every 120 in and every
72 in, both IPC 308.5). The 3-Comp Sink counter went purple so red stays the hot water's.
Two first-cut bugs found on the way: the runs had been drawing at the 2 px default because
`bigMarks()` set a `lineWidth` key the canvas never reads (the stroke is
`lineTypeSettings.lineSize`, now 7), and the Copied confirmation had never been in frame at
all because the film's overlay hides `#toastRegion`; the copy beat now lets that one card
back in, parked at the canvas's bottom left so it never covers the legend, with its 1.5 s
self-hide disabled, and holds it 1.3 s before "Done.". The Prepare beat, the scale dialog and
the count paid for the hot beat (about 5 s of holds and moves), which is why the film is
29.5 s rather than the 27 s the trim alone would have reached. The legend at the pull-back
was already inside the sheet (it clamps itself); what had looked clipped was the first cut's
hairline runs.

**Third cut, 2026-09-17 (Robert's ask: make the lines on camera), 43.0 s, 3.8 MB.** Nothing
about the water is seeded any more. The estimator clicks "+ Add" under Line Types, the name
types itself in at twelve characters a second (`2in Cu cold`: side in the name, material and
size where the rulebook reads them), the blue swatch, Create; a `P` keycap arms Polyline with
the new type (the Create dialog arms Quick Line, so the P is honest), the cold service and the
cold trunk are traced over the sheet's own lines, `Enter` commits each; then the row's pencil
opens the details dialog, where "From the rulebook" already reads "Hanger · 1 per 10 ft ·
matches copper · horizontal · 2 in · § IPC 308.5", and one tap on Add is the row nobody typed.
The same for `1-1/4in Cu hot` in red, every 6 ft. Captions: "Cold in." · "Hangers, from the
rulebook." · "Hot back." · "Rise.". Floor Drain went teal so the palette's blue is cold water's.
Film-only chrome, no app change: the bid switcher is hidden (it would read "No bid open" for
the whole take), the sidebar is 300 px so names do not wrap, the scale reference line is off
(a device preference that had been drawing a dashed ruler at the sheet's bottom left), and the
pull-back camera (`CAM_PULL`) leaves a grey band under the sheet where the caption and the
Copied card sit, clear of the sheet's legend and title block.

**Electrical, first cut, 2026-09-17, "Circuit 7" on A-101, 49.9 s, 3.3 MB, `img/hero-electrical.{mp4,png}`
(`npm run build:hero-video -- --film electrical`).** Same spine, everything on camera. The
thirty-sheet set is built from the office sheet and Prepare keeps A-101, E-101 and E-201; the
scale is proved on the 24'-0" bay (exact since the two-pixel fix). Devices come from the Quick
tab: Electrical, Category Receptacle, Variant Duplex, Add Counter (it arrives at 18 in and the
tool is armed), five receptacles along the north and west walls; then the single-pole switch
inside the door and four 2x4 troffers. The conduit is a line type made with + Add (`3/4in EMT`,
purple), and its pencil opens the details dialog where the raceway selects go EMT and 3/4" and
"3 #12 THHN + 1 #12 G" is typed into Conductors. The circuit is a group made under Groups with
panel LP-1 and circuit 7, made BEFORE the chain so the chain lands in it. `T` opens the Chain
panel, the receptacle and the conduit are picked, three clicks along the south wall each write
their 9.5 ft drop (ceiling 10 ft, mount 18 in, make-up 1 ft), and `L` draws the home run from
the last device to LP-1. The Bid Check section is expanded and the cursor rests on the
voltage-drop and conduit-fill rows, then on the derived #12 THHN rows in the Summary. The
pull-back frames the plan rather than the whole sheet, because one room's marks would merge at
sheet scale. Open in TakeoffTooling ends it; `window.open` is stubbed so the film keeps its tab,
and the "Opened TakeoffTooling with N rows" toast is pinned for the last frame. Seeded, not on
camera: the scale preset, the trade, the 10 ft ceiling and 1 ft make-up (project settings), and
the Groups gate; the switch and troffer colours are set after the Quick tab adds them.

**HVAC, first cut, 2026-09-17, "Pounds, not feet" on A-101, 49.8 s, 3.4 MB, `img/hero-hvac.{mp4,png}`
(`npm run build:hero-video -- --film hvac`).** Same spine, on camera. Prepare keeps A-101, M-101
and M-201; the scale is proved on the 24'-0" bay. `V` arms the Room Sizer and three drags box
OPEN OFFICE 105, CONFERENCE 103 and OFFICE 101, each Room Size dialog opening with the name
already read off the plan; ceiling 9 typed once, the deck 12 typed on the first, the type set,
Apply, and each room answers with ft³ and the CFM it needs (506, 374, 283). The diffuser is
made on the Quick tab (HVAC, 12x12, Supply Diffuser, CFM 150); three in the open office leave
its tag short, the fourth turns it green. The system is a group made under Groups with tag
RTU-1 and capacity 2,000, made before the main so the main lands in it. `U` opens New Duct
Run at 24×12, Start Tracing; `S` opens the size popover twice on the way across the room and
the rectangular suggestion is tapped each time, so the main reads 24×12 → 16×8 → 12×8 with two
transitions counted; `Enter` commits. The Duct Schedule opens on its Bid weight (174 lb), Bid
Check is expanded and read honestly ("two rooms still short": three rooms boxed, one served;
"Fits the roof" computes green on its own once the deck height is known, so it is no longer a
manual tick), the pull-back frames the plan, and Copy Schedule ends it with its toast pinned.
Seeded, not on camera: the scale preset, the trade, the Groups gate. **Re-rendered
2026-09-18** after DUCT-HINT moved the suggestion sentence off the cursor into a card above the
footer; the two trace-beat captions ride the top of the canvas (`R.caption(…, 'top')`) so the
card at the bottom stays clear.

**The chips select the film, 2026-09-17.** The three chips above the headline are buttons now
(`aria-pressed` names the film selected, `.is-live` the film playing). The hero plays the
plumbing film first; with no click the three play in turn (the `ended` event selects the next,
the video no longer loops); a click pins that trade and it loops. Selecting swaps the poster,
the `<source>` and the `img.hero-shot` (with a per-trade alt) in place and reloads the video,
which starts again if it was playing, the click was the user's, or the hero is in view.
Reduced-motion readers keep the stills, which the chips still switch. `window.__heroFilm()`
reports the selection for the spec. The three-trade take (`img/landing-hero.{mp4,png}` and the
generator's `--film trades`, its seeds and its `record()`) is retired; the act-time sync it
needed is gone with it. Punch row HERO-EHVAC closed.

## Hand-off: the per-trade films (2026-09-17)

Everything the next session needs to carry the films forward without the conversation.
Read this with "The per-trade films" above, which says what shipped and why.

### What is built and how to run it

`npm run build:hero-video` renders a film from the REAL app, frame by frame, and encodes it
with ffmpeg. Both outputs are committed.

| Command | Writes | State |
|---|---|---|
| `npm run build:hero-video` (default `--film plumbing`) | `img/hero-plumbing.{mp4,png}` | third cut, 43.0 s, 3.8 MB, on the page (default) |
| `npm run build:hero-video -- --film electrical` | `img/hero-electrical.{mp4,png}` | first cut, 49.9 s, 3.3 MB, on the page |
| `npm run build:hero-video -- --film hvac` | `img/hero-hvac.{mp4,png}` | first cut, 49.8 s, 3.4 MB, on the page |

Iterating: `HERO_FPS=4 node scripts/build-hero-video.js --frames-only --keep-frames` walks the
same timeline at 4 fps in under a minute and leaves the JPEGs in a temp dir, which it prints.
Review them as a contact sheet rather than by eye, one frame at a time:

```
ffmpeg -framerate 24 -i f_%05d.jpg -vf "select='not(mod(n,16))',scale=640:-1,tile=5x10" -frames:v 1 sheet.jpg
```

Needs ffmpeg on the machine and both sample plans (`npm run build:sample-plan`,
`npm run build:sample-plan-advanced`). Manual, like `build:screenshots`, so it is not in
`npm run check`; pixels are not deterministic across machines.

### Reading the generator

[scripts/build-hero-video.js](../../scripts/build-hero-video.js), top to bottom:

- **`Recorder`** is the whole vocabulary: `hold(s)`, `moveTo(x, y, s)`, `moveToPt(pdfPoint, s)`,
  `moveToEl(selector, s)`, `click()`, `key(label)` (a real key press plus a drawn keycap),
  `camera(rect, s)` and `setCamera(rect)`, `caption(trade, text)`. Every one of them advances
  frames, so the timeline is just the order you call them in. Nothing is faked on the frames
  except the cursor, the keycap and the caption strip.
- **`B(x, y)`** converts the restaurant plan's own drawing coordinates to PDF points:
  `60 + 0.75x, 70 + 0.75y`. That means any coordinate in `candidateBPlan()` in
  [scripts/sample-plan-candidates.js](../../scripts/sample-plan-candidates.js) can be pasted
  straight into the film. The office sheet (candidate A) uses the same transform.
- **Page-side helpers** (`seedRestaurant`, `bigMarks`, `armPolyline`, `applyDropAt`, …) are
  plain functions handed to `page.evaluate`, so they take exactly one argument; pass an array
  when you need two. They may not close over anything defined in Node.
- **`bigMarks()`** owns the mark sizes. **`SET_SHEETS` / `SET_KEEP` / `buildSampleSet()`** build
  the thirty-sheet PDF with pdf-lib from the restaurant sheet, stamping every copy but P-101.
- The trades film prints its three act start times on finish; `index.html` hardcodes them for
  the chip sync, so re-paste after a re-render.

### Next: trace the sheet's own hot and cold water

> **DONE 2026-09-17** (second cut, above). The table and notes stay as the record of the
> coordinates and the reasoning; `COLD_SERVICE`, `COLD_TRUNK`, `HOT_SUPPLY` and
> `HOT_RETURN` in the generator are these four rows.

Robert's ask, 2026-09-17: the plumbing film should trace over the piping the sheet already
draws, hot and cold both, instead of the one invented cold main it traces now.

The sheet draws three families in `candidateBPlan()`, with their sizes in the `pipeLabel`s
beside them. In plan coordinates (wrap each in `B(...)`):

| Run | Points | The plan calls it |
|---|---|---|
| Cold, service to the bar | `[883,614] [883,594] [192,594] [192,580]` | 2" CW at the meter, 1" CW at the bar |
| Cold, the trunk and the top wall | `[564,594] [564,110] [930,110] [930,384]` | 1-1/2" CW up, 3/4" CW across |
| Hot, water heater onto the south run | `[796,572] [786,572] [786,590] [188,590] [188,580]` | the loop's supply leg |
| Hot, trunk, top wall, recirc return | `[570,590] [570,105] [936,105] [936,572] [918,572]` | 1-1/4" HW up, 3/4" HW down |
| Gas | `[840,632] [840,346] [700,346]` and `[840,582] [822,582]` | 1-1/4" G, 1-1/2" G, 3/4" G |

Today's `CW_TRUNK` is a blend of the two cold runs. Replace it with two traced runs.

Notes for whoever builds it:

- **Line types cannot be dashed.** A line type is `{ id, name, color, curveStyle }` and
  `curveStyle` is only `straight` or `arc`; the `setLineDash` calls in
  [canvas-draw.js](../../canvas-draw.js) belong to leaders, ghosts and the grid. So hot and
  cold have to read by COLOR, not by the sheet's solid-versus-dashed convention. Cold
  `#2e86de` and hot `#e85447` read well on the plan and in the legend.
- **Name the types so the rulebook answers.** `2in Cu` returns a hanger every 120 in and
  `1-1/4in HW Cu` every 72 in, both from `plumb.hanger.copper` (verify with
  `node -e "console.log(require('./support-model.js').hangerSuggestionsFor('1-1/4in HW Cu'))"`).
  Two runs with two different hanger spacings is a stronger "rows nobody typed" beat than one.
- **The camera already fits it.** `CAM_PLAN` is `{145, 118, 860, 575}` in PDF points; the hot
  loop's far corner `B(936, 105)` lands at `(762, 149)` and its near end `B(188, 580)` at
  `(201, 505)`, so the whole loop is in frame with no camera change.
- **Suggested shape of the beat**: trace cold as now, then switch the active line type and
  trace the hot loop back the other way, so the viewer watches two runs, two footages and the
  legend gaining a second row. Budget about 4 s, which the trim below pays for.
- Arming a polyline is already in the film: `armPolyline(lineTypeId)` sets the tool and the
  draft, clicks commit vertices, `Enter` finishes.

### The rest of the queue

1. ~~Trim the plumbing film to about 27 s.~~ Done 2026-09-17: 29.5 s with the hot beat
   added. Note that `keyboard.type` delays and `waitForTimeout` cost no film time; only
   `hold`, `moveTo`, `click` (two frames) and `camera` advance frames.
2. ~~Hold the finish.~~ Done 2026-09-17; the overlay had been hiding the card outright (gotcha
   below).
3. ~~Keep the legend in frame.~~ Not a legend problem; the hairline runs were (gotcha below).
4. **The electrical and HVAC films**, scripts below, then the hero chip switching that swaps
   the film in place, then retire the three-trade take.
5. **Optional**: a fifteen-second feature montage for the "Everything the takeoff needs"
   section, one second per feature, no story. Same generator.

### The remaining scripts

Both on the office sheet A-101, same spine as plumbing: the set lands and Prepare keeps three,
the scale is proved in passing, the count quickens with the number row, the trade's own math
appears as a consequence, the pull-back blinks the layer, then the hand-off and "Done."

**Electrical, "Circuit 7"** (about 26 s) — **BUILT 2026-09-17, 49.9 s, see above**: receptacles along the office walls at 18 in mount
height, then switches and lights on keycaps 2 and 3; chain 3/4" EMT device to device, each
click writing its 9.5 ft drop, the last leg home to LP-1; the run becomes circuit LP-1/7 and
the wire row slides in by itself, 3 #12 THHN, 128 ft, tagged derived; Bid Check computes
voltage drop 2.4 percent and conduit fill 31 percent, each wearing its NEC section; pull back,
layer off and on; Open in TakeoffTooling.

**HVAC, "Pounds, not feet"** (about 26 s) — **BUILT 2026-09-17, 49.8 s, see above**: room boxes over the open office, conference and two
offices, each reading its name off the plan and answering with ft², ft³ and the CFM it needs;
diffusers at 150 CFM, three leaving the tag amber at 450 of 508 and the fourth turning it
green; RTU-1 at 2,000 CFM, the main tracing out at 24×12 with the chip showing the air still
to serve, S stepping it to 16×10 then 12×8, elbows and taps appearing on their own; the Duct
Schedule reading 26 gauge and one bid weight, Bid Check "Fits the roof" green; pull back,
layer off and on; copy the schedule.

### Gotchas worth not rediscovering

- **The size popover offers round and rectangular.** `.duct-suggest-chip` rows carry both
  (12"Ø and 16×8 for the same air); a rectangular main stays rectangular, so pick the chip whose
  text has the ×. Bid Check's manual "Fits the roof" upgrades itself to an auto row once the deck
  height is known, so there is no `.bid-check-box` to tick; hover the row instead. Auto rows carry
  `data-row-id`; manual boxes carry `data-id`.
- **Two toast timers.** Copy to PipeTooling hides its card through `App.hideModal` (wrap it);
  `showToast` (Open in TakeoffTooling, "Counts copied…") hides through app.js's own closure
  function, which no wrapper reaches, so pin that card with a MutationObserver that puts
  `.visible` back. Both cards live in `#toastRegion`, which the overlay hides with
  `!important`; an override must be `!important` too and later in the document.
- **Selects and collapsed sections.** `page.selectOption` on the Quick tab's Category / Variant
  and the details dialog's raceway selects fires the app's change handlers (the cursor can
  still be moved to the select first). The Groups section opens collapsed and hides its
  `+ Add` until the title is clicked; the film clicks the title.
- **Driving the real dialogs.** Create Line Type: `#addLineType` → `#lineTypeName` →
  `#lineTypeColorRow .color-swatch[data-color="#4a9eff"]` (lower-case hex, the COLORS
  palette) → `#lineTypeCreate`. After Create the app arms Quick Line and the new type is
  active, so `p` arms Polyline with no dialog (the New Polyline dialog only opens with no
  active type); hotkeys are lower-case and the guard ignores keys typed into an input, so
  blur the dialog's input first. `Enter` commits a draft of two or more points and drops the
  tool, so each run starts with its own P. The hanger suggestion lives in the details dialog
  (`.sidebar-item-line-type[data-line-type-id] .edit-btn` → `#childCountsSuggest
  .child-count-suggest-add` → `#counterLineTypeDetailsClose`), not in Create.
- **Visible typing** is `Recorder.type(text, cps)`: one character per FPS/cps frames.
  `keyboard.type`'s own delay costs no film time.
- **Stroke size.** The line stroke the canvas reads is `lineTypeSettings.lineSize` (default 2,
  constant screen weight). `lineWidth` on that object is nothing; the first cut set it and
  the runs drew as hairlines. The film runs 7.
- **The overlay hides every toast.** `OVERLAY_SRC` injects
  `#toastRegion, #airboardToastModal { display: none !important }` so stray toasts never
  land in a frame. A beat that WANTS a toast card (the Copied confirmation) has to let it
  back in with its own style rule, and park its self-hide (`App.hideModal` wrapper), because
  a 24 fps hold outlasts the 1.5 s wall-clock timer many times over.
- **The 4 fps preview overstates length.** A click is two frames at any rate, so fifty clicks
  cost 25 s at 4 fps and 4 s at 24 fps; read the 24 fps frame count for the real duration.
- **Mark size.** `counterSettings.size` defaults to 22, which draws an 11 px dot at hero size,
  which is why the first videos looked empty. The film runs 72. `ringSize` is a PERCENT of the
  mark (170), not pixels; setting it to 3 draws a 3 percent ring, which looks like nothing.
- **One video source.** A VP9 WebM hit a Chromium decode error, so the page ships one H.264
  MP4. The JPEG frames are full range, so the encode converts with
  `scale=...:in_range=pc:out_range=tv` and `-color_range tv`; without that the video decodes
  to garbage in some players.
- **The desktop app's browser pane often reports `document.hidden`**, and then
  requestAnimationFrame never fires, IntersectionObserver never delivers and a muted video
  never autoplays. Anything scroll- or visibility-driven has to be verified with a short
  headless Playwright script instead (`NODE_PATH=$PWD/node_modules node script.js` from the
  worktree). The pane also caches `marketing.css` and images hard; refetch with
  `fetch(url, {cache: "reload"})` before judging a change.
- **Running specs from a `.claude/worktrees/` copy** needs
  `npx playwright test --config playwright.worktree.config.js`, because the base config ignores
  `**/.claude/**`. A fresh worktree also needs an `echo "// stub" > config.local.js`.
- The Copy to PipeTooling beat needs a Playwright context with clipboard permissions, and the
  trades film warms the page text layer before recording so the plan-named room tag appears on
  its first frame.
