---
id: plumb.water.pipe-id
title: Inside diameters of water pipe by nominal size
trade: plumbing
kind: standard
status: draft
summary: The inside diameter the velocity is computed from, per nominal size, for PEX (SDR 9), copper Type L, CPVC CTS and Schedule 40 galvanized steel.
values:
  - when: PEX 1 in nominal
    value: 0.862
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["1"]
  - when: PEX 2 in nominal
    value: 1.629
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["2"]
  - when: PEX 3/8 in nominal
    value: 0.35
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["0.375"]
  - when: PEX 1/2 in nominal
    value: 0.475
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["0.5"]
  - when: PEX 3/4 in nominal
    value: 0.671
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["0.75"]
  - when: PEX 1-1/4 in nominal
    value: 1.054
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["1.25"]
  - when: PEX 1-1/2 in nominal
    value: 1.244
    unit: in
    note: ASTM F876, SDR 9
    code: water-model.js#PIPE_ID_IN.pex.sizes["1.5"]
  - when: Copper Type L 1 in nominal
    value: 1.025
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["1"]
  - when: Copper Type L 2 in nominal
    value: 1.985
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["2"]
  - when: Copper Type L 3 in nominal
    value: 2.945
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["3"]
  - when: Copper Type L 3/8 in nominal
    value: 0.43
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["0.375"]
  - when: Copper Type L 1/2 in nominal
    value: 0.545
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["0.5"]
  - when: Copper Type L 3/4 in nominal
    value: 0.785
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["0.75"]
  - when: Copper Type L 1-1/4 in nominal
    value: 1.265
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["1.25"]
  - when: Copper Type L 1-1/2 in nominal
    value: 1.505
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["1.5"]
  - when: Copper Type L 2-1/2 in nominal
    value: 2.465
    unit: in
    note: ASTM B88
    code: water-model.js#PIPE_ID_IN.copper.sizes["2.5"]
  - when: CPVC 1 in nominal
    value: 0.921
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1"]
  - when: CPVC 2 in nominal
    value: 1.739
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["2"]
  - when: CPVC 1/2 in nominal
    value: 0.489
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["0.5"]
  - when: CPVC 3/4 in nominal
    value: 0.715
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["0.75"]
  - when: CPVC 1-1/4 in nominal
    value: 1.125
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1.25"]
  - when: CPVC 1-1/2 in nominal
    value: 1.329
    unit: in
    note: ASTM D2846, CTS SDR 11
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1.5"]
  - when: Galvanized steel 1 in nominal
    value: 1.049
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1"]
  - when: Galvanized steel 2 in nominal
    value: 2.067
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["2"]
  - when: Galvanized steel 3 in nominal
    value: 3.068
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["3"]
  - when: Galvanized steel 1/2 in nominal
    value: 0.622
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["0.5"]
  - when: Galvanized steel 3/4 in nominal
    value: 0.824
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["0.75"]
  - when: Galvanized steel 1-1/4 in nominal
    value: 1.38
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1.25"]
  - when: Galvanized steel 1-1/2 in nominal
    value: 1.61
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1.5"]
  - when: Galvanized steel 2-1/2 in nominal
    value: 2.469
    unit: in
    note: ASTM A53, Schedule 40
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["2.5"]
source:
  code: ASTM
  section: F876 (PEX, SDR 9); B88 (copper Type L); D2846 (CPVC CTS, SDR 11); A53 (steel, Schedule 40)
  editions: []
  url: https://www.astm.org/
amendments: []
used_by: []
updated: 2026-09-23
---

A nominal pipe size is a name, not a bore. Half-inch PEX carries water through a hole about 0.48 inches across; half-inch Type L copper through 0.545; half-inch Schedule 40 steel through 0.622. Velocity is flow divided by area, so the size suggestion has to know the bore of the material the line type is made of, and the standard each material is made to sets it.

## What the app does with it

The material is read off the line type's name the way the hanger rule reads it (*3/4in PEX hot*, *1in Cu*, *3/4in CPVC*, *2in galv*), the nominal size the same way, and the inside diameter comes from this table. Velocity at a candidate size is 0.4085 × gpm ÷ (inside diameter in inches)². PEX bores are the manufacturers' published averages for SDR 9 tube; CPVC is CTS tube to D2846 (SDR 11 with the standard's minimum wall at 1/2 in); copper is Type L; steel is Schedule 40.

## What it does not do

It does not know Type K or Type M copper, PEX-AL-PEX, or stainless: a line type in one of those gets no velocity and no suggestion until the table grows a row.
