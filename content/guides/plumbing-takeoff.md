---
title: Doing a plumbing takeoff
description: Count fixtures, chain a battery with its risers, let hangers and elbows count themselves, multiply typical floors, and hand a plumbing takeoff to the bid.
updated: 2026-09-21
order: 9
icon: polyline
category: By trade
---

A plumbing takeoff is fixtures, the pipe that connects them, and everything that pipe drags along with it: risers the plan view never shows, a hanger every few feet, an elbow at every turn. CountTooling counts the first two from your clicks and derives the rest from the pipe.

**New here?** Open the app with nothing loaded and click **plumbing** under *take the five-minute tour* (or open it directly: [the plumbing tour](/app/?tour=plumbing)). It walks this article on the sample plan, circles where to click and shades where to drag, checks each step against what you actually did, and offers *Show me where* when you cannot find something. The picture below is the takeoff that tour ends with. Two short lessons go deeper on sample sheets: [Chain and child counts](/app/?lesson=chain) and [Check and prove](/app/?lesson=check). For the why as well as the how, [the plumbing course](/app/?course=plumbing) is nine chapters on an engineer's restaurant set: where the water, waste and gas run, why, how to count each, and your takeoff against the reference ([Learn CountTooling by doing](/guides/learning-the-app/) lists them).

![The plumbing tour's finished takeoff: water closets and lavatories counted in Women 108, a chained 1in PEX branch, a ×3 zone around the room, and a Summary that lists the fixtures, the pipe and the hangers counted from it.](/guides/img/plumbing-tour-takeoff.png)

## Prove the scale before anything else

[Set the scale](/guides/setting-the-scale/) from the title block, then pick **Measure** [[measure]] (press `D`) and click both ends of a dimension the drawing prints. If a 20'-0" wall does not read 20'-0", stop and set it again: a PDF printed down to a smaller sheet looks right and measures short, and every foot of pipe after it is wrong by the same amount. [Verifying your scale](/guides/verifying-your-scale/) covers the sheet-size warning that catches most of these for you.

## Count the fixtures

Make a **counter** [[counter]] per fixture type: water closets, lavatories, urinals, floor drains, hose bibbs. The icon picker's plumbing set ships the symbols, so the mark reads like the drawing; [upload your own](/guides/custom-icons/) when your shop draws them differently. The **Quick** tab builds a counter from Size / Type / Material in two clicks and spells it the same way on every bid ([Quick creators](/guides/quick-creators/)).

Then click each fixture. One click is one tally, and the sidebar total rolls up across every sheet in the set, not just the one you are on. [Groups](/guides/organizing-a-busy-sheet/) subtotal a restroom or a riser stack at a time when a set gets busy.

## Give the fixtures their water

On a plumbing project every counter has a **Fixture units** field. Name it the way the trade does (*Lavatory*, *WC*, *Urinal*, *Mop sink*) and the app prefills its water supply fixture units from the IPC table for the project's occupancy (Project Settings, beside the code editions: public on a commercial bid, private on a dwelling), with a chip naming the row it read; type over it and the counter keeps yours. Then give the water pipe a side: the line type's **Water** field (Cold or Hot, prefilled from a name like *3/4in PEX hot*) makes every run of that type a water run, and each fixture attaches to the nearest run of each side it needs, a dashed tie showing the connection. The line type row reads how many fixture units its runs serve; a fixture nothing reaches gets **Attach to nearest run** on its right-click menu. Then trace the main as a polyline in that type: a card above the sheet reads the fixture units still to serve beyond your cursor and the smallest size of the pipe's material that keeps the water under the trade's velocity (8 feet per second cold, 5 hot), naming your size as over when it is. Press **S** for the whole ladder; take a size and the run so far is kept, a line type of that size is made, and the next run starts from the last point. It is the estimator's pencil, not the engineer's pressure calculation; Bid Check keeps that as a line to tick.

## Chain a battery

Three lavatories on one branch are three fixtures and two pieces of pipe. Counting them and then tracing between them is nine clicks. The **Chain** tool [[chain]] (press `T`) does it in three: choose the fixture and the line type in its panel (**+ New counter** makes one right there), then click lav, lav, lav. Every click places the fixture and draws the branch back to the last one.

For runs that are not fixture-to-fixture, trace with **Line** [[line]] and **Polyline** [[polyline]]; [Snap to 45°](/guides/measuring-runs-lines-and-polylines/) (press `J`) keeps them on the angles pipe actually takes.

## Add the footage plan view hides

Pick **Drop** [[drop]] (press `B`), choose a length in its palette, and click the end of a run: that riser's feet join the run's footage. Click the same end again to clear it. A branch that comes up 3 ft from below the slab at every battery is real pipe on the bid and invisible on the sheet. Each drop stays editable in the run's Line Properties.

## Let the pipe count its own hangers and elbows

Open a line type's details (the pencil beside it). Two things there are derived from the pipe, never placed as marks, so they can never drift from it:

- **Child counts.** Under Child counts the app offers the hanger rule for that pipe, read off the type's name: for 1 in PEX, *Hanger · 1 per 32 in*, with a **§ IPC 308.5** chip naming the rule it came from. Click **Add** and every run of that type counts its hangers into the Summary, the report and every export. Delete a run and its hangers go with it. You can add your own rows too (per run, or one every so many feet). The chip opens the rule in the public [rulebook](/rules/), and **Project Settings** picks the code edition your jurisdiction is on.
- **Fittings from bends.** Turn it on and each bend in a polyline counts the fitting nearer its angle, a 45 or a 90, and each drop at an end counts a 90. A small chip at every bend shows what the tally will say. Where a jog only routes around text, right-click that vertex while editing the run and choose **No fitting here** (or force **Count as 45** / **Count as 90**).

## Typical floors and details at another scale

A restroom core that repeats on three floors: drag a [multiply zone](/guides/scale-zones-and-multiply-zones/) [[multiply-zone]] around it and type 3. Every count and every foot inside triples in the totals while the marks stay clean. For an enlarged detail or an isometric drawn at a different scale on the same sheet, wrap it in a **scale zone** [[scale-zone]] so its lengths stay right beside the main plan's.

## Flag what the drawing does not say

Drop a **Note** [[note]] (press `N`) on the spot and start it with `RFI:`. **Copy RFI Flags**, under Export Options, collects every such note across the whole set as one list for the GC.

## Bid Check, then prove the number

The **Bid Check** section in the sidebar says what the app knows and asks what it cannot. For plumbing it judges two rows on its own, *Hangers on every supported run* and *Fittings counted on every pipe run*, and lists the calls only you can make (fixture units against the building drain, trap arm lengths, slope on waste runs, backflow and water-heater venting) as ticks that are saved with the bid. It never blocks an export; it tells you what is still open.

![The Bid Check section open on a plumbing takeoff: the hangers row judged automatically with its IPC chip, the fittings row, and the manual rows below.](/guides/img/plumbing-bid-check.png)

When someone asks where a number came from, click that total in the **Summary**: the breakdown shows the count per sheet with a thumbnail of where every mark sits, zones already applied.

## Hand it off

- **Copy to /Tooling** puts the whole takeoff on the clipboard (fixtures, feet with the risers inside, hangers and fittings under their pipe), ready to paste into the bid in PipeTooling.
- **Copy Summary (Email/Text)** is the same numbers as plain text.
- **Export PDFs** produces the marked-up plan with the report attached. More in [Reports and exports](/guides/reports-and-exports/).

The work saves as you go, so a takeoff started at a desk can be picked up [on a tablet in the field](/guides/takeoff-on-a-tablet/).
