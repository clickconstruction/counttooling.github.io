# Writing a rule

Rules in this folder are the source for the **/rules/** section — the public trade
knowledge the app applies, written the way the app applies it, with the section it
comes from. One file per rule at `content/rules/<trade>/<slug>.md`; the trade folder
is the trade. `npm run build:rules` renders `rules/<trade>/<slug>/index.html`, the
searchable `rules/index.html`, and `rules/rules.json` (the same list for software —
the app and any AI read that, never the pages). `npm run check` fails when the
committed output is stale **or when a value in code no longer equals its rule**.

## The front-matter

```
---
id: elec.conduit.fill-limit          # stable, dotted, lowercase. Never rename one.
title: Conduit fill limits
trade: electrical                    # electrical | hvac | plumbing — must match the folder
kind: code                           # code | standard | recommendation | convention
status: applied                      # applied = the app uses it (used_by non-empty); draft = written, not yet wired
summary: One sentence for the index and rules.json.
values:
  - when: 3 or more conductors       # the condition, in words
    value: 40
    unit: "%"
    code: bid-check-model.js#fillLimitFor(3)   # optional: where the app keeps this number
    scale: 100                                # optional: code value × scale must equal value
source:
  code: NEC                          # NEC | IPC | UPC | SMACNA | ASHRAE | …
  section: Chapter 9, Table 1
  editions: [2017, 2020, 2023]       # editions the value was checked against
  url: https://…                     # where the public text can be read
amendments: []                       # [{ jurisdiction: Texas, note: … }] when one changes the value
used_by: [bidCheck]                  # bidCheck | childCount | chain | ductSchedule | roomSizer | quickCreate
updated: 2026-09-09
---
```

Then the body, in Markdown: what the rule says **as the app applies it**, why it
matters on a bid, and what the app does and does not do with it.

## What kind means

- **code** — a model code the AHJ adopts (NEC, IPC, UPC). Cite section and edition.
- **standard** — an industry standard the trade builds to (SMACNA, ASTM, ASHRAE).
- **recommendation** — in a code or standard, but advisory (an NEC Informational Note).
- **convention** — a working figure the trade uses and the app defaults to (mount heights,
  make-up, seam & waste). Say so plainly; these are the ones a shop most often overrides.

## The drift check

A `code:` pointer is `<file>.js#<expr>` — a module with a CommonJS footer and an
expression over its exports: `fillLimitFor(3)`, `VD_K.copper`,
`DUCT_GAUGE_TABLE["1"][0].gauge`. The check walks the exports (no eval). When the
app changes a number, change the rule in the same commit, or `npm run check` says which
one drifted. A rule with no pointer is prose-only — fine for a draft, not for `applied`.

## What not to write

Cite the code; do not reprint it. State the value the app uses and the condition it
uses it under, in your own words, and link the public text. Company practice — what a
shop does that the code does not require — is not a rule here; it lives with pricing.
