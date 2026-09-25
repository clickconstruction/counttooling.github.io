# Persona prompts

The prompts the persona pass runs on (PERSONA-PLAN.md), one file per role. They are the single
source: a workflow or a hand fan-out renders them with
[scripts/lib/persona-prompts.js](../lib/persona-prompts.js) and never keeps a copy of its own.

| File | Role | Reads | Model |
|---|---|---|---|
| [text.md](text.md) | the text pass: a persona reads a set's step manifest and the label index, no app | `manifest.jsonl` (or one set's manifest JSON), `labels.json` | Haiku |
| [live.md](live.md) | the live pass: a persona works ONE step through the harness, as a real reader would | the harness's answers only | Haiku |
| [prober.md](prober.md) | the prober: per doing step, the wrong thing the step should reject, and a `false-pass` finding when it passes anyway | the harness's answers only | Haiku |

```
node scripts/lib/persona-prompts.js live --persona apprentice.first-time.desktop.careful.learn --seed 2 \
  --var HARNESS=http://127.0.0.1:3490 --var SET=plumbing --var STEP=size --var OUT=<scratch>/f.jsonl
```

`--persona` and `--seed` fill `{{PERSONA_ID}}`, `{{SEED}}`, `{{WHO}}`, `{{HOW}}` and `{{DEVICE}}`
from the tables below; `--var NAME=value` fills the rest. A placeholder left unfilled is an error,
so a prompt never goes out with a hole in it. `{{FINDING_FORMAT}}` is the section below.

## Placeholders

| Name | In | What |
|---|---|---|
| `MANIFEST` | text | the manifest file: `persona-out/manifest.jsonl` (`npm run build:persona-manifest`), or one set's manifest JSON (`GET /manifest?set=`) |
| `LABELS` | text | `persona-out/labels.json` |
| `SET` | all | the set id (`GET /sets`): `plumbing`, `lesson:counting`, `course:plumbing:fixtures` |
| `STEP` | live, prober | the step id the episode opens on |
| `HARNESS` | live, prober | the harness's base URL, `http://127.0.0.1:3490` |
| `OUT` | all | the findings file (JSONL) the agent appends to, in the session's scratch folder |
| `DEVICE` | live, prober | from the persona (below), or `--var DEVICE=` for the prober (`first-timer` or `returning`) |
| `PERSONA_ID`, `SEED`, `WHO`, `HOW` | text, live | from `--persona` / `--seed`; the prober is `prober.<device>` |

## Persona kinds

A persona is a point on the axes (trade knowledge, app familiarity, device, patience, goal), never
a character. The calibration's five (2026-09-25):

| Kind | Device | Who |
|---|---|---|
| `none.first-time.desktop.skims.learn` | first-timer | You have never done a construction takeoff and never used this app. You skim: you read the numbered lines, skip the paragraphs, and act on the first control that looks right. You do not know plumbing words. |
| `apprentice.first-time.desktop.careful.learn` | first-timer | You are a second-year plumbing apprentice. You know fixtures, pipe materials and roughly what fixture units are, but you have never used this app. You read every line and do exactly what it says, in order, literally. |
| `journeyman.returning.desktop.impatient.bid-fast` | returning | You are a journeyman plumber who has bid a few jobs in this app before: your device still has your own counters, line types and sidebar search words from your last bid. You are impatient: you glance at the card, use keyboard shortcuts when one is mentioned, and expect the tour to notice what you actually did. |
| `estimator.returning.laptop.careful.check` | laptop | You are a plumbing estimator on a 1280 x 720 laptop, returning to the app with your own palette. You check every number and every label the card states against what the screen actually shows, and you notice when they differ. |
| `none.returning.tablet.skims.learn` | tablet | You are an office assistant on a tablet (touch, 768 x 1024) using a device someone else has used for bids before. You have no plumbing knowledge. You skim and tap the first thing that looks right. |

## Seeds

| Seed | How |
|---|---|
| 1 | Follow the card as written. |
| 2 | Where the card leaves a choice or is vague, make the choice a newcomer most plausibly would, even if it may be wrong. |
| 3 | Where the card mentions a keyboard key or a second way to do something, use that way. |

## Finding format

FINDING FORMAT: one JSON object per line (JSONL), exactly these keys:
{"persona":"{{PERSONA_ID}}#{{SEED}}","kind":"stall|wording|gap|code-claim|suggestion|false-pass","set":"{{SET}}","step":"<step id>","control":"<the control's label, if one>","code":"<reason code if the app showed one, else omit>","tried":"<what you did, one line>","expected":"<what you expected>","evidence":"<what you saw instead: quote the card or status line>","severity":1|2|3}
kind: stall = you could not go on; wording = the card said something the screen did not match; gap = a word, idea or step you were assumed to know; code-claim = a statement about a code or trade value you doubt (phrase it as a question; you have no rulebook, so give no ruleId); suggestion = something that would have helped; false-pass = the step passed although what you did was wrong or nothing.
"step" is the step's id (the manifest's "id", the snapshot's "id"), never its number or its title.
severity: 1 friction, 2 a detour, 3 could not finish the step.
Report only what you actually read or saw. Never invent app behaviour. No praise, no summaries, no "overall" lines.
