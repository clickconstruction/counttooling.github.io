---
id: plumb.drain.slope
title: Slope of horizontal drainage pipe
trade: plumbing
kind: code
status: draft
summary: Horizontal waste pipe falls at least 1/4 inch per foot at 2-1/2 inch and smaller, 1/8 inch per foot at 3 to 6 inch, and 1/16 inch per foot at 8 inch and larger.
values:
  - when: 2-1/2 in and smaller
    value: 1/4
    unit: in/ft
  - when: 3 in to 6 in
    value: 1/8
    unit: in/ft
  - when: 8 in and larger
    value: 1/16
    unit: in/ft
source:
  code: IPC
  section: 704.1, Table 704.1
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/content/IPC2021P1/chapter-7-sanitary-drainage
amendments: []
used_by: []
updated: 2026-09-26
---

Waste has only gravity. A horizontal drain must fall steadily toward the sewer or the solids settle out and the pipe stops, so the code sets a minimum slope by pipe size. The course's 3 and 4 inch drains fall 1/8 inch per foot: over 29 feet the far end sits 3-5/8 inches higher than the wall.

On a bid slope is depth. Under a slab every foot of horizontal waste is a foot of trench, and the trench gets deeper the farther the drain runs from the sewer; that is why an engineer runs drains the short way out.

## What the app does with it

Nothing yet: the app does not apply this rule. It is on a course card (the plumbing course, Chapter 4, "Which fixture must never drain through the interceptor?"). Bid Check has a manual row, **Slope set on every waste run**, that you tick when you have read the slope on the set; it checks nothing itself, and the app does not work out trench depth from a run's length.

## Verify against your edition

The course card says 1/8 inch per foot for 3 inch and larger. The table drops to 1/16 inch per foot at 8 inch and larger, so the card is the right figure for the course's pipe and a conservative one above 6 inch. The Uniform Plumbing Code starts from 1/4 inch per foot and allows less only where the AHJ approves it (708.1 in recent editions). A jurisdiction may set its own minimum.
