---
title: How to do a takeoff from a PDF
description: Step-by-step — upload a plan PDF, set the scale, count fixtures, measure runs, and export a report, all in your browser with CountTooling.
updated: 2026-07-31
order: 1
icon: measure
category: Getting started
---

A takeoff is just a structured count and measurement of what's on a drawing. With CountTooling you do it straight on the PDF — no printing, no exporting to another tool first. Here's the whole workflow.

![A finished takeoff in CountTooling — counters on every fixture, a measured waste line, and a live legend tallying the counts and lengths.](/guides/img/plan-takeoff.png)

## 1. Upload your plan PDF

Open the app and drop in your plan set. The **Prepare PDF** dialog lets you shape the set before you start — ① rotate a sideways sheet, ② delete the pages you don't need, then ③ save and open. Each remaining page becomes a sheet you can mark up.

![The Prepare PDF dialog: ① rotate a sideways page, ② delete the pages you don't need, then ③ Save & Open.](/guides/img/prepare-pdf.png)

More on trimming, renaming, and adding addendum pages later: [Preparing a plan set](/guides/preparing-a-plan-set/).

## 2. Set the scale

Before any measurement means anything, calibrate the drawing. Pick the **Set Scale** [[set-scale]] tool and choose your method — ① click two points a known distance apart and enter the real length, ② pick an architectural or engineering preset, or ③ type a custom ratio.

![The Set Scale dialog showing the three ways to calibrate: ① pick two known points, ② choose an architectural or engineering preset, or ③ type a custom scale.](/guides/img/set-scale.png)

- Working with a sheet that has details at a different scale? Add a **scale zone** [[scale-zone]] around that region and give it its own scale.
- Repeating areas (typical floors, identical units)? Drop a **multiply zone** [[multiply-zone]] so everything inside it is counted the right number of times.
- Using a preset? [Verify it against a known dimension](/guides/verifying-your-scale/) before you trust a bid to it.

## 3. Count your fixtures

Create a **counter** [[counter]] for each fixture type — ① name it, ② pick an icon (or upload your own), ③ choose a color — then click each fixture on the plan.

![The Create Counter dialog: ① name the counter, ② pick a built-in icon or upload your own, and ③ choose a color.](/guides/img/counter-create.png)

The tally updates live in the sidebar as you click, rolled up across every sheet. Group related counters together to keep a busy sheet organized.

![Counters placed on each restroom fixture, with the running tally shown in the sidebar — Water Closet and Lavatory totals update as you click.](/guides/img/counting.png)

## 4. Measure the runs

Make a **line type** per kind of run — ① name it, ② straight or curved, ③ color — then trace with **Line** [[line]] or **Polyline** [[polyline]]. CountTooling reads the real length off the scale you set.

![The Create Line Type dialog: ① name it, ② choose straight or curved, ③ pick a color.](/guides/img/line-types.png)

Use **arcs** for curved runs and **drops** where a run changes elevation, and press `J` to snap segments to the 45° angles real runs take. Need a quick one-off distance? The **Measure** [[measure]] tool gives it to you in two clicks.

## 5. Annotate

Add **highlights** [[highlight]] and **notes** [[note]] to flag anything that needs attention, and turn on the **grid** [[grid]] with snapping for clean, aligned lines.

## 6. Review the summary

The on-canvas **legend** [[legend]] shows your counts and lengths by type as you work. In the sidebar Summary, click any total for a **per-page breakdown with thumbnails** — proof of exactly where every item was counted. Open **Show Report** for the full breakdown across pages and canvases.

![Clicking a Summary total opens the by-page breakdown — the count per sheet, with a thumbnail showing where the marks are.](/guides/img/summary-detail.png)

## 7. Export and share

When you're done:

![The Export PDFs dialog: ① set marker and line sizes, ② choose whether to include the report and bundle highlights/notes, then ③ download.](/guides/img/export-pdfs.png)

- **Export PDF** with your markup, the takeoff report, and any highlights and notes baked in.
- **Copy to PipeTooling** to drop the counts straight into a bid, or **copy a summary** for email — tab-delimited and ready to paste.
- Need someone to *see* the live takeoff instead? Send a [view link](/guides/sharing-and-view-links/) — no account required on their end.

That's a complete takeoff — counted, measured, reported, and shared, without leaving the browser.
