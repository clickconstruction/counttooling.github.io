---
id: elec.emergency.battery-duration
title: Emergency lighting battery duration
trade: electrical
kind: code
status: applied
summary: How long an emergency lighting source must carry its load with the normal power out, 90 minutes, which is why every exit sign and emergency light on a small job carries a battery.
values:
  - when: emergency lighting and exit signs, light with the power out (battery unit equipment)
    value: 90
    unit: min
source:
  code: NEC
  section: "700.12 (unit equipment: 700.12(F) in 2017, (I) in 2020, (H) in 2023)"
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

When the power goes out, the exit signs and the emergency lights have to keep the way out lit for an hour and a half. On a restaurant that source is almost always a battery in each fixture (unit equipment). Its branch circuit is one of two: the same circuit as the normal lighting in the area, connected ahead of any switch, or a separate circuit from the same panel as the normal lighting, whose breaker has a lock-on so nobody switches it off. The course's restaurant takes the second: circuit 21 on LP-1, with a lock-on.

On a bid that makes the Type X and Type EM fixtures more than a fixture: a battery and a test switch in each, and an unswitched circuit to each one, with the lock-on when it is a circuit of its own. The building code says where the lights go (IBC 1008, its own rule); this rule says how long they must last.

## What the app does with it

The electrical course teaches it on a card (Chapter 3, Which rooms switch themselves off?), and `check-lesson-rules` holds the card's numbers to this rule. The app counts the fixtures you mark; it does not know which are emergency or check their circuit.

## Verify against your edition

The 90 minutes (1½ hours) holds in 2017, 2020 and 2023. The unit-equipment paragraph moved letters: 700.12(F) in 2017, (I) in 2020, and in 2023 the battery-equipped luminaire is 700.12(H), which states no duration of its own. In 2017 the separate circuit was only an exception (an area fed by three or more normal lighting circuits); from 2020 it is a plain option, with the lock-on. The 2023 paragraph that states the duration for every source was read only in a secondary summary (as 700.12(C), Supply Duration); read it in a 2023 copy before citing its letter. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment. The 2023 duration paragraph is 700.12(C), Supply Duration: two secondary sources agree on the letter and the title (a continuing-education summary, and Electrical Contractor magazine's review of the 2023 changes), and the paragraph itself has not been read in the NEC.
