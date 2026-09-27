---
id: elec.emt.support
title: EMT support spacing
trade: electrical
kind: code
status: draft
summary: Where EMT is strapped, within 3 ft of every box or termination and at least every 10 ft along the run, which is the strap count on a takeoff.
values:
  - when: from each box or other termination
    value: 3
    unit: ft
  - when: between straps on the run
    value: 10
    unit: ft
source:
  code: NEC
  section: 358.30(A)
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

EMT is fastened near every place it ends and at a fixed interval between: within 3 ft of each box or other termination, and no more than 10 ft apart along the run. On a takeoff that is a strap per 10 ft of conduit, plus the ones at the ends of each run.

On a bid a strap is cheap and the labor to set it is not, and they add up by the hundred on a job with any conduit, so they belong in the count rather than in a guess.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 4, A support row of your own), where the reader writes a Strap row under the conduit line type's Child counts by hand. The app does not yet offer the row the way it offers hangers for pipe.

## Verify against your edition

The code allows longer spans in some framing and at some terminations, and a specification may ask for tighter spacing. A tester signs the 3 ft and 10 ft against the adopted edition before this rule is applied.
