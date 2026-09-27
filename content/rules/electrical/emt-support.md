---
id: elec.emt.support
title: EMT support spacing
trade: electrical
kind: code
status: applied
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
used_by: [course]
updated: 2026-09-27
---

EMT is fastened near every place it ends and at a fixed interval between: within 3 ft of each box or other termination, and no more than 10 ft apart along the run. On a takeoff that is a strap per 10 ft of conduit, plus the ones at the ends of each run.

On a bid a strap is cheap and the labor to set it is not, and they add up by the hundred on a job with any conduit, so they belong in the count rather than in a guess.

## What the app does with it

The electrical course teaches it on a card (Chapter 4, A support row of your own), where the reader writes a Strap row under the conduit line type's Child counts by hand, and `check-lesson-rules` holds the card's numbers to this rule. The app does not yet offer the row the way it offers hangers for pipe.

## Verify against your edition

358.30(A): fastened within 3 ft of each box, cabinet, conduit body or other termination, and at least every 10 ft. Its exceptions allow 5 ft from a termination where the framing will not take a fastener within 3 ft, and unbroken lengths fished into finished work; a specification may ask for tighter spacing. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
