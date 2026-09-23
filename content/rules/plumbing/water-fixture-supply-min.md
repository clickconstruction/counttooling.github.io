---
id: plumb.water.fixture-supply-min
title: Minimum fixture supply pipe size
trade: plumbing
kind: code
status: applied
summary: The smallest pipe the code allows to a fixture, from 3/8 inch to a lavatory or a flush-tank water closet up to 1 inch to a flush-valve water closet.
values:
  - when: bathtub
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("bathtub")
  - when: bidet
    value: "3/8"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("bidet")
  - when: combination fixture
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("combination-fixture")
  - when: dishwasher
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("dishwasher")
  - when: drinking fountain
    value: "3/8"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("drinking-fountain")
  - when: hose bibb
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("hose-bibb")
  - when: kitchen sink
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("kitchen-sink")
  - when: laundry tray
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("laundry-tray")
  - when: lavatory
    value: "3/8"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("lavatory")
  - when: shower
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("shower")
  - when: sink flushing rim
    value: "3/4"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("sink-flushing-rim")
  - when: service sink
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("service-sink")
  - when: urinal tank
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("urinal-tank")
  - when: urinal valve
    value: "3/4"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("urinal-valve")
  - when: wall hydrant
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("wall-hydrant")
  - when: water closet tank
    value: "3/8"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet-tank")
  - when: water closet valve
    value: "1"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet-valve")
  - when: water closet flushometer tank
    value: "3/8"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet-flushometer-tank")
  - when: water closet one piece
    value: "1/2"
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet-one-piece")
source:
  code: IPC
  section: 604.5, Table 604.5
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [waterSchedule, bidCheck]
updated: 2026-09-23
---

Whatever the fixture-unit method says a branch can carry, the code sets a floor under the last pipe to each fixture, sized for the fixture's own valve: a flush valve wants a full inch behind it or it will not flush, a flushing-rim sink three quarters, a lavatory can live on three eighths. The floor applies to the fixture supply, the pipe from the branch to the fixture, not to the branch itself.

## What the app does with it

Rung 4 of the ladder: a suggestion is never smaller than the minimum for a fixture attached to the run, and rung 6 gives Bid Check a row, fixture supply minimums, that names any fixture served by a run smaller than its floor ("WC flush valve on 3/4 in; needs 1 in").

## What it does not do

The table is the fixture supply's minimum; it says nothing about the size a branch needs for the load on it, which is the demand curve's job.
