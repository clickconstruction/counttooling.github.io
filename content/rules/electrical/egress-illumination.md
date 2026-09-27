---
id: elec.egress.illumination
title: Means of egress illumination on emergency power
trade: electrical
kind: code
status: applied
summary: The building code's side of the exit lights: the path out stays lit on emergency power for 90 minutes when the normal power fails.
values:
  - when: egress path lighting on emergency power, light with the power out
    value: 90
    unit: min
source:
  code: IBC
  section: "1008.3.4"
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [course]
updated: 2026-09-27
---

The building code decides that the way out of a restaurant must stay lit when the power fails, and for how long: the aisles, the corridors and the exits, on an emergency source, for 90 minutes. The electrical code then says how that source is built (NEC 700.12, its own rule).

On a bid it is the reason the emergency fixtures are on the plan at all, and the reason an architect's egress plan can add some the electrical sheets left off.

## What the app does with it

The electrical course teaches it on a card (Chapter 3, Which rooms switch themselves off?), and `check-lesson-rules` holds the card's numbers to this rule. The app counts the fixtures you mark; it does not check an egress path's lighting.

## Verify against your edition

Section 1008.3 says which rooms and buildings need emergency egress lighting (1008.3.1 to 1008.3.3); the 90 minutes is 1008.3.4, Duration, by storage batteries, unit equipment or an on-site generator; 1008.3.5 sets the illumination the path keeps on emergency power. The 2021 numbering was read in a state adoption of the 2021 IBC; the 2018 numbering rests on search-result text. Exit signs carry their own 90 minutes in 1013. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
