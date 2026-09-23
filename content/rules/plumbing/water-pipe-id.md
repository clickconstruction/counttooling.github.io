---
id: plumb.water.pipe-id
title: Inside diameters of water pipe
trade: plumbing
kind: standard
status: draft
summary: The inside diameter behind each nominal size, for PEX, Type L copper, CPVC and Schedule 40 galvanized steel, which is what turns a flow into a velocity.
values:
  - when: 3/8 in PEX, CTS SDR 9
    value: 0.35
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["3/8"]
  - when: 1/2 in PEX, CTS SDR 9
    value: 0.475
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["1/2"]
  - when: 3/4 in PEX, CTS SDR 9
    value: 0.671
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["3/4"]
  - when: 1 in PEX, CTS SDR 9
    value: 0.862
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["1"]
  - when: 1-1/4 in PEX, CTS SDR 9
    value: 1.054
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["1-1/4"]
  - when: 1-1/2 in PEX, CTS SDR 9
    value: 1.244
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["1-1/2"]
  - when: 2 in PEX, CTS SDR 9
    value: 1.629
    unit: in
    code: water-model.js#PIPE_ID_IN.pex.sizes["2"]
  - when: 3/8 in copper tube, Type L
    value: 0.43
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["3/8"]
  - when: 1/2 in copper tube, Type L
    value: 0.545
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["1/2"]
  - when: 3/4 in copper tube, Type L
    value: 0.785
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["3/4"]
  - when: 1 in copper tube, Type L
    value: 1.025
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["1"]
  - when: 1-1/4 in copper tube, Type L
    value: 1.265
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["1-1/4"]
  - when: 1-1/2 in copper tube, Type L
    value: 1.505
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["1-1/2"]
  - when: 2 in copper tube, Type L
    value: 1.985
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["2"]
  - when: 2-1/2 in copper tube, Type L
    value: 2.465
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["2-1/2"]
  - when: 3 in copper tube, Type L
    value: 2.945
    unit: in
    code: water-model.js#PIPE_ID_IN.copper.sizes["3"]
  - when: 1/2 in CPVC, CTS SDR 11
    value: 0.489
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1/2"]
  - when: 3/4 in CPVC, CTS SDR 11
    value: 0.715
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["3/4"]
  - when: 1 in CPVC, CTS SDR 11
    value: 0.921
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1"]
  - when: 1-1/4 in CPVC, CTS SDR 11
    value: 1.125
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1-1/4"]
  - when: 1-1/2 in CPVC, CTS SDR 11
    value: 1.329
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["1-1/2"]
  - when: 2 in CPVC, CTS SDR 11
    value: 1.739
    unit: in
    code: water-model.js#PIPE_ID_IN.cpvc.sizes["2"]
  - when: 1/2 in galvanized steel, Schedule 40
    value: 0.622
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1/2"]
  - when: 3/4 in galvanized steel, Schedule 40
    value: 0.824
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["3/4"]
  - when: 1 in galvanized steel, Schedule 40
    value: 1.049
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1"]
  - when: 1-1/4 in galvanized steel, Schedule 40
    value: 1.38
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1-1/4"]
  - when: 1-1/2 in galvanized steel, Schedule 40
    value: 1.61
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["1-1/2"]
  - when: 2 in galvanized steel, Schedule 40
    value: 2.067
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["2"]
  - when: 2-1/2 in galvanized steel, Schedule 40
    value: 2.469
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["2-1/2"]
  - when: 3 in galvanized steel, Schedule 40
    value: 3.068
    unit: in
    code: water-model.js#PIPE_ID_IN.galvanized.sizes["3"]
source:
  code: ASTM
  section: F876 (PEX, CTS SDR 9), B88 (copper tube, Type L), D2846 (CPVC, CTS SDR 11); ASME B36.10 (Schedule 40 steel)
  editions: []
amendments: []
used_by: []
updated: 2026-09-23
---

A nominal size is a name, not a measurement. Half-inch PEX has a bore under half an inch; half-inch Schedule 40 steel has a bore over it; and the same flow runs a third faster in the PEX. The velocity cap can only be applied to the true bore, so the app carries the dimension tables the materials are made to. PEX and CPVC bores are the makers' published averages for the standard's wall (the standards fix a minimum wall, so a bore varies a little by maker); copper and steel are the standards' own dimensions.

## What the app will do with it

Rung 4 of the ladder: velocity is the design flow over the bore's area, and the material comes from the line type's name the way the hanger rule already reads it (PEX, Cu or Type L, CPVC, galvanized). A material the table does not carry (PP-R, stainless, lead) gets no suggestion.

## What it does not do

Type K and Type M copper have their own walls and are read as Type L here; the difference in bore is a few hundredths of an inch, inside the spread between one PEX maker and another.
