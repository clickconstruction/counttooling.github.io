# The courses' language, read for someone who has never estimated

Todd's question (2026-09-27): the courses teach people who do not know how to estimate, and
the words feel advanced. Should the language be simpler? This is the read, with numbers, and
three ways to answer it. Todd picks; the edits then land as one batch walked by the course specs.

## The measurement first

Every card's `body`, `reveal` and `done` text was pulled out of the three course files and
scored (the script is in the session scratchpad; it can become `scripts/score-courses.js`).

| Course | Words | Cards | Reading grade | Words per sentence | Sentences over 25 words |
|---|---:|---:|---:|---:|---:|
| Plumbing | 4,272 | 64 | 4.4 | 12.9 | 36 |
| Electrical | 3,398 | 49 | 5.8 | 13.5 | 34 |
| HVAC | 3,468 | 44 | 5.1 | 14.4 | 35 |

The grade is a Flesch-Kincaid figure: fourth to sixth grade. The sentences are short and the
words are short. **The prose is not the problem.** A card like "Click the two water closets"
reads at grade 2. What makes the courses feel advanced is something the grade does not see:
how many trade and app words a chapter uses before it says what they mean.

| Course | Chapter 1 introduces | Undefined on first use (examples) |
|---|---:|---|
| Plumbing | 17 terms | takeoff, bid, title block, legend, schedule, RFI, WSFU and DFU are defined, the rest are not |
| Electrical | 18 terms | homerun, conduit, conductor, ampacity, VA, poles, one-line, 208Y/120 V, panel schedule |
| HVAC | 14 terms | CFM (25 uses, never spelled out), static pressure, tempered, interlocked, roof key, make-up |

Each course opens with its densest chapter: the first six cards carry a fifth of the course's
new vocabulary, most of it in the first read-card's REVEAL, before the reader has clicked once.

## The four patterns

**1. First uses with no gloss.** The courses define some terms well (WSFU and DFU get a
sentence each; a keynote, a wet wall, a grease duct, a trap arm, a roof key are all explained
where they appear). But the words a newcomer most needs are the ones assumed: *takeoff* is
never defined in any course, *bid* is used as a noun for the estimate from the first card,
*homerun* appears in the electrical course's first reveal four chapters before its card
explains it, *CFM* is never expanded. Acronyms used without ever being spelled out:

- Plumbing: RFI (8 uses), GC (3), PVC (11), HWR, SS, GW, BTU.
- Electrical: RFI, GC, VA (3), THHN (6), EMT (14), MDP.
- HVAC: CFM (25), ESP (3), OA (3), RFI, GC, UL.

**2. The answer before the instruction.** The courses deliberately open most doing cards
with the answer to the previous card's question, then give the steps. It is a good teaching
rhythm for someone who knows the trade and reads the paragraph as a payoff. A first-timer
reads it as a wall: the plumbing gas chapter's hanger card is 55 words about RFI flags and the
ledger before its first numbered line, and the water chapter's chain card is 62 words about the
hot-water return (a pump, a check valve, a balancing valve, the Food Code's 100 °F) before
"Click Chain". Twenty-two of the 157 cards lead with 40 words or more of reasoning before step 1.

**3. The long sentences.** About 35 per course run past 25 words, and the worst are the
reveals: the HVAC static-path reveal has a 62-word sentence, the electrical mount-heights
reveal a 48-word list of code sections, the plumbing grease-line card a 48-word sentence with a
semicolon in the middle. Each of these carries two or three ideas that read fine as two or three
sentences.

**4. Estimator idiom.** Phrases that are the voice of the courses and also a barrier: "the
change order you eat", "a foot the bid does not carry", "priced by the foot and the depth",
"a callback", "on the third addendum", "the GC's question", "TYP. is the engineer saving ink".
They are the best lines in the courses for a plumber. For a newcomer each one is a small
puzzle, and there are a few per chapter.

What is NOT a problem: the trade reasoning itself. The persona pass and the four tester dossiers
found the content mostly right, and a course that only said "click here" would teach nothing.
The fix is to keep the reasoning and carry the reader into it.

## Three ways to answer Todd's question

**A. Gloss on first use (light).** Every trade or app word gets two to six words the first time
it appears in each course: "a takeoff (the count and the feet the price is built on)", "CFM,
cubic feet per minute", "an RFI, a written question to the designer", "the GC, the general
contractor". Acronyms spelled out once. The Learn guide's "Words the cards use" list grows to
hold them all, and chapter 1's first card links to it. Nothing moves. About 40 glosses per
course, one commit each, no spec changes except the pinned card texts.

**B. Gloss, lead with the steps, split the long sentences (medium).** A plus: every doing card
opens with its numbered steps, and the previous question's answer moves above them under one
word, "Answer:", or into the read-card that asked; the 30-odd sentences over 25 words become two
or three each; the idioms stay but each gets its plain twin once ("a change order, the extra the
owner pays when the drawing was wrong"). This is the version I recommend. It keeps the voice,
costs one pass through 157 cards, and every card still says what it says now.

**C. Rewrite for someone who has never seen a plan (heavy).** B plus a new chapter 0 per course
(what a set is, what an estimator does with it, what the app's four verbs mean: count, trace,
chain, check), and the fixtures, fittings and equipment themselves defined (what a lavatory is,
what a J-box does, what a diffuser is). Doubles the reading time of chapter 1 and changes what
the persona harness and the course specs walk. Worth it only if the reader is truly outside the
trade; a new hire at a plumbing contractor knows what a lavatory is and does not know WSFU.

The one question that decides between B and C: who is the reader? If it is a new estimator at a
trade contractor (knows the fixtures, not the numbers), B. If it is anyone at all (a
salesperson, a spouse, a student), C.

## What to hold once it lands

- A first-use list in the scoring script: the trade and app terms a course may use, each with the
  chapter that defines it. A term used before its chapter fails the script, the way
  `check-lesson-rules` fails a number beside an unnamed rule. It would join `npm run check`.
- The grade stays where it is (4 to 6); the sentence cap becomes 25 words on a card body.
- The Learn guide's glossary is the one list; every gloss on a card matches it.

**Landed (2026-09-27, wave 2, claude/plain-glossary).** The Learn guide's "Words the cards use" is
the one list, 278 entries grouped by the set, the estimator, the codes, the building, each trade and
the app. `scripts/score-courses.js` (`npm run check:courses`, and `check-courses` in `npm run check`)
holds the three courses, the four tours and the thirteen lessons to it: the 25-word sentence cap,
grade 6 at most, a `FIRST_USE` table per entry (each word and the chapter, or for a tour the card,
that glosses it, a use before it failing unless `EARLY` lists it as another sense of the word) and
every such word in the guide's list. Grades: plumbing 3.7, electrical 4.9, HVAC 4.1, the tours 3.4
to 3.8, the lessons 3.7; no sentence over 25 words.

## Not in this read

The five-minute tours and the thirteen lessons were not scored; they are shorter and were
walked by the persona pass. The plain-language pass should cover them in the same batch only if
Todd picks C.
