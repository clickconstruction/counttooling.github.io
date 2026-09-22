/**
 * The ELECTRICAL set for the plumbing course's sibling, the electrical course
 * (features/course-electrical.js; journeys/plans/ELECTRICAL-COURSE.md): the same Main St
 * Restaurant as P-101, drawn on the same shell (restaurantShell in
 * sample-plan-candidates.js, lights and plumbing tags off), so every device coordinate
 * here is a P-101 coordinate: plan px at 12 px/ft, placed on the sheet at PLAN_AT.
 *
 *   E-101 POWER PLAN     receptacles by circuit (duplex 18", GFCI 44" within 6 ft of a sink),
 *                        a J-box at each piece of equipment, panel LP-1 in STORAGE with its
 *                        working clearance drawn, the meter and main outside the south wall,
 *                        homerun arrows with circuit tags.
 *   E-201 LIGHTING PLAN  fixtures by TYPE with the letter beside each one (the text layer the
 *                        tag reader reads), switches and occupancy sensors, exit and emergency.
 *   E-501 SCHEDULES      the lighting fixture schedule (tag + description rows the schedule
 *                        reader turns into counters) and panel LP-1's schedule.
 *   E-601 ONE-LINE       the service: utility, meter, main, feeder, LP-1, grounding. NTS.
 *
 * POWER / LIGHTING below are the device lists the course mirrors as flat point lists
 * (the labels test reads every double bracket in a teaching file as a control name).
 */
const C = require('./sample-plan-candidates');
const { F, INK, PLAN_AT, restaurantShell, keyTag, titleBlock, notesColumn, sheetFrame } = C;

// ---------------- the devices, plan px ----------------------------------------------
const POWER = {
  duplexDiningW: [[136, 160], [136, 250], [136, 340], [136, 430]],          // LP-1-1
  duplexDiningN: [[200, 106], [300, 106], [400, 106], [500, 596]],          // LP-1-3, the last at the server station
  gfciBar: [[200, 594], [300, 594]],                                        // LP-1-5, within 6 ft of the bar hand sink
  ice: [[400, 585]],                                                        // LP-1-7, the ice machine, dedicated
  gfciRestrooms: [[640, 106], [776, 106], [900, 106]],                      // LP-1-9, the mop room's is within 6 ft of the mop sink
  gfciKitchen: [[575, 302], [930, 360]],                                    // LP-1-11, beside the two kitchen hand sinks
  dw: [[643, 592]],                                                         // LP-1-2,4 the dishwasher, 208 V
  rp: [[887, 552]],                                                         // LP-1-6 the recirc pump
  ef1: [[860, 380]],                                                        // LP-1-8,10 the hood exhaust fan on the roof
  hoodRecep: [[720, 358], [800, 358]],                                      // LP-1-12 under the hood, GFCI (a kitchen), on the shunt trip
  gfciDish: [[660, 476]],                                                   // LP-1-14 beside the dish 3-comp
  duplexStorage: [[760, 476], [930, 590]],                                  // LP-1-16
  missed: [[600, 460]],                                                     // the engineer's miss: a plain duplex on the kitchen's south wall, in a kitchen (210.8(B)(2)); the course has the reader find it
  rtu: [[730, 590]],                                                        // LP-1-18,20,22 RTU-1 on the roof, 3 phase
  wh: [[812, 548]],                                                         // LP-1-19 the water heater's controls
  panel: [704, 506], meter: [690, 612], mdp: [713, 611],
  clearance: { x1: 710, y1: 491, x2: 746, y2: 521 },                        // 36" deep, 30" wide, in front of LP-1
  feeder: [[705, 604], [705, 516]],
  homeruns: [[150, 300, 'LP-1-1'], [250, 572, 'LP-1-5'], [690, 380, 'LP-1-12'], [672, 592, 'LP-1-2,4'], [700, 130, 'LP-1-9'], [800, 488, 'LP-1-16']],
};
const LIGHTING = {
  A: [[200, 160], [345, 160], [490, 160], [200, 285], [345, 285], [490, 285], [200, 410], [345, 410], [490, 410], [265, 505], [330, 505], [390, 505], [490, 535]],   // pendants, dining and bar: LP-1-13
  B: [[640, 380], [760, 380], [880, 380], [640, 440], [760, 440], [880, 440], [600, 508], [660, 508], [760, 530], [860, 530]],   // 2x4 troffers, kitchen, dish, storage: LP-1-15
  C: [[665, 272], [775, 272], [885, 272], [596, 200], [660, 150], [732, 200], [796, 150], [885, 200]],   // downlights, hall, restrooms, mop: LP-1-17
  X: [[495, 112], [926, 440]],                                              // exit signs at the two exits: LP-1-21
  EM: [[300, 470], [760, 364], [700, 278]],                                 // emergency lights: LP-1-21
  S: [[522, 108], [426, 486], [575, 424], [690, 478]],                      // switches
  OS: [[668, 258], [802, 258], [806, 478]],                                 // occupancy sensors: restrooms and storage
  homeruns: [[200, 135, 'LP-1-13'], [700, 400, 'LP-1-15'], [830, 268, 'LP-1-17'], [470, 128, 'LP-1-21']],
};

// ---------------- symbols ------------------------------------------------------------------
const stroke = `fill="none" stroke="${INK}" stroke-width="1.1"`;
const recep = (x, y, kind) => `<g transform="translate(${x},${y})" ${stroke}><circle r="4"/><line x1="-6.5" y1="0" x2="6.5" y2="0"/>${kind === 'gfci' ? `<text x="7" y="-4" font-family="${F}" font-size="6" fill="#444" stroke="none">GFI</text>` : ''}</g>`;
const jbox = (x, y, tag, side = 1) => `<g transform="translate(${x},${y})" ${stroke}><rect x="-5" y="-5" width="10" height="10"/><text y="2.8" text-anchor="middle" font-family="${F}" font-size="7" fill="${INK}" stroke="none">J</text>${tag ? `<text x="${8 * side}" y="3" font-family="${F}" font-size="6.5" fill="#444" stroke="none"${side < 0 ? ' text-anchor="end"' : ''}>${tag}</text>` : ''}</g>`;
const arrow = (x, y, tag, dir = 1) => `<g ${stroke} stroke-width="1.3"><line x1="${x}" y1="${y}" x2="${x + 22 * dir}" y2="${y}"/><path d="M${x + 22 * dir} ${y} l${-7 * dir} -4 l0 8 z" fill="${INK}"/><text x="${x + 11 * dir}" y="${y - 5}" text-anchor="middle" font-family="${F}" font-size="6.5" fill="${INK}" stroke="none">${tag}</text></g>`;
const tagText = (x, y, t) => `<text x="${x}" y="${y}" font-family="${F}" font-size="7.5" font-weight="bold" fill="${INK}">${t}</text>`;
const pendant = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><circle r="6"/><circle r="1.6" fill="${INK}"/></g>${tagText(x + 9, y + 3, 'A')}`;
const troffer = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><rect x="-24" y="-12" width="48" height="24"/><line x1="-24" y1="-12" x2="24" y2="12"/></g>${tagText(x + 27, y + 3, 'B')}`;
const downlight = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><circle r="5"/><line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5"/><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5"/></g>${tagText(x + 8, y + 3, 'C')}`;
const exitSign = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><rect x="-8" y="-5" width="16" height="10"/><circle r="1.5" fill="${INK}"/></g>${tagText(x + 11, y + 3, 'X')}`;
const emLight = (x, y) => `<g transform="translate(${x},${y})" ${stroke}><rect x="-6" y="-4" width="12" height="8"/><circle cx="-8" cy="-6" r="2.5"/><circle cx="8" cy="-6" r="2.5"/></g>${tagText(x + 12, y + 3, 'EM')}`;
const sw = (x, y, t) => `<g transform="translate(${x},${y})"><text text-anchor="middle" y="3.5" font-family="${F}" font-size="9" font-style="italic" fill="${INK}">${t}</text></g>`;
const at = (p, fn, ...rest) => p.map(([x, y]) => fn(x, y, ...rest)).join('');

// ---------------- E-101 POWER PLAN --------------------------------------------------------
function powerPlan() {
  const P = POWER, cl = P.clearance;
  return `${restaurantShell({ lights: false, tags: false, drains: false })}
  <!-- POWER: receptacles by circuit; a J-box at each piece of equipment -->
  ${at(P.duplexDiningW.concat(P.duplexDiningN, P.duplexStorage, P.missed), recep, 'duplex')}
  ${at(P.gfciBar.concat(P.gfciRestrooms, P.gfciKitchen, P.hoodRecep, P.gfciDish), recep, 'gfci')}
  ${jbox(...P.ice[0], 'ICE MACHINE · 7', -1)}${jbox(...P.dw[0], 'DW 208V · 2,4')}${jbox(...P.rp[0], 'RP · 6')}
  ${jbox(...P.ef1[0], 'TO EF-1 ON ROOF · 8,10')}${jbox(...P.rtu[0], 'TO RTU-1 ON ROOF, 3Φ · 18,20,22')}${jbox(...P.wh[0], 'WH · 19')}
  <text x="722" y="386" font-family="${F}" font-size="6.5" fill="#8a2727">RECEPTS UNDER HOOD ON SHUNT TRIP, CKT 12</text>
  <!-- panel LP-1, surface on the storage west wall, with the working clearance the code wants in front of it -->
  <rect x="${P.panel[0] - 2}" y="${P.panel[1] - 10}" width="6" height="20" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
  <text x="${P.panel[0] - 6}" y="${P.panel[1] + 3}" font-family="${F}" font-size="7.5" font-weight="bold" fill="${INK}" text-anchor="middle" transform="rotate(-90 ${P.panel[0] - 6} ${P.panel[1] + 3})">LP-1</text>
  <rect x="${cl.x1}" y="${cl.y1}" width="${cl.x2 - cl.x1}" height="${cl.y2 - cl.y1}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="4 3"/>
  <text x="${(cl.x1 + cl.x2) / 2}" y="${(cl.y1 + cl.y2) / 2 + 2.5}" font-family="${F}" font-size="6" fill="#444" text-anchor="middle">36" CLR</text>
  <!-- the service: meter and main disconnect outside the south wall, the feeder up to LP-1 -->
  <circle cx="${P.meter[0]}" cy="${P.meter[1]}" r="5" fill="#fff" stroke="${INK}" stroke-width="1.2"/><text x="${P.meter[0]}" y="${P.meter[1] + 2.5}" font-family="${F}" font-size="7" fill="${INK}" text-anchor="middle">M</text>
  <rect x="${P.mdp[0] - 8}" y="${P.mdp[1] - 6}" width="16" height="12" fill="#fff" stroke="${INK}" stroke-width="1.2"/><text x="${P.mdp[0]}" y="${P.mdp[1] + 2.5}" font-family="${F}" font-size="5.5" fill="${INK}" text-anchor="middle">MDP</text>
  <text x="${P.mdp[0] + 12}" y="${P.mdp[1] + 3}" font-family="${F}" font-size="6.5" fill="#444">200A MAIN, NEMA 3R</text>
  <line x1="240" y1="640" x2="${P.meter[0] - 5}" y2="640" stroke="${INK}" stroke-width="1.2" stroke-dasharray="10 3 2 3"/><line x1="${P.meter[0] - 5}" y1="640" x2="${P.meter[0] - 5}" y2="${P.meter[1] + 4}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="10 3 2 3"/>
  <text x="248" y="636" font-family="${F}" font-size="8" fill="#444">UTILITY SERVICE LATERAL, 208Y/120V 3Φ 4W</text>
  <line x1="${P.feeder[0][0]}" y1="${P.feeder[0][1]}" x2="${P.feeder[1][0]}" y2="${P.feeder[1][1]}" stroke="${INK}" stroke-width="1.6"/>
  <text x="${P.feeder[0][0] - 4}" y="580" font-family="${F}" font-size="6.5" fill="#444" transform="rotate(-90 ${P.feeder[0][0] - 4} 580)">FEEDER 2" C, 4 #3/0 + 1 #6 G</text>
  <!-- homeruns: an arrow toward the panel with the circuit it lands on -->
  ${P.homeruns.map(([x, y, t]) => arrow(x, y, t, x < 700 ? 1 : -1)).join('')}
  `;
}
function electricalLegend(x, y, rows) {
  return `<g font-family="${F}" font-size="9" fill="${INK}"><text x="${x}" y="${y}" font-size="12" font-weight="bold">LEGEND</text><line x1="${x}" y1="${y + 6}" x2="${x + 220}" y2="${y + 6}" stroke="${INK}" stroke-width="1"/>
    ${rows.map(([sym, text], i) => `<g transform="translate(${x + 14},${y + 24 + i * 15})">${sym}</g><text x="${x + 34}" y="${y + 27 + i * 15}">${text}</text>`).join('')}</g>`;
}
function sheetE101() {
  return `${sheetFrame()}
  <g transform="translate(${PLAN_AT.x},${PLAN_AT.y}) scale(${PLAN_AT.k})">${powerPlan()}</g>
  ${electricalLegend(430, 652, [
    [recep(0, 0, 'duplex'), 'DUPLEX RECEPTACLE, 20A, 18" AFF'],
    [recep(0, 0, 'gfci'), 'GFCI RECEPTACLE, 20A, 44" AFF AT COUNTERS'],
    [jbox(0, 0, ''), 'JUNCTION BOX, EQUIPMENT CONNECTION'],
    [arrow(-12, 0, ''), 'HOMERUN TO PANEL, CIRCUIT NUMBER AS NOTED'],
    ['<rect x="-3" y="-8" width="6" height="16" fill="#fff" stroke="' + INK + '" stroke-width="1.4"/>', 'PANELBOARD, SURFACE'],
    ['<rect x="-8" y="-5" width="16" height="10" fill="none" stroke="' + INK + '" stroke-width="0.8" stroke-dasharray="3 2"/>', 'WORKING CLEARANCE, 36" DEEP × 30" WIDE'],
  ])}
  ${notesColumn(996, 200, 'POWER KEYNOTES', [
    'ALL BRANCH CIRCUITS 3 #12 CU THHN',
    '  + 1 #12 G IN 3/4" EMT, UNLESS NOTED.',
    'RECEPTACLES IN THE KITCHEN, THE BAR,',
    '  THE RESTROOMS AND WITHIN 6 FT OF ANY',
    '  SINK ARE GFCI (NEC 210.8(B)).',
    'RECEPTACLES UNDER THE HOOD ARE ON',
    '  A SHUNT-TRIP BREAKER INTERLOCKED',
    '  WITH THE HOOD SUPPRESSION (NFPA 96).',
    'DW, RP, EF-1, RTU-1: ONE CIRCUIT EACH,',
    '  DISCONNECT WITHIN SIGHT OF THE UNIT.',
    'PANEL LP-1: 208Y/120V 3Φ 4W, 200A MCB,',
    '  42 POLES, SURFACE, TOP AT 78" AFF.',
    'KEEP 36" CLEAR IN FRONT OF LP-1',
    '  (NEC 110.26).',
    'SEE E-501 FOR THE PANEL SCHEDULE,',
    '  E-601 FOR THE ONE-LINE.',
  ])}
  ${titleBlock({ sheet: 'E-101', sheetName: 'POWER PLAN', project: 'MAIN ST RESTAURANT', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- E-201 LIGHTING PLAN -----------------------------------------------------
function lightingPlan() {
  const L = LIGHTING;
  return `${restaurantShell({ lights: false, tags: false, drains: false })}
  <!-- LIGHTING: every fixture carries its TYPE letter beside it -->
  ${at(L.A, pendant)}${at(L.B, troffer)}${at(L.C, downlight)}${at(L.X, exitSign)}${at(L.EM, emLight)}
  ${at(L.S, sw, 'S')}${at(L.OS, sw, 'OS')}
  ${L.homeruns.map(([x, y, t]) => arrow(x, y, t, x < 700 ? 1 : -1)).join('')}
  `;
}
function sheetE201() {
  return `${sheetFrame()}
  <g transform="translate(${PLAN_AT.x},${PLAN_AT.y}) scale(${PLAN_AT.k})">${lightingPlan()}</g>
  ${electricalLegend(430, 652, [
    [pendant(0, 0).replace(tagText(9, 3, 'A'), ''), 'TYPE A · PENDANT'],
    [troffer(0, 0).replace(tagText(27, 3, 'B'), '').replace('width="48" height="24"', 'width="24" height="12"').replace('x="-24" y="-12"', 'x="-12" y="-6"').replace('x1="-24" y1="-12" x2="24" y2="12"', 'x1="-12" y1="-6" x2="12" y2="6"'), 'TYPE B · 2×4 TROFFER, RECESSED'],
    [downlight(0, 0).replace(tagText(8, 3, 'C'), ''), 'TYPE C · 6" DOWNLIGHT'],
    [exitSign(0, 0).replace(tagText(11, 3, 'X'), ''), 'TYPE X · EXIT SIGN W/ BATTERY'],
    [emLight(0, 0).replace(tagText(12, 3, 'EM'), ''), 'TYPE EM · EMERGENCY LIGHT, BATTERY'],
    [sw(0, 0, 'S'), 'SWITCH, 48" AFF · OS = OCCUPANCY SENSOR'],
  ])}
  ${notesColumn(996, 200, 'LIGHTING KEYNOTES', [
    'FIXTURE TYPES PER SCHEDULE, E-501.',
    'LIGHTING CIRCUITS 2 #12 + 1 #12 G',
    '  IN 3/4" EMT, 120V.',
    'EXIT SIGNS AND EMERGENCY LIGHTS ON',
    '  CIRCUIT 21, BATTERY BACKED, 90 MIN',
    '  (IBC 1008, NEC 700.12).',
    'OCCUPANCY SENSORS SWITCH THE',
    '  RESTROOMS AND STORAGE',
    '  (IECC C405.2.1).',
    'DINING PENDANTS ON A DIMMER AT',
    '  THE ENTRY SWITCH.',
    'MOUNTING: SWITCHES 48" AFF, EXIT',
    '  SIGNS 90" AFF, EM LIGHTS 90" AFF.',
  ])}
  ${titleBlock({ sheet: 'E-201', sheetName: 'LIGHTING PLAN', project: 'MAIN ST RESTAURANT', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- E-501 SCHEDULES ------------------------------------------------------------
const FIXTURE_SCHEDULE = [
  ['A', 'PENDANT, LED, DINING AND BAR', 'LED 18W', '120', '18', 'SURFACE, 9\'-0" AFF'],
  ['B', '2X4 TROFFER, LED, RECESSED', 'LED 40W', '120', '40', 'RECESSED, CEILING'],
  ['C', '6" DOWNLIGHT, LED, RECESSED', 'LED 12W', '120', '12', 'RECESSED, CEILING'],
  ['X', 'EXIT SIGN, LED, W/ BATTERY', 'LED 3W', '120', '3', 'WALL, 90" AFF'],
  ['EM', 'EMERGENCY LIGHT, TWIN HEAD, W/ BATTERY', 'LED 5W', '120', '5', 'WALL, 90" AFF'],
];
const PANEL_SCHEDULE = [
  ['1', 'DINING RECEPTACLES, WEST WALL', '720', '1', '20', '#12', '3/4"'],
  ['3', 'DINING RECEPTACLES, NORTH + SERVER', '720', '1', '20', '#12', '3/4"'],
  ['5', 'BAR GFCI RECEPTACLES', '360', '1', '20', '#12', '3/4"'],
  ['7', 'ICE MACHINE', '1200', '1', '20', '#12', '3/4"'],
  ['9', 'RESTROOM + MOP GFCI', '540', '1', '20', '#12', '3/4"'],
  ['11', 'KITCHEN GFCI', '360', '1', '20', '#12', '3/4"'],
  ['13', 'LTG, DINING AND BAR (13 × A)', '234', '1', '20', '#12', '3/4"'],
  ['15', 'LTG, KITCHEN, DISH, STORAGE (10 × B)', '400', '1', '20', '#12', '3/4"'],
  ['17', 'LTG, HALL, RESTROOMS, MOP (8 × C)', '96', '1', '20', '#12', '3/4"'],
  ['19', 'WATER HEATER CONTROLS', '200', '1', '20', '#12', '3/4"'],
  ['21', 'EXIT + EMERGENCY LIGHTS', '21', '1', '20', '#12', '3/4"'],
  ['2,4', 'DISHWASHER, 208V 1Φ', '4800', '2', '30', '#10', '3/4"'],
  ['6', 'HW RECIRC PUMP', '400', '1', '20', '#12', '3/4"'],
  ['8,10', 'EF-1 HOOD EXHAUST FAN, 208V 1Φ', '2400', '2', '20', '#12', '3/4"'],
  ['12', 'COOK LINE GFCI RECEPTACLES (SHUNT TRIP)', '360', '1', '20', '#12', '3/4"'],
  ['14', 'DISH PIT GFCI', '180', '1', '20', '#12', '3/4"'],
  ['16', 'STORAGE RECEPTACLES', '360', '1', '20', '#12', '3/4"'],
  ['18,20,22', 'RTU-1, 208V 3Φ', '9000', '3', '40', '#8', '1"'],
  ['23-42', 'SPARE', '', '', '', '', ''],
];
function sheetE501() {
  const cols1 = [120, 170, 460, 540, 600, 660], y1 = 150;
  const head1 = ['TYPE', 'DESCRIPTION', 'LAMP', 'VOLTS', 'WATTS', 'MOUNTING'].map((t, i) => `<text x="${cols1[i]}" y="${y1}" font-size="10" font-weight="bold">${t}</text>`).join('');
  const rows1 = FIXTURE_SCHEDULE.map((r, j) => r.map((t, i) => `<text x="${cols1[i]}" y="${y1 + 24 + j * 20}" font-size="10">${t}</text>`).join('')).join('');
  const cols2 = [120, 190, 500, 560, 600, 650, 700], y2 = 330;
  const head2 = ['CKT', 'LOAD SERVED', 'VA', 'P', 'BKR', 'WIRE', 'COND.'].map((t, i) => `<text x="${cols2[i]}" y="${y2}" font-size="10" font-weight="bold">${t}</text>`).join('');
  const rows2 = PANEL_SCHEDULE.map((r, j) => r.map((t, i) => `<text x="${cols2[i]}" y="${y2 + 24 + j * 18}" font-size="9.5">${t}</text>`).join('')).join('');
  const y2end = y2 + 24 + PANEL_SCHEDULE.length * 18 - 6;
  return `${sheetFrame()}
  <g font-family="${F}" fill="${INK}">
    <text x="120" y="112" font-size="15" font-weight="bold">LIGHTING FIXTURE SCHEDULE</text>
    <line x1="112" y1="124" x2="860" y2="124" stroke="${INK}" stroke-width="1.2"/><line x1="112" y1="158" x2="860" y2="158" stroke="${INK}" stroke-width="0.8"/>${head1}${rows1}
    <line x1="112" y1="${y1 + 24 + FIXTURE_SCHEDULE.length * 20 - 8}" x2="860" y2="${y1 + 24 + FIXTURE_SCHEDULE.length * 20 - 8}" stroke="${INK}" stroke-width="1.2"/>
    <text x="120" y="292" font-size="15" font-weight="bold">PANEL SCHEDULE · LP-1</text>
    <text x="120" y="310" font-size="9.5" fill="#444">208Y/120V, 3Φ, 4W · 200A MAIN BREAKER · 42 POLES · SURFACE, STORAGE 108 · FED FROM MDP, 2" C, 4 #3/0 CU + 1 #6 G</text>
    <line x1="112" y1="318" x2="860" y2="318" stroke="${INK}" stroke-width="1.2"/><line x1="112" y1="338" x2="860" y2="338" stroke="${INK}" stroke-width="0.8"/>${head2}${rows2}
    <line x1="112" y1="${y2end}" x2="860" y2="${y2end}" stroke="${INK}" stroke-width="1.2"/>
    <text x="120" y="${y2end + 18}" font-size="9.5">CONNECTED LOAD 22.3 kVA · 62 A AT 208V 3Φ · MAIN 200A FOR THE KITCHEN'S FUTURE LOAD (NEC 220, SEE E-601)</text>
  </g>
  ${notesColumn(900, 150, 'SCHEDULE NOTES', [
    '1. BRANCH CIRCUITS #12 CU THHN,',
    '   3/4" EMT, UNLESS NOTED.',
    '2. GFCI RECEPTACLES IN THE KITCHEN,',
    '   BAR, RESTROOMS AND WITHIN 6 FT',
    '   OF ANY SINK (NEC 210.8(B)).',
    '3. CKT 12 ON A SHUNT-TRIP BREAKER',
    '   INTERLOCKED WITH THE HOOD',
    '   SUPPRESSION (NFPA 96).',
    '4. MOUNTING: RECEPTACLES 18" AFF,',
    '   GFCI AT COUNTERS 44" AFF,',
    '   SWITCHES 48" AFF, PANEL TOP',
    '   78" AFF.',
    '5. OCCUPANCY SENSORS IN THE',
    '   RESTROOMS AND STORAGE',
    '   (IECC C405.2.1).',
    '6. #12 CU THHN IS RATED 20 A',
    '   (NEC 240.4(D), 310.16).',
  ])}
  ${titleBlock({ sheet: 'E-501', sheetName: 'SCHEDULES', project: 'MAIN ST RESTAURANT', scale: 'NONE', date: '07/31/26' })}`;
}

// ---------------- E-601 ONE-LINE ---------------------------------------------------------------
function sheetE601() {
  const box = (x, y, w, h, lines) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>${lines.map((t, i) => `<text x="${x + w / 2}" y="${y + 14 + i * 13}" font-family="${F}" font-size="${i ? 9 : 10.5}" ${i ? 'fill="#444"' : `font-weight="bold" fill="${INK}"`} text-anchor="middle">${t}</text>`).join('')}`;
  const wire = (x, y1, y2, label) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${INK}" stroke-width="1.8"/>${label ? `<text x="${x + 12}" y="${(y1 + y2) / 2 + 3}" font-family="${F}" font-size="9" fill="${INK}">${label}</text>` : ''}`;
  const X = 420;
  return `${sheetFrame()}
  <g font-family="${F}"><text x="120" y="112" font-size="15" font-weight="bold" fill="${INK}">ONE-LINE DIAGRAM · SERVICE AND PANEL LP-1</text><text x="120" y="128" font-size="9.5" fill="#444">NOT TO SCALE</text></g>
  ${box(X - 80, 150, 160, 40, ['UTILITY TRANSFORMER', '208Y/120V, 3Φ, 4W'])}
  ${wire(X, 190, 250, 'SERVICE LATERAL: 2" C, 4 #3/0 CU THHN + 1 #6 CU G, 60 FT (UTILITY)')}
  <circle cx="${X}" cy="270" r="20" fill="#fff" stroke="${INK}" stroke-width="1.4"/><text x="${X}" y="274" font-family="${F}" font-size="12" font-weight="bold" fill="${INK}" text-anchor="middle">M</text>
  <text x="${X + 30}" y="274" font-family="${F}" font-size="9" fill="${INK}">METER, UTILITY, ON THE SOUTH WALL</text>
  ${wire(X, 290, 330, '')}
  ${box(X - 80, 330, 160, 44, ['MDP · MAIN DISCONNECT', '200A / 3P, FUSED, NEMA 3R', 'SERVICE ENTRANCE, SOUTH WALL'])}
  ${wire(X, 374, 450, 'FEEDER: 2" C, 4 #3/0 CU THHN + 1 #6 CU G, 12 FT (NEC 310.16: 3/0 CU 75°C = 200 A; 250.122: #6 G AT 200 A)')}
  ${box(X - 80, 450, 160, 44, ['PANEL LP-1', '200A MCB, 42 POLES', '208Y/120V, 3Φ, 4W, STORAGE 108'])}
  ${wire(X, 494, 540, '')}
  <g font-family="${F}" font-size="9" fill="${INK}">
    <line x1="${X - 200}" y1="540" x2="${X + 200}" y2="540" stroke="${INK}" stroke-width="1.8"/>
    ${[['1-11', 'RECEPTACLE CIRCUITS'], ['13-17', 'LIGHTING'], ['21', 'EXIT / EM'], ['2,4 · 6 · 8,10 · 19', 'DW · RP · EF-1 · WH'], ['12', 'HOOD RECEPTS, SHUNT TRIP'], ['18,20,22', 'RTU-1, 3Φ, 40A']].map(([ckt, what], i) => { const x = X - 200 + i * 80; return `<line x1="${x}" y1="540" x2="${x}" y2="566" stroke="${INK}" stroke-width="1.2"/><text x="${x}" y="580" text-anchor="middle" font-size="8">${ckt}</text><text x="${x}" y="592" text-anchor="middle" font-size="7.5" fill="#444">${what}</text>`; }).join('')}
  </g>
  <line x1="${X - 80}" y1="352" x2="${X - 140}" y2="352" stroke="${INK}" stroke-width="1.4"/><line x1="${X - 140}" y1="352" x2="${X - 140}" y2="420" stroke="${INK}" stroke-width="1.4"/>
  <g font-family="${F}" font-size="8.5" fill="${INK}"><path d="M${X - 152} 420 h24 M${X - 148} 426 h16 M${X - 144} 432 h8" stroke="${INK}" stroke-width="1.4" fill="none"/><text x="${X - 140}" y="448" text-anchor="middle">GEC #4 CU TO WATER SERVICE + (2) RODS</text><text x="${X - 140}" y="460" text-anchor="middle" fill="#444">NEC 250.50, 250.66</text></g>
  ${notesColumn(820, 150, 'ONE-LINE NOTES', [
    '1. SERVICE: 200A, 208Y/120V, 3Φ, 4W.',
    '   CONNECTED LOAD 22.3 kVA (62 A);',
    '   200A CARRIES THE KITCHEN\'S FUTURE',
    '   LOAD (NEC 220).',
    '2. THREE PHASE FOR RTU-1 AND THE',
    '   DISHWASHER; 120V FROM ANY PHASE',
    '   TO NEUTRAL.',
    '3. FEEDER AND SERVICE CONDUCTORS',
    '   3/0 CU THHN, 200 A AT 75°C',
    '   (NEC 310.16); #6 CU EGC (250.122).',
    '4. CONDUIT FILL: 4 #3/0 + 1 #6 IN',
    '   2" EMT = 33% (NEC CH. 9 TABLE 1,',
    '   40% MAX).',
    '5. CKT 12 SHUNT TRIP INTERLOCKED',
    '   WITH THE HOOD SUPPRESSION.',
    '6. DISCONNECT WITHIN SIGHT OF EF-1',
    '   AND RTU-1 (NEC 430.102, 440.14).',
  ])}
  ${titleBlock({ sheet: 'E-601', sheetName: 'ONE-LINE DIAGRAM', project: 'MAIN ST RESTAURANT', scale: 'NONE', date: '07/31/26' })}`;
}

module.exports = { POWER, LIGHTING, FIXTURE_SCHEDULE, PANEL_SCHEDULE, sheetE101, sheetE201, sheetE501, sheetE601, keyTag };
