// sample-hvac.test.js: the HVAC course's sheets (scripts/sample-hvac.js) hold the numbers the
// HVAC dossier settled on 2026-09-27 (journeys/plans/TESTER-DOSSIER-HVAC-2026-09-27.md, "Settled
// 2026-09-27"). The course compares the reader's takeoff to a reference drawn from these lists, so
// a sheet that drifts from its own schedules is a course that teaches the drift.
const { test } = require('node:test');
const assert = require('node:assert');
const M = require('./scripts/sample-hvac.js');

const num = (t) => Number(String(t).replace(/,/g, ''));
const room = (name) => M.ROOMS.find((r) => r[0] === name);
const equip = (tag) => M.EQUIPMENT.find((r) => r[0] === tag);
const grille = (tag) => M.DIFFUSERS.find((r) => r[0] === tag);
const keynotes = () => M.sheetM101().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('R1: the air balance is outside air in against exhaust out, and RTU-1 prints its outside air', () => {
  const t = keynotes();
  assert.match(t, /AIR BALANCE, OUTSIDE AIR: RTU-1 OA 1,300 \+ MAKE-UP 2,000 IN · EXHAUST 2,400 \+ 270 OUT: BUILDING POSITIVE\./);
  assert.doesNotMatch(t, /SUPPLY 2,650 \+ MAKE-UP/);
  assert.strictEqual(num(equip('RTU-1')[3]), M.AIR.outsideAir);           // the equipment schedule's OA CFM column
  assert.ok(M.AIR.outsideAir + M.AIR.makeup > M.AIR.hoodExhaust + M.AIR.restroomExhaust);
  // the zones' breathing-zone outside air by the table rates (dining 7.5 a person at 70 per
  // 1,000 sq ft plus 0.18 a sq ft, and the dossier's bar, kitchen and other rooms): about 1,205
  const dining = Math.round(num(room('DINING 100')[1]) * 0.07) * 7.5 + num(room('DINING 100')[1]) * 0.18;
  assert.ok(M.AIR.outsideAir >= dining + 243 + 124 + 60, 'RTU-1 brings in at least the rooms\' ventilation');
});

test('R4: the mop room exhausts 1.0 CFM a sq ft on its own grille, and EF-2 carries the three rooms', () => {
  const mop = room('MOP 104');
  assert.ok(num(mop[3]) >= num(mop[1]) * 1.0, 'the janitor closet rate');
  assert.strictEqual(num(grille('EG-2')[3]), num(mop[3]));
  assert.deepStrictEqual(M.DEVICES.EG2, [[885, 200]]);
  const ef2 = ['MEN 102', 'WOMEN 103', 'MOP 104'].reduce((t, r) => t + num(room(r)[3]), 0);
  assert.strictEqual(num(equip('EF-2')[2]), ef2);
  assert.strictEqual(M.AIR.restroomExhaust, ef2);
  assert.strictEqual(num(grille('EG-1')[3]) * M.DEVICES.EG1.length + num(grille('EG-2')[3]), ef2);
});

test('R5, R6, R13, R15, R11: the citations and the keynotes the dossier settled', () => {
  const t = keynotes();
  assert.match(t, /PENETRATION \(IMC 607\.5\)\./);                          // 607.5.1 is fire walls
  assert.match(t, /FLEX DUCT THE SIZE OF THE NECK/);
  assert.match(t, /LISTED WRAP \(ASTM E2336\) ABOVE THE CEILING/);          // the card's "wrap the keynote calls for"
  const n501 = M.sheetM501();
  assert.match(n501, /THE DOORS \(IMC 403\.2\.2\)\. EXHAUST/);               // transfer air
  assert.match(M.sheetM601(), /\(IECC C403, DUCT INSULATION\)\./);
});

test('T3: each size on the main is printed at the vertex where it changes, not 5 ft downstream', () => {
  M.DUCT.main.sizes.slice(1).forEach(([x, y]) => assert.ok(M.DUCT.main.path.some(([px, py]) => px === x && py === y), 'a change sits on a vertex'));
  const t = M.sheetM101();
  M.DUCT.main.sizes.slice(1).forEach(([x, , s]) => {
    const m = new RegExp('<text x="(\\d+(?:\\.\\d+)?)" y="267"[^>]*>' + s + '</text>').exec(t);
    assert.ok(m, s + ' is printed');
    assert.ok(x - Number(m[1]) <= 30 && x - Number(m[1]) > 0, s + ' starts within 30 plan px downstream of its change');
  });
});

test('T5: MAU-1 drops in clear of RTU-1\'s back-rooms run, so its duct does not tap RTU-1', () => {
  const [dx, dy] = M.DUCT.makeup.path[0];
  assert.deepStrictEqual([dx, dy], M.DEVICES.MAU1);
  const back = M.DUCT.back.path;
  const dist = Math.min(...back.slice(1).map(([x2, y2], i) => {
    const [x1, y1] = back[i];
    const L = Math.hypot(x2 - x1, y2 - y1), u = Math.max(0, Math.min(1, ((dx - x1) * (x2 - x1) + (dy - y1) * (y2 - y1)) / (L * L)));
    return Math.hypot(dx - (x1 + u * (x2 - x1)), dy - (y1 + u * (y2 - y1)));
  }));
  assert.ok(dist > 16, 'more than the 12 pt tap snap (16 plan px) off the back-rooms run: ' + dist);
  assert.match(M.sheetM101(), /<rect x="918" y="364" width="16" height="16"/);   // the drop, drawn like RTU-1's
});
