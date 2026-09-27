---
id: hvac.exhaust.hood-makeup-air
title: Make-up air for a kitchen hood
trade: hvac
kind: code
status: draft
summary: A commercial kitchen hood that exhausts air needs make-up air brought in to replace it, delivered while the hood runs and interlocked with its exhaust fan, so a hood on a plan means a second unit, its duct and its controls on the bid.
values:
  - when: a commercial kitchen hood exhausting air, make-up air to replace it (508.1)
    value: required
  - when: the make-up air unit against the hood's exhaust fan, started and run together (508.1)
    value: interlocked
  - when: make-up air tempered to within a set difference of the room it enters (508.1.1, 10°F in the model code, with exceptions)
    value: required
source:
  code: IMC
  section: 508.1 Makeup air (interlock) and 508.1.1 Makeup air temperature
  editions: [2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-5-exhaust-systems
amendments:
  - jurisdiction: Minnesota
    note: Rule 1346.0508 amends the temperature limit to make-up air not less than 50°F at the diffuser.
used_by: []
updated: 2026-09-27
---

A hood pulls a great deal of air out of one room. On the course's restaurant EF-1 takes 2,400 CFM out of a kitchen that the rooftop unit feeds 800, and that air has to come from somewhere. The code's answer is make-up air: outside air supplied to replace what the hood exhausts, running whenever the hood does. Leave it out and the kitchen goes negative: doors pull hard, the hood spills smoke instead of capturing it, and the gas appliances starve for combustion air.

On a bid it is the line that gets forgotten, because it is a second unit (the make-up air unit, tempered so the cooks are not standing in a winter draft), its own duct and register, and an interlock so it starts with the exhaust fan. The interlock is controls wiring, and whose wiring it is belongs in an RFI with the electrician.

The requirement is also a balance for the whole building, not the hood alone: 508.1 wants the make-up air from all sources to be about equal to the exhaust from all exhaust systems. So the balance a mechanical plan prints is outside air in (the rooftop units' outdoor air plus the make-up air) against exhaust out, never supply against exhaust: a rooftop unit's supply is mostly the building's own air going round again.

## What the app does with it

Nothing automatic yet. You count the make-up air unit and its register and trace its duct like any supply run, and they price on the Duct Schedule with the rest. The make-up air unit is its own system, with its own capacity: none of its air belongs on the rooftop unit's. Bid Check's Controls row is where you say who owns the interlock. The app does not compare a hood's exhaust with the make-up air you traced.

## Verify against your edition

The interlock is in 508.1 itself (Minnesota's Rule 1346.0508 quotes it as "electrically interlocked"; Illinois' 2024 adoption says the make-up air is automatically controlled to start and operate with the exhaust). The temperature limit is 508.1.1: not more than 10°F from the space in the model code, with exceptions, and some states amend it (Minnesota, above). The 2024 IMC adds 508.1.2 (make-up air ducts) and 508.1.3 (the air balance shown on the plans). Local amendments still govern: check your adopted edition and any state change to the temperature limit, since that decides whether the make-up unit is tempered and what it costs.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
