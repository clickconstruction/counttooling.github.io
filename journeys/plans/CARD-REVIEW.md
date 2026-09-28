# The card review: ten rules for every teaching card (2026-09-27)

Will walked lesson 0 card by card on 2026-09-27 and found the same kinds of fault on each. The
language check (scripts/score-courses.js) holds a card's words; nothing held these. They are the
standard a tour, lesson or course card is reviewed against.

Read every card as a first-time reader who sees only the screen.

1. **Nothing is said twice.** The card does not repeat the screen before it, its own title, or
   itself. A title can carry the definition ("The header, the bar across the top"); the body then
   starts with what the thing does.
2. **It has one job.** Say what the card is for in one sentence. What does not serve it goes.
3. **It does not state the obvious.** One button on the card: do not say to click it.
4. **Everything it names, it shows.** A control is written `[[Name]]` (the chip wears the control's
   icon and a click lights the control). A sidebar section is written in capitals, alone (`PAGES`,
   `BID CHECK`: it is set in the sidebar's style and a click lights the heading). A phrase that
   refers to a part of the screen with no one name is a pointer, `{{turns the pages|.page-nav}}`.
5. **Everything it talks about is lit.** A card about two areas lights both (`lightAll: true`, with
   both in `target`).
6. **Nothing it suggests can fail.** No key or click that brings up an error or a warning at that
   moment (a tool key before the sheet has a scale).
7. **It teaches by doing something useful.** A real skill over a description of how cards work.
8. **It speaks to this reader.** One key, for their machine. A tablet has no keys: the engine drops
   "(or press X)" asides and any numbered step that starts "Press" on touch, so a step a touch
   reader needs is written for them too.
9. **Plain words.** A word the entry has not explained does not appear, not in a hint either.
10. **It moves gently.** No jump of zoom or place that loses the reader (the engine glides).

A fix is applied when the rule is clear and the change is wording or presentation. A change to
WHAT is taught (a number, a trade fact, the order of a course, a step's check) is the owner's: it
goes on a list.

Checked on screen, not only in the text: the card open in the app, every chip clicked, the right
thing lit.
