// Node unit tests for sheet-title-model.js — the pure model that reads a sheet's number and
// title off its title block's text layer (punch row SHEET-TITLE). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const st = require('./sheet-title-model.js');

const W = 1224, H = 792;   // ANSI B, the sample sheets' size
// The office sample's title block, as the app's text-layer primitive returns it
// (samples/sample-plan.pdf), with a little of the plan around it.
const OFFICE = [
  { str: 'LP-1', x: 479, y: 436, w: 6, h: 12 },
  { str: 'OPEN OFFICE', x: 330, y: 470, w: 90, h: 11 },
  { str: 'GENERAL NOTES', x: 985, y: 188, w: 103, h: 12 },
  { str: 'LEGEND', x: 985, y: 488, w: 50, h: 12 },
  { str: 'FLOOR DRAIN', x: 1016, y: 523, w: 65, h: 9 },
  { str: 'WATER HEATER', x: 1016, y: 553, w: 74, h: 9 },
  { str: 'COUNTTOOLING — SAMPLE PLAN', x: 844, y: 648, w: 252, h: 15 },
  { str: 'PROJECT', x: 826, y: 685, w: 51, h: 11 },
  { str: 'SUITE 200 OFFICE TI', x: 892, y: 685, w: 110, h: 11 },
  { str: 'SCALE', x: 826, y: 712, w: 33, h: 10 },
  { str: '1/8" = 1\'-0"', x: 826, y: 725, w: 63, h: 13 },
  { str: 'FIRST FLOOR PLAN', x: 826, y: 746, w: 95, h: 10 },
  { str: 'DATE', x: 960, y: 712, w: 26, h: 10 },
  { str: '07/31/26', x: 960, y: 726, w: 47, h: 12 },
  { str: 'DRAWN: CT', x: 960, y: 746, w: 56, h: 10 },
  { str: 'SHEET', x: 1090, y: 690, w: 33, h: 10 },
  { str: 'A-101', x: 1090, y: 734, w: 71, h: 26 },
  { str: '1', x: 1178, y: 690, w: 4, h: 8 },
];

test('isSheetNumber: sheet numbers yes; tags, rooms, sizes and words no', () => {
  ['A-101', 'P-101', 'FP-101', 'M2.01', 'A1.1', 'E001', 'A-101A', 'a-101', 'A-1', 'S.2', 'ID-501'].forEach((t) => assert.strictEqual(st.isSheetNumber(t), true, t));
  ['A1', 'B', '104', 'OFFICE', 'LP-1A2', '24x12', '1/8"', 'ABCD-101', 'A-', '-101', '', 'A-10101'].forEach((t) => assert.strictEqual(st.isSheetNumber(t), false, t));
});

test('readSheetTitle: the office sample reads "A-101 · First Floor Plan"', () => {
  assert.deepStrictEqual(st.readSheetTitle(OFFICE, W, H), { number: 'A-101', title: 'First Floor Plan', label: 'A-101 · First Floor Plan' });
});

test('readSheetTitle: the project name and the firm banner are never the title', () => {
  const r = st.readSheetTitle(OFFICE, W, H);
  assert.ok(!/SUITE|COUNTTOOLING/i.test(r.label));
  // a project name that itself names a kind of drawing, under its PROJECT label
  const items = OFFICE.map((it) => (it.str === 'SUITE 200 OFFICE TI' ? { ...it, str: 'MASTER PLAN PHASE TWO' } : it));
  assert.strictEqual(st.readSheetTitle(items, W, H).title, 'First Floor Plan');
});

test('readSheetTitle: a panel tag on the plan is not the sheet number', () => {
  // "LP-1" is shaped like a sheet number but sits in the drawing, outside the title-block zone
  const items = OFFICE.filter((it) => it.str !== 'A-101');
  assert.strictEqual(st.readSheetTitle(items, W, H), null);
});

test('readSheetTitle: the tallest number in the zone wins over a referenced one', () => {
  const items = OFFICE.concat([{ str: 'A-501', x: 1000, y: 600, w: 24, h: 8 }]);   // "see A-501" in a keynote
  assert.strictEqual(st.readSheetTitle(items, W, H).number, 'A-101');
});

test('readSheetTitle: a TITLE label points at a title that names no kind of drawing', () => {
  const items = [
    { str: 'SHEET TITLE', x: 1000, y: 650, w: 50, h: 7 },
    { str: 'LEVEL 2 - AREA B', x: 1000, y: 662, w: 120, h: 12 },
    { str: 'SHEET NO.', x: 1000, y: 700, w: 40, h: 7 },
    { str: 'M2.01', x: 1000, y: 712, w: 90, h: 30 },
  ];
  assert.deepStrictEqual(st.readSheetTitle(items, W, H), { number: 'M2.01', title: 'Level 2 - Area B', label: 'M2.01 · Level 2 - Area B' });
});

test('readSheetTitle: a title stacked on two lines is joined, top line first', () => {
  const items = [
    { str: 'ENLARGED RESTROOM', x: 1000, y: 650, w: 130, h: 12 },
    { str: 'PLANS AND ELEVATIONS', x: 1000, y: 665, w: 150, h: 12 },
    { str: 'A-401', x: 1000, y: 712, w: 90, h: 30 },
  ];
  assert.strictEqual(st.readSheetTitle(items, W, H).label, 'A-401 · Enlarged Restroom Plans and Elevations');
});

test('readSheetTitle: a title block down the right-hand strip reads too', () => {
  const items = [
    { str: 'MECHANICAL SCHEDULES', x: 1120, y: 300, w: 90, h: 9 },
    { str: 'M-301', x: 1125, y: 330, w: 70, h: 24 },
  ];
  assert.strictEqual(st.readSheetTitle(items, W, H).label, 'M-301 · Mechanical Schedules');
});

test('readSheetTitle: a number with no title is the number alone; nothing readable is null', () => {
  assert.deepStrictEqual(st.readSheetTitle([{ str: 'P-201', x: 1100, y: 730, w: 70, h: 26 }], W, H), { number: 'P-201', title: null, label: 'P-201' });
  assert.strictEqual(st.readSheetTitle([], W, H), null);                                   // a scan: no text layer
  assert.strictEqual(st.readSheetTitle([{ str: 'FLOOR PLAN', x: 1000, y: 740, w: 60, h: 10 }], W, H), null);   // a title but no number
  assert.strictEqual(st.readSheetTitle(OFFICE, 0, 0), null);
  assert.strictEqual(st.readSheetTitle(null, W, H), null);
});

test('sheetTitleCase: shouted titles calm down; abbreviations, numbers and mixed case stand', () => {
  assert.strictEqual(st.sheetTitleCase('FIRST FLOOR PLAN'), 'First Floor Plan');
  assert.strictEqual(st.sheetTitleCase('WASTE AND VENT ISOMETRIC'), 'Waste and Vent Isometric');
  assert.strictEqual(st.sheetTitleCase('HVAC PLAN - LEVEL 2'), 'HVAC Plan - Level 2');
  assert.strictEqual(st.sheetTitleCase('REFLECTED CEILING PLAN (RCP)'), 'Reflected Ceiling Plan (RCP)');
  assert.strictEqual(st.sheetTitleCase('ONE-LINE DIAGRAM'), 'One-Line Diagram');
  assert.strictEqual(st.sheetTitleCase('Door Schedule'), 'Door Schedule');
});

test('isDefaultPageLabel: only the intake\'s own labels may be replaced', () => {
  ['bid-set.pdf', 'bid-set.pdf, p24', 'Bid Set.PDF, p3', 'Page 3', 'Test PDF', 'Test PDF, p2', '', null].forEach((l) => assert.strictEqual(st.isDefaultPageLabel(l), true, String(l)));
  ['P-101 · Plumbing Plan', 'Level 2', 'Kitchen', 'my pdf notes'].forEach((l) => assert.strictEqual(st.isDefaultPageLabel(l), false, l));
});
