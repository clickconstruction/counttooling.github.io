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

Each ships on its own branch with its spec, like any feature.

1. **Step manifest.** `App.tutorialManifest(setId)` and a dump script
   (`npm run build:lesson-manifest`, manual like `build:screenshots`): per step, one compact
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
