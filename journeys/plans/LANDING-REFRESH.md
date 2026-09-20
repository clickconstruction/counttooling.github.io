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

**Electrical, second cut, 2026-09-19, 52.6 s (punch row FILM-HOMERUN, closed).** The first cut
drew the home run but never flagged it, so at 0:42 the caption said "The checks, computed."
over a voltage-drop row reading "Needs a circuit with a panel mark or a homerun". Beat 8b now
does what an estimator does: a right-click on the home run, Line Properties, the Homerun
toggle, Done (the recorder gained `rightClick()`; the caption strip is cleared while the dialog
is up, because it sat on the Done button). The run draws its arrow into LP-1 and the row reads
"LP-1/7 · 57 ft · 12 A · #12 2.3% ✓ (at 120 V)". The film is 2.7 s longer, which the hero
chapters' "Fifty seconds" answer has to follow (see "Still open" there).

**Both films, "complete the room", 2026-09-20 (Will: the bids should be more realistic).**
Electrical third cut, 76.1 s; HVAC second cut, 65.8 s. The descriptions around this note are
the earlier cuts, kept for the record; CHANGELOG "the electrical and HVAC films finish the room"
is the account of what each film does now and why (three circuits because one fails the app's
voltage drop; the trunk from the unit with typed step-downs because the mid-trunk suggestion
reads the whole system). Two things for whoever touches them next: (1) each script ends with a
GUARD that throws if the app's own Bid Check warns, so iterate with `--chapters-only` (about a
minute, prints the verdicts, the popover's chips and an audit) before spending a render; (2)
geometry lives in the constants above each script (`C7_RECEPTS`, `HOME_*`, `TRUNK_H`,
`BRANCH_*`, `DIFF_*`), in plan pixels through `B()`.

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
reports the selection for the spec. **Moved 2026-09-18 (Robert, from the live page): the chips
sit directly above the film they select, below the CTAs and the phone line, not above the
headline** (44 px above the media, 16 px gap). The three-trade take (`img/landing-hero.{mp4,png}` and the
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

## The landing for a shop owner (2026-09-18)

Robert's situation: an owner of a large HVAC shop in Houston and Dallas will land on the page,
and the page has to earn a question. Built in one pass (branch `claude/landing-hvac-owner`):

1. **`/?trade=hvac`** (or plumbing, electrical) lands on that film, pinned, so the first frame is
   their trade. Unknown values fall back to plumbing, unpinned. The link to send is
   `counttooling.com/?trade=hvac`.
2. **The proof panel follows the chip.** `html[data-hero-trade]` is set by the hero script; the
   Bid Check mock has three row sets (`.bidcheck-rows[data-trade]`), plumbing showing before the
   script runs. HVAC's rows are the ones the app really computes: every room served, systems
   within capacity, the bid weight with its gauge citation. Values illustrative, as before.
3. **"For the shop, not the seat"**, a section before the testimonials: the All Bids board from
   the Overseer guide (its generated screenshot, lazy-loaded), the read-only-enforced-on-the-server
   claim, and four rules a shop runs on (one editor at a time, email-gated view links, the access
   log, the tablet that syncs). Every claim is shipped behaviour with a guide behind it.
4. **The HVAC card** names both modes (plan-and-spec reads the sheet's callouts; design-build
   sizes from the rooms' CFM) and says exactly what the gauge is: a simplified SMACNA schedule,
   cited by rule (`content/rules/hvac/duct-gauge.md` calls itself that), not "SMACNA-style".
5. **Austin, Texas** in the footer.

Not done on purpose: no HVAC testimonial (none is real yet; a fabricated one loses a
professional), no partner or pricing language. Pinned by `landing-trade.spec.js` (local + CI).

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

## The trade spotlight (plan of record, 2026-09-18)

> Punch row **SPOTLIGHT** (closed 2026-09-18). Robert's ask: a part of the page under the video
> that changes with the trade chips and shows, in pictures, the specific tools that trade gets.
> Status: **built, all four rungs, 2026-09-18** (see the ladder). Decisions marked ⚑ were built
> with the recommended default and remain Robert's to change.

### What it is

A section directly under the hero, before "Built for the way each trade reads a plan", that
follows the same switch the film and the proof panel already follow (`html[data-hero-trade]`,
set by the hero script; `/?trade=<trade>` pins it). For the selected trade it shows **six
frames of the real app**, one per surface that trade lives in, each with a one-line caption in
the trade's own words. The pictures are the app, not photographs: they are generated by
`scripts/build-screenshots.js` from the sample sheets, so they cannot drift from the product,
and every one shows a surface that ships today.

The three trade cards below it stay as they are (they are what a visitor who never clicks
reads, and the page's text for search). The film narrates; the spotlight is the evidence you
scroll to after. Captions are quiet, one line, no numbered callouts on the frames.

### The frames, per trade

Each set is six frames on the sheet its film uses. The plumbing set on the restaurant sheet
(`samples/sample-plan-advanced.pdf`); electrical and HVAC on the office sheet
(`samples/sample-plan.pdf`). Existing guide shots that already show the surface are named;
the rest are new setups.

**Plumbing, "surface by surface"**

| # | Frame | Surface | Setup | Caption |
|---|---|---|---|---|
| 1 | The Quick tab on the Plumbing profile | `#counterModal`, Quick, Size / Type / Material composing "1in PEX Tee" | like `quick-count` | Name a fixture in three picks; the symbol and the colour come with it. |
| 2 | The rulebook's hanger row | `#counterLineTypeDetailsModal` for `2in Cu cold`, "From the rulebook" with the Add button | new: create the type, open its pencil | Name the pipe and the hanger rule is offered, cited to IPC 308.5. |
| 3 | The riser in the footage | the run with a 3 ft drop and the Drop sizes label | like `drop-sizes-toggle`, cropped to the meter | Rise and fall at each end, so the riser is in the feet. |
| 4 | The scale, proved | `#scaleModal` reading exact on the 31'-8" string | `scale-check` re-shot on the restaurant sheet | Click both ends of a printed dimension; the check reads the error in words. |
| 5 | Bid Check for plumbing | the sidebar section with the hangers row and its § chip | new | Rows nobody typed, each wearing its citation. |
| 6 | The hand-off | Copy to PipeTooling menu open, the Copied card | new | One click to PipeTooling, with a view link back to the plan. |

**Electrical, "Circuit 7"**

| # | Frame | Surface | Setup | Caption |
|---|---|---|---|---|
| 1 | The Quick tab on the Electrical profile | Category / Variant / Rating, Mount height 18 | new (`setProjectTrade('electrical')`) | Devices arrive with their mount height; the vertical is in the run before you draw it. |
| 2 | The Chain panel and a chained run | `#chainPanel` open beside three receptacles chained with 9.5 ft drop labels | new: counters + EMT type + `App.commitChainPoint` × 3 | Chain device to device; every click writes its drop. |
| 3 | The conduit's details | `#counterLineTypeDetailsModal` with raceway EMT 3/4" and conductors 3 #12 THHN + 1 #12 G | new | List the wire once on the line type; every run of it carries the conductors. |
| 4 | The derived wire | the Summary with `#12 THHN · WIRE · 171 ft` rows under the group | new (group LP-1/7 assigned) | Wire is never a mark; it is derived from the runs, so it cannot drift. |
| 5 | Bid Check for electrical | voltage drop and conduit fill rows with NEC chips | new | Voltage drop to the farthest device and conduit fill, checked on the plan. |
| 6 | The hand-off | Open in TakeoffTooling menu | new | Open in TakeoffTooling for assemblies, labor units and pricing. |

**HVAC, "Pounds, not feet"**

| # | Frame | Surface | Setup | Caption |
|---|---|---|---|---|
| 1 | The Quick tab on the HVAC profile | 12x12 Supply Diffuser with CFM 150 | new (`setProjectTrade('hvac')`) | A diffuser that carries its CFM. |
| 2 | Room Size, named off the plan | `#roomBoxModal` with "from the plan: OPEN OFFICE", ceiling, deck, type | `room-size-modal` re-shot with type and deck | Box a room the plan already names; it answers with ft², ft³ and the air it needs. |
| 3 | The main, traced | the duct trace with the 24×12 chip at the cursor and the hint card above the footer | new (post DUCT-HINT) | Trace the main; the chip reads the air still to serve. |
| 4 | S: the size steps down | `#ductSizePopover` with the suggested chips, 12"Ø and 16×8 | new | Press S; the suggestion is one tap, round or rectangular. |
| 5 | The Duct Schedule | `#ductScheduleModal` with gauge rows and the Bid weight line | new | Straight duct by size and gauge, the fittings you did not count, one Bid weight. |
| 6 | Bid Check for HVAC | every room served, systems within capacity, fits the roof | new | Every room served, the system within capacity, the deepest duct clearing the plenum. |

### Where the pictures come from

- `scripts/build-screenshots.js` gains a second set, `--set spotlight`, that writes
  `img/spotlight/<trade>-<n>-<slug>.jpg` (JPEG, quality 85, 2× of a 1200×800 CSS clip; about
  120 KB each, 18 files, about 2 MB total; the guides keep PNG). A per-shot `plan` option
  picks the restaurant or the office sheet; per-trade setups (`plumbingSpotSetup`,
  `electricalSpotSetup`, `hvacSpotSetup`) seed what the film makes on camera, with the same
  names and colours, so the pictures match the film above them.
- Manual, like the guides: not in `npm run check`, regenerated when a surface changes.
- A Node test, `landing-assets.test.js` (in `npm run check`), asserts the eighteen files exist
  and that every `img/spotlight/` reference in `index.html` resolves, the guides'
  link-integrity idiom.

### Markup, style, behaviour

- `<section class="section spotlight" id="spotlight">` after the hero: an eyebrow ("Your trade,
  in the app"), then three `.spotlight-set[data-trade]` blocks, each with its own `<h2>`
  ("Plumbing, surface by surface" · "Electrical, surface by surface" · "HVAC, surface by
  surface") and six `<figure class="spot">` with `<img loading="lazy">` and a `<figcaption>`.
- CSS shows the set matching `html[data-hero-trade]`, plumbing before the script runs, the
  same rule the proof panel uses. Hidden sets have no layout, so their lazy images are never
  fetched: a visit costs the selected trade's six, and only when scrolled to.
- Desktop: a 3 × 2 grid, all six visible. Under 900 px: a horizontal scroll-snap strip,
  one frame and a half in view, so a thumb can flick through.
- No new JavaScript. The hero script's `data-hero-trade` stamp already exists; the chips
  keep their `aria-pressed`; each set carries an `aria-label` naming its trade.
- `landing-trade.spec.js` gains: the selected trade's set is the only visible one, with six
  figures; its images load (`expect.poll` on `naturalWidth`, the lazy idiom); the hidden sets'
  images have not loaded; `/?trade=hvac` shows the HVAC set; a chip click swaps sets.

### The ladder (one topic branch each, the house loop)

1. **SPOT-1 · the generator and the HVAC set.** The `--set spotlight` machinery, `hvacSpotSetup`,
   the six HVAC frames committed. Half a day. No landing change yet. **DONE 2026-09-18**
   (branch `claude/spotlight-hvac`): `node scripts/build-screenshots.js --set spotlight` writes
   `img/spotlight/hvac-{1..6}-*.jpg`, a 1200×900 window (4:3, the viewport's full height so the
   tall dialogs keep their buttons) at 2×, JPEG 85, 215 to 335 KB each; the two trace frames use
   the film's office camera (`frameRegion`). Setups: `hvacBase` (trade, OPEN OFFICE 105 boxed
   with type and deck, four 150 CFM diffusers, RTU-1 at 2,000), `hvacDraft` (two vertices and
   the cursor on the third: the chip and the hint card), `hvacRun` (the main committed with two
   rectangular steps). The Room Size frame drags CONFERENCE 103 for real so the dialog shows
   "from the plan". Preview of the section with these frames: the "Trade Spotlight Preview"
   artifact.
2. **SPOT-2 · the electrical set.** `electricalSpotSetup`, six frames. Two to three hours.
   **DONE 2026-09-18** (branch `claude/spotlight-electrical`): `electricalBase` seeds the film's
   devices (receptacles at 18 in, the switch at 48, the troffers), the `3/4in EMT` type with its
   raceway and conductors, the circuit group LP-1/7 with every device in it, the chain along the
   south wall through `App.commitChainPoint` (each leg carrying its 9.5 ft drop), and the home
   run to LP-1 flagged `homerun: true`, which is what lets the voltage-drop row compute (a
   circuit needs a panel mark or a homerun to know where the panel is). Marks at size 40 so the
   device glyphs read at frame size. Frames: the Quick tab (Category / Variant / Rating, mount
   18"), the Chain panel over the chained run, the conduit's details dialog, the Summary's
   derived #12 THHN rows, Bid Check (fill 10% ✓, voltage drop 2.3% ✓ on LP-1/7), and Open in
   TakeoffTooling's toast.
3. **SPOT-3 · the plumbing set.** `plumbingSpotSetup` on the restaurant sheet, six frames.
   Two hours. **DONE 2026-09-18** (branch `claude/spotlight-plumbing`): a per-shot `plan`
   option loads the restaurant sheet (`PLAN_B`), `plumbingBase` seeds the film's counters,
   the two line types with their rulebook hangers, the four traced runs and the 3 ft riser at
   the meter, and `frameRegion` uses the film's cameras (the office sheet's `fitPlan` does not
   apply). Per-shot `dropSizes` (the "3 ft" label) and `clipboard` (the copy) flags. Frames:
   the Quick tab on the Plumbing profile, the details dialog offering the hanger row "From the
   rulebook" (seeded without hangers so the offer shows), the riser at the meter, the scale
   check reading 0.1% on the 31'-8" string, Bid Check's hangers row, and the copy toast (the
   project is not cloud-saved in the generator, so the toast is the "save to include a view
   link" one, which is honest).
4. **SPOT-4 · the section.** Markup, CSS, captions, the asset test, the spec cases, the plan
   and CHANGELOG notes. Ships all three at once, so the section never shows an empty trade.
   Three hours. Gates: `landing-trade.spec.js` + `seo.spec.js` locally, `npm run check`, then
   the headless check against counttooling.com after the merge. **DONE 2026-09-18** (branch
   `claude/spotlight-section`): `#spotlight` right after the hero, three `.spotlight-set`
   blocks shown through `html[data-hero-trade]` (plumbing before the script runs), each with
   its `<h2>`, a lede naming the sheet, and six `<figure class="spot">` (lazy JPEG, 4:3,
   caption); a 3 × 2 grid on desktop, a snap strip under 900 px; no new JavaScript.
   `landing-assets.test.js` (in `npm run check`) pins referenced ⇔ committed and six per
   trade in order; `landing-trade.spec.js` pins the visible set, the lazy loading (a hidden
   set's frames never fetch), the chip swap and `?trade=hvac`. Punch row SPOTLIGHT closed.
5. **SPOT-5 · tighter frames, value captions.** Robert's review of the first cut (2026-09-18):
   the frames were too loose (a dialog a third of a 1200×900 window, the rest dimmed plan) and
   the captions read as description, not value. **DONE 2026-09-18** (branch
   `claude/spotlight-crops`): the generator's fixed window became a per-frame
   `crop: { sel, w, h, ax, ay, ox, oy }` (a 4:3 window aligned to an anchor element's
   fraction point, plus an optional per-shot `css`), so the Quick tab is the Trade row to the
   More block, the rulebook frame is Name to the offered hanger, the Bid Check frames are the
   checklist column on a 420 px sidebar with a sliver of plan, the riser camera is the WH/WM/GM
   corner, the trace frame is the room and its chip above the hint card. Every figure now
   carries a value title (`<b>`) and a one-line description that quotes the numbers in the
   frame (171.73 ft of #12 THHN, 174 lb, 376 CFM). `landing-assets.test.js` also pins each
   `<img>`'s width/height to the JPEG's own pixels, so the grid never jumps as frames load.
6. **SPOT-6 · the lightbox.** Robert (2026-09-18): "when a user clicks on those photos, do they
   become bigger … so the individual interested in the information can zoom in and zoom out?"
   **DONE 2026-09-18** (branch `claude/spotlight-lightbox`): each frame is a
   `<button class="spot-open">`; one `<dialog id="spotLightbox">` after the section shows the
   frame at full size with its title and description, ← → and the arrow buttons walk the visible
   trade's six, wheel / pinch / + − / double-click zoom to 5× about the pointer, drag pans, Escape
   or the backdrop closes and focus returns to the opener. Inline script beside the hero's, no
   library. Spec case in `landing-trade.spec.js`.
7. **SPOT-7 · the frames follow the films again.** The films grew on 2026-09-20 ("complete the
   room", "complete the floor") and the electrical and HVAC frames were still cut from their own
   small takeoffs, so six captions quoted numbers the films no longer show. **DONE 2026-09-20**
   (branch `claude/punch-spotlight-sync`, punch row SPOTLIGHT-SYNC closed): `electricalBase` seeds
   the film's three circuits off LP-1 point for point (7 and 9 on the receptacle walls, 11 on the
   switch and the troffers, each chained through `App.commitChainPoint` with a square polyline
   home run flagged `homerun`, the panel a counter named LP-1), and `hvacBase` seeds the film's
   floor (six rooms boxed, RTU-1 at 3,000 CFM and 0.8 in. w.g., EF-1, sixteen diffusers, the
   returns, the stat, the exhaust grilles) while `hvacRun` traces the film's duct with real
   clicks: the main stepping down past each takeoff, five branches (the last sized by S), the
   return main, the exhaust run. A `PB()` helper quotes the films' plan coordinates as they
   stand. The frames now read the films' numbers: 13 runs and 202 ft of EMT, voltage drop 1.3% /
   1.5% / 0.3%, 14 rows to TakeoffTooling; 2,400 of 3,000 CFM, 19 flex drops, 244 ft of straight
   duct. Hundredths differ from the films' reports (59.49 ft against 59.46), because the film
   clicks at a different zoom; the captions quote the frames. Three gotchas for the next re-cut:
   a full floor's legend grows down over the Break room and takes the clicks that trace its
   branch, so the HVAC seed turns the legend off; the header's Duct button toggles the tool off
   once it is armed, so a second run is started with the film's `U` key; and the trace frame
   shows the first leg only, because until a branch is drawn every leg reads the whole 2,400 CFM
   and a stepped-down chip beside that suggestion looks wrong. The trace frame is 880×660 now
   (the unit and the hint card both in frame). The proof panel's Bid Check rows further down the
   landing are marked illustrative and were left alone.

About a day and a half in total. HVAC first because that is the visitor being prepared for.

### Decisions before building

- ⚑ **Six frames or four.** Six tells the whole loop; four is tighter on a phone. `[decision]` six (built with the default, 2026-09-18; Robert to say otherwise)
- ⚑ **Heading wording.** "Plumbing, surface by surface" as drafted, or the film's own line
  ("Kitchen, Tuesday" · "Circuit 7" · "Pounds, not feet"). `[decision]` as drafted (built with the default, 2026-09-18)
- ⚑ **Captions.** Quiet one-liners as drafted (recommended), or numbered callouts on the frames
  as the guides do. `[decision]` quiet one-liners (built with the default, 2026-09-18)

### Out of scope, on purpose

Photographs of physical tools (the app is the tool), per-trade pricing, testimonials, and any
change to the three trade cards.

## The hero chapters (plan of record, 2026-09-19)

> **BUILT 2026-09-19 (punch row HERO-CHAPTERS, closed), and it differs from the plan below in
> five places, all Will's calls on the real page.** Read this block first; the sections under
> it are the record of how the idea got here.
>
> 1. **Under the film, not over it.** A bar attached beneath the frame on its own surface
>    (`.hero-frame` holds the still and the video; `#heroChapters` follows it). Over the film the
>    strip covered about 30% of the frame on desktop and two thirds on a phone, and sat on the
>    app's footer and the hand-off toast. Below it nothing is covered, so the films need no
>    footer beats moved.
> 2. **Three parts: the question with the clock, the caption scroller, the rail.** (2026-09-20,
>    superseding the first build's two lines, which dropped the beat line because it repeated the
>    film's baked pill.) The pill read too fast and in shorthand, so the films now carry NO baked
>    caption and the bar draws the captions as a three-row scroller in plain sentences: the beat
>    on screen beside a caret, the one before it and the one coming dimmed around it. The fade-out needs none either: the page keeps the
>    still (the film's unfaded last frame) under the video and cross-fades the video out at
>    `duration - 0.5`, so the hold is the finished takeoff, never black.
> 3. **The words are Scale, then what the trade counts, then what it runs, then Pricing.**
>    Fixtures · Pipe, Devices · Wire, Rooms · Duct. "Bid" overclaimed: the film ends at the
>    hand-off, counts sent on for someone else to price. The answer reads "Forty-three seconds,
>    from start to sent for pricing." and the number is `Math.round(duration)` from the chapters
>    file, never copy (electrical is fifty-three since FILM-HOMERUN).
> 4. **Each chapter names its own length** ("Fixtures 7s"), centred under its track, rounded by
>    largest remainder so the four add up to the stated length. The running stamps went; the
>    clock carries the running time.
> 5. **The end row sits over the held frame** (Play again, the other two films with their
>    lengths), the usual end-of-video idiom, so the bar never changes height (the phone reserves
>    two question lines for the same reason).
>
> **The data.** `npm run build:hero-video -- --film <f> --chapters-only` walks the film's script
> without shooting a frame and writes `img/hero-<film>.chapters.json` (`duration`, four
> `chapters`, every caption as `beats`); a normal render writes it too. `CHAPTER_STARTS` in the
> generator names each chapter and the caption it starts at. The landing fetches the file; if it
> cannot, the bar stays hidden and the film plays as before. Pinned by landing-trade.spec.js
> (real playback: seek, answer, hold, Play again, Next takeoff, the under-the-film geometry, the
> seconds adding up, each file matching its mp4's length) and landing-assets.test.js.
>
> **FILM-FIXTURES, closed 2026-09-20.** The plumbing film said "Nothing missed." and missed four
> fixtures the sheet draws: the lavatory in MEN 102 and in WOMEN 103, and the two floor sinks (in
> front of PREP, and by the clean table in DISH). The film now counts them on keys 5 (Lavatory,
> pink) and 6 (Floor Sink, orange, the sheet's own square symbol): 21 marks, six counters,
> 44.25 s (was 43.0), so the bar reads "Forty-four seconds" and Fixtures 8s by itself. The
> spotlight's `plumbingBase` seeds the same two, five of its six frames were re-cut (the riser
> frame came out byte-identical), and the hand-off caption's "5 counts" became the toast's "7
> counts". The same render made the thirty-sheet set realistic: `buildSampleSet` takes the film's
> keep list, only those three sheets carry the drawing and the other twenty-seven are blank
> drawing sheets (banner, border, title block); electrical and HVAC pick it up at their next
> render. Still uncounted on the sheet, by choice so far: the mop sink (MS), the prep sink, the
> dishwasher, the water heater and the grease interceptor, which the keynotes name too. If
> "Nothing missed." is to be literally true, those are the next counters.

**Where this came from.** Robert and Claude, 2026-09-19, after the modal polish and the
asset refresh. The three hero films carry their beats as a caption pill baked into the
frames ("Hangers, from the rulebook."). The idea: replace the pill with a strip the page
draws over the film, so a visitor can follow along, and use it to make the app's value
plain: ask how long the takeoff takes, and let a clock answer.

**The mock, on the real plumbing film:** [hero-chapters.html](hero-chapters.html), in this
folder, committed so anyone can run it: `npx serve -l 3456` at the repo root, then open
`http://localhost:3456/journeys/plans/hero-chapters.html`. It plays `/img/hero-plumbing.mp4`.
Every decision below is a toggle on that page (Words, trade chips, the last word, placement,
the three looks, the question on/off), so the next person can see each one against the
footage rather than read about it. The same page is also published privately at
https://claude.ai/artifact/PK7ec92sDPZr1B4VgDGiup (ask Robert to share it).

### Decided

1. **The words: Scale → Count → Pipe → Bid.** The third word follows the trade chip:
   Pipe, Wire, Duct. Scale, Count and Bid are all the app's own names for things; the
   trade word makes the strip say "three trades, one takeoff" without a sentence.
   Considered and dropped: Measure → Count → Connect → Check (Measure is the ruler tool;
   Connect says nothing an estimator says), Set up → Mark → Run → Prove (plain, flat
   opener, could sit on any takeoff tool), Sheets → Scale → Marks → Lines → Proof (five
   nouns, tight at 375px, describes what appears rather than what someone does). The
   hybrid Scale → Count → Pipe → Prove was liked but not chosen; it is a one-word change.
2. **Over the film, not under it.** The strip sits inside the frame's bottom edge on a
   dark gradient scrim. It saves ~70px of hero height on a phone. It covers the app's
   footer row and the baked caption pill, so the films' next render drops the pill and
   keeps the footer beats clear of the bottom ~90px of the frame.
3. **Story segments, one per chapter,** each its own track filling in turn (the phone
   story idiom), every segment a button that seeks the film to that chapter. Of the three
   looks mocked (numbered pills, chapter cards, travelling rail) the **chapter cards**
   were chosen: four translucent cards with the app's tool glyph (the scale ruler, the
   counter, the pipe, the bid check), the track along the card's foot, the current card
   lit accent, passed cards green. Robert: "It could look a little cleaner." That polish
   is the open item below.
4. **The question and the clock.** A line over the strip in the site's serif asks the
   question; a stopwatch in mono digits with tenths counts up beside it, labelled
   "real time"; each card stamps the clock when its chapter completes (Scale 0:10,
   Count 0:16, Pipe 0:32); in the last two seconds the question resolves into the
   answer and the clock turns green with "real time · no cuts".
   Per trade: plumbing "How long does it take to count a restaurant?" → "Forty-three
   seconds, start to bid."; electrical "…to wire an office suite?" → "Fifty seconds…";
   HVAC "…to duct an office suite?" → "Fifty seconds…". Wording still open, see below.
5. **The film holds on its end screen.** No loop, no auto-advance to the next trade
   (today the three films play in turn unprompted). The finished takeoff stays on screen
   (the hand-off toast, the tallies); the strip holds the answer and the four stamped
   times; the live-beat line becomes an end row: a yellow **Play again** and two pills,
   "Electrical, 50 s" and "HVAC, 50 s", which are the chips by another name. The chips
   themselves keep working as they do now. Reduced-motion readers keep the still.

**The fade-out, found while building the prototype (2026-09-19).** The encode fades every
film to black over its last 0.45 s (`scripts/build-hero-video.js`, the `vf` chain:
`fade=t=out:st=${dur - 0.45}:d=0.45`). That exists to make the old loop seamless. Now that
the film HOLDS at the end, stopping on the true last frame holds on **black**, which is the
one thing the end screen must not do. Two ways out, do the second:

1. The prototype pauses at `duration - 0.5`, just before the fade starts, and shows the
   clock as the film's full length (the half second skipped is a fade, not work). This
   works against today's mp4s with no re-render.
2. **When the films are next rendered for this feature, drop the fade-out** (keep the
   fade-in). Then the hold is simply the last frame and `HOLD` becomes `DUR`. The films
   are being re-rendered anyway to remove the caption pill, so this is the same pass.

### Still open

- **Make the strip cleaner.** Robert's last note on the chapter cards. Candidates from
  the mock: fewer competing weights in the strip (the question, the clock, four card
  names, the live beat and the stamped times are six type sizes in ~140px), drop the
  per-card glyphs or the stamped times on a phone, a lighter scrim so more of the app
  shows, the end row on one line with the question. Decide by looking at the mock's
  three looks side by side, not by adding a fourth.
- **The question's wording.** "Count a restaurant" reads as a whole set; the film is
  three sheets kept from thirty, the scale proved, twelve fixtures, two runs with
  hangers and a riser, the check, the hand-off. "How long does it take to count these
  plans?" is the safer question. The answer must stay as specific as the film.
- **The electrical answer's number.** The electrical film is 52.6 s since the FILM-HOMERUN
  beat (2026-09-19), not ~50. "Fifty seconds, start to bid." and the "Electrical, 50 s" pill
  are no longer as specific as the film; take the number from the chapters array's last
  `end` rather than from copy, so the next re-render cannot make it wrong again.
- **Where the question lives.** In the strip (as mocked, so the answer lands where the
  clock stops), or as the page headline above the film with only the clock in the strip
  (readable before the film scrolls into view, at the cost of repetition).

### Building it

- **An HTML layer on the video's clock, not a re-render.** The strip listens to the
  `<video>`'s `timeupdate` and reads one chapter array per film: `{ name, start, end }`
  ×4 plus the beat captions with their seconds. The plumbing boundaries, measured off the
  film: Scale 0–10, Count 10–16, Pipe 16–32, Bid 32–43. Electrical and HVAC (both ~50 s)
  are unmeasured; take them from the generator rather than the montage.
- **The generator writes the arrays.** `scripts/build-hero-video.js` already stamps every
  caption with its frame time (`caption()` records `since`, and the `acts` list exists
  for exactly this). Have it emit `img/hero-<film>.chapters.json` (or a block in
  index.html) next to the mp4 so the timings cannot drift from the footage; the landing
  reads it. Chapter boundaries are the first caption of each chapter: "30 sheets." /
  "Count." / "Cold in." / "Nothing missed." for plumbing.
- **The films' next render** drops the caption pill (the strip carries the beat) and
  keeps the footer beats above the scrim. Do it once for all three; then run
  `build:screenshots --set spotlight` too, since the spotlight frames are cut from the
  same setups.
- **The landing script** (index.html, the hero block): keep `select(trade)` and the
  chips; remove the play-in-turn; on `ended` add the end row; `Play again` seeks 0 and
  plays; the next-takeoff pills call `select()`; a segment click seeks its chapter start.
  Cache `--n` from the array length; the strip's CSS is in the mock and mirrors
  marketing.css tokens.
- **Honesty.** The clock reads the video's own time and resets on chip change. The
  "real time · no cuts" label is true because the generator walks real interactions at
  real speed (mouse moves, typing at ~12 cps, the app's own dialogs) and the encode does
  not accelerate; if a future film ever skips or speeds a beat, the label goes with it.
- **Specs.** seo.spec.js pins the hero's markup and chips; add one assertion per film
  that the chapter array has four entries whose ends are ascending and whose last end
  equals the film's duration, and one that the strip's first card name matches the
  array. `landing-assets.test.js` should require the chapters file beside each mp4.
- **Phone.** At 375px the mock drops the "Next takeoff" label, shrinks the card names to
  12px and the scrim's top padding; check the end row wraps to two lines cleanly.
