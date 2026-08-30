---
title: Scale zones and multiply zones
description: Handle multi-scale sheets and repeated areas — give a region its own scale, or multiply everything inside a boundary so typical floors and units count correctly.
updated: 2026-08-10
order: 5
icon: scale-zone
category: Working with plans
---

Real plan sets aren't always one clean scale per sheet. Two tools handle the awkward cases without making you re-do the whole page.

![A plan with two regions marked: a multiply zone around a set of typical rooms, and a scale zone around a detail that's drawn at a different scale.](/guides/img/zones.png)

## Scale zones — for multi-scale sheets

A sheet often has the main plan at one scale and a blown-up detail or isometric at another. A **scale zone** [[scale-zone]] lets a region carry its own scale:

1. Pick the **Scale Zone** [[scale-zone]] tool and draw a rectangle around the detail.
2. Give that zone its own scale [[set-scale]] (the same way you'd [set the page scale](/guides/setting-the-scale/)).

Any line fully inside the zone is measured with the zone's scale; everything else uses the page scale. The **Measure** [[measure]] tool respects it too, so a quick check inside the detail comes out right.

## Multiply zones — for repeated areas

When the same layout repeats — typical floors, identical units, a row of matching rooms — you don't want to count it ten times by hand. A **multiply zone** [[multiply-zone]] does it for you:

1. Draw a multiply-zone rectangle around the area.
2. Set how many times it repeats.

![After drawing the zone rectangle, the multiplier dialog asks how many times the area repeats — everything inside counts that many times in the totals.](/guides/img/multiply-zone-value.png)

Every counter and line whose anchor falls inside is multiplied by that factor in the totals. Count one typical floor, wrap it in a ×10 zone, and the project totals reflect all ten. Every total in the sidebar shows the with-repeats number; hover a counter's badge to see how many marks are physically placed.

Here's both zones live on a sheet — note the legend: the four lavatories inside the ×3 zone count as twelve, so the Lavatory total reads 15, not 7:

![A scale zone (yellow, carrying its own 1/4" = 1' scale) and a ×3 multiply zone (green) on the plan — the legend's Lavatory count already reflects the multiplication.](/guides/img/zones-on-plan.png)

## Good to know

- Scale zones can't overlap — each region gets one scale.
- If the page's scale was corrected for a compressed or rescaled sheet, zone presets are corrected the same way automatically — the zone's label shows the same "· ANSI D"-style suffix, and the dialog says so. Calibrating a zone by clicking two points is never corrected (it's already ground truth).
- A multiply zone changes the **totals**, not the marks on the sheet, so the plan stays readable.
- Both are visual boundaries you can edit or delete later from their right-click menu.

These two tools are what make CountTooling practical on messy, real-world plan sets — see them in context in [How to do a takeoff from a PDF](/guides/how-to-do-a-pdf-takeoff/).
