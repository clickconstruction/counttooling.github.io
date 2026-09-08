# Custom Icons

ClickCount supports two kinds of custom icons:

1. **Bundled custom icons** (the generated `CUSTOM_ICONS` array in `icons-custom.js`) — Available to all users, shipped with the app.
2. **User-uploaded icons** — Stored in IndexedDB per browser; users upload SVGs via Create Counter → Custom Icons.

Both are merged by `getEffectiveCustomIcons()` and appear in the icon picker.

## Adding Bundled Icons

To add SVG icons that ship with the app:

1. Place `.svg` files in `my-counters/` (or another directory).
2. Run:
   ```bash
   npm run build:icons
   ```
   For a custom directory:
   ```bash
   node scripts/build-custom-icons.js --dir path/to/svgs
   ```
3. That's it — the generator overwrites `icons-custom.js` wholesale (a classic
   `<script src>` loaded between `icons.js` and `icon-render.js`; the icon data
   lives in the shared global lexical scope). Commit the regenerated file.

Options: `--out other-file.js` writes elsewhere; `--stdout` prints instead of writing.

## SVG Requirements

- Must contain at least one `path`, `rect`, `circle`, `ellipse`, or `line` element.
- `viewBox` is recommended (e.g. `viewBox="0 0 1200 1200"`); defaults to `0 0 24 24` if missing.
- Multiple paths are supported; they are joined into a single path string.

## Icon sets

The top-level `my-counters/*.svg` files are the original (plumbing) set. Each
immediate **subfolder is a further set** named after the folder — today
`my-counters/electrical/` (41 drafting-convention E-sheet symbols, Electrical,
First-Class move 1). Every generated entry carries `set` ('plumbing' |
'electrical'); the icon pickers' custom grid groups by set with a heading per
set and the project's trade first (`customIconCellsHtml(icons, selected,
firstSet)` in icon-render.js).

The electrical set is **generated, not hand-drawn**:
`node scripts/build-electrical-symbols.js` writes the SVGs from geometry
(rings, bars, annular sectors — every symbol is one fill-only path, so outlines
are rings and letters are built from bands), then `npm run build:icons` folds
them in. Edit the symbol there, never the SVG.

Two optional authoring elements are honored by the generator:

- `<title>Duplex Receptacle</title>` — overrides the filename-derived display
  name (so `tv-outlet.svg` can read "TV Outlet").
- `<desc>terms: receptacle, outlet, duplex</desc>` — search terms, emitted as
  `terms` on the entry.

## Display Names

Display names are derived from filenames:

- `90-elbow.svg` → "90 Elbow"
- `p-trap.svg` → "P Trap"
- `mounted sink.svg` → "Mounted Sink"

Hyphens and underscores become spaces; each word is title-cased. To override a name, rename the source `.svg` in `my-counters/` and rerun `npm run build:icons` (hand-edits to `icons-custom.js` are lost on the next regeneration).
