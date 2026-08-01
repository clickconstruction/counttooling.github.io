#!/usr/bin/env node
/**
 * CANDIDATE replacements for samples/sample-plan.pdf — under review, not yet wired
 * into anything (not in npm run check; build-screenshots still uses the current
 * sample plan). Same pipeline as scripts/build-sample-plan.js (inline SVG ->
 * Playwright PDF). Outputs land in samples/candidates/ (gitignored).
 *
 *   node scripts/sample-plan-candidates.js   # writes candidate-a/-b .pdf + .png
 *
 * On approval: fold the winning design into scripts/build-sample-plan.js, retune
 * the takeoffSetup/roomSetup coordinates in scripts/build-screenshots.js to the
 * new geometry, and regenerate the guide screenshots.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'samples', 'candidates');
const W = 1224, H = 792; // 17x11in @ 72dpi

const F = 'Helvetica, Arial';
const INK = '#111';

// ---------------- shared symbol library ----------------------------------------
const wc = (x, y, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="-8" y="-6" width="16" height="8"/><ellipse cx="0" cy="11" rx="8" ry="10.5"/></g>`;
const lavCtr = (x, y, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.2">
  <ellipse cx="0" cy="0" rx="9" ry="6.5"/><circle cx="0" cy="-3.5" r="1.2"/></g>`;
const urinal = (x, y, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="-6" y="0" width="12" height="9" rx="2"/><ellipse cx="0" cy="14" rx="7" ry="8"/></g>`;
const mopSink = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="-11" y="-11" width="22" height="22"/><line x1="-11" y1="-11" x2="11" y2="11"/><line x1="11" y1="-11" x2="-11" y2="11"/></g>`;
const floorDrain = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.1">
  <circle r="6"/><line x1="-6" y1="0" x2="6" y2="0"/><line x1="0" y1="-6" x2="0" y2="6"/></g>`;
const floorSink = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.1">
  <rect x="-7" y="-7" width="14" height="14"/><circle r="4"/></g>`;
const waterHeater = (x, y, r = 16) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.3">
  <circle r="${r}"/><text y="4" text-anchor="middle" font-family="${F}" font-size="10" fill="${INK}" stroke="none">WH</text></g>`;
const drinkFtn = (x, y, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="-8" y="0" width="16" height="10" rx="2"/><rect x="-5" y="10" width="10" height="7" rx="2"/></g>`;
const handSink = (x, y, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="-8" y="-6" width="16" height="12" rx="2"/><ellipse cx="0" cy="0" rx="5" ry="3.5"/></g>`;
const sink3Comp = (x, y, w = 66) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.2">
  <rect x="0" y="0" width="${w}" height="20"/>
  <rect x="4" y="3" width="${w / 3 - 6}" height="14"/><rect x="${w / 3 + 2}" y="3" width="${w / 3 - 6}" height="14"/><rect x="${2 * w / 3 + 1}" y="3" width="${w / 3 - 6}" height="14"/></g>`;
const door = (x, y, size, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.1">
  <line x1="0" y1="0" x2="0" y2="${-size}"/><path d="M0 ${-size} A ${size} ${size} 0 0 1 ${size} 0"/></g>`;
const lightFix = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.1">
  <circle r="5.5"/><line x1="-3.9" y1="-3.9" x2="3.9" y2="3.9"/><line x1="3.9" y1="-3.9" x2="-3.9" y2="3.9"/></g>`;
const stall = (x, y, w, h) => `<g fill="none" stroke="${INK}" stroke-width="1"><polyline points="${x},${y + h} ${x},${y} ${x + w},${y}"/></g>`;

const roomTag = (x, y, label, num) => `<g font-family="${F}" text-anchor="middle">
  <text x="${x}" y="${y}" font-size="13" font-weight="bold" fill="${INK}">${label}</text>
  <rect x="${x - 22}" y="${y + 6}" width="44" height="17" fill="#fff" stroke="${INK}" stroke-width="1"/>
  <text x="${x}" y="${y + 19}" font-size="11" fill="${INK}">${num}</text></g>`;

const keyTag = (x, y, label) => `<g font-family="${F}" text-anchor="middle">
  <polygon points="${x},${y - 9} ${x + 8},${y - 4.5} ${x + 8},${y + 4.5} ${x},${y + 9} ${x - 8},${y + 4.5} ${x - 8},${y - 4.5}" fill="#fff" stroke="${INK}" stroke-width="1"/>
  <text x="${x}" y="${y + 3.5}" font-size="8.5" font-weight="bold" fill="${INK}">${label}</text></g>`;

const dimH = (x1, y, x2, label) => `<g stroke="${INK}" stroke-width="0.9" font-family="${F}" font-size="11" fill="${INK}">
  <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
  <line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}"/>
  <line x1="${x1 - 3}" y1="${y + 3}" x2="${x1 + 3}" y2="${y - 3}"/><line x1="${x2 - 3}" y1="${y + 3}" x2="${x2 + 3}" y2="${y - 3}"/>
  <text x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle" stroke="none">${label}</text></g>`;
const dimV = (x, y1, y2, label) => `<g stroke="${INK}" stroke-width="0.9" font-family="${F}" font-size="11" fill="${INK}">
  <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
  <line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}"/><line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}"/>
  <line x1="${x - 3}" y1="${y1 + 3}" x2="${x + 3}" y2="${y1 - 3}"/><line x1="${x - 3}" y1="${y2 + 3}" x2="${x + 3}" y2="${y2 - 3}"/>
  <text x="${x - 7}" y="${(y1 + y2) / 2}" text-anchor="middle" transform="rotate(-90 ${x - 7} ${(y1 + y2) / 2})" stroke="none">${label}</text></g>`;

const gridBubble = (x, y, label) => `<g font-family="${F}">
  <circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
  <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="${INK}">${label}</text></g>`;
const gridLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#999" stroke-width="0.7" stroke-dasharray="14 5 3 5"/>`;

const northArrow = (x, y) => `<g transform="translate(${x},${y})" stroke="${INK}" fill="${INK}" font-family="${F}">
  <circle r="16" fill="none" stroke-width="1.1"/>
  <path d="M0 12 L6 8 L0 -13 L-6 8 Z" stroke="none"/>
  <text x="0" y="-22" text-anchor="middle" font-size="12" stroke="none">N</text></g>`;

const scaleBar = (x, y, unit = 24, label = "0      8'     16'            32'") => `<g transform="translate(${x},${y})" font-family="${F}" font-size="10" fill="${INK}">
  <rect x="0" y="0" width="${unit}" height="6" fill="${INK}"/><rect x="${unit}" y="0" width="${unit}" height="6" fill="none" stroke="${INK}" stroke-width="0.8"/>
  <rect x="${unit * 2}" y="0" width="${unit * 2}" height="6" fill="${INK}"/>
  <text x="0" y="18">${label}</text></g>`;

function titleBlock({ sheet, sheetName, project, scale, date }) {
  return `<g font-family="${F}">
    <rect x="812" y="640" width="392" height="132" fill="#fff" stroke="${INK}" stroke-width="2"/>
    <line x1="812" y1="676" x2="1204" y2="676" stroke="${INK}" stroke-width="1"/>
    <line x1="812" y1="706" x2="1204" y2="706" stroke="${INK}" stroke-width="0.8"/>
    <line x1="1076" y1="676" x2="1076" y2="772" stroke="${INK}" stroke-width="1"/>
    <line x1="1076" y1="724" x2="1204" y2="724" stroke="${INK}" stroke-width="0.8"/>
    <g transform="translate(826,658)">
      <circle r="10" fill="#e8c547"/><g stroke="#161617" stroke-width="1.8" fill="none">
      <circle r="4.5"/><line x1="0" y1="-9" x2="0" y2="-5.5"/><line x1="0" y1="5.5" x2="0" y2="9"/><line x1="-9" y1="0" x2="-5.5" y2="0"/><line x1="5.5" y1="0" x2="9" y2="0"/></g>
    </g>
    <text x="844" y="663" font-size="15" font-weight="bold" fill="${INK}">COUNTTOOLING — SAMPLE PLAN</text>
    <text x="826" y="696" font-size="11" fill="#444">PROJECT</text>
    <text x="892" y="696" font-size="11" fill="${INK}">${project}</text>
    <text x="826" y="722" font-size="10" fill="#444">SCALE</text>
    <text x="826" y="738" font-size="13" fill="${INK}">${scale}</text>
    <text x="826" y="756" font-size="10" fill="#444">${sheetName}</text>
    <text x="960" y="722" font-size="10" fill="#444">DATE</text>
    <text x="960" y="738" font-size="12" fill="${INK}">${date}</text>
    <text x="960" y="756" font-size="10" fill="#444">DRAWN: CT</text>
    <text x="1090" y="700" font-size="10" fill="#444">SHEET</text>
    <text x="1090" y="760" font-size="26" font-weight="bold" fill="${INK}">${sheet}</text>
    <g transform="translate(1180,694)"><polygon points="0,-8 7,5 -7,5" fill="none" stroke="${INK}" stroke-width="1"/><text y="3.5" text-anchor="middle" font-size="8" fill="${INK}">1</text></g>
  </g>`;
}

function notesColumn(x, y, title, lines) {
  const rows = lines.map((l, i) => `<text x="${x}" y="${y + 26 + i * 15}" font-size="9.5" fill="${INK}">${l}</text>`).join('');
  return `<g font-family="${F}">
    <text x="${x}" y="${y}" font-size="12" font-weight="bold" fill="${INK}">${title}</text>
    <line x1="${x}" y1="${y + 6}" x2="${x + 200}" y2="${y + 6}" stroke="${INK}" stroke-width="1"/>
    ${rows}</g>`;
}

const sheetFrame = () => `<rect width="${W}" height="${H}" fill="#fff"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${INK}" stroke-width="1.4"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="${INK}" stroke-width="0.6"/>`;

// ---------------- Candidate A: commercial office TI (A-101) --------------------
function candidateA() {
  const L = 130, R = 940, T = 100, B = 600, COR_T = 340, COR_B = 384;
  return `${sheetFrame()}
  <!-- structural grid -->
  ${gridLine(L, 66, L, 630)}${gridLine(420, 66, 420, 630)}${gridLine(640, 66, 640, 630)}${gridLine(R, 66, R, 630)}
  ${gridLine(96, T, 968, T)}${gridLine(96, B, 968, B)}
  ${gridBubble(L, 54, '1')}${gridBubble(420, 54, '2')}${gridBubble(640, 54, '3')}${gridBubble(R, 54, '4')}
  ${gridBubble(84, T, 'A')}${gridBubble(84, B, 'B')}

  <!-- outer wall -->
  <rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${INK}" stroke-width="6"/>
  <!-- corridor -->
  <line x1="${L}" y1="${COR_T}" x2="${R}" y2="${COR_T}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="${L}" y1="${COR_B}" x2="${R}" y2="${COR_B}" stroke="${INK}" stroke-width="2.5"/>
  <!-- top row partitions -->
  <line x1="300" y1="${T}" x2="300" y2="${COR_T}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="470" y1="${T}" x2="470" y2="${COR_T}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="640" y1="${T}" x2="640" y2="${COR_T}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="790" y1="${T}" x2="790" y2="${COR_T}" stroke="${INK}" stroke-width="2.5"/>
  <!-- bottom row partitions -->
  <line x1="470" y1="${COR_B}" x2="470" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="580" y1="${COR_B}" x2="580" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="760" y1="${COR_B}" x2="760" y2="${B}" stroke="${INK}" stroke-width="2.5"/>

  <!-- room tags -->
  ${roomTag(215, 210, 'LOBBY', '100')}
  ${roomTag(385, 210, 'OFFICE', '101')}
  ${roomTag(555, 210, 'OFFICE', '102')}
  ${roomTag(715, 210, 'CONFERENCE', '103')}
  ${roomTag(865, 200, 'BREAK', '104')}
  ${roomTag(300, 480, 'OPEN OFFICE', '105')}
  ${roomTag(525, 452, 'JAN.', '106')}
  ${roomTag(670, 445, 'MEN', '107')}
  ${roomTag(850, 445, 'WOMEN', '108')}
  <text x="150" y="368" font-family="${F}" font-size="11" fill="#444">CORRIDOR C-1</text>

  <!-- break room: counter + sink + fridge -->
  <g fill="none" stroke="${INK}" stroke-width="1.2">
    <rect x="798" y="106" width="136" height="22"/>
    <rect x="906" y="132" width="28" height="28"/>
  </g>
  ${handSink(852, 117)}
  <text x="912" y="150" font-family="${F}" font-size="8.5" fill="${INK}" text-anchor="middle">REF</text>

  <!-- janitor / mech: mop sink, WH, FD -->
  ${mopSink(505, 415)}
  ${waterHeater(548, 425, 14)}
  ${floorDrain(525, 560)}

  <!-- men 107: 2 stalls + wc, 2 urinals, 2 lavs, FD -->
  ${stall(590, 392, 38, 52)}${stall(628, 392, 38, 52)}
  ${wc(609, 400)}${wc(647, 400)}
  ${urinal(700, 392)}${urinal(728, 392)}
  <rect x="588" y="562" width="80" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  ${lavCtr(610, 574)}${lavCtr(646, 574)}
  ${floorDrain(712, 505)}

  <!-- women 108: 3 stalls, 3 lavs, FD -->
  ${stall(770, 392, 40, 52)}${stall(810, 392, 40, 52)}${stall(850, 392, 40, 52)}
  ${wc(790, 400)}${wc(830, 400)}${wc(870, 400)}
  <rect x="778" y="562" width="118" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  ${lavCtr(800, 574)}${lavCtr(837, 574)}${lavCtr(874, 574)}
  ${floorDrain(905, 505)}

  <!-- corridor drinking fountains + FD -->
  ${drinkFtn(690, 342)}${drinkFtn(712, 342)}
  ${floorDrain(660, 362)}

  <!-- doors (openings onto corridor) -->
  ${door(250, COR_T, 24, 180)}
  ${door(340, COR_T, 24, 0)}
  ${door(510, COR_T, 24, 0)}
  ${door(680, COR_T, 24, 0)}
  ${door(820, COR_T, 24, 0)}
  ${door(210, COR_B, 24, 90)}
  ${door(500, COR_B, 22, 90)}
  ${door(608, COR_B, 24, 90)}
  ${door(788, COR_B, 24, 90)}
  <!-- entry door -->
  ${door(L, 190, 28, 270)}

  <!-- dimensions -->
  ${dimH(L, 84, 420, "24'-0\"")}${dimH(420, 84, 640, "18'-4\"")}${dimH(640, 84, R, "25'-0\"")}
  ${dimH(L, 622, R, "67'-4\"")}
  ${dimV(112, T, COR_T, "20'-0\"")}${dimV(112, COR_T, COR_B, "5'-0\"")}${dimV(112, COR_B, B, "18'-0\"")}

  ${northArrow(990, 132)}
  ${scaleBar(130, 648)}

  ${notesColumn(985, 200, 'GENERAL NOTES', [
    '1. ALL DIMENSIONS TO FACE OF STUD',
    '   UNLESS NOTED OTHERWISE.',
    '2. VERIFY ALL FIXTURE ROUGH-INS',
    '   WITH PLUMBING PLANS.',
    '3. PROVIDE ADA CLEARANCES AT',
    '   ALL RESTROOM FIXTURES.',
    '4. FD = FLOOR DRAIN, SLOPE 1/4"',
    '   PER FOOT TO DRAIN, TYP.',
    '5. WH = 50 GAL ELECTRIC WATER',
    '   HEATER ON 18" STAND.',
  ])}
  ${notesColumn(985, 396, 'LEGEND', [])}
  <g font-family="${F}" font-size="9.5" fill="${INK}">
    <g transform="translate(996,428)">${floorDrain(0, 0)}</g><text x="1016" y="431">FLOOR DRAIN</text>
    <g transform="translate(996,456)">${waterHeater(0, 0, 9)}</g><text x="1016" y="459">WATER HEATER</text>
    <g transform="translate(988,478)">${mopSink(8, 6)}</g><text x="1016" y="487">MOP SINK</text>
    <g transform="translate(988,506)">${drinkFtn(8, 0)}</g><text x="1016" y="515">DRINKING FOUNTAIN</text>
  </g>

  ${titleBlock({ sheet: 'A-101', sheetName: 'FIRST FLOOR PLAN', project: 'SUITE 200 OFFICE TI', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- Candidate B: restaurant plumbing plan (P-101) ----------------
function candidateB() {
  const L = 130, R = 940, T = 100, B = 600;
  return `${sheetFrame()}
  <!-- outer wall (entry opening 480-510 masked out of the top run) -->
  <rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${INK}" stroke-width="6"/>
  <line x1="480" y1="${T}" x2="510" y2="${T}" stroke="#fff" stroke-width="8"/>
  <!-- main partitions, segmented at door openings -->
  <line x1="560" y1="${T}" x2="560" y2="300" stroke="${INK}" stroke-width="2.5"/>
  <line x1="560" y1="324" x2="560" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="560" y1="252" x2="662" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="684" y1="252" x2="796" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="818" y1="252" x2="862" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="882" y1="252" x2="${R}" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="${T}" x2="700" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="830" y1="${T}" x2="830" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="${L}" y1="470" x2="300" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="324" y1="470" x2="420" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="420" y1="470" x2="420" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="470" x2="700" y2="505" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="527" x2="700" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="470" x2="758" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="812" y1="470" x2="${R}" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <!-- pass-through window kitchen <-> dish (counter sill in the opening) -->
  <rect x="758" y="465" width="54" height="10" fill="#fff" stroke="${INK}" stroke-width="1"/>
  <text x="785" y="461" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle">PASS-THRU</text>

  <!-- room tags -->
  ${roomTag(340, 250, 'DINING', '100')}
  ${roomTag(200, 492, 'BAR', '101')}
  ${roomTag(628, 160, 'MEN', '102')}
  ${roomTag(763, 160, 'WOMEN', '103')}
  ${roomTag(884, 150, 'MOP', '104')}
  ${roomTag(872, 388, 'KITCHEN', '105')}
  ${roomTag(745, 545, 'DISH', '106')}

  <!-- restrooms: WC tanks against the top wall, lavs hung on the side walls,
       FD at the room center clear of the door swings -->
  ${wc(596, 118)}${lavCtr(574, 180, 270)}${floorDrain(630, 192)}
  ${wc(732, 118)}${lavCtr(712, 180, 270)}${floorDrain(766, 196)}
  <!-- mop room: sink in the NW corner, FD center-south -->
  ${mopSink(848, 126)}${floorDrain(902, 206)}

  <!-- dining pendant lights: even 3x3 grid over the room + a row over the bar -->
  ${lightFix(200, 160)}${lightFix(345, 160)}${lightFix(490, 160)}
  ${lightFix(200, 285)}${lightFix(345, 285)}${lightFix(490, 285)}
  ${lightFix(200, 410)}${lightFix(345, 410)}${lightFix(490, 410)}
  ${lightFix(265, 505)}${lightFix(330, 505)}${lightFix(390, 505)}
  <text x="150" y="136" font-family="${F}" font-size="8.5" fill="#444">PENDANT, TYP.</text>

  <!-- bar: counter anchored to the left wall, parallel to the rear wall, with a
       bartender aisle behind it; the vertical leg stops short of the rear wall
       to leave a pass-through. Back-bar equipment sits in the aisle. -->
  <path d="M133 520 L370 520 L370 570" fill="none" stroke="${INK}" stroke-width="2"/>
  ${sink3Comp(170, 560, 54)}
  ${handSink(272, 585)}
  ${floorDrain(238, 542)}${floorDrain(340, 545)}

  <!-- kitchen equipment wall: 3-comp, prep sink, hand sinks -->
  ${sink3Comp(566, 262, 66)}
  <text x="599" y="298" font-family="${F}" font-size="8.5" fill="#444" text-anchor="middle">3-COMP</text>
  ${handSink(676, 266)}
  ${handSink(575, 380, 90)}
  <rect x="740" y="262" width="60" height="20" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="770" y="298" font-family="${F}" font-size="8.5" fill="#444" text-anchor="middle">PREP</text>
  <ellipse cx="770" cy="272" rx="9" ry="6" fill="none" stroke="${INK}" stroke-width="1.1"/>

  <!-- cook line (dashed hood above) -->
  <rect x="590" y="330" width="200" height="26" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <rect x="580" y="322" width="220" height="42" fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="6 4"/>
  <text x="690" y="348" font-family="${F}" font-size="9" fill="#444" text-anchor="middle">COOK LINE — HOOD ABOVE</text>

  <!-- kitchen floor drains / floor sinks -->
  ${floorDrain(610, 420)}${floorDrain(700, 420)}${floorDrain(790, 420)}${floorDrain(870, 300)}
  ${floorSink(655, 300)}${floorSink(884, 444)}

  <!-- dish room, straight-line flow along the top wall:
       soiled table w/ pre-rinse -> DW -> clean table down the right wall.
       FS under the DW (indirect waste), FD center, WH out of the work path. -->
  <rect x="735" y="478" width="96" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <rect x="748" y="482" width="28" height="16" rx="2" fill="none" stroke="${INK}" stroke-width="1.1"/>
  <text x="783" y="514" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle">SOILED</text>
  <rect x="836" y="478" width="46" height="30" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="859" y="496" font-family="${F}" font-size="8.5" fill="#444" text-anchor="middle">DW</text>
  <rect x="908" y="486" width="26" height="90" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="921" y="538" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle" transform="rotate(-90 921 538)">CLEAN</text>
  ${floorSink(859, 524)}
  ${floorDrain(835, 552)}

  <!-- water heater + grease interceptor (exterior) -->
  ${waterHeater(795, 572)}
  <g font-family="${F}">
    <rect x="965" y="520" width="56" height="34" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <text x="993" y="540" font-size="9.5" fill="${INK}" text-anchor="middle">GI</text>
    <text x="993" y="568" font-size="8.5" fill="#444" text-anchor="middle">1000 GAL</text>
    <line x1="940" y1="545" x2="965" y2="540" stroke="${INK}" stroke-width="1" stroke-dasharray="5 3"/>
  </g>

  <!-- site utilities: city connections outside the walls -->
  <g font-family="${F}">
    <!-- city water main (solid) below the building, service riser + meter at the tie-in -->
    <line x1="240" y1="614" x2="800" y2="614" stroke="${INK}" stroke-width="1.8"/>
    <path d="M236 614 L246 610 L246 618 Z" fill="${INK}"/><path d="M804 614 L794 610 L794 618 Z" fill="${INK}"/>
    <text x="248" y="609" font-size="8.5" fill="#444">8" CITY WATER MAIN</text>
    <line x1="390" y1="600" x2="390" y2="614" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="390" cy="614" r="2.4" fill="${INK}"/>
    <rect x="381" y="601" width="18" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>
    <text x="390" y="609.5" font-size="7.5" fill="${INK}" text-anchor="middle">WM</text>
    <text x="404" y="610" font-size="8.5" fill="#444">2" W</text>
    <!-- city gas main (dash-dot) below the water main, riser + meter -->
    <line x1="240" y1="632" x2="800" y2="632" stroke="${INK}" stroke-width="1.3" stroke-dasharray="10 3 2 3"/>
    <path d="M236 632 L246 628 L246 636 Z" fill="${INK}"/><path d="M804 632 L794 628 L794 636 Z" fill="${INK}"/>
    <text x="248" y="627" font-size="8.5" fill="#444">4" CITY GAS MAIN</text>
    <line x1="500" y1="600" x2="500" y2="632" stroke="${INK}" stroke-width="1.3" stroke-dasharray="8 3 2 3"/>
    <circle cx="500" cy="632" r="2.4" fill="${INK}"/>
    <rect x="491" y="603" width="18" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>
    <text x="500" y="611.5" font-size="7.5" fill="${INK}" text-anchor="middle">GM</text>
    <text x="514" y="612" font-size="8.5" fill="#444">1-1/2" G</text>
    <!-- city sanitary sewer main (heavy dashed, right of the building); the GI branch ties in -->
    <line x1="1105" y1="520" x2="1105" y2="626" stroke="${INK}" stroke-width="1.8" stroke-dasharray="8 4"/>
    <path d="M1105 634 L1101 624 L1109 624 Z" fill="${INK}"/><path d="M1105 516 L1101 526 L1109 526 Z" fill="${INK}"/>
    <line x1="1021" y1="537" x2="1105" y2="537" stroke="${INK}" stroke-width="1.8" stroke-dasharray="8 4"/>
    <circle cx="1105" cy="537" r="2.4" fill="${INK}"/>
    <text x="1032" y="530" font-size="8.5" fill="#444">4" SS</text>
    <text x="1096" y="600" font-size="8.5" fill="#444" transform="rotate(-90 1096 600)">8" CITY SANITARY MAIN</text>
  </g>

  <!-- keynote tags, anchored beside their fixtures -->
  ${keyTag(652, 192, 'FD')}${keyTag(788, 196, 'FD')}
  ${keyTag(622, 124, 'WC')}${keyTag(758, 124, 'WC')}
  ${keyTag(646, 272, '3CS')}
  ${keyTag(600, 380, 'HS')}
  ${keyTag(848, 158, 'MS')}

  <!-- doors (each hinge sits at a real wall opening) -->
  ${door(480, T, 30, 90)}
  ${door(560, 300, 24, 90)}
  ${door(662, 252, 22, 0)}
  ${door(796, 252, 22, 0)}
  ${door(862, 252, 20, 0)}
  ${door(700, 505, 22, 90)}
  ${door(324, 470, 24, 180)}

  <!-- dimensions -->
  ${dimH(L, 84, 560, "36'-0\"")}${dimH(560, 84, R, "31'-8\"")}
  ${dimV(112, T, 470, "30'-8\"")}${dimV(112, 470, B, "10'-10\"")}

  ${northArrow(990, 132)}
  ${scaleBar(130, 648)}

  ${notesColumn(985, 200, 'PLUMBING KEYNOTES', [
    'WC   WATER CLOSET, FLOOR MTD',
    'HS   HAND SINK, WALL HUNG',
    '3CS  3-COMPARTMENT SINK',
    'MS   MOP SINK, FLOOR MTD',
    'FD   FLOOR DRAIN W/ TRAP',
    '     PRIMER, TYP.',
    'FS   FLOOR SINK, 1/2 GRATE',
    'DW   COMMERCIAL DISHWASHER,',
    '     INDIRECT WASTE TO FS',
    'GI   GREASE INTERCEPTOR,',
    '     1000 GAL, EXTERIOR',
    'WH   WATER HEATER, 100 GAL GAS',
    'SS   SANITARY SEWER TO CITY',
    'W    DOMESTIC WATER FROM CITY',
    'G    GAS SERVICE FROM CITY',
  ])}
  <g font-family="${F}" font-size="9" fill="#8a2727">
    <text x="985" y="464" font-weight="bold">ALL KITCHEN WASTE THROUGH</text>
    <text x="985" y="478" font-weight="bold">GREASE INTERCEPTOR, TYP.</text>
  </g>
  ${lightFix(992, 504)}
  <text x="1008" y="508" font-family="${F}" font-size="9.5" fill="${INK}">PENDANT LIGHT FIXTURE, TYP.</text>

  ${titleBlock({ sheet: 'P-101', sheetName: 'PLUMBING PLAN', project: 'MAIN ST RESTAURANT', scale: '1/4" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- render ---------------------------------------------------------
async function render(name, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${W}px ${H}px; margin: 0; } html,body { margin:0; padding:0; } svg { display:block; }
  </style></head><body>${svg}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: path.join(OUT_DIR, name + '.pdf'), width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
  await page.screenshot({ path: path.join(OUT_DIR, name + '.png') });
  await browser.close();
  console.log('wrote ' + name + '.pdf/.png');
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await render('candidate-a-office-ti', candidateA());
  await render('candidate-b-restaurant-plumbing', candidateB());
})().catch((e) => { console.error(e); process.exit(1); });
