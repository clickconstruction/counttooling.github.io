# PERSONA — simulated readers that find gaps, checked by things that are not personas

> Plan of record, written 2026-09-25 after the six by-hand walks of the tours, lessons and
> courses (#199 to #207). The owner's aim: take the markup tool "long term" into "a tool to
> teach people plumbing and what the codes are", and use personas to "test and validate and
> come up with things we should add to improve the app and deepen the learning base". The
> owner's two constraints: reads are the expensive part and forks are cheap, so run as much
> as possible in parallel; and the owner wants to give as little input as possible.

## The problem this plan is built around

Personas are a cheap way to see the app through a beginner's eyes, and good at finding gaps.
They are poor at validating: a simulated user is more patient and agreeable than a real one,
and a model playing a master plumber cites the wrong code section with total confidence.

So **a persona never decides anything.** It produces a lead. Every finding climbs a ladder
whose rungs are checked by something a persona cannot flatter:

1. **Persona run.** A structured finding: step, control, what it tried, what it expected, a
   reason code.
2. **Replay.** The harness reproduces it with real clicks on the real app. No reproduction,
   no finding.
3. **A person with the trade.** Anything about code or trade practice becomes a tester row,
   the way PC-TRADE / EC-TRADE / HC-TRADE are today.
4. **Real use.** The same reason codes ride `tour_step` telemetry, so real readers' stalls
   check whether the personas predicted them.

## Rules that answer the two failure modes

**Agreeableness: measure what they do, never ask what they think.** No "was this clear?". The
engine records misses, hints shown, time on step, backtracks and quitting. A persona gets a
budget of actions per step and quits after a set number of misses; it sees only the text
snapshot (or a screenshot when it asks), never the source; it acts with real clicks and
never uses the step's own button (the by-hand-walk rule). One persona skims and acts on the
first plausible control, because real beginners do.

**The confident master plumber: split code claims in two.**
- *Internal consistency* is checkable in code: does a card agree with the rule file it names,
  and the rule file with the code? `build:rules --check` already does this for numbers; step
  `rules:` ids (below) carry it into lesson text.
- *External truth* (is the rule right against the IPC / UPC / NEC?) is never settled by a
  persona. A persona may cite a rule only by its rulebook `id`, or quote a source text it was
  handed, with the section. Anything else is a question for a tester. A rule a persona
  proposes enters as `status: draft` and goes no further without a person.

**Many personas without many duplicates.** A persona is a point on axes, not a character:
trade knowledge (none / apprentice / journeyman / estimator), app familiarity (first time /
returning with a palette), device (desktop / 1280 × 720 / tablet), patience, and goal (learn
/ bid fast / check a number). Run a grid of those with a few seeds each. Findings group by
step id + control + reason code in code, and rank by how many independent persona kinds hit
the same spot.

**Calibrate before trusting.** The CHANGELOG holds six rounds of real by-hand findings. Run the
personas against the commit before #199 and score recall (known stalls found) and noise
(findings that were not real). A number, before any persona output is trusted on new work.

## Token budget: read once, fork many

Reads are the expensive part and forks are cheap, so the cost of reading is paid once:

```
parent: reads the compact inputs once
  |   (step manifest, rules.json, label index, persona axes, finding schema)
  |-- fork: persona A x plumbing course --.
  |-- fork: persona B x plumbing course   |  each fork appends JSONL findings to a
  |-- fork: persona A x electrical course |  scratch folder and returns ONE line:
  '-- ... all launched in one message   --'  "12 findings -> <path>"
            |
   merge script (code, no model): group by step + control + code, count persona kinds
            |
   one triage fork reads only the merged digest -> drafts punch rows and wording fixes
```

1. **The parent reads digests, never source.** No fork opens app.js or a features file. The
   parent reads small generated files: the step manifest, `rules/rules.json` (exists), and the
   shell label index.
2. **Shared material first, persona last.** The parent's context is common and in a fixed
   order; a fork's prompt adds only its persona and task. A wave launches in one message
   right after the load, so every fork reuses the same cached prefix (the cache has a time
   limit: a wave spread across a day pays for the read again).
3. **Forks write files and return one line.** Findings returned as text would grow the
   parent's context wave by wave. A script merges.
4. **The answer key never enters the shared context.** In calibration the known findings stay
   out of the parent, or every fork inherits them. Scoring is a script, afterwards.
5. **Models by tier.** Haiku drives personas. A stronger model does the triage and the
   rule-consistency read.
6. **Stop early.** A capped persona that is stuck has already given its finding.

**The live pass: one browser, many isolated sessions.** `scripts/persona-harness.js` runs one
headless Chromium and hands out isolated contexts over a localhost endpoint:

- `POST /episode { set, step, device }`: fast-forwards to the step through the steps'
  `action.run` chain (`App.tutorialDoStep()`, no tokens), returns the text snapshot.
- `POST /act { id, action }`: one action from a small set (`click "<label>"`, `click zone N`,
  `type "<text>"`, `key U`, `screenshot`, `give up`) with real mouse and keyboard events;
  returns the next snapshot with the check state and the miss's reason code.

A fork works one step in a handful of `curl` calls of a few hundred tokens each, and twenty
forks drive twenty contexts at once. Every step is its own short episode: context never
accumulates across a tour.

## Build items, in order

**Built 2026-09-25**, all seven, on three branches merged as one (CHANGELOG "feat(persona)"). What
follows is the plan as written; the Harness section below is how it came out.


1. **Step manifest.** `App.tutorialManifest(setId)` and a dump script
   (`npm run build:persona-manifest`, manual like `build:screenshots`): per step, one compact
   line with id, title, rendered body text, target control labels, zones, and whether it has a
   hint / progress / action. Stable field order; this is the parent's main read, so size
   matters most here. Covers the three five-minute tours, the blank-sheet tour, the thirteen
   lessons and the three courses (about 330 steps).
2. **Label index.** Every control label in the shell, which teaching-labels.test.js already
   collects, written beside the manifest. With it the text pass catches "the card names a
   control that is not there" without a browser.
3. **Reason codes on hints.** `hint()` may return `{ code, text }` (plain strings still work, so
   the steps move over a set at a time): `not-armed`, `outside-zone`, `wrong-scale`,
   `wrong-item`, `dialog-closed`, `not-yet`. The plumbing tour's twelve steps first. The code
   rides the `tour_step` event so real readers are measured on the same yardstick.
4. **`App.tutorialObserve()`.** The text snapshot: card text, lit controls by label and screen
   box, sheet zones, check state, hint and its code, the open dialog. Built on
   `tutorialStepInfo` and `tutorialZoneScreen`.
5. **The harness and the merge script.** `scripts/persona-harness.js`,
   `scripts/persona-merge.js`. Findings land in the session scratch folder, never the repo.
6. **Named devices.** First-timer, returning estimator, tablet: the setups tutorial.spec.js
   already builds, lifted into one fixture both the specs and the harness use.
7. **`rules:` ids on steps.** A step that teaches a code value names its rulebook ids; a check
   (in `npm run check`) fails a card that states a code number or section without one, or
   whose number differs from the rule's.

## Runs

| Phase | Loaded once in the parent | Fan-out | Model | Needs |
|---|---|---|---|---|
| Calibration | plumbing tour manifest at the commit before #199 | 5 persona kinds x 3 seeds | Haiku | 1, 2 (text); 3 to 6 (live) |
| Text pass | every set's manifest + labels + rules.json | persona kinds x sets | Haiku | 1, 2 |
| Rule consistency | rules.json + the course text | one fork per trade | stronger | 1, 7 |
| Live pass | device fixtures + harness notes | persona x **flagged steps only** | Haiku | 3 to 6 |
| Triage | the merged digest only | 1 | stronger | 5 |

The live pass is the only part paid per click, so it runs on the steps the text pass or the
calibration flagged, never on all 330.

## Who does what (the owner gives as little input as possible)

An agent session builds items 1 to 7, runs every phase, merges, and triages without asking.
What the triage finds is sorted by kind, and only one kind comes back to a person:

- **Wording and stalls the harness reproduced** (a card naming the wrong control, a hint
  that never shows): the agent fixes them and lands them like the by-hand walks, a CHANGELOG
  entry per round.
- **Knowledge gaps** (a term used before it is defined, a step that assumes the trade): the
  agent drafts the glossary line, guide paragraph or `draft` rule, lands it, and lists it.
- **Code and trade truth**: a tester row, never an edit. This is the one rung no agent can
  climb.
- **Product calls** (a new lesson, a change to how the app behaves): a `⚑ call` row.

The owner's input is: a go; "use a workflow" once, when the grid outgrows a hand fan-out (the
Workflow tool runs only on that explicit word, and its default size guideline is under 10
agents, raised in the app's settings under "Dynamic workflow size"); and a read of the
triage's one-page summary per round. The calibration number decides whether the live pass is
worth running at all.

## Open

- Whether a round of persona fixes lands as one PR per round (the by-hand walks' pattern) or
  one per set. Default: one per round.


## Rulebook gaps

Found by the lesson rules check the day it was built (2026-09-25): the courses teach code the
rulebook does not hold. `node scripts/check-lesson-rules.js --gaps` lists them, each with the step
and the section it cites. There are 29: eleven in the plumbing course (indirect waste and trap
primers, drainage slope, grease interceptors, cleanouts and vents, trap arms, vent terminals, gas
pipe sizing, appliance shutoffs, hood gas shutoff, steel pipe hangers, drainage fixture units),
twelve in the electrical course (working space, conductor protection and ampacity, GFCI locations,
emergency lighting, occupancy sensors, EMT supports, disconnects, the shunt trip, fixed-equipment
circuits, feeder and grounding, bends between pull points) and six in the HVAC course (make-up
air, the diffuser neck velocity, fire dampers, no dampers in a grease duct, outdoor air). This is
the learning base's backlog. Each becomes a rule file with `status: draft` in the course's words,
cited by section, never the code text reprinted (content/rules/README.md). A person with the
trade signs it before it is `applied`, and the step then names it in `rules:`.

## Harness

Built 2026-09-25 (build items 2, 5 and 6). Four scripts, all Node tooling, none in the shell:

- `scripts/persona-devices.js`: the named devices, `first-timer` (1440 × 900, clean),
  `returning` (1440 × 900, the standing palette and sidebar search words), `laptop`
  (1280 × 720, returning) and `tablet` (768 × 1024, touch, returning). tutorial.spec.js's
  returning-estimator tests seed from the same module.
- `scripts/lib/persona-driver.js`: the Playwright half (boot on `App.bootSettled`, decline the
  restore offer, start a set by its own door, clear the opening step with its own card button,
  fast-forward through the specs' seam, observe, one action with real mouse and keys). Every
  engine seam (`tutorialIds`, `tutorialManifest`, `tutorialObserve`) is feature-detected; on a
  commit without them the ids come from the feature files' doors, the snapshot from the card's
  DOM (its `code` is null), and the manifest from walking the set with Skip / Next
  (`"source":"walk"`).
- `npm run build:persona-manifest -- --app <url>`: `persona-out/manifest.jsonl` (one line per
  step) and `persona-out/labels.json` (every label the shell shows, the list
  teaching-labels.test.js checks chips against). About 15 minutes as a walk, four sets at a time.
- `npm run persona:merge -- <findings dir> [--score known.json]`: `digest.json` + `digest.md`,
  ranked by persona kinds, then severity. The finding schema and the known-list format are at
  the top of `scripts/persona-merge.js`.

Start the harness against a running app server (no `--app` serves this checkout itself):

```
npm run persona:harness -- --port 3490 --app http://localhost:3457 --out <scratch>/persona
```

| Endpoint | Body / query | Returns |
|---|---|---|
| `GET /health` | | `{ ok, episodes, app, devices }` |
| `GET /sets` | | `{ sets: [ids] }` |
| `GET /manifest?set=plumbing` | | the set's manifest |
| `POST /episode` | `{ set, step, device }` (step: id or index) | `{ id, obs }` |
| `POST /act` | `{ id, action }` | `{ obs, ok, error?, events }` |
| `POST /close` | `{ id }` | `{ ok }` |

Actions: `{click:"+ Add"}` (with `within:"COUNTERS"` or `nth` when two controls share a name;
"COUNTERS + Add" also works when the leading words are a section heading on screen),
`{clickZone:n}`, `{dragZone:n}`, `{clickAt:[x,y]}`,
`{drag:[[x,y],[x,y]]}`, `{type:"text"}`, `{fill:["Name","Water Closet"]}`,
`{select:["Size","1in"]}`, `{key:"U"}`, `{scroll:[x,y,dy]}`, `{screenshot:true}`, `{wait:ms}`,
`{giveUp:"why"}`. A click by label looks in the open dialog, then a floating panel, the tour
card, the header, the sidebar and the page; several matches in one place come back as an
error listing them, the lit one marked `lit:true` (`preferLit:true` takes it); a label that
matches nothing lists the controls sharing a word with it. An unknown set or device is a 400
listing the valid ones. A control under the card or a
dialog is reported as covered, not clicked. Each episode appends JSONL to
`<out>/<id>.jsonl`; idle episodes close after 10 minutes.

```
$ curl -s -XPOST localhost:3490/episode -d '{"set":"plumbing","step":"counter","device":"returning"}'
{"id":"e1-h08t","obs":{"tour":"plumbing","i":3,"n":17,"id":"counter","kind":"do","title":"Make a Water Closet counter","card":"1. In the left sidebar, under COUNTERS, click + Add.\n…","status":"Waiting for you…","miss":false,"code":null,"done":false,"next":false,"buttons":["Leave the tour","Show me where","Skip this step","Back","Next"],"lit":{"label":"+ Add","box":[122,236,59,27]},"dialog":null,"zones":[],"page":0,"stepPage":null}}
$ curl -s -XPOST localhost:3490/act -d '{"id":"e1-h08t","action":{"click":"COUNTERS + Add"}}'
{"obs":{…},"ok":true,"events":["clicked \"+ Add\" in the sidebar (split \"COUNTERS\" + \"+ Add\")","dialog opened: Create tab"]}
```
