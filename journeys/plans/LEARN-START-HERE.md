# Learn: lesson 0, "Start here", and a Words search (2026-09-27)

Todd's ask (2026-09-27): the Learn guide (`content/guides/learning-the-app.md`) is valuable
enough to offer as a top-level lesson, with an entry point of its own, and a little
interactive. Decided the same day: build lesson 0 with the empty-canvas card and the route
first, the Words search as a second PR. Deferred ("let's actually build it later").

## LEARN-START · lesson 0, "Start here"

**BUILT 2026-09-27** (CHANGELOG "feat(learn): lesson 0, Start here, and the one card a new device
sees"). As planned, with four differences found building it:

- Where things are is three cards, not one (the header; the sidebar; the footer and the status
  bar): a card lights one control, so one card could not light each "in turn". Seven cards in
  all after the open step, still about four minutes.
- The circle sits on the title block's SHEET cell, (1140, 748), not the block's centre, and the
  card holds for Next once it ticks, so the ✓ is seen. The step names the Title block row in
  COUNTERS as a second target, which keeps the card off it.
- The card gets a second, quieter link, "or see every tour, lesson and course" (Learn), so a
  reader who wants the whole list is not held to the one card on a new device.
- "Finished nothing" also counts a course chapter and the blank tour, not only lessons and the
  three trade tours. Learn's suggested row skips Start here once any of the thirteen is done.

The plan as written:

A real lesson on the tour engine, about four minutes, on the lesson set like the other
thirteen (features/lessons.js `LESSONS`, first row, an uncounted opener the way each course's
Chapter 0 is: shown as row 0, left out of "N of M done" through `renderRows`' `number`
accessor, which the lessons caller does not pass yet). Five cards:

1. **What this is** (read): the guide's opening paragraph. The app teaches itself on sample
   sheets; nothing touches a real project.
2. **Where things are** (read): the header, the left sidebar, the status bar, each lit in turn
   by `target`, `[[Learn]]` last (the courses' Chapter 0 "where" pattern).
3. **How a card teaches, by doing it** (do): one circle on P-101's title block (sheet
   coordinates: the block is the 812–1204 × 640–772 rectangle of the 1224 × 792 sheet, centre
   about (1008, 706), in PDF points top-left; `K().markZones` with a seeded "Title block"
   counter) and the line beside Show me where. A click outside shows the red reason, a click
   inside the ✓. The guide's lesson-targets picture, turned into the thing itself.
4. **Pick your path** (read): the three paths with their minutes: the five-minute tour for
   the reader's trade, the thirteen lessons, a course. Done hands back to Learn with the
   tours at the top (`openLearnMenu`).
5. **The words** (read): where the glossary lives ("Words the cards use" in the Learn guide)
   and how to get back to it.

Entry points:

- The empty canvas: a device that has finished nothing (`clickcount-lessons-done` empty, no
  tour done key) shows one card, "New here? Start here, 4 min", in place of the line of
  tour links (`#canvasEmptyHint`, app/index.html:533; the tour links are hidden per tour by
  features/tutorial.js `TOURS[*].linkId`). Once lesson 0 is done, the line of links returns.
- Learn: row 0, above the tours, with the same tick and lighting as every row.
- `/app/?lesson=start`: the existing `?lesson=<id>` route needs nothing new. The guide's
  "How a lesson works" section gets a "Do this in the app" link to it; the landing may too.
- Project Settings → Help → lessons, as now.

To hold: `check-courses` covers the new lesson (its words need glosses or `FIRST_USE` rows in
scripts/score-courses.js's `lessons` block, which reads lessons in menu order, so a term
lesson 0 glosses moves there); teaching-labels for its `[[Control]]` chips; lessons.spec.js
walks every lesson (an `EXPECT.start` entry) and its doors test pins 13 rows and "1 of 13
done" (row 0 excluded keeps those); the "thirteen lessons" copy in app/index.html:2542 and
the guide can stay if the opener is uncounted. Card 3 is a doing step, so the row reads
"4 min", not "read".

## LEARN-WORDS · a Words search in Learn (second PR)

**BUILT 2026-09-27** (CHANGELOG "feat(learn): a Words search at the top of Learn"): the box, the
generated `guides/words.json`, the precache line. While the box holds a query its matches replace
the menu; twelve show at most. The tap targets below are not built; they are punch row LEARN-TAPS.

The plan as written:

A search box at the top of the Learn modal over the guide's glossary (278 entries).
`build:guides` also emits `guides/words.json` from the same Markdown section, so the guide
stays the one list; the app fetches it (one line in build-sw.js `PRECACHE_EXTRA`). Later,
and separately: the same words as tap targets on cards, a dotted underline on a term the
card has already glossed once, its guide entry on tap; the inline gloss stays for the first
use.
