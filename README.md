# ClickCount

PDF measurement and counting tool for construction takeoffs. Hosted at [counttooling.com](https://counttooling.com).

## Features

- **PDF upload** — Load one or more PDFs with multi-page support
- **Scale** — Set drawing scale by clicking two reference points and entering real-world distance (ft, in, m, cm, yd)
- **Line types** — Define line types (e.g. Conduit Run) and group multiple runs with totals
- **Quick line** — Single-segment measurement
- **Polyline** — Multi-segment lines; double-click to finish, right-click to close polygon for area
- **Counters** — Place markers with SVG icons and colors; searchable icon picker; click swatch to edit color; double-click name to rename
- **Pan & zoom** — Drag to pan when no tool is active; mouse wheel or trackpad to zoom
- **Print Report** — Generate printable HTML summary of pages, counters, and line types
- **Export/Import** — Save and restore projects as JSON
- **Local storage** — Scale, counters, and line types persist across sessions

## Usage

1. **Upload** a PDF via the header button or sidebar.
2. **Set scale** — Click two points on a known dimension, enter the real-world value.
3. **Line types** — Create line types (e.g. Conduit Run), then draw quick lines or polylines assigned to that type.
4. **Measure** — Use Quick Line or Polyline tools to measure lengths and areas.
5. **Count** — Create counter types (e.g. Water Closet, Sink), then click on the drawing to place markers.
6. **Print Report** — Click the Print Report button at the bottom of the sidebar to generate a printable summary.
7. **Export** — Save your project as JSON for backup or sharing.

## Sidebar

- **Double-click** page, counter, line type, or line names to rename inline
- **Click** the color swatch next to a counter to change its color
- **Click** a counter or line type to activate it for placement

## Navigation

| Action | Input |
|--------|-------|
| Pan | Drag (when no tool active) |
| Zoom in/out | Mouse wheel or trackpad scroll |
| Fit to view | Zoom control button (⊡) |
| Page nav | Arrow keys or bottom nav buttons |

## Counter Icons

Icons are searchable in the New Counter modal. All icons are SVG-based:

**Plumbing & fixtures:** Water Closet, Water Fountain, Sink, Hose Bib, Shower, Bath, Laundry, Water Heater

**General:** Circle, Circle Dot

**Electrical:** Light, Plug, Power Source, Battery, Charging Station, Wall Sconce

Search by keyword (e.g. "water", "light", "plug") to filter the icon grid.

## Keyboard Shortcuts

- **Escape** — Cancel current tool or exit polyline edit mode
- **Arrow keys** — Change page
- **Enter** — Finish polyline or confirm polyline edit

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- Google Fonts: DM Sans, DM Mono, Instrument Serif
- No build step; static deployment

## Project Structure

```
counttooling.github.io/
├── index.html    # Single-file app (HTML, CSS, JS)
├── report.js    # Print report generation
├── CNAME         # Custom domain (counttooling.com)
└── README.md     # This file
```
