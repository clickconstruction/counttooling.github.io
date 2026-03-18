# Custom Icons

ClickCount supports two kinds of custom icons:

1. **Bundled custom icons** (`CUSTOM_ICONS` in `index.html`) — Available to all users, shipped with the app.
2. **User-uploaded icons** — Stored in `localStorage` per browser; users upload SVGs via Create Counter → Custom Icons.

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
3. Copy the output line (starts with `const CUSTOM_ICONS = `).
4. In `index.html`, replace the existing `const CUSTOM_ICONS = [];` (around line 2448) with the pasted line.

Optional: write output to a file instead of stdout:
```bash
node scripts/build-custom-icons.js --out custom-icons.js
```

## SVG Requirements

- Must contain at least one `path`, `rect`, `circle`, `ellipse`, or `line` element.
- `viewBox` is recommended (e.g. `viewBox="0 0 1200 1200"`); defaults to `0 0 24 24` if missing.
- Multiple paths are supported; they are joined into a single path string.

## Display Names

Display names are derived from filenames:

- `90-elbow.svg` → "90 Elbow"
- `p-trap.svg` → "P Trap"
- `mounted sink.svg` → "Mounted Sink"

Hyphens and underscores become spaces; each word is title-cased. To override a name, edit the generated array in `index.html` after pasting.
