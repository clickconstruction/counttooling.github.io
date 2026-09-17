# Landing page refresh — three trades on the front door (2026-09-16)

> Plan of record for punch row **LANDING-REFRESH**. Status: **mockup done, direction and
> headline undecided, nothing built.** Robert's ask (2026-09-16): "now that we have HVAC and
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
   `[decision]` ____
2. **The Bid Check panel** in "numbers you can defend": replace the mock with a real
   screenshot (needs an electrical project with a voltage-drop row, a fill row and a
   hanger row; `scripts/build-screenshots.js` can stage one) or keep it as drawn.
   `[decision]` ____
3. **Direction.** A as mocked, or build out B or C instead. `[decision]` ____

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
