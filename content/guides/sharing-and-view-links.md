---
title: Sharing takeoffs and view links
description: Work together without stepping on each other — share projects with viewers or editors, check out to edit, and send email-gated view-only links that need no sign-in.
updated: 2026-07-31
order: 7
icon: share
category: Collaboration
---

When a project lives in the cloud, more than one person can work with it — safely, without overwriting each other.

## Viewers and editors

Open the Share dialog from the **Share** [[share]] button in the header (or Project Settings → Share), add people by email, and pick a role:

- **Viewer** — can open and browse the takeoff but not change it.
- **Editor** — can make changes, one editor at a time (see check-out below).

Any project member can add people, and roles can be changed or removed from the same dialog later.

## One editor at a time (check-out)

To avoid two people saving over each other, editing uses **check-out**: an editor checks the project out to make changes, and **turns it in** when done to release it. The lock holds while you're active and expires after about 30 minutes of inactivity, so a project never stays stuck if someone walks away. (Admins can force a turn-in if needed.) When the project frees up, anyone waiting is notified that it's available.

## View-only links — no sign-in

Sometimes you just need to show a takeoff to someone who isn't a CountTooling user — a GC, an owner, an inspector. A **view link** does that:

- Create the link from the Share dialog's view-links section and copy the URL. (The header Share [[share]] button copies the project's link directly.)
- The recipient opens it and enters their email — gated to your allowed domain — and views the plans, **no account required**:

![Opening a view link: the recipient enters their work email to view the plans — no account, no install.](/guides/img/view-link-gate.png)

- Each link has an **access log** (who opened it, when), and you can **revoke** any link at any time from the same panel.

## What the recipient sees

The viewer gets the live takeoff — the real marks, tallies, and legend, not a static export — with pan, zoom, page navigation, and canvas layers to browse:

![A view-link session: the live takeoff with its tallies and legend. The eye button hides the marks to read the bare drawing.](/guides/img/view-link-viewer.png)

- The **Hide marks** [[hide-marks]] eye peels the takeoff off the drawing and back — handy on a phone, and their choice is remembered per link.
- The **Measure** [[measure]] tool works in view mode, so they can check a dimension themselves in two clicks.
- They can even run **Set Scale** [[set-scale]] on an uncalibrated sheet — the scale **shares back to the project** for everyone, with a notice to the owner. A field question answers itself instead of round-tripping through email.

## Your work is saved as you go

Whether or not a project is shared, CountTooling **auto-saves every few seconds** with local backups, and — once you've loaded a project in the [installed app](/guides/working-offline-and-installing/) — keeps working even without a connection, syncing back up when you reconnect. For what the save indicators mean (and what happens if an edit session expires), see [How your work is saved](/guides/how-your-work-is-saved/).
