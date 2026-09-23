---
id: plumb.water.fixture-supply-min
title: Minimum fixture supply pipe sizes
trade: plumbing
kind: code
status: applied
summary: The smallest pipe that may supply each fixture, 3/8 inch for a lavatory or a tank water closet up to 1 inch for a flush-valve water closet.
values:
  - when: Bathtub
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("bathtub")
  - when: Bidet
    value: 3/8
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("bidet")
  - when: Combination sink and tray
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("combination-fixture")
  - when: Dishwasher, domestic
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("dishwasher")
  - when: Drinking fountain
    value: 3/8
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("drinking-fountain")
  - when: Hose bibb
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("hose-bibb")
  - when: Kitchen sink
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("kitchen-sink")
  - when: Laundry, 1, 2 or 3 compartments
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("laundry-tray")
  - when: Lavatory
    value: 3/8
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("lavatory")
  - when: Shower, single head
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("shower")
  - when: Sink, flushing rim
    value: 3/4
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("flushing-rim-sink")
  - when: Sink, service
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("service-sink")
  - when: Urinal, flush tank
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("urinal", "flush-tank")
  - when: Urinal, flush valve
    value: 3/4
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("urinal", "flush-valve")
  - when: Wall hydrant
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("wall-hydrant")
  - when: Water closet, flush tank
    value: 3/8
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet", "flush-tank")
  - when: Water closet, flush valve
    value: 1
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet", "flush-valve")
  - when: Water closet, flushometer tank
    value: 3/8
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet", "flushometer-tank")
  - when: Water closet, one piece
    value: 1/2
    unit: in
    code: water-model.js#fixtureSupplyMinLabel("water-closet", "one-piece")
source:
  code: IPC
  section: 604.4, Table 604.4
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [waterSchedule]
updated: 2026-09-23
---

Whatever the fixture-unit arithmetic says, a fixture's supply pipe has a floor. A flush-valve water closet needs a 1-inch supply because the valve draws hard and briefly; a lavatory's 3/8-inch stop and riser are enough for its faucet. The floor is on the pipe to the fixture, and it applies from the branch to the stop.

## What the app does with it

When a fixture is attached to a water run (rung 3 of the water-sizing ladder), the run's size is compared with the floor for that fixture; a branch smaller than its fixture allows is flagged ⚠ in the Water Sizing schedule and named in Bid Check's **Fixture supply minimums** row (*"WC flush valve on 3/4 in; needs 1 in"*, rung 6). The size suggestion never offers a size under a served fixture's floor.

## What it does not do

It does not size the fixture's own supply riser or stop; those are counted with the fixture. The code also caps how far the fixture supply may run past its stop (30 inches); the app does not measure that.
