---
id: elec.vertical.make-up
title: Make-up on a vertical
trade: electrical
kind: convention
status: applied
summary: The foot of conduit the app adds to every vertical it writes, for the box entry and the bend that plan view never shows.
values:
  - when: every device vertical the Chain tool writes
    value: 1
    unit: ft
    code: constants.js#DEFAULT_MAKE_UP_FT
source:
  code: trade practice
  section: estimating convention; not a code figure
  editions: []
amendments: []
used_by: [chain]
updated: 2026-09-09
---

A vertical from the ceiling to a device is not just ceiling minus mount height. There is the bend at the top, the box entry, and the couple of inches of slack every electrician leaves. Estimators cover it with a flat make-up per drop; a foot is the common figure.

## What the app does with it

The Chain tool writes `ceiling − mount height + make-up` as the drop on every run it draws to a device with a mount height. The make-up sits next to the ceiling height in Project Settings, so a shop that uses 18 inches can say so once per project.
