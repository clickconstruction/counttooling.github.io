# Writing a guide / help article

Articles in this folder are the source for the **/guides/** help section. Each `.md`
file becomes a page at `https://counttooling.com/guides/<filename-without-.md>/`.

## Add an article

1. Create `content/guides/<slug>.md` (the filename is the URL slug — use lowercase
   words separated by hyphens, e.g. `working-with-plan-scales.md`).
2. Start the file with a front-matter block, then write the body in Markdown:

   ```
   ---
   title: Working with plan scales
   description: A one-sentence summary (~150 chars) — used as the meta description and the index blurb.
   updated: 2026-06-09
   order: 3
   category: Getting started
   ---

   Your Markdown here. Use `##` for section headings (the page title comes from
   `title`, so don't add an `# H1`). Links, lists, **bold**, `code`, images, etc.
   all work. Link to other guides like [this](/guides/how-to-do-a-pdf-takeoff/).
   ```

3. Build the HTML + index + sitemap, then preview:

   ```
   npm run build:guides
   ```

   Open http://localhost:8080/guides/ (with the local dev server running) to check it.

4. **Commit the `.md` AND the generated files** (`guides/**` and `sitemap.xml`). CI runs
   `npm run build:guides -- --check` and fails if you forgot to regenerate.

## Inline button icons

To show a toolbar button's icon inline in the text, use a `[[name]]` shortcode — the
generator swaps it for the app's real icon (extracted from `app/index.html`, so they always
match). For example: `Pick the **Set Scale** [[set-scale]] tool.`

Available names: `set-scale`, `move`, `measure`, `highlight`, `multiply-zone`, `scale-zone`,
`delete-area`, `note`, `legend`, `grid`, `counter`, `line`, `polyline`, `hide-marks`. (Add a
new one by extending `ICON_BTN` in `scripts/build-guides.js` with the button's id.)

## Front-matter fields

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Page `<title>`, H1, OG title, and the index card title. |
| `description` | yes | Meta description, OG description, and the index card blurb. Keep it ~150 chars. |
| `updated` | recommended | `YYYY-MM-DD`. Shown as "Last updated" and used for the article date. |
| `order` | optional | Number; controls the index sort (lower = first). Defaults to 999. |
| `category` | optional | Label for grouping (informational for now). |
| `h1` | optional | Overrides the on-page H1 if it should differ from `title`. |

## Adding screenshots / visuals

Article images live in `guides/img/` and are referenced with normal Markdown:
`![alt text](/guides/img/<name>.png)`. They're **generated** (not hand-captured) so they
stay reproducible and on-brand:

- The backdrop is a synthetic floor plan: `npm run build:sample-plan` → `samples/sample-plan.pdf`
  (rarely needs rerunning).
- The screenshots come from `scripts/build-screenshots.js`, which drives the real app
  headlessly, lays a sample takeoff on the plan, opens dialogs, overlays **numbered callouts**,
  and writes `guides/img/*.png`. To add or change a shot, edit the `SHOTS` array in that script,
  then run `npm run build:screenshots` and commit the new PNG(s).
- Number your article steps to match the ①②③ callouts in the image.
- These build steps need a browser and aren't deterministic at the pixel level, so they're **not**
  in `npm run check` (same as `build:og-image`). The committed PNGs are the source of truth; the
  link-integrity test fails CI only if an article references an image that doesn't exist.

## Notes

- Write content from the app's **real** features only — don't invent capabilities.
- Removing an article: delete its `.md`, run `npm run build:guides`, and delete the
  now-stale `guides/<slug>/` folder by hand (the generator doesn't prune).
