---
id: elec.emt.bends
title: EMT bends between pull points
trade: electrical
kind: code
status: applied
summary: A run of EMT may turn no more than 360° in total between pull points, the equal of four quarter bends, so a run with more needs a box or conduit body in it.
values:
  - when: total of the bends in one run, box to box or pull point to pull point
    value: 360
    unit: ° of bends
source:
  code: NEC
  section: "358.26"
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

Wire is pulled through conduit, and every bend adds to the pull. So the code caps the bends between two places a wire can be pulled from: 360° in total, four quarter bends, and past that the run needs a pull point, a box or a conduit body, in the middle.

On a bid it is the fittings a plan never shows. The floor plan draws a run as a line; the electrician bends it around beams, ducts and the corner, and a long run with several offsets carries a pull box or two the drawings do not.

## What the app does with it

The electrical course teaches it on a card (Chapter 9, What the manual rows mean), and `check-lesson-rules` holds the card's numbers to this rule. Bid Check carries it as a manual row you tick once you have looked. The app does not count bends.

## Verify against your edition

358.26 counts the bends between pull points, such as conduit bodies and boxes: the equal of four quarter bends, 360° in total. The same limit is written into each raceway's article (rigid, IMC, PVC and the rest); this rule is the EMT one the card cites. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
