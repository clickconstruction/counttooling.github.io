---
title: Canvas layers — alternates and options on one sheet
description: Every page can hold multiple annotation layers — keep the base bid and alternates side by side, switch with the arrow keys, and compare with one tap.
updated: 2026-08-10
order: 5.7
icon: layers
category: Working with plans
---

A sheet often needs more than one takeoff: a base bid and an alternate, a first pass and a check pass, two options the owner is deciding between. **Canvas layers** let one page carry them all — each layer its own independent set of marks over the same drawing.

## Working with layers

- The layers [[layers]] control in the bottom bar shows the current page's layers. **Add Canvas** creates a new one — **empty**, or a **duplicate** of the current layer when you want to riff on what's already counted.

![Add Canvas: ① a new empty layer, or ② a duplicate of the current one — named whatever makes sense, like "Alternate — cast iron".](/guides/img/add-canvas.png)
- Switch layers with `↑`/`↓` or from the layers menu. Each page remembers which layer is active.

![The footer canvas switcher: the active layer's name, the layer count, and the show-all peek eye — everything layer-related lives in one spot.](/guides/img/canvas-switcher.png)
- Rename a layer from its details (the edit pen in the canvas switcher) so "Canvas 2" becomes "Alternate — cast iron".
- Deleting a layer asks first, names the layer, and tells you what it holds.

Everything you place lands on the **active** layer only, and the sidebar tallies, footer totals, and reports follow the layers you scope them to — the export dialogs let you choose this canvas, all canvases on a page, or everything.

## Compare layers at a glance

The **show-all** peek (the eye-on-layers button next to the layer selector, shown when a page has two or more layers) temporarily draws *every* layer at once so you can compare options in place. It's purely visual — editing still targets the active layer, and nothing is saved differently. The sidebar totals stay on your **active layer** during the peek; the on-sheet legend is where you read the merged picture.

On a sheet with several layers, showing everything can be its own kind of noise. **Right-click the peek button** to choose exactly which layers to show: the current layer is always on, and you check just the one or two you want to compare against ("All canvases" brings the full merge back). A small dot on the button reminds you a subset is showing. The selection is temporary — it isn't saved with the project, and it clears when a page is back to a single layer.

## Move marks between projects: canvas JSON

The **Export Canvas** option writes your marks — palette, groups, and all — as a small JSON file, without the PDF. **Import Canvas** loads one into another project. Because the file is tiny, it's the easy way to hand a takeoff to a colleague who already has the plan set, or to reuse a typical layout.

## Good to know

- Viewers on a [view link](/guides/sharing-and-view-links/) can browse layers too — it doesn't modify the project.
- Undo/redo and auto-save cover layer operations like everything else.
- The per-page breakdowns in the [Summary](/guides/reports-and-exports/) respect layers, so an alternate never contaminates the base bid's numbers.

Related: [Reports & exports](/guides/reports-and-exports/) for scoping output to layers.
