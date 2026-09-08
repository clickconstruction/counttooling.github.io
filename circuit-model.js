/*
 * circuit-model.js - the pure circuit model behind "Circuits" (Electrical,
 * First-Class S4). No state, no DOM: a classic <script src> loaded after
 * conductor-model.js, top-level declarations in the shared global lexical
 * scope (features/circuits.js reads the same surface as window.CircuitModel);
 * the guarded CommonJS footer lets circuit-model.test.js require() it.
 *
 * The model: a GROUP with a panel tag is a circuit — `group.panel` ("LP-1"),
 * `group.circuit` ("7"), optional `group.loadAmps`. A COUNTER may be a panel:
 * `counter.panelName` ("LP-1") + `counter.poles` (the schedule's pole count).
 * A line type or a single line may be a HOMERUN (`homerun: true`) — the run to
 * the panel, drawn with the arrowhead and reported apart from device-to-device
 * runs. From those three facts the schedule follows: per panel, per circuit,
 * the devices served, conduit / homerun / wire feet, and the farthest device's
 * distance along the runs (where voltage drop lives, S5). The panel
 * cross-check compares circuits on plan with the schedule's poles.
 */

// "LP-1/7" — panel, then circuit; either alone reads on its own.
function circuitTag(group) {
  if (!group) return '';
  const p = String(group.panel || '').trim();
  const c = String(group.circuit || '').trim();
  if (p && c) return p + '/' + c;
  return p || c;
}
function isCircuitGroup(group) {
  return !!(group && (String(group.panel || '').trim() || String(group.circuit || '').trim()));
}

// --- the run graph -----------------------------------------------------------
// runs: [{ a: {x,y}, b: {x,y}, feet, id? }] in PDF points with their real feet
// (drops included). Endpoints within `tol` points snap to one node.
function buildRunGraph(runs, tol) {
  const t = typeof tol === 'number' && tol > 0 ? tol : 2;
  const nodes = [];
  const nodeFor = (p) => {
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - p.x, dy = nodes[i].y - p.y;
      if (dx * dx + dy * dy <= t * t) return i;
    }
    nodes.push({ x: p.x, y: p.y });
    return nodes.length - 1;
  };
  const adj = [];
  const edge = (i, j, feet, id) => { (adj[i] = adj[i] || []).push({ to: j, feet, id }); };
  (runs || []).forEach((r) => {
    if (!r || !r.a || !r.b) return;
    const i = nodeFor(r.a), j = nodeFor(r.b);
    const feet = typeof r.feet === 'number' && r.feet >= 0 ? r.feet : 0;
    edge(i, j, feet, r.id); edge(j, i, feet, r.id);
  });
  return { nodes, adj, tol: t, nodeFor: (p) => { for (let i = 0; i < nodes.length; i++) { const dx = nodes[i].x - p.x, dy = nodes[i].y - p.y; if (dx * dx + dy * dy <= t * t) return i; } return -1; } };
}
// Dijkstra over feet from `start`; Infinity for unreachable nodes.
function distancesFrom(graph, start) {
  const n = graph.nodes.length;
  const dist = new Array(n).fill(Infinity);
  if (start < 0 || start >= n) return dist;
  dist[start] = 0;
  const done = new Array(n).fill(false);
  for (let k = 0; k < n; k++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    (graph.adj[u] || []).forEach((e) => { if (dist[u] + e.feet < dist[e.to]) dist[e.to] = dist[u] + e.feet; });
  }
  return dist;
}

// The farthest device from the panel along the circuit's runs.
//   runs:        the circuit's runs (see buildRunGraph)
//   devices:     [{x,y}] the circuit's counter marks (non-panel)
//   panelPoints: [{x,y}] panel marks (the start when one sits on the graph)
//   homerunEnds: [{x,y}] the far ends of the circuit's homerun runs (the start
//                when no panel mark touches the graph — the arrow points home)
// → { feet, from: 'panel' | 'homerun' | null, devicesOnRuns, devicesOffRuns }
// feet is null when no start could be found or no device sits on the runs.
function farthestDeviceFeet(opts) {
  const o = opts || {};
  const g = buildRunGraph(o.runs || [], o.tol);
  let start = -1, from = null;
  for (const p of o.panelPoints || []) { const i = g.nodeFor(p); if (i >= 0) { start = i; from = 'panel'; break; } }
  if (start < 0) {
    // The panel end of a homerun is its LEAF end — the one no other run
    // continues from and no device sits on; the other end is the first device.
    const deviceNodes = new Set((o.devices || []).map((d) => g.nodeFor(d)).filter((i) => i >= 0));
    const ends = (o.homerunEnds || []).map((p) => g.nodeFor(p)).filter((i) => i >= 0);
    const leaf = ends.find((i) => (g.adj[i] || []).length <= 1 && !deviceNodes.has(i));
    const pick = leaf != null ? leaf : ends[0];
    if (pick != null) { start = pick; from = 'homerun'; }
  }
  const dist = start >= 0 ? distancesFrom(g, start) : null;
  let feet = null, devicesOnRuns = 0, devicesOffRuns = 0;
  (o.devices || []).forEach((d) => {
    const i = g.nodeFor(d);
    if (i < 0) { devicesOffRuns++; return; }
    devicesOnRuns++;
    if (dist && dist[i] < Infinity) feet = Math.max(feet == null ? 0 : feet, dist[i]);
  });
  return { feet: feet == null ? null : Math.round(feet * 100) / 100, from: start >= 0 ? from : null, devicesOnRuns, devicesOffRuns };
}

// --- the panel cross-check ---------------------------------------------------
// groups: the project's groups; counters: the palette (panelName / poles).
// One row per panel named anywhere: circuits on plan = distinct circuit numbers
// among the panel's groups (a group with the panel but no number counts once
// as its own), scheduled = the panel counter's poles (null when unknown).
function panelCrossCheck(groups, counters) {
  const byPanel = {};
  (groups || []).forEach((g) => {
    const p = String(g.panel || '').trim();
    if (!p) return;
    const key = p.toUpperCase();
    byPanel[key] = byPanel[key] || { panel: p, circuits: new Set(), untagged: 0 };
    const c = String(g.circuit || '').trim();
    if (c) c.split(/[,/&+ ]+/).filter(Boolean).forEach((n) => byPanel[key].circuits.add(n.toUpperCase()));
    else byPanel[key].untagged++;
  });
  (counters || []).forEach((c) => {
    const p = String(c.panelName || '').trim();
    if (!p) return;
    const key = p.toUpperCase();
    byPanel[key] = byPanel[key] || { panel: p, circuits: new Set(), untagged: 0 };
    if (typeof c.poles === 'number' && c.poles > 0) byPanel[key].poles = c.poles;
  });
  return Object.values(byPanel).map((r) => {
    const onPlan = r.circuits.size + r.untagged;
    const scheduled = typeof r.poles === 'number' ? r.poles : null;
    const verdict = scheduled == null ? 'unknown' : onPlan === scheduled ? 'match' : onPlan < scheduled ? 'under' : 'over';
    return { panel: r.panel, onPlan, scheduled, verdict };
  }).sort((a, b) => a.panel.localeCompare(b.panel, undefined, { numeric: true }));
}

// The names above are top-level declarations in the shared global lexical
// scope; window.CircuitModel is the same surface as one object. Keep in sync.
const CIRCUIT_MODEL_API = { circuitTag, isCircuitGroup, buildRunGraph, distancesFrom, farthestDeviceFeet, panelCrossCheck };
if (typeof window !== 'undefined') window.CircuitModel = CIRCUIT_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = CIRCUIT_MODEL_API;
