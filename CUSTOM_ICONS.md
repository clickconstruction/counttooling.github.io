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

## Display Names

Display names are derived from filenames:

- `90-elbow.svg` → "90 Elbow"
- `p-trap.svg` → "P Trap"
- `mounted sink.svg` → "Mounted Sink"

Hyphens and underscores become spaces; each word is title-cased. To override a name, rename the source `.svg` in `my-counters/` and rerun `npm run build:icons` (hand-edits to `icons-custom.js` are lost on the next regeneration).
