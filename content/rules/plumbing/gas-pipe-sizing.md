---
id: plumb.gas.pipe-sizing
title: Gas pipe sizing
trade: plumbing
kind: code
status: draft
summary: Each section of gas pipe is sized for the load it carries downstream, in Btu per hour, over the longest run from the meter to the farthest outlet, so like water it shrinks as it goes.
values:
  - when: what a section of gas pipe is sized by
    value: the connected load downstream of it
  - when: the length it is sized over (the longest length method)
    value: the point of delivery (the meter, on the course's job) to the most remote outlet
source:
  code: IFGC
  section: 402 Pipe sizing (402.4 sizing methods, 402.4.1 longest length)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/content/IFGC2021P1/chapter-4-gas-piping-installations
amendments: []
used_by: []
updated: 2026-09-27
---

Gas is sized by how much it has to carry and how far. Add the input ratings of the appliances a section feeds, in Btu per hour, convert that to cubic feet per hour of gas, and read the size off the code's tables at the length from the meter to the farthest appliance. Near the meter the pipe carries every appliance and is large; past each branch it carries less and steps down. On the course's restaurant the line leaves the meter at 1-1/2 inch, drops a 3/4 inch branch to the water heater, and runs on at 1-1/4 inch to the cook line.

On a bid the sizes are the engineer's, and the takeoff counts them: every size change is a reducing fitting, and every size is its own line of pipe.

## What the app does with it

Nothing yet: the app does not apply this rule. It is on a course card (the plumbing course, Chapter 6, "From the meter"). The app does not size gas pipe or check a size against a load; a gas line type is traced and counted like any other pipe.

## Verify against your edition

The table to read depends on the gas, the pipe material, the pressure and the pressure drop the design allows, and those are the engineer's choice; the heating value used to convert Btu per hour to cubic feet comes from the gas supplier. The IFGC also allows the branch length and hybrid pressure methods (402.4.2, 402.4.3). The code measures from the point of delivery, which is the meter on the course's job and, in general, the outlet of the service meter or the service regulator. The Uniform Plumbing Code sizes gas the same way in its Chapter 12. Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
