---
id: hvac.duct.grease-duct
title: Grease duct metal and its weight
trade: hvac
kind: code
status: applied
summary: A commercial kitchen hood's exhaust duct is welded carbon steel of at least 16 gauge or stainless of at least 18 gauge, never the galvanized gauge schedule, so the Duct tool prices a grease run at that fixed gauge and its own sheet weight.
values:
  - when: carbon steel (black steel), minimum gauge
    value: 16
    unit: ga
    code: duct-model.js#DUCT_MATERIALS["black-steel"].gauge
  - when: stainless steel, minimum gauge
    value: 18
    unit: ga
    code: duct-model.js#DUCT_MATERIALS["stainless"].gauge
  - when: 16 gauge carbon steel sheet
    value: 2.5
    unit: lb/ft²
    code: duct-model.js#DUCT_MATERIALS["black-steel"].lbPerSqFt
  - when: 18 gauge stainless sheet
    value: 2.0
    unit: lb/ft²
    code: duct-model.js#DUCT_MATERIALS["stainless"].lbPerSqFt
source:
  code: IMC
  section: 506.3.1.1 Grease duct materials (NFPA 96 7.5.1 says the same)
  editions: [2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-5-exhaust-systems
amendments: []
used_by: [ductSchedule]
updated: 2026-09-21
---

A grease duct is a chimney for a fire. The code fixes its metal: carbon steel not less than 0.055 in (16 gauge) or stainless not less than 0.044 in (18 gauge), joints continuously welded liquid-tight, cleanouts at changes of direction, and no damper of any kind inside it. The SMACNA gauge schedule the Duct tool carries is for galvanized supply, return and general exhaust at low pressure; it would call an 18 in round at 1 in w.g. 24 gauge and weigh it at about half what the welded duct weighs.

## What the app does with it

A duct run has a material: galvanized by default, or welded black steel or welded stainless from the Duct dialog or the run's right-click menu. A grease run tallies on its own row of the Duct Schedule at the fixed gauge above and the sheet weight above, with its fittings priced the same way, and the per-size gauge override never touches it. The cleanouts, the listed wrap or enclosure and the welding labor are not sheet metal by the pound; they are a line of their own in the bid.
