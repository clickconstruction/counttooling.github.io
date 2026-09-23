---
id: plumb.wsfu.fixtures
title: Water supply fixture units by fixture
trade: plumbing
kind: code
status: draft
summary: The load each fixture puts on the water supply, in water supply fixture units (WSFU), by public or private occupancy, with the cold and hot split the sizing needs.
values:
  - when: bathroom group, flush tank, private
    value: 3.6
    unit: WSFU
    note: cold 2.7 · hot 1.5
    code: water-model.js#WSFU_FIXTURES.bathroom-group-tank.private.total
  - when: bathroom group, flush valve, private
    value: 8
    unit: WSFU
    note: cold 6 · hot 3
    code: water-model.js#WSFU_FIXTURES.bathroom-group-valve.private.total
  - when: bathtub, public
    value: 4
    unit: WSFU
    note: cold 3 · hot 3
    code: water-model.js#WSFU_FIXTURES.bathtub.public.total
  - when: bathtub, private
    value: 1.4
    unit: WSFU
    note: cold 1 · hot 1
    code: water-model.js#WSFU_FIXTURES.bathtub.private.total
  - when: bidet, private
    value: 2
    unit: WSFU
    note: cold 1.5 · hot 1.5
    code: water-model.js#WSFU_FIXTURES.bidet.private.total
  - when: combination fixture, private
    value: 3
    unit: WSFU
    note: cold 2.25 · hot 2.25
    code: water-model.js#WSFU_FIXTURES.combination-fixture.private.total
  - when: dishwashing machine, private
    value: 1.4
    unit: WSFU
    note: cold 0 · hot 1.4
    code: water-model.js#WSFU_FIXTURES.dishwasher.private.total
  - when: drinking fountain, public
    value: 0.25
    unit: WSFU
    note: cold 0.25 · hot 0
    code: water-model.js#WSFU_FIXTURES.drinking-fountain.public.total
  - when: kitchen sink, public
    value: 4
    unit: WSFU
    note: cold 3 · hot 3
    code: water-model.js#WSFU_FIXTURES.kitchen-sink.public.total
  - when: kitchen sink, private
    value: 1.4
    unit: WSFU
    note: cold 1 · hot 1
    code: water-model.js#WSFU_FIXTURES.kitchen-sink.private.total
  - when: laundry trays (1 to 3), private
    value: 1.4
    unit: WSFU
    note: cold 1 · hot 1
    code: water-model.js#WSFU_FIXTURES.laundry-tray.private.total
  - when: lavatory, public
    value: 2
    unit: WSFU
    note: cold 1.5 · hot 1.5
    code: water-model.js#WSFU_FIXTURES.lavatory.public.total
  - when: lavatory, private
    value: 0.7
    unit: WSFU
    note: cold 0.5 · hot 0.5
    code: water-model.js#WSFU_FIXTURES.lavatory.private.total
  - when: service sink, public
    value: 3
    unit: WSFU
    note: cold 2.25 · hot 2.25
    code: water-model.js#WSFU_FIXTURES.service-sink.public.total
  - when: shower head, public
    value: 4
    unit: WSFU
    note: cold 3 · hot 3
    code: water-model.js#WSFU_FIXTURES.shower.public.total
  - when: shower head, private
    value: 1.4
    unit: WSFU
    note: cold 1 · hot 1
    code: water-model.js#WSFU_FIXTURES.shower.private.total
  - when: urinal, 1 in flush valve, public
    value: 10
    unit: WSFU
    note: cold 10 · hot 0
    code: water-model.js#WSFU_FIXTURES.urinal-valve-1in.public.total
  - when: urinal, 3/4 in flush valve, public
    value: 5
    unit: WSFU
    note: cold 5 · hot 0
    code: water-model.js#WSFU_FIXTURES.urinal-valve-3-4in.public.total
  - when: urinal, flush tank, public
    value: 3
    unit: WSFU
    note: cold 3 · hot 0
    code: water-model.js#WSFU_FIXTURES.urinal-tank.public.total
  - when: washing machine (8 lb), public
    value: 3
    unit: WSFU
    note: cold 2.25 · hot 2.25
    code: water-model.js#WSFU_FIXTURES.washing-machine-8lb.public.total
  - when: washing machine (8 lb), private
    value: 1.4
    unit: WSFU
    note: cold 1 · hot 1
    code: water-model.js#WSFU_FIXTURES.washing-machine-8lb.private.total
  - when: washing machine (15 lb), public
    value: 4
    unit: WSFU
    note: cold 3 · hot 3
    code: water-model.js#WSFU_FIXTURES.washing-machine-15lb.public.total
  - when: water closet, flush valve, public
    value: 10
    unit: WSFU
    note: cold 10 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-valve.public.total
  - when: water closet, flush valve, private
    value: 6
    unit: WSFU
    note: cold 6 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-valve.private.total
  - when: water closet, flush tank, public
    value: 5
    unit: WSFU
    note: cold 5 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-tank.public.total
  - when: water closet, flush tank, private
    value: 2.2
    unit: WSFU
    note: cold 2.2 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-tank.private.total
  - when: water closet, flushometer tank, public
    value: 2
    unit: WSFU
    note: cold 2 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-flushometer-tank.public.total
  - when: water closet, flushometer tank, private
    value: 2
    unit: WSFU
    note: cold 2 · hot 0
    code: water-model.js#WSFU_FIXTURES.water-closet-flushometer-tank.private.total
source:
  code: IPC
  section: Appendix E, Table E103.3(2)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: []
updated: 2026-09-23
---

A water supply fixture unit is not a gallon. It is a weight the method gives each fixture for how often it runs and how hard it draws, so that a hundred lavatories are never sized as if all hundred ran at once. A public lavatory carries more than a private one because it is used more; a flush valve carries far more than a flush tank because it draws its water in a rush. The total column is the diversified figure the method adds up before it turns the sum into gallons; the cold and hot columns are what each side of the system actually carries.

## What the app will do with it

Rung 2 of the water-sizing ladder (WATER-PLAN.md §6): a counter on a plumbing project gets a WSFU field the rulebook fills from the counter's name, in the column the project's occupancy picks (Project Settings, beside the code editions; public is the default on a commercial bid), with a chip naming this rule and the value it read. Type over it and the counter keeps yours; a placed mark can carry its own override. A fixture the table does not list, a hose bibb, a floor drain, a grease interceptor, gets no prefill: a hose bibb is a continuous demand the method adds separately, and a drain draws nothing.

## What it does not do

The table is the IPC's Appendix E, a method the code offers rather than requires; the Uniform Plumbing Code carries its own table (UPC Table 610.3) with different figures for some fixtures. The app applies this table whichever edition the project names, and the rule chip says so when the project follows the UPC.
