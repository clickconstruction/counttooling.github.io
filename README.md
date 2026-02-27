# TakeoffPro — User Documentation

*PDF Measurement & Counting Tool*

> A browser-based PDF takeoff tool for measuring distances, counting items, and drawing annotated polylines — no server required.
>
> Hosted on GitHub Pages · No login required · Data stays in your browser

---

## Overview

TakeoffPro is a zero-server, zero-login PDF annotation and measurement tool that runs entirely in your browser. It is designed for construction estimators, architects, engineers, and anyone who needs to measure distances, count items, and annotate PDF drawings without specialized software.

Because the application runs on GitHub Pages and uses no database, your PDF files never leave your device. All annotation data is stored in your browser's local storage and can be exported as a portable JSON file.

### Key Capabilities

| Feature | Description |
|---|---|
| **PDF Loading** | Upload single or multi-page PDFs. Multiple PDF files can be appended into one project. |
| **Scale Calibration** | Click two reference points on the drawing and enter the real-world distance to set the measurement scale. |
| **Quick Lines** | Draw single measurement lines between two points with automatic distance labeling. |
| **Polylines** | Draw multi-segment lines with multiple direction changes. The tool accumulates total linear distance across all segments. Closed polylines additionally calculate area. |
| **Counters** | Define named counter types with custom icons and colors. Every click on the canvas places a marker and increments the count. |
| **Multi-page** | Each page in the project has its own independent set of annotations, counters, and measurements. |
| **Export / Import** | Save your entire project as a JSON file and re-import it later. PDF files are re-uploaded separately. |
| **Keyboard Navigation** | Arrow keys flip between pages. Escape cancels the active tool. |

---

## Getting Started

### Step 1 — Upload a PDF

Click the **Upload PDF** button in the top toolbar, or click the large upload button in the center of the empty canvas. You can select a single PDF or multiple PDFs at once. Multi-page PDFs are automatically split into individual pages within the project.

> 💡 After uploading, the view will automatically zoom to fit the first page. Use the zoom controls in the bottom-right corner or the + / − buttons to adjust the view.

### Step 2 — Set the Drawing Scale

Before taking measurements, you must calibrate the scale so the tool knows how many pixels represent a real-world unit of distance.

To set the scale:

1. Click the **Set Scale** button in the toolbar. The cursor changes to a crosshair.
2. Click **Point A** — the first endpoint of a known distance on the drawing (e.g., the end of a dimension line, or a wall you know the length of).
3. Click **Point B** — the second endpoint of that same known distance.
4. A modal appears showing the pixel span of your selection.
5. Enter the real-world value (e.g., `25`) and choose a unit (ft, m, in, cm, or yd).
6. The scale preview updates live as you type. Click **Set Scale** to confirm.

> 💡 The scale badge in the toolbar updates to show the active scale. You can re-run Set Scale at any time to recalibrate.

### Step 3 — Start Annotating

With a scale set, you are ready to draw measurements, place counters, and build up your takeoff. The three main annotation tools are described in the following sections.

---

## Annotation Tools

### Quick Line

The Quick Line tool draws a single straight measurement line between two clicks. It is ideal for fast spot-checks — measuring a wall, a span, or verifying a dimension.

**How to use:**

1. Click the **Quick Line** button in the toolbar.
2. Click the start point on the canvas.
3. Move the mouse — a dashed preview line and live distance HUD follow the cursor.
4. Click the end point. The line is drawn with a distance label at its midpoint.

> 💡 If no scale is set, the distance label will display in pixels. Set a scale first for real-world measurements.

---

### Polyline

The Polyline tool draws a connected series of line segments, each anchored by a click. The tool accumulates the length of every segment and displays the running total as you draw. This is ideal for measuring irregular paths such as fence lines, pipe runs, or room perimeters.

**How to draw a polyline:**

1. Click the **Polyline** button. A modal appears asking for a name and color.
2. Enter a descriptive name (e.g., *North Fence Line*) and pick a color, then click **Start Drawing**.
3. Click to place the first vertex. Each subsequent click adds another segment.
4. The running total distance updates in real time next to your cursor.
5. To finish an **open** polyline: double-click, or press `Enter`.
6. To **close** the polyline into a polygon (measuring perimeter and area): right-click while drawing.

Closed polylines automatically calculate enclosed area using the polygon area formula. The area label appears alongside the perimeter label on the canvas.

> 💡 You can have multiple named polylines on the same page in different colors. All are listed in the Lines panel in the left sidebar with their total distances.

---

### Counters

A Counter is a named, icon-tagged item type that you place by clicking on the canvas. Every click drops a marker and increments the count. You can define as many counter types as needed for a single project.

**How to create and use a counter:**

1. Click the **Counter** button in the toolbar (or the `+` next to Counters in the sidebar).
2. In the modal, enter a name (e.g., *Parking Spots*, *Fire Sprinklers*, *Windows*).
3. Choose an icon from the emoji grid and a color from the color swatches.
4. Click **Create Counter**. The counter type appears in the sidebar and becomes immediately active.
5. Click anywhere on the canvas to place a marker. Each click increments the count shown in the sidebar.
6. To switch between counter types, click a different counter in the sidebar.
7. To delete an individual marker, right-click it and select **Delete**.

> 💡 Counter totals are per-page. The sidebar always shows the count for the current page. Export the project JSON to get a full cross-page breakdown.

---

## Working with Multiple Pages

TakeoffPro supports projects with many pages — each page maintains a completely independent set of annotations, polylines, and counter tallies.

### Adding Pages

Pages are added in two ways: uploading a multi-page PDF (each page is split automatically), or clicking the `+` button next to Pages in the sidebar to upload additional PDFs. New pages are appended to the end of the project page list.

### Navigating Between Pages

Click any page in the left sidebar page list to jump directly to it. You can also use the arrow navigation bar at the bottom center of the canvas, or the keyboard arrow keys (left/right or up/down).

> 💡 Pages that have annotations are marked with a small amber dot in the sidebar list, so you can quickly see which pages have been worked on.

### Scale Per Page

The scale set via the toolbar applies globally to all pages by default. If your document contains pages at different drawing scales (for example, a site plan at 1:100 and a detail sheet at 1:10), you can re-run **Set Scale** on each individual page. The scale is stored globally but the pixel-to-unit ratio recalculates based on the active page's zoom level at the time of calibration.

### Clearing a Page

To remove all annotations from the current page, click the **Clear Page** button in the top-right of the toolbar. You will be prompted to confirm before any data is deleted. This does not affect other pages.

---

## Saving & Restoring Work

### Auto-Save to Browser Storage

TakeoffPro automatically saves your annotation data, counter definitions, and scale to your browser's local storage after every change. If you close the tab and reopen the application, your counters and scale will be restored automatically.

> 💡 Browser local storage is tied to your specific browser on your specific device. It does not sync across devices. For portability, use the Export feature.

### Exporting a Project

Click the **Export** button in the toolbar to download a `takeoff-project.json` file. This file contains:

- All counter type definitions (name, icon, color)
- All polylines and quick lines (with their vertex coordinates and colors)
- All counter marker positions and counts
- The active scale setting

The JSON file does not contain the PDF itself (PDF files can be large). To restore a project, you re-upload the original PDF alongside the JSON.

### Importing a Project

Click **Import** in the toolbar and select your previously exported `.json` file. The annotations, counters, and scale are restored and overlaid onto whatever PDF is currently loaded. Make sure to upload the same PDF first so the coordinate positions align correctly.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Esc` | Cancel the current tool / exit drawing mode |
| `Enter` | Finish the current polyline (open) |
| `←` or `↑` | Go to the previous page |
| `→` or `↓` | Go to the next page |
| Right-click (while drawing) | Finish polyline as a closed polygon |
| Right-click (on annotation) | Open context menu to delete the annotation |
| Double-click | Finish the current polyline (open) |

---

## Tips & Best Practices

- Always set the scale before drawing measurements. Use a known dimension line printed on the PDF, or calibrate against a scale bar if one is present.
- Zoom in before setting scale — the more pixels you span with your two reference points, the more accurate your calibration will be.
- Use the Polyline tool for any measurement that changes direction, such as room perimeters, road alignments, or irregular borders.
- Use the Quick Line tool for fast one-off spot checks without naming or managing a polyline.
- Create a counter for every distinct item type you need to count before starting — switching between counter types mid-count is easy via the sidebar.
- Export your project JSON at the end of every session as a backup. Local storage can be cleared by browser settings.
- For very large PDFs with many pages, navigate directly via the sidebar rather than using the arrow keys to reduce confusion.

---

## Deploying to GitHub Pages

TakeoffPro is a single HTML file with no build step, no npm dependencies at runtime, and no server. Deploying is straightforward.

### Steps

1. Create a new GitHub repository (public repos get Pages for free on all plans).
2. Upload the `index.html` file (rename `takeoff.html` to `index.html`) to the root of the repository.
3. Go to the repository **Settings** tab, then **Pages** in the left sidebar.
4. Under **Source**, select *Deploy from a branch*, choose `main` (or `master`), and set the folder to `/ (root)`.
5. Click **Save**. GitHub will build and publish the site within a minute or two.
6. Your tool will be live at `https://your-username.github.io/your-repo-name`

> 💡 PDF.js is loaded from the Cloudflare CDN. An internet connection is required to load the application for the first time. Once loaded, all PDF processing and annotation happens locally in the browser.

### Custom Domain (Optional)

GitHub Pages supports custom domains. In the Pages settings, add your domain under **Custom domain**, then configure a `CNAME` record at your DNS provider pointing to `your-username.github.io`. HTTPS is enabled automatically via Let's Encrypt.

---

## Technical Reference

### Architecture

The application is built with vanilla JavaScript using two primary browser APIs:

- **PDF.js** (Mozilla) — renders PDF pages to an HTML canvas element at the specified zoom level.
- **HTML Canvas API** — provides a second transparent overlay canvas for all annotation drawing: lines, polylines, markers, and labels.

All state is held in memory as a JavaScript object during the session. Scale, counter definitions, and annotation data are serialized to `localStorage` on every change. PDF binary data is never stored — only the annotation coordinates relative to the rendered canvas.

### Scale Calculation

Scale is stored as `pixelsPerUnit` at zoom level 1. When the user sets scale, the pixel distance between the two reference points is divided by the real-world value entered, then multiplied by the current zoom to normalize back to zoom=1. At render time, all distance calculations divide the pixel distance by `(pixelsPerUnit / currentZoom)` to account for the active zoom level.

> 💡 This means measurements remain consistent regardless of zoom level. You can zoom in to place points more precisely without affecting the scale calibration.

### Data Format (Export JSON)

| Field | Description |
|---|---|
| `version` | Schema version number (currently `1`) |
| `scale` | Object with `pixelsPerUnit` (number) and `unit` (string) |
| `counters` | Array of counter type definitions: `id`, `name`, `icon`, `color` |
| `pages[].label` | Display name for each page (derived from filename) |
| `pages[].annotations.counterMarkers` | Object keyed by counter id; value is array of `{x, y, id}` positions |
| `pages[].annotations.polylines` | Array of polyline objects: `id`, `name`, `color`, `points[]`, `closed` |
| `pages[].annotations.quickLines` | Array of line objects: `id`, `x1`, `y1`, `x2`, `y2`, `color` |

---

*TakeoffPro is open source. No warranties expressed or implied. Data accuracy depends on correct scale calibration.*
