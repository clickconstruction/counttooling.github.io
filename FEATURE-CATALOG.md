# CountTooling — Full Feature Catalog

Every feature in the app, the problem it solves, and why it's useful — grounded in how takeoffs
actually get done today and where the incumbent tools fall short.
Compiled 2026-07-31 from the live app, ARCHITECTURE.md, the /guides/ articles, and market research.

---

## The market context

Estimators today sit between two bad options:

- **The manual way** — printed sheets or a PDF viewer, a highlighter, a clicker, and a legal pad.
  Every fixture counted one by one, every pipe run traced by hand, and when the drawings change,
  you start over. Manual plan-view takeoffs routinely under-measure runs by 12–18%, and supporting
  material (hangers, insulation, fittings) quietly eats 15–20% of material cost when it's missed.
- **The incumbent software** — powerful but heavy: PlanSwift is ~$1,749/user/year and
  desktop-Windows-only with no cloud collaboration; Autodesk Takeoff is ~$1,250/user/year;
  Bluebeam is a PDF-markup tool first (steep learning curve, no takeoff-native workflow); STACK
  and similar cloud tools run $249+/user/month, require constant internet, and lag on dense
  multi-sheet plan sets. None of them has a real answer for the field: a tablet in a basement
  mechanical room with no signal.

**CountTooling's position:** takeoff-native (not markup-native), runs in any browser on any device
with nothing to install, stays fast on huge plan sets, works fully offline once a plan is loaded,
and hands its numbers directly to pricing (PipeTooling) instead of dead-ending in a PDF.

Each feature below is listed as: **Feature** → the *problem* → why it's *useful*.

---

## 1. Getting plans in

**PDF upload — multi-file, drag-and-drop, up to 50 MB**
*Problem:* Incumbent tools make you install desktop software (Windows-only for several) or push
plans through an import/processing pipeline before you can touch them.
*Useful because:* You start the takeoff seconds after receiving the plan set — open the browser,
drop the PDF, click.

**Prepare PDF — keep/drop from a sheet grid, and rotate pages before starting**
*Problem:* Bid sets arrive as 200-sheet combined PDFs where only a dozen sheets matter to your
trade, and paging past the rest wastes attention all day.
*Useful because:* You trim the set to exactly your sheets once, and everything after — sidebar,
warm-up, exports — stays focused and fast.

**Append pages to an existing takeoff**
*Problem:* Addenda and revised sheets arrive mid-bid, and most tools force a new project or a
painful re-import that orphans your existing counts.
*Useful because:* The late sheet joins the project in place; nothing you've counted moves. The
project keeps its name, and a toast confirms "Added N sheets".

**Page rotation (R)**
*Problem:* Scanned and re-plotted sheets come in sideways, and marking up a rotated drawing
guarantees misreads.
*Useful because:* One keystroke turns the sheet — and every existing mark rotates with it, so
orientation is never a data hazard.

**Page renaming + smart title truncation**
*Problem:* PDF page 47 means nothing; "P-201 Underground" is how estimators actually navigate.
*Useful because:* The sidebar speaks sheet language, so finding the right drawing is a glance, not
a hunt.

**Marked-page badges + marked-page navigation (Shift+arrows)**
*Problem:* On a big set you lose track of which sheets are calibrated and which are done, and
re-checking wastes passes through the whole set.
*Useful because:* Badges show scale-set and has-marks status per sheet at a glance, and Shift+arrow
jumps only between sheets you've actually worked.

---

## 2. Scale & calibration — the accuracy layer

**Per-page scale: two-point calibration, architectural/engineering presets, or custom ratio**
*Problem:* A takeoff is only as good as its scale, and real plan sets mix scales sheet by sheet;
tools with one global scale silently corrupt every measurement on off-scale sheets.
*Useful because:* Each sheet is calibrated its own way — click a known dimension, pick `1/4"=1'`,
or type a ratio — so lengths are real feet everywhere.

**Sheet-size correction for compressed/rescaled PDFs**
*Problem:* PDFs that were re-plotted at half size are the classic silent killer: a `1/4"=1'` preset
reads a 10-foot wall as 5 feet and nobody notices until the bid is wrong.
*Useful because:* The app detects a non-standard sheet size, warns you, and corrects the preset by
the rescale ratio — an error class most competitors don't even acknowledge. Since the correction is
still a guess, a corrected apply walks you straight into the verify check (Esc keeps the scale).
Scale-zone presets inherit the same correction from the page scale, so details stay consistent.

**Verify-your-scale check mode**
*Problem:* A preset scale is an assumption, and estimators rarely test it before trusting a whole
bid to it.
*Useful because:* Two clicks on a known dimension show the % error in green or yellow — you prove
the scale before it can poison the numbers. Sheet-corrected applies enter this check automatically.

**Synthetic scale bar on the sheet**
*Problem:* Even after calibration there's no ongoing visual sanity check that the scale still
matches the drawing.
*Useful because:* A dashed reference bar of a round length sits on the sheet, so a wrong scale
*looks* wrong against any known dimension.

**Scale zones — a region with its own scale**
*Problem:* Sheets mix a main plan with blown-up details and isometrics at other scales; measuring
into a detail with the page scale gives garbage, and re-scaling the page breaks everything else.
*Useful because:* Wrap the detail in a zone with its own scale, and every line inside it measures
correctly alongside the main plan — the Measure tool honors it too. On a compressed/rescaled
sheet, zone presets inherit the page's sheet-size correction automatically, so detail and plan
agree instead of silently disagreeing by the rescale ratio.

**Multiply zones — count once, multiply totals**
*Problem:* Typical floors and identical units force estimators to count the same layout ten times,
or to remember to multiply by hand in the spreadsheet later (and forget).
*Useful because:* Count one typical floor, wrap it in a ×10 zone, and every total in every export
reflects all ten automatically. Every counter total surface shows the multiplied ("with repeats")
number — sidebar badges, Choose tab, Summary, footer, legend, report all agree — and hovering a
sidebar/Summary badge shows the placed count.

---

## 3. Counting

**Counters — named point symbols with custom color and icon**
*Problem:* The manual clicker-and-highlighter count is slow, unauditable, and impossible to
reconstruct when someone asks "which ones did you count?"
*Useful because:* Every count is one click that leaves a visible, color-coded mark on the plan, and
the tally updates live across the whole project. Creating is two clicks, not data entry: the Create
tab opens prefilled with the next unused icon's name (a fresh project's C hotkey lands straight on
it), and an exact duplicate create is auto-renamed ("Water Closet 2") in a fresh color so a stray
double-create can't silently split a tally.

**Custom SVG icon upload + bundled trade icon library**
*Problem:* Generic dots make a marked-up plan unreadable to anyone but its author.
*Useful because:* Counters can look like the actual fixture (floor drain, P-trap, 45-elbow, water
heater), so the takeoff doubles as a legible drawing anyone can review. A search box above the
icon grid filters the library by name, so finding the right symbol is a few keystrokes instead of
scrolling ~250 cells.

**Groups — subtotals for related items**
*Problem:* A dense sheet with hundreds of marks becomes an undifferentiated cloud; restroom groups
and risers need their own numbers.
*Useful because:* Assign marks to groups and get subtotals per area — the plan stays organized and
the numbers stay auditable.

**Counter settings — size, opacity, rings, count numbers, outline**
*Problem:* Marks that are readable at fit-zoom vanish at print scale, and vice versa.
*Useful because:* You tune mark appearance once and stay legible on screen, in exports, and in
print.

**Quick Count / Quick Plumbing / Quick Line creators (Size / Type / Material pickers)**
*Problem:* Building a palette by typing "2\" PVC Waste" forty times is data entry, not estimating.
*Useful because:* Two clicks on modifier chips create a correctly-named, correctly-colored palette
item — and your modifier preferences follow your account. A new Quick Count counter never
duplicates an existing counter's icon+color: the color auto-rotates to a free palette entry, and
the panel previews the exact color it will mint.

**Show only on current page**
*Problem:* On multi-sheet projects the sidebar fills with every sheet's items, drowning the ones
that matter now.
*Useful because:* One toggle filters the lists to the current sheet, so what you see is what you're
counting.

---

## 4. Measuring

**Quick lines (two-click) and polylines (multi-vertex)**
*Problem:* Tracing runs with a scale ruler or measuring wheel on paper is the single biggest time
sink in a linear takeoff.
*Useful because:* Click the path and the real-world length lands in the totals instantly, read off
the calibrated scale. With a line type active, P starts tracing immediately — no dialog.

**Arc line types**
*Problem:* Curved runs measured as straight chords under-count material.
*Useful because:* Arc-style line types measure along the sweep, so long-radius work is priced from
its true length.

**Line drops (start/end vertical footage)**
*Problem:* Plan-view takeoffs systematically miss vertical pipe — risers, stacks, and drops between
floors — which is real material and labor (a 12–18% under-measurement class).
*Useful because:* Add a drop value at either end of a run and the vertical footage joins the total,
visible on the plan as an explicit marker.

**Measure tool (D)**
*Problem:* Checking one dimension shouldn't require creating takeoff data you then have to delete.
*Useful because:* Two clicks give a distance readout — scale-zone aware — and leave the takeoff
untouched.

**Snap to 45° angles (J)**
*Problem:* Freehand traced lines wander a few degrees, which looks sloppy and measures slightly
long or short — and real pipe runs at 90s and 45s anyway.
*Useful because:* Lines lock to the eight angles fittings actually come in, so the takeoff is both
cleaner and truer to the built condition.

**Grid overlay with snap**
*Problem:* Layouts on a regular module are tedious to trace consistently.
*Useful because:* An adjustable grid with snapping keeps marks aligned to the module with zero
extra effort.

**Room Sizer — room boxes with ceiling heights (V)**
*Problem:* HVAC sizing starts from room air volume, and computing ft² and ft³ per room by hand off
a plan is slow, error-prone spreadsheet work.
*Useful because:* Two corners plus a ceiling height give floor area and air volume per room —
L-shaped rooms sum from multiple boxes — feeding airflow, air-change, and equipment-sizing math
directly.

**Always-feet totals**
*Problem:* Plan sets mix scale units (inches, feet, metric), and summing mixed units is a classic
silent takeoff error.
*Useful because:* Every tally converts to decimal feet *before* summing, so totals agree across
mixed sheets and match what pricing tools expect.

---

## 5. Annotating & reviewing

**Highlights**
*Problem:* "Look at this area" shouldn't require an email with a screenshot.
*Useful because:* A translucent rectangle flags a region right on the sheet without touching any
counts.

**Notes — movable, resizable, editable**
*Problem:* Questions and answers about a drawing scatter across texts and emails, divorced from the
spot they're about.
*Useful because:* Notes live on the sheet at the point in question and travel with the project —
and can be bundled into the exported PDF.

**Legend overlay**
*Problem:* Tallies that live only in a side panel disappear the moment you print or export.
*Useful because:* A draggable on-canvas legend shows live counts and lengths by type, and it prints
with the sheet so the deliverable carries its own summary.

**Hide marks (eye toggle)**
*Problem:* Sometimes you (or a GC) need to read the bare drawing under a dense takeoff.
*Useful because:* One tap peels the entire overlay off and one tap brings it back — purely visual,
data untouched, and viewers on share links get it too — and hidden marks can't be
grabbed by accident.

**Canvas layers — multiple overlays per page**
*Problem:* Alternates, bid options, and multiple trades on one sheet either collide in one layer or
force duplicate projects.
*Useful because:* Each sheet holds independent overlay canvases you switch with the arrow keys —
base bid on one layer, alternate on another, same drawing.

**Show-all-canvases peek**
*Problem:* Comparing two options means flipping back and forth and holding one in memory.
*Useful because:* A toggle shows every layer at once for comparison without changing what you're
editing — and right-clicking the button narrows the peek to the current layer plus just the one
or two you pick, so a five-layer sheet compares two options cleanly.

**Context menus (right-click / long-press)**
*Problem:* Fixing one mark by hunting for it in a side panel breaks flow.
*Useful because:* Right-click any mark to edit or delete it in place, with its name shown so you
know exactly what you're touching.

**Right-click tool settings**
*Problem:* Settings buried in menus mean most users never find them.
*Useful because:* Right-click any tool button for its settings — options are discoverable exactly
where the tool lives. The Move and Measure tools' entry is **Set / edit scale**, so the page's
scale stays one right-click away after it's set instead of hiding behind the Set Scale tool —
and a wrong Measure readout is one right-click from its fix.

**Delete Area tool**
*Problem:* Clearing a region of marks one by one (a redesigned area, a wrong count) is minutes of
clicking with mistakes likely.
*Useful because:* Rubber-band the region, see a count of exactly what will be removed, confirm
once.

**Undo/redo — 50 steps (Ctrl+Z / Ctrl+Shift+Z)**
*Problem:* Rapid clicking means rapid mistakes, and shallow undo histories make estimators afraid
to move fast.
*Useful because:* Fifty steps of instant undo make speed safe.

---

## 6. Speed & navigation — why it stays fast on big sets

**Instant zoom and pan (wheel, pinch, zoom rail)**
*Problem:* The #1 complaint about cloud takeoff tools is lag on dense, multi-sheet plan sets — the
sheet re-renders for seconds after every zoom and the view "moves under you."
*Useful because:* Rendering is cached, ladder-stepped, and moved off the main thread, so zooming a
dense CAD sheet re-sharpens continuously instead of freezing.

**Background page warm-up**
*Problem:* Jumping deep into a 40-page set means a cold multi-second render on every first visit.
*Useful because:* After a document opens, idle time pre-renders every page (your marked pages
first) — a status hint shows progress, and the whole set flips instantly about 15 seconds in.

**Persistent render cache across sessions**
*Problem:* Reopening yesterday's project pays the full render cost all over again.
*Useful because:* Rendered sheets persist on-device, so daily projects reopen already warm.

**Zoom rail**
*Problem:* Precise zoom control with a mouse wheel or pinch is fiddly, especially on touch devices.
*Useful because:* A large log-scale slider with labeled ticks gives exact, repeatable zoom levels
on any input device.

**Aim loupe (mobile press-and-hold)**
*Problem:* A fingertip covers exactly the spot you're trying to mark on a phone or tablet.
*Useful because:* Press-and-hold raises a magnified loupe with a crosshair, so touch placement is
as precise as a mouse.

**Tool hotkeys (M, S, C, L, P, D, H, N, V, X, R…)**
*Problem:* Mousing to a toolbar between every action doubles the motions in a thousand-action day.
*Useful because:* Every tool is one key, so the mouse hand never leaves the plan.

**Keyboard Map**
*Problem:* Shortcut lists are reference cards nobody reads, so most shortcuts go unused.
*Useful because:* A visual keyboard lights up every mapped key — you *see* the whole shortcut
surface at a glance, and hovering a key names its action.

**Quick Keys — your palette on the number row (1–0)**
*Problem:* The slowest part of a busy sheet isn't placing marks, it's switching *what* you're
placing — a sidebar trip and a visual scan, hundreds of times a day.
*Useful because:* Bind your own counters and line types to the number row; switching is a
keystroke, bound items wear their digit as a sidebar badge, and the layout follows your saved
Artboard from bid to bid.

---

## 7. Output & reporting — where the numbers go

**Live footer totals**
*Problem:* "Where am I on this bid?" shouldn't require opening a report.
*Useful because:* A running `[counts | length]` across all pages and canvases — zones applied — is
always in view.

**Summary panel + per-count detail drill-down**
*Problem:* A bare total invites the question "counted where?" — and most tools can't answer it.
*Useful because:* Click any total for a per-page breakdown with thumbnails showing exactly where
every item sits; the takeoff audits itself.

**Show Report**
*Problem:* Assembling a client-ready quantity breakdown by hand duplicates work you already did.
*Useful because:* One click builds a printable report scoped to a canvas, a page, or the whole
project.

**Export PDFs — marked-up deliverable with report and annotations bundled**
*Problem:* The takeoff deliverable usually means screenshots pasted into documents, or a separate
markup pass.
*Useful because:* Export selected pages (or just the marked ones) with adjustable marker/line
sizes, the report appended, and highlights and notes baked in — one file, ready to send.

**Copy to PipeTooling — takeoff straight into the bid**
*Problem:* The most-cited gap in tools like Bluebeam: takeoff data dead-ends in the PDF and must be
retyped into the estimating system, an hour of transcription with error risk on every row.
*Useful because:* One click puts the entire takeoff on the clipboard as tab-delimited counts —
with a view link back to the source plan — ready to paste directly into pricing. Before copying,
a scale check (shared with Copy Summary) flags any exported page whose lines were traced without
a scale (pages without marks don't count), and unscaled runs export as separate `px of` rows —
a pixel length can't silently ride into a priced feet total.

**Copy Summary (email/text)**
*Problem:* A quick "here's where the count stands" email means retyping numbers.
*Useful because:* A plain-text summary lands on the clipboard formatted for pasting into an email
or a text. It runs the same pre-copy scale check, and unscaled runs appear as their own `px`
bullets flagged "no scale set" — never summed into the feet numbers.

**Download current page**
*Problem:* Sharing one sheet's markup shouldn't require exporting the whole project.
*Useful because:* The current sheet — marks included — downloads as a single PDF in one click.

**Canvas JSON export/import**
*Problem:* Moving takeoff data between projects or colleagues usually means moving giant PDFs too.
*Useful because:* The marks alone travel as a small file and re-attach to the matching PDF by
content hash on the other side.

---

## 8. Cloud & collaboration

**Auto-save every 5 seconds + layered local backups**
*Problem:* Estimating tools with manual save (or fragile cloud sync) lose afternoons of counting to
a crash, a dead battery, or a dropped connection.
*Useful because:* Work saves continuously to the cloud *and* to on-device backups, with a hardened
sync engine (retries, backoff, connection recovery) built from real field failure cases. The
last-session restore prompt now works signed-out and fully offline (the boot candidate is keyed
aside so no post-boot write can clobber it), and a hash-verified same-PDF re-upload re-applies
the backed-up marks.

**Save Status indicator + exportable diagnostic log**
*Problem:* "Did that save?" is an anxiety question in every cloud tool, and support tickets start
from zero information.
*Useful because:* A header bell shows synced/saving/offline at a glance, and one click exports a
diagnostic log that lets a problem be root-caused from the user's own machine.

**Project sharing with viewer/editor roles**
*Problem:* Takeoffs shared as email attachments fork instantly — nobody knows which copy is
current.
*Useful because:* Everyone opens the same live project, with roles deciding who can look and who
can change.

**Check-out / turn-in — one editor at a time**
*Problem:* Two people editing the same estimate silently overwrite each other — the classic shared-
file disaster.
*Useful because:* Editing requires checking the project out; everyone else reads until it's turned
in, and the lock self-releases after 30 idle minutes so a walk-away never strands the project.

**View links — email-gated, no sign-in, access-logged, revocable**
*Problem:* Showing a takeoff to a GC, owner, or inspector usually means either buying them a seat
or flattening everything into static PDFs.
*Useful because:* Send a URL; they enter a work email and see the live takeoff — no account, every
access logged, and you can revoke the link anytime. A dead or revoked link shows the recipient an
honest full-screen note to ask the sender for a new one (never a broken-looking editor), and
revoking truly stops repeat visits even when the recipient has an offline cached copy.

**Viewer scale sharing**
*Problem:* A viewer who spots a missing scale has no way to fix it, so the question round-trips
through email.
*Useful because:* A view-link recipient can set a page's scale and it writes back to the project
(with a notice to the owner), closing the loop in the field.

**Artboard — your palette in the cloud**
*Problem:* Rebuilding the same counters, line types, and modifier preferences for every new bid is
pure setup tax.
*Useful because:* Save your palette once and it follows your account to any device — new bids
start with your standards, including your Quick Key layout. Loading mid-bid is safe too: placed
marks re-link to the loaded counters and lines by name (unmatched ones keep counting under a
visible "Unknown" row), and undo brings the old palette and counts back.

**Palette Insights**
*Problem:* Your real standards live implicitly across old projects, and nobody remembers exactly
what they were.
*Useful because:* One view shows which counters and line types you actually use across all your
projects, with one-click adds of the proven ones to your Artboard.

**Admin toolkit — users, projects, activity, force turn-in, global reload**
*Problem:* Team tools usually externalize administration to a separate console (or a support
ticket).
*Useful because:* Admins create users, reset passwords, transfer project ownership, force a
turn-in, audit per-user activity, and push an update to every open tab — all inside the app.

---

## 9. Platform — where and how it runs

**Runs in any browser, nothing to install**
*Problem:* PlanSwift and On-Screen Takeoff are Windows-desktop installs; per-machine licensing and
IT involvement gate who can even open a takeoff.
*Useful because:* Any modern browser on any OS is the whole requirement — a login is the only
setup.

**Installable app (PWA)**
*Problem:* Browser tabs get lost, and field users expect an app icon.
*Useful because:* Add to home screen on phone, tablet, or desktop for a one-tap, full-screen app.

**Full offline mode**
*Problem:* Cloud takeoff tools require constant internet — useless in basements, mechanical rooms,
and half of all job-site field offices — while desktop tools never leave the office PC.
*Useful because:* Once a takeoff is loaded, counting, measuring, and markup all work with zero
signal, auto-saving locally and syncing when the connection returns.

**Touch-first tablet support**
*Problem:* Desktop-era takeoff tools treat touch as an afterthought, making field verification a
clipboard job.
*Useful because:* Pan, pinch, long-press context menus, and the aim loupe make marking plans on a
tablet feel native.

**Works fully without the cloud**
*Problem:* Subscription tools stop working when the subscription (or the vendor) does.
*Useful because:* With no account at all, the app is still a complete local takeoff tool — the
cloud adds sharing and sync, it isn't a hostage-taker.

---

## The one-paragraph pitch this adds up to

Estimators lose their days to three things: counting and measuring by hand, fighting heavy
per-seat desktop software that can't leave the office, and retyping takeoff numbers into pricing.
CountTooling is a takeoff tool that lives in the browser — fast on dense plan sets, accurate down
to the scale-verification layer, offline-capable on a tablet in the field, shareable by link
instead of by seat, and one paste away from a priced bid.
