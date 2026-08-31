---
title: Admin handbook
description: Creating users, resetting passwords, transferring projects, forcing turn-in, reading activity, and pushing updates — the admin surfaces inside the app.
updated: 2026-08-31
order: 11
icon: share
category: For admins
---

CountTooling accounts are admin-provisioned — there's no self-signup — so admins run the team from inside the app. Everything below lives in **User Settings** and **Project Settings** and appears only for admin accounts.

## Users

- **Add User** — create an account with email + password and hand the credentials over; new users can sign in immediately.
- **Manage User** — the full user table: role, owned-project count, last sign-in, and last active. Per-row actions:
  - **Email sign-in link** (✉️) — email the user a one-time sign-in link, no password involved. The fastest locked-out rescue: nothing to read over the phone, and their password stays unchanged. The link signs in whichever browser opens it, so tell them to open the email on the device they work from. The button rests for a minute after each send (email rate limit). Users can also get this link themselves — after two failed password tries, the sign-in box offers it.
  - **Set password** (🔑) — reset any user's password and hand it over, for when they need a password they know (for example, a shared tablet that stays signed out).
  - **Transfer projects** (⇄) — move *all* of a user's projects to someone else; stored PDFs and inherited view links move with them.
  - **Overseer toggle** (👁) — grant or remove the read-only [Overseer role](/guides/reviewing-all-bids/): the user sees every bid in the company (the All Bids board) but can never change one. The lit eye and the *Overseer* role label mark who has it.
  - **View activity** (♥) — the per-user activity overview.
  - **Delete** — with a choice: delete the user's projects too, or **reassign them to another user first**. You can't delete yourself.
- **All Users** — the same table, read-only.

## Projects

- **Manage Projects** (Project Settings) lists every project across all users with owner, size, and counts. From here you can **delete** any project (including its stored PDF) or **Force turn-in** one that's checked out — the escape hatch when someone left for the day holding the lock. (Checkout also expires on its own after ~30 minutes of inactivity; see [Sharing](/guides/sharing-and-view-links/).)
- Admins see **all projects** in Load Project, can check any of them out, and the Load Project list has an admin-only **Advanced** toggle showing who has access to each row.

## Activity

- **Activity log** — the raw event log (per user or all users), plus a summary view with rolling 1/7/30-day counts. (The all-users log opens from the heart button in the Manage Users header.)
- **Activity overview** — click a user's dates cell or heart icon for the rich view: totals, per-event breakdown, active days, and a day-grouped recent feed ("Placed 22 counters · Lobby · 1:56–2:17 PM").
- Every signed-in user has the same view of *their own* history via **My Activity** in User Settings.

## Pushing an update

**Project Settings → Advanced → Global force reload** tells every signed-in tab to refresh (active tabs get a Reload banner; everyone else reloads on next visit), with an optional note like "v1.42 update". Use it after a deploy when you want the whole team on the new version now.

## Sharing controls worth knowing

View links are email-domain-gated, and every access is logged (Share dialog → Access log). Any link can be revoked at any time — see [Sharing takeoffs and view links](/guides/sharing-and-view-links/).
