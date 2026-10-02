# The pitch deck at counttooling.com/deck/

`index.html` here is GENERATED — `node scripts/build-deck.js` writes it from
`deck.json` (the slide order and title) and `slides/<id>.html` (one slide each).
Edit those, rebuild, commit all three. The page is `noindex` and not in the sitemap:
it is a pitch, reached by its link.

The slide files are the Slides-artifact format the deck was authored in at claude.ai
(the "ClickTooling Pitch" artifact, https://claude.ai/artifact/56K6KtLWCR1jmCbQC96fkY):
one `<section id="<id>">` on a 1920×1080 canvas, every style inline, an `<aside>` of
speaker notes as the last child. The build maps its `/_blob/<id>` images to files in
`assets/` or `/img/` (`BLOBS` in the script — a new image gets a row there, and the
Artifact tool's read with the asset id saves the file to copy in).

## Bringing the artifact's edits here

The artifact is where the deck is edited. To push its state to the site from any session:

1. Read the artifact's files with the Artifact tool (`read` with `paths` for `project/deck.json`
   and every `project/slides/<id>.html`); it saves them under a folder ending in
   `artifact-files/<artifact id>/project`.
2. `node scripts/sync-deck.js <that folder>` copies the index and the slides it orders,
   removes slides the order dropped, swaps the see-it still for the recording (`MEDIA` in
   the script), and rebuilds. `--check` only reports.
3. Commit `deck/`, open a PR, merge. GitHub Pages serves it within about two minutes.

The other direction works too: edit a slide file here and publish it to the artifact with
the Artifact tool, since the format is the same, then rebuild.

## Context for the next editor

- **Audience and ask.** A family member at a very large HVAC company; the ask is $1.5M on a
  post-money SAFE plus a license to their company. The term sheet is a private artifact and
  is never put in this repo or on a URL.
- **This repo is public.** The slide sources and the speaker notes are readable by anyone on
  GitHub even though the page is `noindex`. Nothing goes in a slide or a note that should
  not be read by a stranger.
- **Framing rules the author set.** Simple sentences a reader does not have to think about.
  Honest claims only: three trades are live, a new trade is a rule book and a price book,
  never promise a date per trade. Accuracy is said as 92–93%, never as 7–8% off.
- **Placeholders.** `[N]` on the robot slide is the scored-job count, filled from the
  scoreboard the morning of the pitch (23 on 2026-09-30). The traction numbers were read
  from the live database on 2026-09-30 and should be refreshed before a pitch.
- **The market model.** `model/revenue_paths.py` reprints the revenue-paths table from its
  BLS inputs; change a constant there, then update the slide by hand.

## Adding a moving image or a video

Put a `<video>` where the `<img>` was, sized the same, and rebuild:

```html
<video src="/img/hero-plumbing.mp4" poster="/img/hero-plumbing.png"
       muted loop playsinline preload="metadata" data-autoplay
       style="width:1664px;height:640px;object-fit:cover;border-radius:16px"></video>
```

`data-autoplay` (or `autoplay`) makes the viewer start it from the top each time its
slide comes up and pause it when the slide leaves; without it the video sits on its
poster until clicked. Keep `muted` — browsers block sound that was not asked for.
The three landing-page recordings are already on the site: `/img/hero-plumbing.mp4`
(4.6 MB), `/img/hero-electrical.mp4` (5.0 MB), `/img/hero-hvac.mp4` (7.7 MB), each with
a matching `.png` poster. A new clip goes in `assets/` (keep it under about 10 MB;
`mp4`, H.264). An animated GIF or WebP is just an `<img>`.

## Presenting

Arrow keys, space, click (right three-quarters forward, left quarter back) or swipe
move between slides. `#7` in the address opens slide 7. **N** shows the speaker notes,
**F** goes full screen, **Esc** closes the notes.
