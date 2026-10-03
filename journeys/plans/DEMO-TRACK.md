# The demo track: what a stranger sees behind "Try it" (2026-10-02)

Todd, 2026-10-02, after playing the test drive himself: *"it was kind of confusing and it
took me a good amount of time to gain the context, which made me not want to use the app.
When the purpose of this test area is to take someone who has no familiarity and have them
play with the app in a way that demonstrates value."*

The test drive (`/test/`) hands the app to someone after a pitch. Its desk door's "Try it"
buttons opened COURSE chapters: twelve-minute lessons that teach the trade, written for a
reader who will sit through nine of them. That is the wrong thing to hand a stranger with two
minutes. This plan is the replacement: a **demo track** per trade, built on the tour engine,
that is not a lesson.

## The five decisions (all five taken, Todd, 2026-10-02)

1. **A separate demo script per trade.** The courses, tours and lessons are untouched. The demo
   is `features/demo-<trade>.js`, registered on the tour engine (`App.registerTour`) through the
   shared `features/demo-track.js`.
2. **The demo does the work.** The guest makes one or two clicks per moment; the app does the
   rest (lays the rooms, makes the counters, sizes the run). **The demo track is EXEMPT from
   the house rule "never add a button that does a step for the reader" (2026-09-21).** That
   rule is for lessons, where the point is practice. A demo's point is the payoff. A demo card
   MAY carry a button that does the step; a lesson card still may not.
3. **One orientation card, then nothing.** When the demo opens, ONE card: what a plan is, what
   the sidebar is, how many clicks are coming. Then every card is one action.
4. **Quiet the UI while a demo runs.** Sidebar sections the current moment does not use are
   collapsed; header tools it does not name recede (dimmed, not removed: nothing breaks if a
   guest clicks one). Restored when the demo stops.
5. **One number: time to first payoff.** From "Try it" to a result that means money, 60
   seconds or less, measured by a stopwatch in a real browser. The hand check is Todd playing
   it; the automated check is the spec's own clock.

## The shape of a moment

A trade's demo is **3 to 5 moments**. A moment is 2 to 4 cards. Every card is:

- **One action.** One thing to click, named the way it looks (`[[Duct]]`), or one button on the
  card that does it. Never a numbered list of four steps.
- **One sentence of payoff**, in money or time or a caught mistake, after the action lands.
  "That's 1,062 pounds of sheet metal. Shops price duct by the pound." Not "a fitting is any
  shaped piece of duct that is not straight".
- **No glossary, no chapter numbers, no "why".** A guest who wants the why has the course; the
  demo's last card points there once.
- **Under 20 words per sentence, two sentences per card at most.** Grade 6 or under
  (`scripts/score-courses.js` scores the courses; the demo files are scored the same way, add
  them to its list).
- **Zones where it works on the sheet** (circles for clicks, a boundary for a drag), the way
  tours and lessons declare them, so the engine lights where to click and a click elsewhere
  is not a failure.
- **`action.run`** on every doing card: the spec seam `App.tutorialDoStep()`, and (decision 2)
  the "Do it for me" the card shows.

The moments per trade are the test page's five, already written there (`test/index.html`,
`TRADES[<trade>].moments`), each ending on the payoff its `why` line promises:

| HVAC | Plumbing | Electrical |
|---|---|---|
| The plan tells you the duct size | The schedule makes your counters | The outlet that needs a GFCI |
| Pounds of sheet metal, in one number | Trace the pipe, get the parts it needs | Draw the conduit, get the wire |
| Every room knows its air | The vertical feet the plan cannot show | A circuit that checks itself |
| It catches the mistake in the plans | Prove the scale before you count | How full may a conduit be? |
| Check it, sign it, hand it off | It checks the bid against the code | Check it, prove it, hand it off |

A moment's door is `/app/?demo=<trade>:<moment-id>`; `/app/?demo=<trade>` runs them in order.
The test page's "Try it" opens the moment; the test page is updated in phase 3.

## Files

- `features/demo-track.js` (shared, phase 1): the `?demo=` door, the orientation card builder,
  the quiet-UI apply/restore, the "Do it for me" button on a demo card (the engine's
  `handsOff` path or a new flag, whichever is smaller), and `App.registerDemo({ trade, moments })`.
- `features/demo-<trade>.js` (one per trade): the script. Reuses the course's seeds and layers
  through `App.lessonKit` and the course's own helpers where they are published; what a demo
  needs that a course keeps private, publish from the course file (the course is unchanged
  otherwise).
- New shell scripts: a root-absolute `<script>` tag in `app/index.html` after the course files,
  then `npm run build:sw`; an ARCHITECTURE.md Files row; `npm run build:filemap`.
- `demo-<trade>.spec.js`: every moment walked by `tutorialDoStep` on real state, each card's
  check passing because the thing was done; the orientation card first; the quiet UI applied
  and restored; the door; and **the clock**: from goto to the first moment's payoff card,
  under 60 s with the page's own timer (`performance.now()`), reported in the test name's
  output so a slow one is seen.
- `teaching-labels.test.js` and `scripts/check-lesson-rules.js` read the tour and lesson
  files by name: add the demo files to their lists so a `[[control]]` that does not exist and
  a rule number without its `rules:` key fail the same way.

## Voice

Written for anyone at all, like the courses (COURSE-LANGUAGE option C), but SHORTER than the
courses by a factor of five. Imperative. Say what to click, then say what it was worth.

> **Click the duct where it says 24×12.** The app read that size off the plan for you.
> **Click the corner, then the end of the hall.** You traced the main. The elbow counted itself.
> **Click Duct Schedule.** 1,062 pounds of sheet metal. Shops price duct by the pound.

No em dashes (house style). A control is `[[Duct]]`. Numbers come from the sample's real
geometry, never typed in: a card that quotes "1,062 lb" reads it live (`body: () => ...`) the
way the courses' compare cards do, so it cannot drift from the sheet.

## Validation (the orchestrator, after each phase)

1. `npm run check` green; the demo spec and the course, lesson, tutorial, restore specs green.
2. Played by hand in the browser at laptop width and in the test page's phone frame: every
   moment, as a guest who has never seen the app, with a stopwatch.
3. The guest's device is untouched afterward: Counter Settings, palette, searches, filter
   (the lessonKit's device snapshot), and no "Project from Last Session" offer of the sample.
4. The three trades read as one product: same card shape, same voice, same button labels.

## Progress

- Phase 1 (shared engine + HVAC): LANDED 2026-10-02, PR #316 (`features/demo-track.js`,
  `features/demo-hvac.js`, `demo-hvac.spec.js`). The orchestrator's hand walk at 651 px and
  800 px found six faults the spec had not (the sheet gliding under the first tap, 15-point
  circles, a right trace not counting, sidebar wording where the sidebar is behind ☰, the Trim
  your set flash, the orientation over a black canvas) plus the app's own toasts leaking in;
  all fixed on the branch before merge, each with a spec case. The clock: about 4 s headless,
  about 16 s by hand to the first payoff. The lesson for phase 2: walk it by hand at a narrow
  width before calling it done; the spec's `tutorialDoStep` path cannot see what a finger sees.
- Phase 3 (test page wired to `/app/?demo=<trade>:<id>`, the field door's first-tap prompt):
  LANDED 2026-10-02, PR #315.
- Phase 2 (plumbing, electrical in parallel, shared files frozen): LANDED 2026-10-02, PRs #318
  (electrical) and #319 (plumbing). Each hand-walked at 651 px by the orchestrator before merge
  (electrical `gfci`: one tap, the 11-not-10 payoff, no toast; plumbing `schedule`: one drag,
  eight counters named off the sheet). All three trades live behind `/test/`.

## Open after phase 2

- The opening card offers "Open the sample plan" beside "Opening the sample plan…" while the
  open is in flight (openRun's loop ends after 3 s if the set's name is not up yet; the card's
  check then seeds it). Guarded against a double open, but the button should not show mid-open.
  A cold first load of a four-sheet set took 15 to 30 s on a worktree server; the live site's
  service worker caches the set after the first visit, so a demo laptop opens each trade once.
- A real tablet and phone walk with a stopwatch, by a person: the orchestrator's walks were a
  mouse in a 651 px pane. PUNCHLIST DEMO-TRACK stays open for that and the item above.
