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
First-Class move 1) and `my-counters/hvac/` (the 5 M-sheet symbols of DUCT
unit D16: Supply Diffuser, Return Grille, RTU, VAV Box, Fire/Smoke Damper).
Every generated entry carries `set` ('plumbing' | 'electrical' | 'hvac'); the
icon pickers' custom grid groups by set with a heading per set
(`ICON_SET_LABELS` — "Plumbing" / "Electrical" / "HVAC") and the project's
trade first (`customIconCellsHtml(icons, selected, firstSet)` in
icon-render.js). Within a set the cells follow filename order.

The electrical and HVAC sets are **generated, not hand-drawn**:
`node scripts/build-electrical-symbols.js` / `node scripts/build-hvac-symbols.js`
write the SVGs from geometry (rings, bars, annular sectors — every symbol is
one fill-only path, so outlines are rings and letters are built from bands;
viewBox `0 0 1200 1200`, the 70-unit band weight), then `npm run build:icons`
folds them in. Edit the symbol there, never the SVG. A bundled icon is a
single fill that takes the counter's color, so a symbol can't carry its own
tint (the fire/smoke damper is red only when the counter is).

**CFM → diffuser default (D16).** A counter created WITH a CFM (the Create
tab's CFM box or Quick Count's) and no explicit icon click takes the HVAC
set's Supply Diffuser — `cfmDefaultIconFromList` (icon-render.js) resolves it
by set + name, published as `App.cfmDefaultIcon()`. The Create tab moves the
selection live as the CFM is typed and restores the T2-05 prefill when it's
cleared; Quick Count shows it in the preview swatch. Precedence: an explicit
cell click > the trade's type symbol (`HVAC_DEFAULTS.iconNameByType` —
Supply/Linear Diffuser, Return/Exhaust Grille, VAV Box, RTU, Damper,
Thermostat) > the CFM default > the picker's ordinary default. A counter
without a CFM is untouched.

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

Hyphens and underscores become spaces; each word is title-cased. To override a name, rename the source `.svg` in `my-counters/` and rerun `npm run build:icons` (hand-edits to `icons-custom.js` are lost on the next regeneration). `npm run build:icons -- --check` exits 1 when `icons-custom.js` is stale against `my-counters/` — it is one of the `npm run check` steps, so a symbol added without a rerun cannot ship silently (then `npm run build:sw`, since the file is precached).
