# ClickCount

PDF measurement and counting tool for construction takeoffs. Hosted at [counttooling.com](https://counttooling.com).

## Features

- **PDF upload** — Load one or more PDFs with multi-page support
- **Scale** — Set drawing scale by clicking two reference points and entering real-world distance (ft, in, m, cm, yd)
- **Quick line** — Single-segment measurement
- **Polyline** — Multi-segment lines; double-click to finish, right-click to close polygon for area
- **Counters** — Place markers with icons and colors; searchable icon picker
- **Pan & zoom** — Drag to pan when no tool is active; mouse wheel or trackpad to zoom
- **Export/Import** — Save and restore projects as JSON
- **Local storage** — Scale and counters persist across sessions

## Usage

1. **Upload** a PDF via the header button or sidebar.
2. **Set scale** — Click two points on a known dimension, enter the real-world value.
3. **Measure** — Use Quick Line or Polyline tools to measure lengths and areas.
4. **Count** — Create counter types (e.g. Water Closet, Sink), then click on the drawing to place markers.
5. **Export** — Save your project as JSON for backup or sharing.

## Navigation

| Action | Input |
|--------|-------|
| Pan | Drag (when no tool active) |
| Zoom in/out | Mouse wheel or trackpad scroll |
| Fit to view | Zoom control button (⊡) |
| Page nav | Arrow keys or bottom nav buttons |

## Counter Icons

Icons are searchable in the New Counter modal. Available icons include:

**General:** Pin, circles (blue/red/yellow/green/orange), star, house, car, tree, wrench, light, window, door, parking, recycle, power, water drop, fire, drum, box, computer, construction, square

**Plumbing & fixtures:**
- Water Closet (search: water, closet, wc, toilet, bathroom)
- Water Fountain (water, fountain)
- Sink (sink, faucet, basin)
- Hose Bib (hose, bib, spigot, faucet, outdoor)
- Shower (shower, showerhead)
- Bath (bath, bathtub)
- Laundry (laundry, washer, washing machine)
- Water Heater (water, heater, hot water)

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
├── CNAME         # Custom domain (counttooling.com)
└── README.md     # This file
```
