---
title: Reports, exports, and sending a takeoff onward
description: Turn your marked-up plan into numbers and deliverables — the on-canvas legend, Show Report, Export PDF, Copy to PipeTooling, and email summaries.
updated: 2026-08-10
order: 6
icon: legend
category: Output
---

A takeoff is only useful once it's numbers someone can price or check. CountTooling gives you several ways to get there, from a quick on-screen tally to a full marked-up PDF.

## See the totals as you work

- **Legend** [[legend]] — the on-canvas summary shows your counts and lengths by type, right on the plan. It's draggable and resizable, so park it wherever it doesn't cover your work (styling options: [Highlights, notes, and the legend](/guides/annotating-and-reviewing/)).
- **Footer totals** — the status bar keeps a running `[count | length]` across every page and canvas, with multiply and scale zones already applied.
- **Count detail** — click any count or line total in the Summary for a per-page breakdown with thumbnails showing exactly where each item sits. The takeoff audits itself.

![Clicking a Summary total opens the by-page breakdown — the count per sheet, with a thumbnail showing where the marks are.](/guides/img/summary-detail.png)

## Show Report

Open **Show Report** for the full breakdown in a new tab. You can scope it to:

- this canvas,
- all canvases on the current page,
- all plan pages (current canvas), or
- everything — all pages and canvases.

## Export a marked-up PDF

![The Export PDFs dialog: ① set marker and line sizes, ② choose whether to include the report and bundle highlights/notes, then ③ download.](/guides/img/export-pdfs.png)

**Export PDF** produces a deliverable with your markup baked in. You control:

- marker and line **size** (so marks read at print scale),
- whether to **include the takeoff report**, and
- whether to **bundle highlights and notes** into the file.

You can export specific pages, just the marked ones, or the whole set.

## Send it to where it gets priced

- **Copy to PipeTooling** — copies the takeoff as tab-delimited counts, ready to paste straight into a bid. It even appends a **view link** back to the source takeoff, so a bid can point at the plan it came from. Before copying, the app double-checks your scales: if any exported page has lines but no scale, a dialog lists those pages and offers to jump you straight to Set Scale — or you can export anyway, knowing those lengths are in pixels. Pages without marks are never flagged.
- **Copy Summary (email/text)** — a plain-text summary for dropping into an email or message. It runs the same scale check before copying.

### Pages without a scale

Totals never mix pixel lengths into feet. A line drawn on a page with no scale is measured in raw pixels, and every total — the footer, the sidebar, the legend, the report, and both copy buttons — keeps it in its own `px` bucket (`12.50 ft + 200 px`, never one summed number). In the exports, unscaled runs appear as separate `px of` rows/bullets so nothing pixel-measured can masquerade as feet in a bid. Set the page's scale to move those runs into the feet total.
- **Download current page** — the yellow printer button downloads the sheet you're on as a PDF; on multi-page or multi-layer projects it offers a scope menu (this canvas, all canvases on the page, all pages).
- **Export / Import Canvas** — your marks alone (palette, groups, and all) as a small JSON file, without the PDF — the easy way to hand a takeoff to someone who already has the plan set. See [Canvas layers](/guides/canvas-layers/).

## Reading the bare drawing

Need to hand someone the plan without the takeoff on top? The **Hide marks** [[hide-marks]] toggle peels the overlay off so the drawing reads clean, then brings it back with another tap — it's purely visual and never touches your data.

To share the live takeoff instead of a file, see [Sharing and view links](/guides/sharing-and-view-links/).
