# CountTooling — Value Narratives

Short, honest demo stories for sales conversations, walkthroughs, and onboarding calls.
Each is a thing you can actually show in about ten seconds, the claim it proves, and the
public guide that backs it up. Every script was performed in the live app before it was
written down — nothing here is aspirational.

Companion to [FEATURE-CATALOG.md](FEATURE-CATALOG.md), which covers every feature and the
market context; this document is the *show, don't tell* subset.

---

## The first ten minutes

**Show it:** Click **+ Add** next to COUNTERS — the dialog is already filled in: "Water
Closet", toilet icon, color picked. Click **Create Counter**, then tap, tap, tap across
the restroom: each toilet gets a gold dot while the sidebar tally, the on-plan legend, and
the Summary tick 1-2-3 in real time. Nobody typed a word.

**The claim:** A first-time user goes from an empty app to counted fixtures in about ten
actions including the PDF load — the app already knows you came to count.

**Backed by:** [How to do a PDF takeoff](/guides/how-to-do-a-pdf-takeoff/)

## The daily core: counting and measuring

**Count on the number row.** Press `1` — the toilet counter arms, its digit badge glowing
in the sidebar. Click across the MEN and WOMEN rooms: seven numbered glyphs drop while the
badge and legend tick 1…7 live. Press `2`, count the lavs in blue. Ten seconds, no menus,
and the sheet already looks like a deliverable. *Claim:* your palette lives on the number
row, so switching what you're counting never interrupts the counting.
→ [Counting with counters](/guides/counting-with-counters/) ·
[Working faster with the keyboard](/guides/working-faster-with-the-keyboard/)

**Measure a run, then prove it.** Scale set, press `L`, click both ends of the men's-room
wall — the sidebar ticks "1 · 24.97 ft", legend and footer updating in the same beat.
Press `D`, click the same two points — "Distance: 25'-0"", matching the dimension math
printed on the sheet. *Claim:* lengths come out in real feet-and-inches that agree with
the drawing, and the Measure tool lets anyone check that in two clicks.
→ [Measuring runs, lines, and polylines](/guides/measuring-runs-lines-and-polylines/)

**A palette without typing.** On the Counter modal's Quick tab, pick a Size, Type, and
Material — the name assembles itself ("2\" PVC Waste"), the icon follows the type, and
**Add** leaves it armed. *Claim:* a new bid's palette takes a minute, not fifteen, and
every name comes out spelled the same way, so tallies and pricing group cleanly.
→ [Building your palette in two clicks](/guides/quick-creators/)

## Numbers you can defend

The differentiating storyline: most takeoff tools assume their numbers are right —
CountTooling *proves* its numbers are right, in front of the customer.

**The scale that catches its own mistake.** On a rescaled ("compressed") PDF, apply a
preset with the wrong sheet guess still selected, then run **Verify by measuring**: click
both ends of a printed 65'-0" dimension and type 65. The app answers: *"Expected 65'-0" /
Current scale reads 173'-1" / Off by about 166% (reads long). Use measured to fix it."*
One click on **Use measured** and the plan carries a dashed 65'-0" reference line pinned
exactly where you clicked — the receipt. *Claim:* CountTooling detects rescaled sheets,
walks corrected scales straight into a two-click verification, and names the size of any
error in plain English — the exact failure mode that silently ruins bids elsewhere.
→ [Is your scale lying to you?](/guides/verifying-your-scale/)

**Pixels never masquerade as feet.** Draw a line on a page with no scale, then open any
total — footer, legend, report, or either copy button. The unscaled run sits in its own
`px` bucket (`12.50 ft + 200 px`), never summed into the feet number. *Claim:* a length
the app can't vouch for is never hidden inside a total it didn't earn.
→ [Reports and exports](/guides/reports-and-exports/) ("Pages without a scale")

**The handoff that saves the bid.** Click **Copy to /Tooling** with one page still
unscaled: the app stops you cold, names the exact page whose lines would copy in pixels,
and offers to jump you straight to Set Scale. Fix it, copy again — the pasted total flips
from a quietly-wrong 401.20 ft to the true 74.80 ft. *Claim:* the handoff to pricing has a
scale check built in, so a wrong number is caught at the copy button, not at bid opening.
→ [Reports and exports](/guides/reports-and-exports/)

**Click a total, see the proof.** Click "Water Closet [11]" in the Summary — a by-page
breakdown opens: 7 on p1, 4 on p2, each with a live thumbnail of that sheet showing the
exact dots behind the number. Rotate the page and click again — the proof re-renders,
still matching. *Claim:* every total can show its work — the count per sheet, with a
picture of where each mark sits.
→ [Reports and exports](/guides/reports-and-exports/) ("Count detail")

## Big sets and special sheets

**Trim a 200-sheet set to your trade.** Drop a combined bid set on the app and walk the
Prepare dialog with the Delete button — ten seconds later the label reads "Page 1 of 4"
over P-101, the civil/arch/struct pile gone. **Download Trimmed PDF** hands you a clean
P-set named after the job. *Claim:* trim once and everything after stays focused — and
addendum sheets join later without renaming the project or moving a single existing mark.
→ [Preparing a plan set](/guides/preparing-a-plan-set/)

**Details at another scale; typical floors ×3.** Measure a wall: 19'-9". Ring the detail
with a Scale Zone, tap its preset, measure again: 9'-10" — the zone's scale label sits
right on the sheet. Ring a typical restroom with a ×3 Multiply Zone: the dialog reports it
caught 3 counters and the Summary jumps 7 → 13 while the plan stays clean. *Claim:*
mixed-scale sheets and repeated layouts are two clicks each — multiplication happens in
the totals, never by cloning marks.
→ [Scale zones and multiply zones](/guides/scale-zones-and-multiply-zones/)

**Rooms to ft² and ft³ in one pass.** Two clicks across Office 101 — the dialog already
knows "23'-11" × 20'-1" — 479 ft² Floor Area". Type a ceiling height of 9 and "3,665 ft³
Air Volume" appears live. Apply: the room is labeled on the plan, the sidebar tallies area
and volume, and the next room is already armed with your height. *Claim:* equipment-sizing
math falls out of the takeoff as you draw it.
→ [Measuring room volumes](/guides/measuring-room-volumes/) ·
[Doing an HVAC takeoff](/guides/hvac-takeoff/)

## Working clean

**Delete with a receipt, undo with one key.** Pick Delete Area, tap two corners around
the messy part of the sheet — before touching anything the app answers with a receipt:
"In this area: 10 counter(s), 1 line run(s) (35.70 ft), 1 note(s)." Click Delete, then
press Ctrl+Z — everything comes back. *Claim:* the app counts before it deletes, and
nothing is ever more than one undo away.
→ [Fixing mistakes and editing marks](/guides/fixing-mistakes/)

**One eye for the bare drawing, one for the alternate.** On a dense sheet, click the
header eye: fourteen fixtures, the waste line, notes and legend all peel off in one frame
— bare drawing, sidebar tally still standing. Click again and the takeoff snaps back.
Then tap the layers peek eye: the cast-iron alternate draws over the base bid on the same
sheet. *Claim:* "what's under my marks?" and "how do the options compare?" — the two
questions that eat review time — are one click each.
→ [Highlights, notes, and reading the bare drawing](/guides/annotating-and-reviewing/) ·
[Canvas layers](/guides/canvas-layers/)

## Deliverables

**The attachment the GC actually wants.** Open a marked set, click **Export PDFs**, click
**Download** — under a second later you're holding one file: takeoff report up front,
every marked sheet behind it, your margin notes at the back. *Claim:* two clicks and
nothing to configure between a finished takeoff and the email attachment.
→ [Reports and exports](/guides/reports-and-exports/)

## Your work is safe

**Close the browser, come back, keep counting.** Mid-count, three fixtures marked, close
the browser. Reopen: "Project from Last Session — Keep and Open." One click and the plan,
the counter, and all three marks are back in about a second — signed in or not, online or
not, nothing typed. *Claim:* a day's work survives a closed tab, a dead battery, or a
lost signal — the restore needs no account and no internet at all.
→ [How your work is saved](/guides/how-your-work-is-saved/)

**The basement takeoff.** Phone flat on a pipe rack, network dead. Tap Counter, Create
(the placeholder already says Water Closet), then tap across the restroom — the legend
ticks "Water Closet [3]" live. Press and hold: a magnifier balloons over the fixture with
a crosshair; slide a hair, lift — the mark lands exactly where the crosshair pointed, not
under your finger. *Claim:* touch, offline, and fingertip precision are first-class — the
takeoff works where the work is.
→ [Takeoffs on a tablet in the field](/guides/takeoff-on-a-tablet/) ·
[Working offline and installing](/guides/working-offline-and-installing/)

## Sharing without friction

**The link that needs no account.** One click on the share icon — "View link copied" —
text it to the GC. On their phone: tap the link, type their email, Continue — the live
marked-up plan is on screen in seconds, tallies and legend included, nothing to install.
They tap the ruler, two taps on a run: "Distance: 25'-0"". *Claim:* showing a takeoff to
a GC, owner, or inspector is one text message, and what they see is the live takeoff, not
a stale screenshot. Every access is logged, any link can be revoked — and a revoked link
says so plainly instead of dumping the recipient somewhere confusing.
→ [Sharing takeoffs and view links](/guides/sharing-and-view-links/)

**One editor at a time, no stepped-on saves.** Two estimators, one project: the second
sees who has it checked out; the first turns it in (or walks away — the lock expires on
its own) and the second picks it up with a notification. *Claim:* collaboration is
check-out/turn-in, like a set of keys — one sentence to explain, safe enough for a bid.
→ [Sharing takeoffs and view links](/guides/sharing-and-view-links/)

## Standards that compound

**Your history builds your palette.** Open Palette Insights and click "Analyze My Usage":
seconds later, a ranked list of your real standards — "Water Closet — 11 projects · 431
placed [+ Add]". One click and it's on today's bid, with a toast confirming it also
joined your saved Artboard. *Claim:* your best-earned standards come out of your own
project history and onto the next bid in one click, and they follow your sign-in to any
device.
→ [Your palette, every bid](/guides/artboard-and-palette-insights/)

**A team with nothing to set up.** Open `/guides/` signed out and tap the **Admin
handbook** card — the whole playbook is public: create users, hand out passwords, reset
them, transfer projects, force a turn-in, read the activity log. *Claim:* nothing to
install, nothing to configure — accounts are set up for you, and the team's entire admin
manual is already published.
→ [Admin handbook](/guides/admin-handbook/)

## Why the numbers hold up

A closing note for the skeptical prospect — the engineering habits behind the demos:

- **Measured means measured.** Curved runs are integrated to full length (an arc is never
  shorter than its own chord — there's a unit test for exactly that), lengths resolve
  through the page's verified scale, and anything the app can't vouch for is labeled
  `px`, never folded into a feet total.
- **Verification is on the happy path.** A corrected preset scale doesn't just warn — it
  walks you into a two-click check against a printed dimension, and the reference line it
  leaves on the plan is a permanent receipt.
- **Recovery is assumed.** Autosave every few seconds, local backups that restore in
  about a second even signed out and offline, a 50-step undo, and delete confirmations
  that count what they're about to remove.
- **Failure states tell the truth.** A revoked view link says it's revoked. A connection
  problem offers Retry. An unscaled page is named before its numbers can be copied.

Every guide linked above is public at
[counttooling.com/guides](https://counttooling.com/guides/) — prospects can read the
documentation for anything shown in a demo before they ever sign in.
