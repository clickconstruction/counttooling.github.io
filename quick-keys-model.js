// quick-keys-model.js - the pure core of the Quick Keys dialog
// (features/quick-keys.js): which key is armed next, and in what order the
// palette is listed for a search. No state, no DOM.
//
// The dialog is ONE armed key and ONE list. A pick lands on the armed key and
// the next empty key arms itself, so ten keys are ten picks. That only works
// when the list puts the right row first, which is this file's job:
//
//  - No search: counters, then line types, and inside each the items the
//    project has PLACED come first, most used first. A key is for what is
//    being counted, and that is what the sheets already carry.
//  - A search: every word typed must be in the name, read without spaces,
//    hyphens or case ("wc1" finds "WC-1", "valve ball" finds "Ball Valve 1").
//    A name that STARTS with what was typed comes first, then a name with a
//    word that starts with it, then the rest. Ties go to the more used item,
//    then to palette order.

// Physical left-to-right order of the number row. '0' is last because that is
// where it sits on a keyboard.
const QUICK_KEY_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function quickKeyNorm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function quickKeyIsBound(bindings, slot) {
  const b = bindings && bindings[slot];
  return !!(b && b.id && b.kind);
}

// The key the dialog opens on: the first empty one, or 1 when all ten are held.
function firstOpenQuickKeySlot(bindings) {
  return QUICK_KEY_SLOTS.find((s) => !quickKeyIsBound(bindings, s)) || QUICK_KEY_SLOTS[0];
}

// The key that arms after a pick lands on `fromSlot`: the next empty one to its
// right, wrapping. With every key held it stays where it is.
function nextOpenQuickKeySlot(bindings, fromSlot) {
  const at = QUICK_KEY_SLOTS.indexOf(String(fromSlot));
  if (at < 0) return firstOpenQuickKeySlot(bindings);
  for (let j = 1; j <= QUICK_KEY_SLOTS.length; j++) {
    const s = QUICK_KEY_SLOTS[(at + j) % QUICK_KEY_SLOTS.length];
    if (!quickKeyIsBound(bindings, s)) return s;
  }
  return QUICK_KEY_SLOTS[at];
}

// Which key holds this item, or null. First match wins.
function quickKeySlotOf(bindings, kind, id) {
  return QUICK_KEY_SLOTS.find((s) => {
    const b = bindings && bindings[s];
    return !!(b && b.kind === kind && b.id === id);
  }) || null;
}

// 0 = the name starts with what was typed, 1 = a word of it does, 2 = it is in
// there somewhere, -1 = no match.
function quickKeyMatchScore(name, query) {
  const tokens = String(query == null ? '' : query).toLowerCase().split(/\s+/).map(quickKeyNorm).filter(Boolean);
  if (!tokens.length) return 0;
  const flat = quickKeyNorm(name);
  if (!tokens.every((t) => flat.includes(t))) return -1;
  if (flat.startsWith(tokens.join(''))) return 0;
  const words = String(name == null ? '' : name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(tokens[0]))) return 1;
  return 2;
}

// items: [{ kind: 'counter'|'lineType', id, name, used }] in palette order,
// `used` the number placed (counters) or the runs drawn (line types).
// Returns a new array of the same objects; never mutates `items`.
function rankQuickKeyItems(items, query) {
  const rows = (Array.isArray(items) ? items : []).map((it, i) => ({ it, i, used: Number(it && it.used) || 0 }));
  const hasQuery = quickKeyNorm(query).length > 0;
  if (!hasQuery) {
    const kindOrder = (k) => (k === 'counter' ? 0 : 1);
    return rows
      .sort((a, b) => kindOrder(a.it.kind) - kindOrder(b.it.kind)
        || (b.used > 0) - (a.used > 0)
        || b.used - a.used
        || a.i - b.i)
      .map((r) => r.it);
  }
  return rows
    .map((r) => Object.assign(r, { score: quickKeyMatchScore(r.it.name, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || b.used - a.used || a.i - b.i)
    .map((r) => r.it);
}

// The row the list lights after a render: the first one not already on a key,
// so Enter, Enter, Enter walks SK-1, SK-2, SK-3 onto three keys.
function firstUnboundQuickKeyIndex(ranked, bindings) {
  const list = Array.isArray(ranked) ? ranked : [];
  const i = list.findIndex((it) => !quickKeySlotOf(bindings, it.kind, it.id));
  return i < 0 ? 0 : i;
}

const QUICK_KEYS_MODEL_API = {
  QUICK_KEY_SLOTS, quickKeyNorm, firstOpenQuickKeySlot, nextOpenQuickKeySlot,
  quickKeySlotOf, quickKeyMatchScore, rankQuickKeyItems, firstUnboundQuickKeyIndex,
};
if (typeof window !== 'undefined') window.QuickKeysModel = QUICK_KEYS_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = QUICK_KEYS_MODEL_API;
