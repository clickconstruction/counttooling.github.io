#!/usr/bin/env node
/**
 * Sample-plan candidates — both SHIPPED (2026-09-14): candidate A is the simple
 * (design-build) plan, rendered by scripts/build-sample-plan.js to
 * samples/sample-plan.pdf on a true ANSI B sheet; candidate B is the advanced
 * (restaurant plumbing) plan, rendered by scripts/build-sample-plan-advanced.js.
 * Inline SVG -> Playwright PDF. Preview outputs land in samples/candidates/ (gitignored).
 *
 *   node scripts/sample-plan-candidates.js   # writes candidate-a/-b .pdf + .png
 *
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
// The waste side's marks (the plumbing course's answer key, 2026-09-21): a cleanout, a
// vent stack through the roof, a hose bibb off the wall.
const cleanout = (x, y) => `<g transform="translate(${x},${y})" fill="#fff" stroke="${INK}" stroke-width="1.1"><circle r="3.6"/><line x1="-2.5" y1="2.5" x2="2.5" y2="-2.5"/></g>`;
const vtr = (x, y) => `<g transform="translate(${x},${y})" stroke="${INK}" stroke-width="1.3"><circle r="4.5" fill="#fff"/><circle r="1.6" fill="${INK}" stroke="none"/></g>`;
const hoseBibb = (x, y) => `<g transform="translate(${x},${y})" stroke="${INK}" stroke-width="1.2"><circle r="2.8" fill="#fff"/><line x1="2.8" y1="0" x2="7" y2="0"/></g>`;
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
// Double door: two mirrored leaves hinged at opposite jambs, meeting mid-opening.
// The opening spans 2*size from the hinge point along the local +x axis.
const doorDouble = (x, y, size, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${INK}" stroke-width="1.1">
  <line x1="0" y1="0" x2="0" y2="${-size}"/><path d="M0 ${-size} A ${size} ${size} 0 0 1 ${size} 0"/>
  <line x1="${2 * size}" y1="0" x2="${2 * size}" y2="${-size}"/><path d="M${2 * size} ${-size} A ${size} ${size} 0 0 0 ${size} 0"/></g>`;
const lightFix = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="${INK}" stroke-width="1.1">
  <circle r="5.5"/><line x1="-3.9" y1="-3.9" x2="3.9" y2="3.9"/><line x1="3.9" y1="-3.9" x2="-3.9" y2="3.9"/></g>`;
// A toilet stall against the bottom wall, ENCLOSING the fixture: side partitions run
// from the front line down to the wall, the front line closes the top; adjacent
// stalls share a partition, so only the last stall draws its right-hand one.
const stallEnc = (x, y, w, h, last = false) => `<g fill="none" stroke="${INK}" stroke-width="1"><polyline points="${x},${y + h} ${x},${y} ${x + w},${y}${last ? ` ${x + w},${y + h}` : ''}"/></g>`;

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
// opts.labelDx flips the rotated label to the other side of the line (right-hand
// dimension strings read better with the text outboard); opts.extFrom draws
// extension lines from the building edge out past the dimension line.
const dimV = (x, y1, y2, label, opts = {}) => {
  const lx = x + (opts.labelDx ?? -7);
  const ext = opts.extFrom == null ? '' : [y1, y2].map((y) =>
    `<line x1="${opts.extFrom}" y1="${y}" x2="${x + (opts.extFrom < x ? 6 : -6)}" y2="${y}" stroke-width="0.6"/>`).join('');
  return `<g stroke="${INK}" stroke-width="0.9" font-family="${F}" font-size="11" fill="${INK}">
  ${ext}<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
  <line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}"/><line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}"/>
  <line x1="${x - 3}" y1="${y1 + 3}" x2="${x + 3}" y2="${y1 - 3}"/><line x1="${x - 3}" y1="${y2 + 3}" x2="${x + 3}" y2="${y2 - 3}"/>
  <text x="${lx}" y="${(y1 + y2) / 2}" text-anchor="middle" transform="rotate(-90 ${lx} ${(y1 + y2) / 2})" stroke="none">${label}</text></g>`;
};

const gridBubble = (x, y, label) => `<g font-family="${F}">
  <circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
  <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="${INK}">${label}</text></g>`;
const gridLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#999" stroke-width="0.7" stroke-dasharray="14 5 3 5"/>`;

const northArrow = (x, y) => `<g transform="translate(${x},${y})" stroke="${INK}" fill="${INK}" font-family="${F}">
  <circle r="16" fill="none" stroke-width="1.1"/>
  <path d="M0 12 L6 8 L0 -13 L-6 8 Z" stroke="none"/>
  <text x="0" y="-22" text-anchor="middle" font-size="12" stroke="none">N</text></g>`;

// Graphic scale bar, calibrated to the sheets' true geometry (12 px/ft per the
// dimension strings; the PDF is 1224 CSS px = 918 pt wide, so 12 px/ft = 9 pt/ft =
// 1/8" = 1'-0", the same scale as samples/sample-plan.pdf): four alternating 4-ft
// segments with ticks and aligned labels.
const scaleBar = (x, y, pxPerFt = 12) => {
  const seg = 4 * pxPerFt;
  const boxes = [0, 1, 2, 3].map((i) =>
    `<rect x="${i * seg}" y="0" width="${seg}" height="7" ${i % 2 === 0 ? `fill="${INK}"` : `fill="#fff" stroke="${INK}" stroke-width="0.9"`}/>`).join('');
  const ticks = [0, 1, 2, 3, 4].map((i) =>
    `<line x1="${i * seg}" y1="-3" x2="${i * seg}" y2="10" stroke="${INK}" stroke-width="0.9"/>`).join('');
  const labels = [0, 4, 8, 12, 16].map((ft, i) =>
    `<text x="${i * seg}" y="22" text-anchor="middle">${ft === 0 ? '0' : ft + "'"}</text>`).join('');
  return `<g transform="translate(${x},${y})" font-family="${F}" font-size="9.5" fill="${INK}">
    <rect x="0" y="0" width="${seg * 4}" height="7" fill="none" stroke="${INK}" stroke-width="0.9"/>
    ${boxes}${ticks}${labels}
    <text x="0" y="-9" font-size="9" letter-spacing="1.5">GRAPHIC SCALE</text>
    <text x="${seg * 4 + 12}" y="7" font-size="9" fill="#444">1/8" = 1'-0"</text>
  </g>`;
};

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
// PROMOTED 2026-09-14: candidate A is the simple plan (scripts/build-sample-plan.js
// renders it to samples/sample-plan.pdf on a true ANSI B sheet). The plan geometry
// is drawn at 12 px/ft in its own space and placed on the sheet at PLAN_AT (0.75 →
// 9 pt/ft = 1/8" = 1'-0", so the title block's scale is literally true); the frame,
// notes, legend, room schedule and title block sit in sheet coordinates. A point on
// the drawing lands at (PLAN_AT.x + 0.75·px, PLAN_AT.y + 0.75·py) PDF pt — the
// figure the tours and build-screenshots carry.
//
// It is the DESIGN-BUILD sheet (journeys/plans/SAMPLE-PLANS.md §2): an architectural
// plan with the inputs the design math reads — a room schedule with areas, ceiling
// heights and types; fixture counts as drawn; the water heater, panel LP-1, the
// service entry and RTU-1 named — and none of the answers: no piping, duct or
// circuits on the sheet.
const PLAN_AT = { x: 60, y: 70, k: 0.75 };
const ROOM_SCHEDULE = [
  ['100', 'LOBBY', '283', "9'-0\"", 'LOBBY'],
  ['101', 'OFFICE', '283', "9'-0\"", 'OFFICE'],
  ['102', 'OFFICE', '283', "9'-0\"", 'OFFICE'],
  ['103', 'CONFERENCE', '250', "9'-0\"", 'CONFERENCE'],
  ['104', 'BREAK', '250', "9'-0\"", 'BREAK'],
  ['105', 'OPEN OFFICE', '510', "9'-0\"", 'OFFICE'],
  ['106', 'JAN.', '165', "8'-0\"", 'STORAGE / MECH'],
  ['107', 'MEN', '270', "8'-0\"", 'RESTROOM, PUBLIC'],
  ['108', 'WOMEN', '270', "8'-0\"", 'RESTROOM, PUBLIC'],
  ['C-1', 'CORRIDOR', '337', "8'-0\"", 'CIRCULATION'],
];
function roomSchedule(x, y) {
  const cols = [0, 32, 110, 165, 210];
  const head = ['NO.', 'ROOM', 'AREA SF', 'CLG', 'TYPE / OCCUPANCY'];
  const row = (cells, yy, bold) => cells.map((c, i) => `<text x="${x + cols[i]}" y="${yy}" font-size="7.5"${bold ? ' font-weight="bold"' : ''} fill="${INK}">${c}</text>`).join('');
  return `<g font-family="${F}">
    <text x="${x}" y="${y}" font-size="10" font-weight="bold" fill="${INK}">ROOM SCHEDULE</text>
    <line x1="${x}" y1="${y + 5}" x2="${x + 330}" y2="${y + 5}" stroke="${INK}" stroke-width="1"/>
    ${row(head, y + 16, true)}
    <line x1="${x}" y1="${y + 20}" x2="${x + 330}" y2="${y + 20}" stroke="${INK}" stroke-width="0.6"/>
    ${ROOM_SCHEDULE.map((r, i) => row(r, y + 30 + i * 9)).join('')}
    <text x="${x}" y="${y + 30 + ROOM_SCHEDULE.length * 9 + 4}" font-size="7.5" fill="#444">DECK 12'-0" A.F.F. TYP. · MEP DESIGN-BUILD, SEE NOTE 6</text>
  </g>`;
}
function candidateAPlan() {
  const L = 132, R = 940, T = 100, B = 600, COR_T = 340, COR_B = 384;
  return `
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

  <!-- janitor / mech: mop sink, WH, FD, panel LP-1 on the east wall -->
  ${mopSink(536, 399)}
  ${waterHeater(564, 401, 14)}
  ${floorDrain(525, 560)}
  <rect x="572" y="480" width="8" height="32" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
  <text x="566" y="496" font-family="${F}" font-size="7.5" fill="${INK}" text-anchor="middle" transform="rotate(-90 566 496)">LP-1</text>

  <!-- men 107: 2 stalls + wc on the bottom wall, lavs on the top wall clear of the door
       swing, 2 urinals on the bottom wall beside the stalls, FD -->
  ${stallEnc(580, 540, 38, 57)}${stallEnc(618, 540, 38, 57, true)}
  ${wc(599, 591, 180)}${wc(637, 591, 180)}
  ${urinal(676, 596, 180)}${urinal(702, 596, 180)}
  <rect x="642" y="387" width="60" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  ${lavCtr(657, 399)}${lavCtr(687, 399)}
  ${floorDrain(712, 505)}

  <!-- women 108: 3 stalls, 3 lavs, FD (the plumbing tour counts this room) -->
  ${stallEnc(760, 540, 40, 57)}${stallEnc(800, 540, 40, 57)}${stallEnc(840, 540, 40, 57, true)}
  ${wc(780, 591, 180)}${wc(820, 591, 180)}${wc(860, 591, 180)}
  <rect x="820" y="387" width="112" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  ${lavCtr(838, 399)}${lavCtr(876, 399)}${lavCtr(914, 399)}
  ${floorDrain(905, 505)}

  <!-- corridor: hi-lo drinking fountains in a recess on the south wall between the
       janitor and men's doors (2026-09-14: they sat under the conference wall), FD -->
  <rect x="538" y="381" width="44" height="12" fill="#fff" stroke="${INK}" stroke-width="1"/>
  ${drinkFtn(548, 382, 180)}${drinkFtn(570, 382, 180)}
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
  <!-- entry door, swinging into the lobby (2026-09-14: it swung outside the building line) -->
  ${door(L, 162, 28, 90)}

  <!-- dimensions -->
  ${dimH(L, 84, 420, "24'-0\"")}${dimH(420, 84, 640, "18'-4\"")}${dimH(640, 84, R, "25'-0\"")}
  ${dimH(L, 622, R, "67'-4\"")}
  ${dimV(112, T, COR_T, "20'-0\"")}${dimV(112, COR_T, COR_B, "3'-8\"")}${dimV(112, COR_B, B, "18'-0\"")}

  ${northArrow(990, 132)}
  ${scaleBar(L, 648)}`;
}
function candidateA() {
  return `${sheetFrame()}
  <g transform="translate(${PLAN_AT.x},${PLAN_AT.y}) scale(${PLAN_AT.k})">${candidateAPlan()}</g>

  ${roomSchedule(390, 556)}

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
    '6. MEP DESIGN-BUILD BY CONTRACTOR:',
    '   SIZE AND ROUTE PER CODE.',
    '7. RTU-1, 2,000 CFM, ON ROOF OVER',
    '   JAN. 106; DUCT BY D-B CONTRACTOR.',
    '8. PANEL LP-1, 42 POLE, IN JAN. 106.',
    '9. WATER SERVICE + GAS METER AT',
    '   THE JAN. 106 EXTERIOR WALL.',
  ])}
  ${notesColumn(985, 500, 'LEGEND', [])}
  <g font-family="${F}" font-size="9.5" fill="${INK}">
    <g transform="translate(996,530)">${floorDrain(0, 0)}</g><text x="1016" y="533">FLOOR DRAIN</text>
    <g transform="translate(996,560)">${waterHeater(0, 0, 12)}</g><text x="1016" y="563">WATER HEATER</text>
    <g transform="translate(988,588)">${mopSink(8, 6)}</g><text x="1016" y="597">MOP SINK</text>
    <g transform="translate(988,616)">${drinkFtn(8, 0)}</g><text x="1016" y="625">DRINKING FOUNTAIN</text>
  </g>

  ${titleBlock({ sheet: 'A-101', sheetName: 'FIRST FLOOR PLAN', project: 'SUITE 200 OFFICE TI', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- Candidate B: restaurant plumbing plan (P-101) ----------------
// Like candidate A, the plan is drawn at 12 px/ft in its own space and placed on the
// sheet at PLAN_AT (0.75 → 9 pt/ft) so the engineered plan prints on a true ANSI B
// sheet too (2026-09-14; it used to print at 918 × 594 pt, the size that trips Set
// Scale's standard-sheet check). The legend, keynotes and title block sit in sheet
// coordinates.
// Round 2 (estimator feedback, 2026-09-14): the cook line sits along the hall wall
// with the hood drawn over it (range, flat top, two fryers, a gas drop each); the
// dish pit moved to the west back room so a PASS-THRU from the server station on
// the dining side lands on its soiled table, with the 3-comp sink in the pit and
// the clean table on the south wall running up to the door; the old dish room is
// STORAGE with the water heater; the bar's 3-comp and hand sink carry keytags; and
// the sheet carries the domestic water (CW solid, HW dashed) and gas (dash-dot)
// piping a commercial plumbing set shows, sized as a small restaurant's would be.
const PIPE = {
  cw: `stroke="${INK}" stroke-width="1.2"`,
  hw: `stroke="${INK}" stroke-width="1.2" stroke-dasharray="6 3"`,
  hwr: `stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 3"`,   // the hot water RETURN, its own dash (the course traces it)
  gas: `stroke="${INK}" stroke-width="1.1" stroke-dasharray="10 3 2 3"`,
  ss: `stroke="${INK}" stroke-width="1.8" stroke-dasharray="8 4"`,    // sanitary, the legend's heavy dash
  gw: `stroke="${INK}" stroke-width="1.3" stroke-dasharray="8 4"`,    // grease waste, the same dash lighter
};
const pipe = (kind, pts) => `<polyline points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" ${PIPE[kind]}/>`;
const pipeLabel = (x, y, text, rot = 0) => `<text x="${x}" y="${y}" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${text}</text>`;
const gasDrop = (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${INK}"/>`;
const equip = (x, y, w, h, label, rot = 0) => `<g font-family="${F}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="${x + w / 2}" y="${y + h / 2 + 2.5}" font-size="7" fill="#444" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : ''}>${label}</text></g>`;

// The restaurant's SHELL: walls, rooms, doors, fixtures and equipment, dimensions, the
// north arrow and the scale bar, with the pendant lights and the plumbing keytags as
// options. P-101 draws its plumbing over it; the electrical sheets (scripts/
// sample-electrical.js) draw their devices over the same shell with the lights and the
// plumbing tags off, so every E-sheet coordinate is a P-101 coordinate.
function restaurantShell(opts = {}) {
  const lights = opts.lights !== false;
  const kt = (x, y, label) => (opts.tags === false ? '' : keyTag(x, y, label));
  const fd = (x, y) => (opts.drains === false ? '' : floorDrain(x, y));
  const fsk = (x, y) => (opts.drains === false ? '' : floorSink(x, y));
  const L = 130, R = 940, T = 100, B = 600;
  return `
<!-- outer wall (entry opening 480-510 masked out of the top run) -->
  <rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="#fff" stroke="${INK}" stroke-width="6"/>
  <line x1="480" y1="${T}" x2="510" y2="${T}" stroke="#fff" stroke-width="8"/>
  <!-- kitchen service/exit door in the east wall (outswing, per egress) -->
  <line x1="${R}" y1="420" x2="${R}" y2="456" stroke="#fff" stroke-width="8"/>
  <!-- main partitions, segmented at door openings -->
  <line x1="560" y1="${T}" x2="560" y2="258" stroke="${INK}" stroke-width="2.5"/>
  <line x1="560" y1="288" x2="560" y2="416" stroke="${INK}" stroke-width="2.5"/>
  <!-- dining/BOH wall below the kitchen doors: solid, except the dish pit's
       pass-through window (508-562) from the server station -->
  <line x1="560" y1="460" x2="560" y2="542" stroke="${INK}" stroke-width="2.5"/>
  <line x1="560" y1="594" x2="560" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <!-- hallway between restrooms and kitchen: open to dining at the left
       (guests never cross the kitchen), door into the kitchen at the right -->
  <line x1="560" y1="296" x2="870" y2="296" stroke="${INK}" stroke-width="2.5"/>
  <line x1="910" y1="296" x2="${R}" y2="296" stroke="${INK}" stroke-width="2.5"/>
  ${doorDouble(910, 296, 20, 180)}
  <line x1="560" y1="252" x2="662" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="684" y1="252" x2="796" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="818" y1="252" x2="862" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="882" y1="252" x2="${R}" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="${T}" x2="700" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="830" y1="${T}" x2="830" y2="252" stroke="${INK}" stroke-width="2.5"/>
  <line x1="${L}" y1="470" x2="300" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="324" y1="470" x2="420" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="420" y1="470" x2="420" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <!-- back rooms under the kitchen: DISH (560-700) and STORAGE (700-940), each
       with its own door to the kitchen; the wall between them is solid -->
  <line x1="560" y1="470" x2="656" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="696" y1="470" x2="760" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="800" y1="470" x2="${R}" y2="470" stroke="${INK}" stroke-width="2.5"/>
  <line x1="700" y1="470" x2="700" y2="${B}" stroke="${INK}" stroke-width="2.5"/>
  <!-- pass-through window: server station (dining side) -> the soiled landing at
       the west end of the dish line -->
  <rect x="555" y="542" width="10" height="52" fill="#fff" stroke="${INK}" stroke-width="1"/>
  <text x="548" y="568" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle" transform="rotate(-90 548 568)">PASS-THRU</text>
  <text x="490" y="560" font-family="${F}" font-size="8" fill="#444" text-anchor="middle">SERVER STA.</text>

  <!-- room tags -->
  ${roomTag(340, 250, 'DINING', '100')}
  ${roomTag(200, 492, 'BAR', '101')}
  ${roomTag(628, 160, 'MEN', '102')}
  ${roomTag(763, 160, 'WOMEN', '103')}
  ${roomTag(884, 150, 'MOP', '104')}
  ${roomTag(614, 268, 'HALL', '107')}
  ${roomTag(760, 400, 'KITCHEN', '105')}
  ${roomTag(612, 532, 'DISH', '106')}
  ${roomTag(760, 556, 'STORAGE', '108')}

  <!-- restrooms: WC tanks against the top wall, lavs hung on the side walls,
       FD at the room center clear of the door swings -->
  ${wc(596, 118)}${lavCtr(584, 180, 270)}${fd(630, 192)}
  ${wc(732, 118)}${lavCtr(712, 180, 270)}${fd(766, 196)}
  <!-- mop room: sink in the NW corner, FD center-south -->
  ${mopSink(848, 126)}${fd(902, 206)}

  ${lights ? `<!-- dining pendant lights: even 3x3 grid over the room + a row over the bar -->
  ${lightFix(200, 160)}${lightFix(345, 160)}${lightFix(490, 160)}
  ${lightFix(200, 285)}${lightFix(345, 285)}${lightFix(490, 285)}
  ${lightFix(200, 410)}${lightFix(345, 410)}${lightFix(490, 410)}
  ${lightFix(265, 505)}${lightFix(330, 505)}${lightFix(390, 505)}
  <!-- server station alcove between bar and dish -->
  ${lightFix(490, 535)}
  <!-- kitchen fixtures (clear of the hood, the piping runs and the drain row) -->
  ${lightFix(700, 406)}${lightFix(912, 350)}${lightFix(718, 452)}${lightFix(760, 452)}
  <!-- hallway fixtures -->
  ${lightFix(665, 272)}${lightFix(775, 272)}${lightFix(885, 272)}
  <!-- dish pit + storage fixtures -->
  ${lightFix(720, 548)}${lightFix(860, 520)}
  <text x="150" y="136" font-family="${F}" font-size="8.5" fill="#444">PENDANT, TYP.</text>

  ` : ''}
<!-- bar: counter anchored to the left wall, parallel to the rear wall, with a
       bartender aisle behind it; the vertical leg stops short of the rear wall
       to leave a pass-through. 3-comp and hand sink in the aisle, tagged. -->
  <path d="M133 520 L370 520 L370 570" fill="none" stroke="${INK}" stroke-width="2"/>
  ${sink3Comp(170, 560, 54)}${kt(238, 570, '3CS')}
  ${handSink(330, 578)}${kt(352, 580, 'HS')}
  ${fd(238, 542)}${fd(340, 545)}

  <!-- kitchen north (hall) wall, west to east: hand sink, prep sink (indirect
       to FS), then the COOK LINE along the wall with the hood over it -->
  ${handSink(600, 308)}${kt(614, 308, 'HS')}
  <rect x="624" y="304" width="60" height="20" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <ellipse cx="654" cy="314" rx="9" ry="6" fill="none" stroke="${INK}" stroke-width="1.1"/>
  <text x="660" y="338" font-family="${F}" font-size="8" fill="#444" text-anchor="middle">PREP</text>
  ${fsk(640, 346)}
  <!-- cook line: equipment against the wall, hood outline over it, a gas drop
       on each piece from the 1-1/4" G run behind the line -->
  <rect x="690" y="298" width="172" height="54" fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="6 4"/>
  ${equip(700, 302, 48, 36, 'RANGE')}${equip(750, 302, 48, 36, 'FLAT TOP')}
  ${equip(800, 302, 24, 36, 'FRYER', -90)}${equip(826, 302, 24, 36, 'FRYER', -90)}
  <text x="808" y="362" font-family="${F}" font-size="8.5" fill="#444" text-anchor="middle">HOOD ABOVE</text>

  <!-- kitchen: a hand sink by the exit (the other is beside the range), floor drains along the work aisle -->
  ${handSink(928, 392, 270)}${kt(904, 412, 'HS')}
  ${fd(610, 432)}${fd(740, 430)}${fd(860, 440)}

  <!-- dish pit (west back room), one straight line along the south wall, west to
       east: the pass-through drops onto the SOILED landing (pre-rinse), then the
       DW (indirect to FS), then the CLEAN landing that turns up the east wall to
       just short of the door — which swings out. The 3-comp pot sink sits off the
       line on the north wall; fixtures sit up off the south wall so the CW/HW runs
       have a clear strip. -->
  ${sink3Comp(578, 476, 54)}${kt(644, 486, '3CS')}
  <rect x="576" y="566" width="44" height="22" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <rect x="582" y="570" width="14" height="14" rx="2" fill="none" stroke="${INK}" stroke-width="1.1"/>
  <text x="598" y="562" font-family="${F}" font-size="7" fill="#444" text-anchor="middle">SOILED</text>
  <rect x="624" y="560" width="38" height="28" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="643" y="577" font-family="${F}" font-size="8.5" fill="#444" text-anchor="middle">DW</text>
  <path d="M666 588 L666 566 L676 566 L676 520 L696 520 L696 588 Z" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="686" y="548" font-family="${F}" font-size="7.5" fill="#444" text-anchor="middle" transform="rotate(-90 686 548)">CLEAN</text>
  ${fsk(668, 550)}${fd(648, 536)}

  <!-- storage / mechanical (east back room): water heater, FD -->
  ${waterHeater(812, 572)}${fd(740, 528)}
  <g font-family="${F}"><rect x="856" y="560" width="62" height="24" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="887" y="575" font-size="7" fill="#444" text-anchor="middle">RECIRC PUMP</text></g>

  <!-- doors (each hinge sits at a real wall opening) -->
  ${door(R, 456, 36, 0)}
  ${door(480, T, 30, 90)}
  ${doorDouble(560, 460, 22, 270)}
  ${door(662, 252, 22, 0)}
  ${door(796, 252, 22, 0)}
  ${door(862, 252, 20, 0)}
  ${door(656, 470, 40, 0)}
  ${door(800, 470, 40, 180)}
  ${door(324, 470, 24, 180)}

  <!-- dimensions -->
  ${dimH(L, 84, 560, "35'-10\"")}${dimH(560, 84, R, "31'-8\"")}   <!-- 430 px and 380 px at 12 px/ft: the strings say what the walls measure -->
  ${dimV(112, T, 470, "30'-8\"")}${dimV(112, 470, B, "10'-10\"")}
  ${dimV(958, T, 252, "12'-7\"", { labelDx: 8, extFrom: 944 })}${dimV(958, 252, 296, "3'-8\"", { labelDx: 8, extFrom: 944 })}

  ${northArrow(990, 132)}
  ${scaleBar(130, 648)}

`;
}
// P-101's plumbing over the shell: the gas run and its drops, the interceptor, the
// domestic water and the hot water return, the site utilities, the waste side, the keynote tags.
function candidateBPlan() {
  const L = 130, R = 940, T = 100, B = 600;
  void L; void R; void T; void B;
  return restaurantShell({ lights: true }) + `
  ${pipe('gas', [[840, 632], [840, 346], [700, 346]])}
  ${gasDrop(724, 346)}${gasDrop(774, 346)}${gasDrop(812, 346)}${gasDrop(838, 346)}
  ${pipeLabel(834, 420, '1-1/4" G', -90)}${pipeLabel(834, 520, '1-1/2" G', -90)}
<!-- grease interceptor (exterior) -->
  <g font-family="${F}">
    <rect x="965" y="520" width="56" height="34" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <text x="993" y="540" font-size="9.5" fill="${INK}" text-anchor="middle">GI</text>
    <text x="993" y="568" font-size="8.5" fill="#444" text-anchor="middle">1000 GAL</text>
    <line x1="940" y1="545" x2="965" y2="540" stroke="${INK}" stroke-width="1" stroke-dasharray="5 3"/>
  </g>

  <!-- domestic water, per the owner's 2026-09-14 sketch. COLD: 2" service at the
       meter turns west along the south wall to the bar; one shared trunk rises
       from that run up the WEST walls — dish pit, kitchen, men's room — to the
       top-wall run, which feeds both restrooms and the mop room and drops the
       east wall to the exit hand sink. HOT: leaves the WH onto the same south-wall
       run and trunk, crosses the top wall, and comes back down the east wall
       through the RECIRC PUMP into the heater — one loop. At every sink the hot
       drop enters LEFT of the cold. -->
  ${pipe('cw', [[883, 614], [883, 594], [192, 594], [192, 580]])}
  ${pipe('cw', [[812, 594], [812, 588]])}
  ${pipe('cw', [[564, 594], [564, 110], [930, 110], [930, 384]])}
  ${pipe('hw', [[796, 572], [786, 572], [786, 590], [188, 590], [188, 580]])}
  ${pipe('hw', [[570, 590], [570, 105], [936, 105]])}
  ${pipe('hwr', [[936, 105], [936, 572], [918, 572]])}
  ${pipe('hw', [[856, 572], [828, 572]])}
  <!-- restrooms + mop sink (hot left of cold) -->
  ${pipe('cw', [[596, 110], [596, 114]])}${pipe('cw', [[732, 110], [732, 114]])}
  ${pipe('hw', [[582, 105], [582, 172]])}${pipe('cw', [[588, 110], [588, 172]])}
  ${pipe('hw', [[710, 105], [710, 172]])}${pipe('cw', [[716, 110], [716, 172]])}
  ${pipe('hw', [[842, 105], [842, 115]])}${pipe('cw', [[848, 110], [848, 115]])}
  <!-- kitchen hall wall: hand sink, then the prep sink fed under its own rim -->
  ${pipe('cw', [[564, 306], [592, 306]])}${pipe('hw', [[570, 310], [592, 310]])}
  ${pipe('cw', [[564, 330], [628, 330], [628, 324]])}${pipe('hw', [[570, 334], [624, 334], [624, 324]])}
  <!-- dish pit: 3-comp off the trunk; pre-rinse and DW off the south-wall runs -->
  ${pipe('cw', [[564, 486], [578, 486]])}${pipe('hw', [[570, 490], [578, 490]])}
  ${pipe('hw', [[596, 590], [596, 588]])}${pipe('cw', [[600, 594], [600, 588]])}
  ${pipe('hw', [[642, 590], [642, 588]])}${pipe('cw', [[646, 594], [646, 588]])}
  <!-- bar hand sink -->
  ${pipe('hw', [[326, 590], [326, 584]])}${pipe('cw', [[330, 594], [330, 584]])}
  ${pipeLabel(904, 609, '2" CW')}${pipeLabel(582, 410, '1-1/2" CW · 1-1/4" HW', -90)}
  ${pipeLabel(900, 124, '3/4" CW')}${pipeLabel(470, 584, '1" CW')}${pipeLabel(944, 330, '3/4" HWR', -90)}
  <!-- gas to the water heater -->
  ${pipe('gas', [[840, 582], [822, 582]])}${pipeLabel(846, 545, '3/4" G', -90)}

  <!-- site utilities: city connections outside the walls -->
  <g font-family="${F}">
    <!-- city water main (solid) below the building, service riser + meter at the tie-in -->
    <line x1="240" y1="614" x2="900" y2="614" stroke="${INK}" stroke-width="1.8"/>
    <path d="M236 614 L246 610 L246 618 Z" fill="${INK}"/><path d="M904 614 L894 610 L894 618 Z" fill="${INK}"/>
    <text x="248" y="609" font-size="8.5" fill="#444">8" CITY WATER MAIN</text>
    <circle cx="880" cy="614" r="2.4" fill="${INK}"/>
    <rect x="871" y="601" width="18" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>
    <text x="880" y="609.5" font-size="7.5" fill="${INK}" text-anchor="middle">WM</text>
    <!-- city gas main (dash-dot) below the water main, riser + meter -->
    <line x1="240" y1="632" x2="900" y2="632" stroke="${INK}" stroke-width="1.3" stroke-dasharray="10 3 2 3"/>
    <path d="M236 632 L246 628 L246 636 Z" fill="${INK}"/><path d="M904 632 L894 628 L894 636 Z" fill="${INK}"/>
    <text x="248" y="627" font-size="8.5" fill="#444">4" CITY GAS MAIN</text>
    <circle cx="840" cy="632" r="2.4" fill="${INK}"/>
    <rect x="831" y="619" width="18" height="11" fill="#fff" stroke="${INK}" stroke-width="1"/>
    <text x="840" y="627.5" font-size="7.5" fill="${INK}" text-anchor="middle">GM</text>
    <!-- city sanitary sewer main (heavy dashed, right of the building); the GI branch ties in -->
    <line x1="1105" y1="520" x2="1105" y2="626" stroke="${INK}" stroke-width="1.8" stroke-dasharray="8 4"/>
    <path d="M1105 634 L1101 624 L1109 624 Z" fill="${INK}"/><path d="M1105 516 L1101 526 L1109 526 Z" fill="${INK}"/>
    <line x1="1021" y1="537" x2="1105" y2="537" stroke="${INK}" stroke-width="1.8" stroke-dasharray="8 4"/>
    <circle cx="1105" cy="537" r="2.4" fill="${INK}"/>
    <text x="1032" y="530" font-size="8.5" fill="#444">4" SS</text>
    <text x="1114" y="622" font-size="8.5" fill="#444" transform="rotate(-90 1114 622)">8" CITY SANITARY MAIN</text>
  </g>

  <!-- WASTE (the plumbing course's answer key, 2026-09-21; journeys/plans/PLUMBING-COURSE.md):
       restroom and mop-room waste is a 4" sanitary line under the restrooms that leaves
       the east wall and drops the outside to the city main DOWNSTREAM of the interceptor,
       so sewage never enters it; every kitchen, dish and bar fixture drains to a 3" grease
       line along the work aisle and the back rooms to the interceptor's inlet, the red
       note made real. A cleanout at each upstream end and at the outside turn, a vent
       stack through the roof in the restroom wall and in the dish/storage wall, a
       backflow preventer where the service enters, a hose bibb by the kitchen exit.
       Everything here is ADDED: nothing that was on the sheet moved, so the tours' and
       lessons' coordinates stay true. -->
  ${pipe('ss', [[592, 210], [940, 210], [1060, 210], [1060, 537]])}
  ${pipe('gw', [[596, 436], [900, 436], [900, 537], [940, 537]])}
  ${pipe('gw', [[222, 544], [440, 544], [440, 512], [900, 512]])}
  ${pipeLabel(1000, 205, '4" SS')}${pipeLabel(1068, 380, '4" SS', -90)}
  ${pipeLabel(650, 447, '3" GW')}${pipeLabel(300, 556, '3" GW')}${pipeLabel(910, 490, '3" GW', -90)}
  ${cleanout(592, 210)}${keyTag(592, 226, 'CO')}
  ${cleanout(596, 436)}${keyTag(596, 452, 'CO')}
  ${cleanout(222, 544)}${keyTag(206, 544, 'CO')}
  ${cleanout(1060, 210)}${keyTag(1076, 210, 'CO')}
  ${vtr(700, 232)}${keyTag(718, 234, 'VTR')}
  ${vtr(700, 500)}${keyTag(718, 500, 'VTR')}
  <!-- backflow preventer on the 2" service, just inside the wall -->
  <g font-family="${F}"><rect x="818" y="586" width="30" height="10" fill="#fff" stroke="${INK}" stroke-width="1.2"/><text x="833" y="593.5" font-size="7" fill="${INK}" text-anchor="middle">RPZ</text></g>
  <!-- hose bibb outside the kitchen exit, off the east-wall 3/4" CW -->
  ${pipe('cw', [[930, 402], [930, 490], [946, 490]])}${hoseBibb(949, 490)}${keyTag(964, 490, 'HB')}

  <!-- keynote tags, anchored beside their fixtures -->
  ${keyTag(606, 196, 'FD')}${keyTag(788, 196, 'FD')}
  ${keyTag(622, 124, 'WC')}${keyTag(758, 124, 'WC')}
  ${keyTag(848, 158, 'MS')}

  `;
}
function candidateB() {
  return `${sheetFrame()}
  <g transform="translate(${PLAN_AT.x},${PLAN_AT.y}) scale(${PLAN_AT.k})">${candidateBPlan()}</g>

  <!-- line + symbol legend (bottom left, beside the scale bar) -->
  <g font-family="${F}" font-size="9.5" fill="${INK}">
    <text x="430" y="652" font-size="12" font-weight="bold">LEGEND</text>
    <line x1="430" y1="658" x2="630" y2="658" stroke="${INK}" stroke-width="1"/>
    ${pipe('cw', [[430, 670], [470, 670]])}<text x="480" y="673">CW  DOMESTIC COLD WATER</text>
    ${pipe('hw', [[430, 683], [470, 683]])}<text x="480" y="686">HW  DOMESTIC HOT WATER</text>
    ${pipe('hwr', [[430, 696], [470, 696]])}<text x="480" y="699">HWR HOT WATER RETURN</text>
    ${pipe('gas', [[430, 709], [470, 709]])}<text x="480" y="712">G   GAS</text>
    ${pipe('ss', [[430, 722], [470, 722]])}<text x="480" y="725">SS  SANITARY SEWER</text>
    ${pipe('gw', [[430, 735], [470, 735]])}<text x="480" y="738">GW  GREASE WASTE TO GI</text>
    ${gasDrop(450, 748)}<text x="480" y="751">GAS DROP W/ SHUTOFF, TYP.</text>
    ${lightFix(450, 761)}<text x="480" y="764">LIGHT FIXTURE, TYP.</text>
  </g>

  ${notesColumn(996, 200, 'PLUMBING KEYNOTES', [
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
    'RP   RECIRC PUMP ON THE HW RETURN',
    'SS   SANITARY SEWER TO CITY',
    'W    DOMESTIC WATER FROM CITY',
    'G    GAS SERVICE FROM CITY',
    'RPZ  BACKFLOW PREVENTER, RPZ',
    'HB   HOSE BIBB, FREEZEPROOF',
    'CO   CLEANOUT',
    'VTR  VENT THROUGH ROOF',
  ])}
  <g font-family="${F}" font-size="9" fill="#8a2727">
    <text x="996" y="536" font-weight="bold">ALL KITCHEN WASTE THROUGH</text>
    <text x="996" y="550" font-weight="bold">GREASE INTERCEPTOR, TYP.</text>
  </g>
  ${notesColumn(60, 648, 'GENERAL NOTES', [
    'WATER: TYPE L COPPER. GAS: SCH 40 BLACK STEEL, THREADED.',
    'WASTE AND VENT: PVC DWV SCH 40, BELOW SLAB AND IN WALLS.',
    'SLOPE WASTE 1/4" PER FT TO 2-1/2", 1/8" PER FT AT 3" AND UP.',
    'CLEANOUTS AT EACH UPSTREAM END, EACH TURN, 100 FT MAX APART.',
    'EVERY FIXTURE TRAPPED AND VENTED. VENTS THROUGH ROOF AT VTR.',
    'RESTROOM WASTE DIRECT TO SEWER. KITCHEN AND BAR WASTE VIA GI.',
  ])}

  ${titleBlock({ sheet: 'P-101', sheetName: 'PLUMBING PLAN', project: 'MAIN ST RESTAURANT', scale: '1/8" = 1&#39;-0"', date: '07/31/26' })}`;
}

// ---------------- The lesson set: P-401 and P-501 (LEARN-PLAN.md, 2026-09-21) --------
// samples/sample-lessons.pdf is three sheets: P-101 (candidate B, unchanged), and the
// two below, drawn ON PURPOSE for the tools P-101 cannot teach. Both are drawn straight
// in sheet points (1 SVG unit = 1 PDF pt), so the figures here ARE the lesson
// coordinates in features/lessons.js.
//   P-401: the restrooms enlarged at 1/4" = 1'-0" (18 pt/ft; a second page scale, with
//   12'-0" strings to prove it) and detail 2 at 1/2" = 1'-0" (36 pt/ft; a scale zone)
//   that is "TYP. OF 4" (a multiply zone), with a 4'-0" string to prove the zone.
//   P-501: the fixture schedule, a sheet "scanned sideways": landscape content turned
//   90° on a portrait page, for Rotate.
const at = (x, y, k, body) => `<g transform="translate(${x},${y}) scale(${k})">${body}</g>`;
const LESSON_DETAIL = {
  ptPerFt: 18, women: { x1: 100, y1: 140, x2: 316, y2: 320 }, men: { x1: 316, y1: 140, x2: 532, y2: 320 },
  wcs: [[136, 152], [190, 152], [244, 152], [352, 152], [406, 152]], urinals: [[478, 146]],
  lavs: [[150, 304], [210, 304], [366, 304], [426, 304]], fds: [[208, 262], [424, 262]],
  prove: [[100, 118], [316, 118]],                       // the 12'-0" string over WOMEN
  detail: { x1: 640, y1: 130, x2: 1040, y2: 330, ptPerFt: 36, hs: [760, 196], fd: [904, 262], prove: [[760, 300], [904, 300]] },
};
function lessonDetailSheet() {
  const D = LESSON_DETAIL, d = D.detail;
  const stall = (x) => `<line x1="${x}" y1="140" x2="${x}" y2="212" stroke="${INK}" stroke-width="1"/>`;
  return `${sheetFrame()}
  <rect x="100" y="140" width="432" height="180" fill="#fff" stroke="${INK}" stroke-width="5"/>
  <line x1="316" y1="140" x2="316" y2="320" stroke="${INK}" stroke-width="2.5"/>
  <line x1="262" y1="320" x2="298" y2="320" stroke="#fff" stroke-width="7"/><line x1="478" y1="320" x2="514" y2="320" stroke="#fff" stroke-width="7"/>
  ${door(262, 320, 36, 0)}${door(478, 320, 36, 0)}
  ${[163, 217, 271, 379, 433].map(stall).join('')}
  ${D.wcs.map(([x, y]) => at(x, y, 1.5, wc(0, 0))).join('')}
  ${D.urinals.map(([x, y]) => at(x, y, 1.5, urinal(0, 0))).join('')}
  ${D.lavs.map(([x, y]) => at(x, y, 1.5, lavCtr(0, 0, 180))).join('')}
  ${D.fds.map(([x, y]) => at(x, y, 1.5, floorDrain(0, 0))).join('')}
  ${roomTag(208, 222, 'WOMEN', '103')}${roomTag(424, 222, 'MEN', '102')}
  ${dimH(100, 118, 316, "12'-0\"")}${dimH(316, 118, 532, "12'-0\"")}${dimV(78, 140, 320, "10'-0\"")}
  <g font-family="${F}" fill="${INK}"><circle cx="112" cy="362" r="12" fill="none" stroke="${INK}" stroke-width="1.2"/><text x="112" y="366" font-size="12" text-anchor="middle" font-weight="bold">1</text>
    <text x="132" y="360" font-size="13" font-weight="bold">ENLARGED RESTROOM PLAN</text><text x="132" y="375" font-size="10" fill="#444">SCALE: 1/4" = 1'-0"</text></g>

  <rect x="${d.x1}" y="${d.y1}" width="${d.x2 - d.x1}" height="${d.y2 - d.y1}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="8 4"/>
  <line x1="670" y1="170" x2="1010" y2="170" stroke="${INK}" stroke-width="5"/>
  ${at(d.hs[0], d.hs[1], 3, handSink(0, 0))}${at(d.fd[0], d.fd[1], 3, floorDrain(0, 0))}
  ${keyTag(818, 196, 'HS')}${keyTag(944, 262, 'FD')}
  ${pipe('cw', [[764, 170], [764, 182]])}${pipe('hw', [[756, 170], [756, 182]])}
  ${dimH(760, 300, 904, "4'-0\"")}
  <g font-family="${F}" fill="${INK}"><circle cx="652" cy="362" r="12" fill="none" stroke="${INK}" stroke-width="1.2"/><text x="652" y="366" font-size="12" text-anchor="middle" font-weight="bold">2</text>
    <text x="672" y="360" font-size="13" font-weight="bold">HAND SINK STATION · TYP. OF 4</text><text x="672" y="375" font-size="10" fill="#444">SCALE: 1/2" = 1'-0"</text></g>

  ${notesColumn(100, 440, 'SHEET NOTES', [
    '1. PLAN 1 IS DRAWN AT 1/4" = 1\'-0". DETAIL 2 IS DRAWN AT 1/2" = 1\'-0".',
    '2. PROVIDE DETAIL 2 AT EACH OF (4) COOK LINE AND BAR STATIONS.',
    '3. FLOOR DRAINS W/ TRAP PRIMER, TYP.',
    '4. ALL DIMENSIONS TO FACE OF FINISH.',
  ])}
  ${titleBlock({ sheet: 'P-401', sheetName: 'ENLARGED PLANS', project: 'MAIN ST RESTAURANT', scale: 'AS NOTED', date: '07/31/26' })}`;
}
// The schedule carries the engineer's fixture units (public occupancy, IPC Appendix E and
// Table 709.1), so the plumbing course can show where the pipe sizes came from.
const LESSON_SCHEDULE = [
  ['WC-1', 'WATER CLOSET, FLOOR MTD, FLUSH VALVE', '1"', '-', '4"', '2"', '10', '4'],
  ['U-1', 'URINAL, WALL HUNG, FLUSH VALVE', '3/4"', '-', '2"', '1-1/2"', '5', '4'],
  ['L-1', 'LAVATORY, COUNTER MTD', '1/2"', '1/2"', '1-1/2"', '1-1/4"', '2', '1'],
  ['HS-1', 'HAND SINK, WALL HUNG', '1/2"', '1/2"', '1-1/2"', '1-1/4"', '2', '1'],
  ['3CS-1', '3-COMPARTMENT SINK', '3/4"', '3/4"', '2"', '1-1/2"', '4', '3'],
  ['MS-1', 'MOP SINK, FLOOR MTD', '3/4"', '3/4"', '3"', '2"', '3', '2'],
  ['FD-1', 'FLOOR DRAIN W/ TRAP PRIMER', '1/2"', '-', '3"', '2"', '-', '2'],
  ['FS-1', 'FLOOR SINK, 1/2 GRATE', '-', '-', '3"', '2"', '-', '3'],
];
// P-601: the restrooms' waste and vent riser, an elevation drawn to scale (1/4" = 1'-0",
// 18 pt/ft) so the course can set a scale on it, prove it on the 14'-0" floor-to-roof
// string, measure a trap arm, and trace the stack the plan shows as one circle. One of
// each fixture (typical of both restrooms), the stack with its cleanout at the base and
// its vent through the roof, the building drain under the slab. Straight in sheet points;
// RISER mirrors the course's coordinates (features/course-plumbing.js).
const RISER = {
  floorY: 520, roofY: 268, drainY: 556, stackX: 520, vtrY: 250, ventFromY: 493,
  wc: { x: 340, armY: 548 }, fd: { x: 448, armY: 536 }, lav: { x: 592, rimY: 469, armY: 493 },
  co: [534, 540], prove: [[110, 268], [110, 520]], stack: [[520, 556], [520, 250]], lavArm: [[520, 493], [592, 493]],
};
function lessonRiserSheet() {
  const R = RISER, fy = R.floorY, sx = R.stackX;
  const waste = (x1, y1, x2, y2, w = 2.2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w}"/>`;
  const vent = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="7 4"/>`;
  const lbl = (x, y, t, rot = 0, size = 8.5) => `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" fill="#444"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;
  return `${sheetFrame()}
  <!-- the slab and the ground under it -->
  <rect x="140" y="${fy}" width="780" height="92" fill="#f3f3f3"/>
  <line x1="140" y1="${fy}" x2="920" y2="${fy}" stroke="${INK}" stroke-width="3"/>
  ${lbl(926, fy + 4, 'FIN. FLOOR', 0, 9)}
  <line x1="140" y1="${R.roofY}" x2="920" y2="${R.roofY}" stroke="${INK}" stroke-width="2"/>
  ${lbl(926, R.roofY + 4, 'ROOF', 0, 9)}
  ${dimV(R.prove[0][0], R.roofY, fy, "14'-0\"")}
  <!-- the building drain, under the slab, falling to the sewer at the right -->
  ${waste(160, R.drainY, 900, R.drainY, 2.4)}
  <path d="M904 ${R.drainY} L892 ${R.drainY - 4} L892 ${R.drainY + 4} Z" fill="${INK}"/>
  ${lbl(640, R.drainY + 18, '4" SS TO BUILDING SEWER · SLOPE 1/8" PER FT')}
  <!-- the stack: waste below the highest fixture, vent above it, through the roof -->
  ${waste(sx, R.drainY, sx, R.ventFromY, 2.4)}
  ${vent(sx, R.ventFromY, sx, R.vtrY)}
  <path d="M${sx - 12} ${R.roofY} L${sx + 12} ${R.roofY} L${sx + 8} ${R.roofY - 7} L${sx - 8} ${R.roofY - 7} Z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
  <circle cx="${sx}" cy="${R.vtrY}" r="4" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
  ${keyTag(sx + 22, R.vtrY, 'VTR')}${lbl(sx + 36, R.vtrY + 3, '4" VENT THRU ROOF, 12" MIN. ABOVE')}
  ${lbl(sx - 6, 470, '4" WASTE STACK', -90)}${lbl(sx - 6, 380, '4" VENT STACK', -90)}
  <!-- cleanout at the base of the stack, above the floor -->
  ${waste(sx, R.co[1], R.co[0] - 4, R.co[1], 1.6)}${cleanout(R.co[0], R.co[1])}${keyTag(R.co[0] + 20, R.co[1], 'CO')}
  <!-- water closet: 4" arm under the slab to the base of the stack -->
  <g fill="none" stroke="${INK}" stroke-width="1.2"><rect x="${R.wc.x - 14}" y="474" width="28" height="18"/><path d="M${R.wc.x - 10} 492 h20 v18 a10 8 0 0 1 -20 0 z"/></g>
  ${keyTag(R.wc.x, 456, 'WC')}
  ${waste(R.wc.x, fy, R.wc.x, R.wc.armY)}${waste(R.wc.x, R.wc.armY, sx, R.wc.armY)}${lbl(R.wc.x + 60, R.wc.armY + 12, '4"')}
  ${dimH(R.wc.x, 598, sx, "10'-0\"")}
  <!-- floor drain: 2" arm under the slab -->
  <g fill="none" stroke="${INK}" stroke-width="1.2"><rect x="${R.fd.x - 8}" y="${fy - 4}" width="16" height="4"/></g>
  ${keyTag(R.fd.x, 500, 'FD')}
  ${waste(R.fd.x, fy, R.fd.x, R.fd.armY, 1.6)}${waste(R.fd.x, R.fd.armY, sx, R.fd.armY, 1.6)}${lbl(R.fd.x + 28, R.fd.armY - 4, '2"')}
  ${dimH(R.fd.x, 580, sx, "4'-0\"")}
  <!-- lavatory at 34" rim, its 1-1/2" trap arm in the wall to the stack -->
  <g fill="none" stroke="${INK}" stroke-width="1.2"><rect x="${R.lav.x - 16}" y="${R.lav.rimY - 6}" width="32" height="8"/><line x1="${R.lav.x}" y1="${R.lav.rimY + 2}" x2="${R.lav.x}" y2="${R.lav.armY}"/></g>
  ${keyTag(R.lav.x + 30, R.lav.rimY - 2, 'L')}
  ${waste(R.lav.x, R.lav.armY, sx, R.lav.armY, 1.6)}${lbl(sx + 8, R.lav.armY - 5, '1-1/2" TRAP ARM', 0, 7.5)}
  ${dimH(sx, 508, R.lav.x, "4'-0\"")}
  <g font-family="${F}" fill="${INK}"><circle cx="152" cy="650" r="12" fill="none" stroke="${INK}" stroke-width="1.2"/><text x="152" y="654" font-size="12" text-anchor="middle" font-weight="bold">1</text>
    <text x="172" y="648" font-size="13" font-weight="bold">WASTE &amp; VENT RISER, RESTROOMS 102 / 103, TYP.</text><text x="172" y="663" font-size="10" fill="#444">SCALE: 1/4" = 1'-0"</text></g>
  ${notesColumn(960, 300, 'RISER NOTES', [
    '1. ONE OF EACH FIXTURE SHOWN,',
    '   TYPICAL OF BOTH RESTROOMS.',
    '2. TRAP ARM LENGTHS PER IPC',
    '   TABLE 1002.2: 1-1/2" 6\'-0" MAX,',
    '   2" 8\'-0", 4" 16\'-0".',
    '3. VENT TERMINAL 12" MIN. ABOVE',
    '   THE ROOF, 10\'-0" FROM ANY',
    '   AIR INTAKE.',
    '4. CLEANOUT AT THE BASE OF',
    '   EACH STACK.',
  ])}
  ${titleBlock({ sheet: 'P-601', sheetName: 'WASTE &amp; VENT RISER', project: 'MAIN ST RESTAURANT', scale: '1/4" = 1&#39;-0"', date: '07/31/26' })}`;
}
function lessonScheduleSheet() {
  const cols = [120, 200, 500, 570, 640, 710, 790, 860], y0 = 150;
  const head = ['TAG', 'FIXTURE', 'CW', 'HW', 'W', 'V', 'WSFU', 'DFU'].map((t, i) => `<text x="${cols[i]}" y="${y0}" font-size="10" font-weight="bold">${t}</text>`).join('');
  const rows = LESSON_SCHEDULE.map((r, j) => r.map((t, i) => `<text x="${cols[i]}" y="${y0 + 24 + j * 20}" font-size="10">${t}</text>`).join('')).join('');
  const land = `${sheetFrame()}
  <g font-family="${F}" fill="${INK}"><text x="120" y="112" font-size="15" font-weight="bold">PLUMBING FIXTURE SCHEDULE</text>
  <line x1="112" y1="124" x2="920" y2="124" stroke="${INK}" stroke-width="1.2"/><line x1="112" y1="158" x2="920" y2="158" stroke="${INK}" stroke-width="0.8"/>${head}${rows}
  <line x1="112" y1="${y0 + 24 + LESSON_SCHEDULE.length * 20 - 8}" x2="920" y2="${y0 + 24 + LESSON_SCHEDULE.length * 20 - 8}" stroke="${INK}" stroke-width="1.2"/></g>
  ${notesColumn(120, 400, 'SCHEDULE NOTES', [
    '1. ROUGH-IN SIZES ARE MINIMUMS; SEE PLANS FOR RUN SIZES.',
    '2. ALL FIXTURES ADA WHERE SHOWN ON THE ARCHITECTURAL PLANS.',
    '3. WSFU AND DFU PER IPC APPENDIX E AND TABLE 709.1, PUBLIC OCCUPANCY.',
    '4. DRAINAGE LOAD ON P-101: 47 DFU. BUILDING SEWER 4" AT 1/8" PER FT (180 DFU MAX);',
    '   A 3" SEWER AT 1/8" PER FT WOULD CARRY 36 (TABLE 710.1(1)).',
  ])}
  ${titleBlock({ sheet: 'P-501', sheetName: 'SCHEDULES', project: 'MAIN ST RESTAURANT', scale: 'NONE', date: '07/31/26' })}`;
  return `<rect width="${H}" height="${W}" fill="#fff"/><g transform="translate(0,${W}) rotate(-90)">${land}</g>`;   // the sheet, scanned sideways: one Rotate 90° right reads it
}

// ---------------- render ---------------------------------------------------------
function pageHtml(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${W}px ${H}px; margin: 0; } html,body { margin:0; padding:0; } svg { display:block; }
  </style></head><body>${svg}</body></html>`;
}
async function render(name, body) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(pageHtml(body), { waitUntil: 'networkidle' });
  await page.pdf({ path: path.join(OUT_DIR, name + '.pdf'), width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
  await page.screenshot({ path: path.join(OUT_DIR, name + '.png') });
  await browser.close();
  console.log('wrote ' + name + '.pdf/.png');
}

// Candidate A ships as the SIMPLE sample plan (scripts/build-sample-plan.js), candidate B
// as the ADVANCED one (scripts/build-sample-plan-advanced.js).
module.exports = { W, H, PLAN_AT, F, INK, candidateA, candidateB, candidateBPlan, restaurantShell, pageHtml, lessonDetailSheet, lessonScheduleSheet, lessonRiserSheet, LESSON_DETAIL, RISER,
  keyTag, roomTag, titleBlock, notesColumn, sheetFrame, dimH, dimV, northArrow, scaleBar, pipe, equip };

if (require.main === module) {
  (async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await render('candidate-a-office-ti', candidateA());
    await render('candidate-b-restaurant-plumbing', candidateB());
  })().catch((e) => { console.error(e); process.exit(1); });
}
