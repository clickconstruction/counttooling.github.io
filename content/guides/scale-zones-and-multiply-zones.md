---
title: Scale zones and multiply zones
description: Handle multi-scale sheets and repeated areas — give a region its own scale, or multiply everything inside a boundary so typical floors and units count correctly.
updated: 2026-06-09
order: 5
category: Working with plans
---

Real plan sets aren't always one clean scale per sheet. Two tools handle the awkward cases without making you re-do the whole page.

## Scale zones — for multi-scale sheets

A sheet often has the main plan at one scale and a blown-up detail or isometric at another. A **scale zone** lets a region carry its own scale:

1. Draw a scale-zone rectangle around the detail.
2. Give that zone its own scale (the same way you'd [set the page scale](/guides/setting-the-scale/)).

Any line fully inside the zone is measured with the zone's scale; everything else uses the page scale. The **Measure** tool respects it too, so a quick check inside the detail comes out right.

## Multiply zones — for repeated areas

When the same layout repeats — typical floors, identical units, a row of matching rooms — you don't want to count it ten times by hand. A **multiply zone** does it for you:

1. Draw a multiply-zone rectangle around the area.
2. Set how many times it repeats.

Every counter and line whose anchor falls inside is multiplied by that factor in the totals. Count one typical floor, wrap it in a ×10 zone, and the project totals reflect all ten.

## Good to know

- Scale zones can't overlap — each region gets one scale.
- A multiply zone changes the **totals**, not the marks on the sheet, so the plan stays readable.
- Both are visual boundaries you can edit or delete later from their right-click menu.

These two tools are what make CountTooling practical on messy, real-world plan sets — see them in context in [How to do a takeoff from a PDF](/guides/how-to-do-a-pdf-takeoff/).
