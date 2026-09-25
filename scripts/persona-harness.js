#!/usr/bin/env node
// The persona harness (PERSONA-PLAN build item 5, 2026-09-25): one headless Chromium, many
// isolated contexts, served over a localhost JSON endpoint so a persona fork works one step in a
// handful of curl calls of a few hundred tokens each. Every step is its own short episode: the
// fast-forward (the specs' seam) takes the set to the step, the persona acts with real mouse and
// keyboard events, and nothing accumulates across a tour.
//
//   node scripts/persona-harness.js [--port 3490] [--app http://localhost:3457] [--out <dir>] [--headed]
//   (npm run persona:harness -- --app ...)   no --app serves this checkout on a free port
//
//   GET  /health                      { ok, episodes, app, uptimeS }
//   GET  /sets                        { sets: [ids] }
//   GET  /manifest?set=plumbing       the set's manifest (the engine's, or a walk of the card)
//   POST /episode {set, step, device} { id, obs }         device: first-timer | returning | laptop | tablet
//   POST /act {id, action}            { obs, ok, error?, events }
//   POST /close {id}                  { ok }
//
// An unknown set or device is a 400 that lists the valid ones (App.startTutorial would otherwise
// run the electrical tour for a typo).
//
// Actions: {click:"<label>", within?, nth?, preferLit?}, {clickZone:n}, {dragZone:n}, {clickAt:[x,y]},
// {drag:[[x,y],[x,y]]}, {type:"text"}, {fill:["<field label>","text"]},
// {select:["<field label>","<option>"]}, {key:"U"}, {scroll:[x,y,dy]}, {screenshot:true},
// {wait:ms}, {giveUp:"why"}. There is no action for the step's own button (tutorialDoStep).
//
// Each episode appends JSONL to <out>/<id>.jsonl: the start, then per action the action, the
// step before and after, the status and its miss / code, and the milliseconds it took.
// Idle episodes close after 10 minutes; SIGINT closes everything.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const D = require('./lib/persona-driver.js');
const { DEVICES, device: deviceOf } = require('./persona-devices.js');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const PORT = +arg('port', 3490);
const OUT = path.resolve(arg('out', path.join(process.cwd(), 'persona-out', 'episodes')));
const HEADED = argv.includes('--headed');
const IDLE_MS = 10 * 60 * 1000;

let APP = arg('app', null);
let browser = null, staticServer = null, util = null;
const started = Date.now();
const episodes = new Map();   // id -> { context, page, errors, set, device, step, n, last, busy, log }
const manifests = new Map();  // set -> manifest (cached for the harness's life)
let seq = 0;

const log = (ep, rec) => { try { fs.appendFileSync(ep.log, JSON.stringify(Object.assign({ t: new Date().toISOString() }, rec)) + '\n'); } catch (_) { /* the log is a convenience */ } };
const brief = (obs) => (obs ? { i: obs.i, id: obs.id, status: obs.status, miss: obs.miss, code: obs.code, done: obs.done } : null);

// A booted first-timer page for the lists and the engine manifests, made once.
async function utilPage() {
  if (util) return util.page;
  util = await D.newSession(browser, DEVICES['first-timer']);
  await D.boot(util.page, APP);
  return util.page;
}

// A request the harness turns away with a 400 (a bad set or device), not a 500.
class BadRequest extends Error {}

async function openEpisode({ set, step, device }) {
  if (!set) throw new BadRequest('set is required (GET /sets)');
  const bad = await D.unknownSet(await utilPage(), set);
  if (bad) throw new BadRequest(bad);
  const devName = device || 'first-timer';
  let dev;
  try { dev = deviceOf(devName); } catch (e) { throw new BadRequest(e.message); }
  const target = step == null ? null : (typeof step === 'number' || /^\d+$/.test(String(step)) ? +step : String(step));
  const t0 = Date.now();
  const s = await D.newSession(browser, dev);
  try {
    await D.boot(s.page, APP);
    await dev.seed(s.page);
    await D.startSet(s.page, set, target);
    const ff = target == null ? { skipped: [] } : await D.fastForward(s.page, target);
    const id = 'e' + (++seq).toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const ep = Object.assign(s, { id, set, device: devName, step: target, n: 0, last: Date.now(), busy: Promise.resolve(), log: path.join(OUT, id + '.jsonl') });
    episodes.set(id, ep);
    const obs = await D.observe(s.page);
    log(ep, { ev: 'start', set, step: target, device: devName, skipped: ff.skipped, obs: brief(obs), ms: Date.now() - t0 });
    return { id, obs, skipped: ff.skipped.length ? ff.skipped : undefined };
  } catch (e) {
    await s.context.close().catch(() => {});
    throw e;
  }
}

async function doAct(ep, action) {
  const t0 = Date.now();
  ep.n++;
  ep.last = Date.now();
  const before = await D.observe(ep.page).catch(() => null);
  const errs = ep.errors.length;
  const toastsBefore = await ep.page.evaluate(() => (window.__persona ? window.__persona.toasts() : [])).catch(() => []);
  const r = await D.act(ep.page, action, { outDir: OUT, id: ep.id, n: ep.n }).catch((e) => ({ ok: false, error: String(e.message || e).split('\n')[0], events: [] }));
  if (!r.gaveUp && action && action.wait == null && !action.screenshot) await D.settle(ep.page, before && before.id);
  const obs = await D.observe(ep.page).catch(() => null);
  const events = r.events || [];
  if (before && obs && before.id !== obs.id) events.push('step ' + before.id + ' -> ' + obs.id);
  if (before && !obs) events.push('the set ended');
  if (before && obs && !!before.dialog !== !!obs.dialog) events.push(obs.dialog ? 'dialog opened: ' + obs.dialog.title : 'dialog closed');
  const toasts = await ep.page.evaluate(() => (window.__persona ? window.__persona.toasts() : [])).catch(() => []);
  toasts.filter((t) => !toastsBefore.includes(t)).forEach((t) => events.push('toast: ' + t));   // only what this action raised
  ep.errors.slice(errs).forEach((e) => events.push('page error: ' + String(e).slice(0, 140)));
  const out = { obs, ok: !!r.ok, events };
  if (r.error) out.error = r.error;
  if (r.candidates) out.candidates = r.candidates;
  log(ep, { ev: 'act', n: ep.n, action, ok: out.ok, error: r.error, before: brief(before), after: brief(obs), events, ms: Date.now() - t0 });
  if (r.gaveUp) { await closeEpisode(ep.id, 'gave up'); out.closed = true; }
  return out;
}

async function closeEpisode(id, why) {
  const ep = episodes.get(id);
  if (!ep) return false;
  episodes.delete(id);
  log(ep, { ev: 'close', why: why || 'closed', actions: ep.n });
  await ep.context.close().catch(() => {});
  return true;
}

// ---------------------------------------------------------------- HTTP
const send = (res, code, body) => { const s = JSON.stringify(body); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) }); res.end(s); };
const readBody = (req) => new Promise((resolve, reject) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) reject(new Error('body too large')); }); req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(new Error('the body is not JSON')); } }); });

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true, episodes: episodes.size, app: APP, devices: Object.keys(DEVICES), uptimeS: Math.round((Date.now() - started) / 1000) });
  if (req.method === 'GET' && p === '/sets') return send(res, 200, { sets: await D.setIds(await utilPage()) });
  if (req.method === 'GET' && p === '/manifest') {
    const set = url.searchParams.get('set');
    if (!set) return send(res, 400, { error: 'set is required' });
    const bad = await D.unknownSet(await utilPage(), set);
    if (bad) return send(res, 400, { error: bad });
    if (!manifests.has(set)) {
      // the engine answers on the shared page; a walk needs a fresh context of its own
      const engine = await (await utilPage()).evaluate(() => typeof window.App.tutorialManifest === 'function');
      if (engine) manifests.set(set, await D.manifestOf(await utilPage(), set));
      else {
        const s = await D.newSession(browser, DEVICES['first-timer']);
        try { await D.boot(s.page, APP); manifests.set(set, await D.manifestOf(s.page, set)); } finally { await s.context.close().catch(() => {}); }
      }
    }
    return send(res, 200, manifests.get(set));
  }
  if (req.method === 'POST' && p === '/episode') return send(res, 200, await openEpisode(await readBody(req)));
  if (req.method === 'POST' && p === '/act') {
    const body = await readBody(req);
    const ep = episodes.get(body.id);
    if (!ep) return send(res, 404, { error: 'no episode ' + body.id + ' (closed after 10 idle minutes?)' });
    // one action at a time per episode, in arrival order
    const run = ep.busy.then(() => doAct(ep, body.action));
    ep.busy = run.catch(() => {});
    return send(res, 200, await run);
  }
  if (req.method === 'POST' && p === '/close') { const body = await readBody(req); return send(res, 200, { ok: await closeEpisode(body.id, 'closed by the caller') }); }
  return send(res, 404, { error: 'GET /health /sets /manifest?set= · POST /episode /act /close' });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!APP) { staticServer = await D.serveRepo(0); APP = staticServer.url; }
  browser = await D.launch({ headed: HEADED });
  const server = http.createServer((req, res) => { route(req, res).catch((e) => send(res, e instanceof BadRequest ? 400 : 500, { error: String(e.message || e).split('\n')[0] })); });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log('persona harness on http://127.0.0.1:' + PORT + ' · app ' + APP + ' · logs ' + OUT);
  const sweep = setInterval(() => { const now = Date.now(); episodes.forEach((ep, id) => { if (now - ep.last > IDLE_MS) closeEpisode(id, 'idle 10 min'); }); }, 30000);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(sweep);
    console.log('persona harness: closing ' + episodes.size + ' episode(s)');
    await Promise.all(Array.from(episodes.keys()).map((id) => closeEpisode(id, 'harness stopped')));
    if (util) await util.context.close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
    if (staticServer) staticServer.server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => { console.error(e); process.exit(1); });
