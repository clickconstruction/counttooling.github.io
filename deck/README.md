# The pitch deck at counttooling.com/deck/

`index.html` here is GENERATED — `node scripts/build-deck.js` writes it from
`deck.json` (the slide order and title) and `slides/<id>.html` (one slide each).
Edit those, rebuild, commit all three. The page is `noindex` and not in the sitemap:
it is a pitch, reached by its link.

The slide files are the Slides-artifact format the deck was authored in at claude.ai
(the "ClickTooling Pitch" artifact): one `<section id="<id>">` on a 1920×1080 canvas,
every style inline, an `<aside>` of speaker notes as the last child. A slide edited
in the artifact is pasted back here whole; the build maps its `/_blob/<id>` images to
files in `assets/` or `/img/` (`BLOBS` in the script — a new image gets a row there).

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
