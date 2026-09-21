/**
 * The HVAC set for the HVAC course (features/course-hvac.js; journeys/plans/HVAC-COURSE.md):
 * the same Main St Restaurant as P-101, on the same shell (restaurantShell in
 * sample-plan-candidates.js, lights, plumbing tags and drains off), so every device
 * coordinate here is a P-101 coordinate: plan px at 12 px/ft, placed at PLAN_AT.
 *
 *   M-101 MECHANICAL PLAN  RTU-1 on a roof key with its supply main sized down the hall and
 *                          into the dining room, every size printed beside its run (the text
 *                          the callout reader reads), diffusers by type with their CFM,
 *                          return grilles to the plenum, the hood's exhaust to EF-1, the
 *                          restroom exhaust to EF-2, make-up air from MAU-1, thermostats,
 *                          the air-balance note.
 *   M-501 SCHEDULES        the equipment schedule, the diffuser schedule (tag + description
 *                          rows), the room air schedule with each room's supply and exhaust.
 *   M-601 SECTION          a ceiling section through the dining room at 1/2" = 1'-0": the deck,
 *                          the ceiling, the plenum between, the wrapped main inside it.
 *
 * DUCT / DEVICES below are the lists the course mirrors as flat point lists (the labels
 * test reads every double bracket in a teaching file as a control name).
 */
const C = require('./sample-plan-candidates');
const { F, INK, PLAN_AT, restaurantShell, titleBlock, notesColumn, sheetFrame, dimV, dimH } = C;

// ---------------- the devices and runs, plan px -----------------------------------------------
const DEVICES = {
  SD1: [[190, 210], [300, 210], [410, 210], [520, 210], [190, 350], [300, 350], [410, 350], [520, 350], [200, 540], [330, 540], [596, 506]],   // 24x24 lay-in, 150 CFM: dining 8, bar 2, dish 1
  SD2: [[800, 282], [820, 506]],                                                                                                                   // 12x12, 100 CFM: hall, storage
  SD3: [[600, 440], [700, 440], [800, 440], [900, 440]],                                                                                            // 24x24, 200 CFM: the kitchen
  RG1: [[350, 300], [450, 300], [620, 460]],                                                                                                       // 24x24 return grilles, plenum return
  EG1: [[630, 200], [766, 200], [885, 200]],                                                                                                       // 8x8 exhaust grilles: MEN, WOMEN, MOP
  MA1: [[640, 372]],                                                                                                                               // make-up air register, 2,000 CFM
  T: [[554, 300], [566, 440]],                                                                                                                     // thermostats
  RTU1: [904, 328], EF1: [836, 323], EF2: [905, 150], MAU1: [904, 372],
};
const DUCT = {
  main: { path: [[904, 328], [904, 282], [560, 282], [180, 282]], sizes: [[904, 328, '24x12'], [560, 282, '20x12'], [420, 282, '16x10'], [300, 282, '12x10']] },
  kitchen: { path: [[572, 282], [572, 440], [900, 440]], size: '16x10' },
  back: { path: [[904, 328], [904, 506], [596, 506]], size: '12x8' },
  bar: { path: [[260, 282], [260, 540]], size: '10x8' },
  makeup: { path: [[904, 372], [640, 372]], size: '20x16' },
  exhaust: { path: [[630, 206], [905, 206], [905, 150]], size: '8"ø' },
  hoodExhaust: { at: [836, 323], size: '18"ø' },
  flex: [[190, 210, 190, 282], [300, 210, 300, 282], [410, 210, 410, 282], [520, 210, 520, 282], [190, 350, 190, 282], [300, 350, 300, 282], [410, 350, 410, 282], [520, 350, 520, 282],
    [200, 540, 260, 540], [330, 540, 260, 540]],
  keys: { rtu: [966, 300, 64, 56], mau: [966, 362, 64, 42], ef1: [966, 232, 64, 46], ef2: [972, 170, 44, 24] },
};
const AIR = { supply: 2650, capacity: 3000, hoodExhaust: 2400, makeup: 2000, restroomExhaust: 225 };

// ---------------- symbols ------------------------------------------------------------------------
const stroke = `fill="none" stroke="${INK}" stroke-width="1.1"`;
const tag = (x, y, t, size = 6.5) => `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" font-weight="bold" fill="${INK}">${t}</text>`;
const sub = (x, y, t) => `<text x="${x}" y="${y}" font-family="${F}" font-size="6" fill="#444">${t}</text>`;
const diffuser = (x, y, s, name, cfm) => `<g transform="translate(${x},${y})" ${stroke}><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"/><line x1="${-s / 2}" y1="${-s / 2}" x2="${s / 2}" y2="${s / 2}"/><line x1="${s / 2}" y1="${-s / 2}" x2="${-s / 2}" y2="${s / 2}"/></g>${tag(x + s / 2 + 3, y - 1, name)}${sub(x + s / 2 + 3, y + 7, cfm + ' CFM')}`;
const grille = (x, y, s, name) => `<g transform="translate(${x},${y})" ${stroke}><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"/><line x1="${-s / 2}" y1="${s / 2}" x2="${s / 2}" y2="${-s / 2}"/></g>${tag(x + s / 2 + 3, y + 2, name)}`;
const exhaustGrille = (x, y, name) => `<g transform="translate(${x},${y})" ${stroke}><rect x="-5" y="-5" width="10" height="10"/><line x1="-5" y1="-1" x2="5" y2="-1"/><line x1="-5" y1="2" x2="5" y2="2"/></g>${tag(x + 8, y + 2, name)}`;
const thermostat = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><circle r="4.5"/><text y="2.5" text-anchor="middle" font-family="${F}" font-size="6.5" fill="${INK}" stroke="none">T</text></g>`;
const roofKey = ([x, y, w, h], lines) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-dasharray="5 3"/>${lines.map((t, i) => `<text x="${x + w / 2}" y="${y + 10 + i * 8}" text-anchor="middle" font-family="${F}" font-size="${i ? 5.5 : 6.5}" ${i ? 'fill="#444"' : `font-weight="bold" fill="${INK}"`}>${t}</text>`).join('')}`;
// A duct run drawn at its true width: a black band with a white core, size callouts along it.
const widthOf = (size) => { const m = /^(\d+)x(\d+)$/.exec(size); if (m) return Number(m[1]); const r = /^(\d+)"ø$/.exec(size); return r ? Number(r[1]) : 12; };
function ductRun(path, sizes, dashed) {
  const w = widthOf(Array.isArray(sizes) ? sizes[0][2] : sizes);
  const p = path.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polyline points="${p}" fill="none" stroke="${INK}" stroke-width="${w + 1.6}" stroke-linejoin="miter"${dashed ? ' stroke-dasharray="8 4"' : ''}/><polyline points="${p}" fill="none" stroke="#fff" stroke-opacity="0.82" stroke-width="${w}" stroke-linejoin="miter"/>`;
}
const callout = (x, y, t, rot = 0) => `<text x="${x}" y="${y}" font-family="${F}" font-size="7" font-weight="bold" fill="${INK}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;
const flexLine = ([x1, y1, x2, y2]) => (x1 === x2 && y1 === y2 ? '' : `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 3"/>`);

// ---------------- M-101 MECHANICAL PLAN ------------------------------------------------------------
function mechanicalPlan() {
  const D = DEVICES, U = DUCT;
  return `${restaurantShell({ lights: false, tags: false, drains: false })}
  <!-- the supply side: RTU-1 on the roof, its main sized down the hall and across the dining room, branches -->
  ${ductRun(U.makeup.path, U.makeup.size)}${callout(760, 369, U.makeup.size)}
  ${ductRun(U.main.path, U.main.sizes)}
  ${ductRun(U.kitchen.path, U.kitchen.size)}${callout(578, 380, U.kitchen.size, -90)}
  ${ductRun(U.back.path, U.back.size)}${callout(910, 480, U.back.size, -90)}
  ${ductRun(U.bar.path, U.bar.size)}${callout(266, 470, U.bar.size, -90)}
  ${U.main.sizes.map(([x, y, s]) => callout(x === 904 ? x + 16 : x - 60, y === 328 ? 310 : y - 15, s, x === 904 ? -90 : 0)).join('')}
  ${U.flex.map(flexLine).join('')}
  <!-- the exhaust side: restroom grilles to EF-2, the hood to EF-1 -->
  ${ductRun(U.exhaust.path, U.exhaust.size, true)}${callout(760, 218, U.exhaust.size)}
  <circle cx="${U.hoodExhaust.at[0]}" cy="${U.hoodExhaust.at[1]}" r="9" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 2"/>${callout(U.hoodExhaust.at[0] + 12, U.hoodExhaust.at[1] + 3, U.hoodExhaust.size)}
  <!-- devices -->
  ${D.SD1.map(([x, y]) => diffuser(x, y, 24, 'SD-1', 150)).join('')}
  ${D.SD2.map(([x, y]) => diffuser(x, y, 12, 'SD-2', 100)).join('')}
  ${D.SD3.map(([x, y]) => diffuser(x, y, 24, 'SD-3', 200)).join('')}
  ${D.RG1.map(([x, y]) => grille(x, y, 24, 'RG-1')).join('')}
  ${D.EG1.map(([x, y]) => exhaustGrille(x, y, 'EG-1')).join('')}
  ${D.MA1.map(([x, y]) => diffuser(x, y, 24, 'MA-1', 2000)).join('')}
  ${D.T.map(([x, y]) => thermostat(x, y)).join('')}
  <!-- roof keys -->
  ${roofKey(U.keys.rtu, ['RTU-1 ON ROOF', '3,000 CFM · 7.5 TON', '1.0" ESP · 208V 3Φ'])}
  ${roofKey(U.keys.mau, ['MAU-1 ON ROOF', '2,000 CFM MAKE-UP', 'INTERLOCKED W/ EF-1'])}
  ${roofKey(U.keys.ef1, ['EF-1 ON ROOF', '2,400 CFM', 'HOOD EXHAUST'])}
  ${roofKey(U.keys.ef2, ['EF-2', '225 CFM'])}
  <text x="400" y="458" font-family="${F}" font-size="6.5" fill="#444" text-anchor="middle">RETURN AIR VIA CEILING PLENUM TO RTU-1</text>
  <rect x="896" y="320" width="16" height="16" fill="none" stroke="${INK}" stroke-width="0.9" stroke-dasharray="3 2"/><line x1="912" y1="328" x2="966" y2="328" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2"/><line x1="912" y1="372" x2="966" y2="383" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2"/><line x1="845" y1="323" x2="966" y2="255" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2"/><line x1="905" y1="150" x2="972" y2="182" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2"/>
  `;
}
function sheetM101() {
  return `${sheetFrame()}
  <g transform="translate(${PLAN_AT.x},${PLAN_AT.y}) scale(${PLAN_AT.k})">${mechanicalPlan()}</g>
  <g font-family="${F}" font-size="9.5" fill="${INK}"><text x="430" y="652" font-size="12" font-weight="bold">LEGEND</text><line x1="430" y1="658" x2="660" y2="658" stroke="${INK}" stroke-width="1"/>
    <g transform="translate(444,674)">${diffuser(0, 0, 14, '', '').replace(/<text[\s\S]*$/, '')}</g><text x="470" y="677">SUPPLY DIFFUSER, TYPE AND CFM AS NOTED</text>
    <g transform="translate(444,690)">${grille(0, 0, 14, '').replace(/<text[\s\S]*$/, '')}</g><text x="470" y="693">RETURN GRILLE, TO CEILING PLENUM</text>
    <g transform="translate(444,706)">${exhaustGrille(0, 0, '').replace(/<text[\s\S]*$/, '')}</g><text x="470" y="709">EXHAUST GRILLE</text>
    <line x1="432" y1="722" x2="456" y2="722" stroke="${INK}" stroke-width="7"/><line x1="432" y1="722" x2="456" y2="722" stroke="#fff" stroke-width="5"/><text x="470" y="725">SUPPLY DUCT, SIZE AS NOTED, 1" W.G.</text>
    <line x1="432" y1="738" x2="456" y2="738" stroke="${INK}" stroke-width="7" stroke-dasharray="4 2"/><line x1="432" y1="738" x2="456" y2="738" stroke="#fff" stroke-width="5"/><text x="470" y="741">EXHAUST DUCT</text>
    <line x1="432" y1="754" x2="456" y2="754" stroke="${INK}" stroke-width="1" stroke-dasharray="3 3"/><text x="470" y="757">FLEX DUCT, 8"ø, 6'-0" MAX</text>
  </g>
  ${notesColumn(996, 200, 'MECHANICAL KEYNOTES', [
    'SUPPLY DUCT: GALVANIZED, SMACNA',
    '  1" W.G., 2" EXTERNAL WRAP IN THE',
    '  CEILING PLENUM.',
    'CEILINGS 9\'-0", ROOF DECK 12\'-0":',
    '  A 3\'-0" PLENUM. SEE SECTION, M-601.',
    'DIFFUSER TYPES AND CFM PER M-501.',
    'FLEX DUCT 8"ø, 6\'-0" MAX, TO EACH',
    '  DIFFUSER FROM A TAP W/ DAMPER.',
    'HOOD EXHAUST: 18"ø WELDED 16 GA',
    '  BLACK STEEL, 18" CLEAR OF',
    '  COMBUSTIBLES (NFPA 96).',
    'MAU-1 INTERLOCKED WITH EF-1.',
    'AIR BALANCE: SUPPLY 2,650 + MAKE-UP',
    '  2,000 · EXHAUST 2,400 + 225:',
    '  BUILDING SLIGHTLY POSITIVE.',
    'RTU-1: 3,000 CFM, 1.0" ESP.',
  ])}
  ${titleBlock({ sheet: 'M-101', sheetName: 'MECHANICAL PLAN', project: 'MAIN ST RESTAURANT', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- M-501 SCHEDULES ----------------------------------------------------------------------
const EQUIPMENT = [
  ['RTU-1', 'ROOFTOP UNIT, GAS HEAT / DX COOL', '3,000', '1.0"', '7.5 TON', '208V 3Φ', '900 LB'],
  ['EF-1', 'HOOD EXHAUST FAN, UPBLAST', '2,400', '1.25"', '-', '208V 1Φ', '150 LB'],
  ['MAU-1', 'MAKE-UP AIR UNIT, TEMPERED', '2,000', '0.5"', '-', '208V 3Φ', '650 LB'],
  ['EF-2', 'RESTROOM EXHAUST FAN', '225', '0.4"', '-', '120V', '40 LB'],
];
const DIFFUSERS = [
  ['SD-1', 'SUPPLY DIFFUSER, 24X24 LAY-IN, 4-WAY', '8"ø', '150', 'DINING, BAR, DISH'],
  ['SD-2', 'SUPPLY DIFFUSER, 12X12 SURFACE', '6"ø', '100', 'HALL, STORAGE'],
  ['SD-3', 'SUPPLY DIFFUSER, 24X24 LAY-IN, 4-WAY', '10"ø', '200', 'KITCHEN'],
  ['RG-1', 'RETURN GRILLE, 24X24 LAY-IN, PLENUM', '-', '-', 'DINING, KITCHEN'],
  ['EG-1', 'EXHAUST GRILLE, 8X8', '6"ø', '75', 'RESTROOMS, MOP'],
  ['MA-1', 'MAKE-UP AIR REGISTER, 24X24', '20X16', '2000', 'KITCHEN'],
];
const ROOMS = [
  ['DINING 100', '1,104', '1,200', '-', 'RTU-1'], ['BAR 101', '261', '300', '-', 'RTU-1'], ['MEN 102', '148', '-', '75', 'EF-2'],
  ['WOMEN 103', '137', '-', '75', 'EF-2'], ['MOP 104', '116', '-', '75', 'EF-2'], ['KITCHEN 105', '459', '800', '2,400', 'RTU-1 / EF-1 / MAU-1'],
  ['DISH 106', '126', '150', '-', 'RTU-1'], ['HALL 107', '117', '100', '-', 'RTU-1'], ['STORAGE 108', '216', '100', '-', 'RTU-1'],
];
function table(x, y, title, cols, head, rows, rowH = 18) {
  const h = head.map((t, i) => `<text x="${cols[i]}" y="${y + 38}" font-size="10" font-weight="bold">${t}</text>`).join('');
  const r = rows.map((row, j) => row.map((t, i) => `<text x="${cols[i]}" y="${y + 38 + 22 + j * rowH}" font-size="9.5">${t}</text>`).join('')).join('');
  const w = cols[cols.length - 1] + 120 - x;
  const end = y + 38 + 22 + rows.length * rowH - 8;
  return `<g font-family="${F}" fill="${INK}"><text x="${x}" y="${y}" font-size="15" font-weight="bold">${title}</text>
    <line x1="${x - 8}" y1="${y + 12}" x2="${x + w}" y2="${y + 12}" stroke="${INK}" stroke-width="1.2"/><line x1="${x - 8}" y1="${y + 46}" x2="${x + w}" y2="${y + 46}" stroke="${INK}" stroke-width="0.8"/>${h}${r}
    <line x1="${x - 8}" y1="${end}" x2="${x + w}" y2="${end}" stroke="${INK}" stroke-width="1.2"/></g>`;
}
function sheetM501() {
  return `${sheetFrame()}
  ${table(120, 100, 'EQUIPMENT SCHEDULE', [120, 180, 470, 530, 590, 660, 740], ['TAG', 'DESCRIPTION', 'CFM', 'ESP', 'COOLING', 'ELEC', 'WEIGHT'], EQUIPMENT)}
  ${table(120, 270, 'DIFFUSER AND GRILLE SCHEDULE', [120, 180, 470, 540, 600], ['TAG', 'DESCRIPTION', 'NECK', 'CFM', 'ROOMS'], DIFFUSERS)}
  ${table(120, 470, 'ROOM AIR SCHEDULE', [120, 260, 340, 430, 520], ['ROOM', 'AREA SQ FT', 'SUPPLY CFM', 'EXHAUST CFM', 'SERVED BY'], ROOMS)}
  ${notesColumn(900, 100, 'SCHEDULE NOTES', [
    '1. SUPPLY CFM PER ROOM FROM THE',
    '   COOLING LOAD AND ASHRAE 62.1',
    '   VENTILATION; USE THESE, NOT A',
    '   RULE OF THUMB.',
    '2. RTU-1 SUPPLIES 2,650 CFM OF ITS',
    '   3,000; THE REST IS FUTURE.',
    '3. KITCHEN: HOOD EXHAUST 2,400 CFM',
    '   (EF-1), MAKE-UP 2,000 (MAU-1),',
    '   SUPPLY 800 (RTU-1).',
    '4. RESTROOMS EXHAUST ONLY; AIR IS',
    '   DRAWN FROM THE HALL UNDER THE',
    '   DOORS (IMC 403, TABLE 403.3.1.1).',
    '5. FLEX DUCT 6\'-0" MAX PER DROP.',
  ])}
  ${titleBlock({ sheet: 'M-501', sheetName: 'SCHEDULES', project: 'MAIN ST RESTAURANT', scale: 'NONE', date: '07/31/26' })}`;
}

// ---------------- M-601 SECTION ---------------------------------------------------------------------------
// A ceiling section through the dining room at 1/2" = 1'-0" (36 pt/ft): the roof deck at
// 12'-0", the ceiling at 9'-0", the wrapped 24x12 main in the plenum, a flex drop to a diffuser.
const SECTION = { ptPerFt: 36, floorY: 640, ceilY: 640 - 9 * 36, deckY: 640 - 12 * 36, duct: { x: 520, w: 72, h: 36, wrap: 6 }, prove: [[140, 640 - 12 * 36], [140, 640]], plenum: [[180, 640 - 12 * 36], [180, 640 - 9 * 36]], ductDepth: [[640, 640 - 9 * 36 - 78], [640, 640 - 9 * 36 - 78 + 48]] };
function sheetM601() {
  const S = SECTION, d = S.duct;
  const ductTop = S.ceilY - 78, ductBottom = ductTop + 48;   // 24x12 with 2" wrap: 14" deep, hung 2'-6" clear of the ceiling? no: 6" below the deck
  return `${sheetFrame()}
  <g font-family="${F}"><text x="120" y="112" font-size="15" font-weight="bold" fill="${INK}">1  SECTION THROUGH THE DINING ROOM CEILING</text><text x="120" y="128" font-size="9.5" fill="#444">SCALE: 1/2" = 1'-0"</text></g>
  <!-- the deck, the ceiling, the floor -->
  <rect x="200" y="${S.deckY - 14}" width="760" height="14" fill="#e6e6e6" stroke="${INK}" stroke-width="1.6"/><text x="966" y="${S.deckY - 2}" font-family="${F}" font-size="9" fill="#444">ROOF DECK, 12'-0"</text>
  <line x1="200" y1="${S.ceilY}" x2="960" y2="${S.ceilY}" stroke="${INK}" stroke-width="1.4"/><text x="966" y="${S.ceilY + 4}" font-family="${F}" font-size="9" fill="#444">LAY-IN CEILING, 9'-0"</text>
  <line x1="200" y1="${S.floorY}" x2="960" y2="${S.floorY}" stroke="${INK}" stroke-width="3"/><text x="966" y="${S.floorY + 4}" font-family="${F}" font-size="9" fill="#444">FIN. FLOOR</text>
  ${dimV(140, S.deckY, S.floorY, "12'-0\"")}
  ${dimV(180, S.deckY, S.ceilY, "3'-0\"", { labelDx: 8 })}
  <!-- the main: 24x12 with 2" wrap, hung from the deck -->
  <rect x="${d.x - d.wrap}" y="${ductTop}" width="${d.w + 2 * d.wrap}" height="${d.h + 2 * d.wrap}" fill="#fff" stroke="${INK}" stroke-width="0.8" stroke-dasharray="3 2"/>
  <rect x="${d.x}" y="${ductTop + d.wrap}" width="${d.w}" height="${d.h}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
  <text x="${d.x + d.w / 2}" y="${ductTop + d.wrap + d.h / 2 + 3}" font-family="${F}" font-size="9" font-weight="bold" fill="${INK}" text-anchor="middle">24x12 SUPPLY MAIN</text>
  <text x="${d.x + d.w / 2}" y="${ductTop - 6}" font-family="${F}" font-size="8" fill="#444" text-anchor="middle">2" EXTERNAL WRAP</text>
  <line x1="${d.x + 10}" y1="${S.deckY}" x2="${d.x + 10}" y2="${ductTop}" stroke="${INK}" stroke-width="1"/><line x1="${d.x + d.w - 10}" y1="${S.deckY}" x2="${d.x + d.w - 10}" y2="${ductTop}" stroke="${INK}" stroke-width="1"/>
  <text x="${d.x + d.w + 20}" y="${S.deckY + 16}" font-family="${F}" font-size="8" fill="#444">TRAPEZE HANGER, 8'-0" O.C.</text>
  ${dimV(640, ductTop, ductBottom, "1'-4\"", { labelDx: 8 })}
  <!-- a flex drop to a diffuser -->
  <path d="M${d.x + d.w + 6} ${ductTop + d.wrap + d.h / 2} h30 q30 0 30 40 v${S.ceilY - ductTop - d.wrap - d.h / 2 - 40 - 6}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3"/>
  <rect x="${d.x + d.w + 40}" y="${S.ceilY - 6}" width="52" height="6" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
  <text x="${d.x + d.w + 66}" y="${S.ceilY + 16}" font-family="${F}" font-size="8" fill="#444" text-anchor="middle">SD-1, 24x24 LAY-IN, 150 CFM</text>
  <text x="${d.x + d.w + 100}" y="${ductTop + 30}" font-family="${F}" font-size="8" fill="#444">8"ø FLEX, 6'-0" MAX, TAP W/ VOLUME DAMPER</text>
  ${dimH(d.x + d.w + 6, S.ceilY + 40, d.x + d.w + 66, "5'-0\"")}
  ${notesColumn(120, 180, 'SECTION NOTES', [
    '1. THE PLENUM IS THE 3\'-0" BETWEEN THE',
    '   CEILING AND THE DECK. EVERYTHING THE',
    '   MECHANICAL, ELECTRICAL AND PLUMBING',
    '   TRADES HANG LIVES IN IT.',
    '2. THE MAIN WITH ITS WRAP IS 1\'-4" DEEP:',
    '   IT FITS, WITH 1\'-8" TO SPARE FOR THE',
    '   RETURN AIR THE PLENUM CARRIES.',
    '3. WRAP: 2" FIBERGLASS, FOIL FACED, ON',
    '   ALL SUPPLY DUCT IN THE PLENUM',
    '   (IECC C403.11).',
    '4. FLEX DUCT 6\'-0" MAX, NO SAG,',
    '   SUPPORTED AT 4\'-0" O.C.',
  ])}
  ${titleBlock({ sheet: 'M-601', sheetName: 'SECTIONS', project: 'MAIN ST RESTAURANT', scale: '1/2" = 1&#39;-0"', date: '07/31/26' })}`;
}

module.exports = { DEVICES, DUCT, AIR, SECTION, EQUIPMENT, DIFFUSERS, ROOMS, sheetM101, sheetM501, sheetM601 };
