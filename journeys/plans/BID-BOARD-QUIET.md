# BID-BOARD-QUIET: All Bids, quieter

Will, 2026-10-13: Wendi (a lead, LEAD-ROLE) "doesn't love" All Bids. Her screenshot: 41 cards in
the Ready lane, every one a digital twin's backtest, each with a gold Ready badge, a green Fully
cloud badge, the estimator in gold and two gold buttons. The mockups are the canvas "All Bids,
quieter" (https://claude.ai/artifact/NBYM1zccqsVipz8G6yV2zU, five artboards: today as shipped,
A a quiet list with actions on hover, B grouped by estimator, C the decision moved into the bid,
D the cards kept and quieted).

## Why it reads loud

- The lane title says Ready for review (41) and every card says it again in gold, adds a badge
  for the normal case (Fully cloud), prints the estimator in gold and carries two gold buttons.
  Four loud elements per card, times 41, with 82 review buttons on screen.
- A card is 270px tall: seven to a row, the lane scrolls for six screens.
- The intro said "nothing can be changed by accident" above buttons that change a bid's review
  status (written for the overseer's board before the handoff landed).
- Most of all, the bids were not hers to review: the twin fleet's backtests flood a lead's board.
  No restyling fixes that.

## Shipped

- PEOPLE-TWINS (2026-10-13): a People · Twins · All switch beside the search, People by default
  for everyone but an admin, a "N twin bids are off · show twins" line, the estimator filter
  narrowed to the segment, the switch hidden when no bid is twin-owned; the intro rewritten.
  Detail in CHANGELOG.md.

## What is left

1. **C, the review bar in the bid.** On a ready bid opened by someone who `App.canOversee()`, a
   slim bar under the header: how long it has waited, its counts, Request changes…, one filled
   Mark reviewed, and Next ready (the next bid in the lane, so 41 reviews are a loop, not 41
   trips to the board). features/review-flow.js owns it. The board's per-card buttons go once
   it lands; the Overseer guide ("clicks Mark reviewed right on the card") and bid-board.spec.js
   change with it.
2. **A, the board as a list.** One row per bid, 42px: name with the stamp in dim mono, estimator,
   counts, days waiting; actions on the hovered row only; badges for exceptions only (canvas
   only, changes requested); the Ready lane oldest-waiting first. Forty rows to a screen.
3. **B, grouped by estimator**, only once the company has more than two or three human
   estimators; with one or two it is A with a caret.

Decisions still Will's: the Ready lane's sort (oldest waiting first is the assumption), and
whether the board's per-card buttons go when C lands or stay beside it.
