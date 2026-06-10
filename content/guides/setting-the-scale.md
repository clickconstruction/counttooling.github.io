---
title: Setting the scale on a plan
description: Calibrate a PDF so measurements are accurate — set scale from two points, use architectural/engineering presets, or enter a custom scale.
updated: 2026-06-09
order: 2
icon: set-scale
category: Getting started
---

Scale is what turns pixels on a PDF into real feet and inches. Until you set it, CountTooling can count fixtures but can't measure runs. Scale is **per page**, so each sheet can have its own.

![The Set Scale dialog showing the three ways to calibrate: ① pick two known points, ② choose an architectural or engineering preset, or ③ type a custom scale.](/guides/img/set-scale.png)

There are three ways to set it — **①** two points, **②** a preset, or **③** a custom value.

## Set scale from two points

The most reliable way is to calibrate against something you know:

1. Pick the **Set Scale** [[set-scale]] tool.
2. Click two points a known distance apart — a dimension line, a door width, a grid spacing.
3. Enter the real-world length (for example `3'` or `10 ft`).

CountTooling works out the scale from those two points, so it stays accurate even if the PDF was exported at an odd size.

## Use a preset

If the sheet is drawn at a standard ratio, skip the two-point step and pick a preset:

- **Architectural** — `1/4" = 1'`, `1/8" = 1'`, and the rest of the common set.
- **Engineering** — `1" = 20'`, `1" = 40'`, and so on.

## Enter a custom scale

You can also type a scale directly — a fraction like `1/4` or a decimal like `0.25` — and apply it. Useful when you know the ratio but don't have a dimension to click.

## Tips

- The scale badge on each page in the sidebar turns yellow once a scale is set, so you can see at a glance which sheets are calibrated.
- If a single sheet mixes scales (a detail blown up in the corner), you don't have to re-scale the whole page — see [Scale zones and multiply zones](/guides/scale-zones-and-multiply-zones/).
- Try to measure something before you trust a takeoff. If a known 3-foot door reads as 4 feet, your scale is off — reset it and pick cleaner points.

Once the scale is set, you're ready to [measure runs](/guides/measuring-runs-lines-and-polylines/).
