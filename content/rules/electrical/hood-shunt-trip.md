---
id: elec.hood.shunt-trip
title: Shunt trip on hood suppression
trade: electrical
kind: standard
status: draft
summary: When a kitchen hood's fire-suppression system fires, the electric power to the cooking equipment under it shuts off by itself, usually through a shunt-trip breaker wired to the system.
values:
  - when: the hood's fire-suppression system discharges
    value: power to the cooking equipment under the hood shuts off automatically
source:
  code: NFPA 96
  section: 10.4.1
  editions: [2017, 2021, 2024]
  url: https://www.nfpa.org/codes-and-standards/nfpa-96-standard-development/96
amendments: []
used_by: []
updated: 2026-09-26
---

A grease fire under a hood is put out by the hood's own suppression system, and the fire must not be fed while it does. So the standard shuts off the fuel and the electric power that heat the cooking equipment the system protects. On the electrical side that is a shunt-trip breaker, one that opens on a signal, wired to a contact in the suppression system. The plumbing course meets the same rule on the gas valve.

On a bid the breaker is the easy part. The interlock wiring between the suppression panel and the shunt trip falls between the electrician, the hood supplier and the fire protection contractor, and when the drawings do not say who does it, it is an RFI before the bid, not a surprise at inspection.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 6, The breaker the hood trips), where the reader writes the RFI as a note. The app counts the breaker as a device if you mark it; it does not know which circuits are under a hood.

## Verify against your edition

The standard speaks of the power that produces heat to the protected equipment; whether receptacles for plug-in cooking appliances under the hood are on the shunt trip is the engineer's and the authority's reading (the course's circuit 12 puts them on it, the common and conservative reading). A tester signs the section number and that reading against the adopted edition before this rule is applied.

Left open 2026-09-27, when the other electrical drafts were settled: the research (TESTER-DOSSIER-ELECTRICAL, S11) found 10.4.1 quoted for the 2017 and 2024 editions on Mike Holt's forum and NFPA Xchange, and the same Fuel and Electric Power Shutoff title in 2021 and 2024 on UpCodes, with 10.4.2 exempting steam from an outside source and 10.4.4 wanting a manual reset. NFPA 96 itself was not opened, so this rule stays a draft until someone reads 10.4.1 in the standard.
