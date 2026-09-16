// recent-bids.js - the recent-bids list core, the sibling of recent-colors.js
// and recent-drops.js. Consumed by features/bid-chip.js (the header switcher's
// menu) and written by the cloud load + cloud save paths.
//
// An estimator lives in three or four bids at once and moves between them all
// day. The switcher's menu has to open INSTANTLY, which rules out asking the
// cloud: list_accessible_projects returns a `data jsonb` column, the whole
// takeoff payload for every accessible project, and the Load Project modal
// only gets away with that behind a spinner on an explicit click. So the menu
// reads this list, kept locally and written whenever a bid is opened or saved.
// Clicking a row still pays the RPC, exactly as opening Load Project does
// today, for the same action with three fewer steps.
//
// Entries are { id, name, at } - the cloud project id, its name as of the last
// time we saw it, and an epoch-ms stamp for ordering and the "2h ago" column.
// The list is per device (localStorage), so it works offline and a second
// machine starts empty. That is the accepted v1 trade: see BID-SWITCHER.md D3.

const RECENT_BIDS_MAX = 5;
const RECENT_BIDS_KEY = 'recentBids';

// Recent-bid list update. Pure: depends only on its args, no state/DOM/storage.
// Newest-first, deduped on `id` (a bid that comes back to the top keeps ONE
// row and takes the fresher name, so a rename elsewhere corrects itself the
// next time it is opened), capped at RECENT_BIDS_MAX. An entry with no id is
// ignored: a local-only takeoff has nothing to reopen. Returns a new array;
// never mutates `list`.
function nextRecentBids(list, entry, nowMs) {
  const base = (Array.isArray(list) ? list : [])
    .filter(b => b && typeof b.id === 'string' && b.id)
    .map(b => ({ id: b.id, name: typeof b.name === 'string' ? b.name : '', at: typeof b.at === 'number' ? b.at : 0 }));
  const id = entry && typeof entry.id === 'string' ? entry.id : '';
  if (!id) return base.slice(0, RECENT_BIDS_MAX);
  const row = {
    id,
    name: entry.name ? String(entry.name) : 'Untitled',
    at: typeof nowMs === 'number' ? nowMs : Date.now(),
  };
  return [row].concat(base.filter(b => b.id !== id)).slice(0, RECENT_BIDS_MAX);
}

// Drop one bid from the list - it was deleted, or access was revoked, and the
// direct-load path found it gone. Pure; returns a new array.
function withoutRecentBid(list, id) {
  return (Array.isArray(list) ? list : []).filter(b => b && b.id && b.id !== id);
}

// Relative age for the menu's right-hand column. Deliberately coarse: an
// estimator wants "was this this morning or last week", never a timestamp.
// Trade voice, lowercase, no em dashes.
function formatBidAge(at, nowMs) {
  const t = typeof at === 'number' ? at : 0;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  if (!t || t > now) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + 'w ago';
  return 'a while ago';
}


// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RECENT_BIDS_MAX, RECENT_BIDS_KEY, nextRecentBids, withoutRecentBid, formatBidAge };
}
