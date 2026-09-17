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

Still to do: trim to about 27 s (the Prepare beat and the scale dialog), hold the "Copied"
confirmation before "Done.", keep the legend inside the frame at pull-back; then the
electrical and HVAC films, the chip switching on the landing, and retiring the three-trade
take. The landing keeps playing `landing-hero.mp4` until then.
