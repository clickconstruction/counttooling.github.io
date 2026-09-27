---
id: elec.conductor.small-protection
title: Small conductor protection
trade: electrical
kind: code
status: draft
summary: The largest breaker the code lets protect the small copper sizes, 15 A on #14, 20 A on #12 and 30 A on #10, which is why a 20 A circuit is #12.
values:
  - when: "#14 copper"
    value: 15
    unit: A
  - when: "#12 copper"
    value: 20
    unit: A
  - when: "#10 copper"
    value: 30
    unit: A
source:
  code: NEC
  section: 240.4(D)
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

The breaker protects the wire. For the three small copper sizes the code caps the breaker whatever the wire's table ampacity says: #14 at 15 A, #12 at 20 A, #10 at 30 A. So a 20 A receptacle circuit is #12, and a load of 23 A (the course's dishwasher, 4800 VA at 208 V) goes to a 30 A breaker and #10 wire.

On a bid the gauge sets the wire price and, through conduit fill, the conduit size. Going up a size for a long run is the voltage-drop question; going down a size under this cap is never an option.

## What the app does with it

Nothing yet. The electrical course teaches it on two cards (Chapter 1, Read a row, and Chapter 4, Why #12). The app reads the gauge you write in a line type's conductors, but it does not compare a circuit's breaker with its wire.

## Verify against your edition

The code lists exceptions to the cap (motor and air-conditioning circuits, among others, are protected under their own articles), and aluminum has its own figures. A tester signs the three copper rows against the adopted edition before this rule is applied.
