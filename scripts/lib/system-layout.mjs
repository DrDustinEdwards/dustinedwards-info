// Inside any system on /systems: one tap on a capsomer zooms into its circle (Dustin, 2026-10-18: "I thought it
// was a single page that you would click on something and it would show the wiring of it", and "it's not
// intuitive to click twice"). Capsomer's map draws an inside view for the core alone (insideScene, placeInside,
// one layer); this draws one for every system, in Capsomer's classes, at build time (system-insides-plugin.mjs),
// and the site's script (app/enhance/system-map.ts) shows the chosen one. Capsomer is not changed.
//
// What a circle holds:
//   - the system's own parts inside it;
//   - around the rim, what it works with outside (its `external` parts) and every other system it connects to;
//   - one straight wire for each pair a relationship joins, from the exact part that uses it. A line between
//     two systems as wholes (Capsid coordinates Foxing) runs from the circle's edge, and is left out when a part
//     of this system already wires to that system.
// A private system is its name only: its circle holds its name and its summary, and its rim its links.
//
// The places are searched for, from fixed starts, so the same model always draws the same way: each part over a
// grid inside the circle, the rim's order around it, until no wire crosses another or runs under a box it does
// not end at, and then the shortest wires. The drawing is the shell's width, so a unit is the same size as on the
// map, and as tall as it needs.
import { layoutMap, playableFlows } from "capsomer/behaviour/system-map";

/** @typedef {import("../../app/lib/systems.mjs").SystemModel} SystemModel */
/**
 * A box in the drawing: a part inside the circle, or on the rim what is outside it or another system.
 * @typedef {{ id: string, role: "part" | "outside" | "system", name: string, lines: string[], sub: string, w: number, h: number, store?: boolean, private?: boolean, x: number, y: number }} Node
 */
/** A wire: node indices, -1 for the circle itself. @typedef {{ a: number, b: number, from: string, to: string, loose: boolean }} Wire */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/**
 * One circle laid out: its radius, the name at its foot, every box placed, every wire with its route (its end
 * points, the points along it and its path), the drawing's top, foot and width, and what the search scored it.
 * @typedef {{ name: string, r: number, label: Rect | null, nodes: Node[], wires: (Wire & { seg: number[], pts: number[][], d: string, bow: number })[], top: number, bottom: number, width: number, faults: number, cost: number }} Layout
 */

const LOOSE_KINDS = new Set(["coordinates", "watches"]);
const STORE_KINDS = new Set(["database", "bucket", "kv", "queue"]);
const EXTERNAL = "external";
/** The circle's own end of a line between two systems as wholes. */
const CIRCLE = -1;

// Sizes, in the shell's drawing units (a 390 px phone draws a unit at about 0.94 px).
const NAME_SIZE = 11.5;
const KIND_SIZE = 9;
const RIM_SIZE = 11;
const LINE_H = 13;
const BOX_PAD_X = 8;
/** A part's name wider than this wraps onto a second line, at a hyphen or a space. */
const MAX_LINE = 96;
const MIN_BOX_W = 58;
const RIM_H = 24;
const RIM_PAD_X = 10;
const MARGIN = 12;
/** Every rim box keeps this far outside the circle, and every part this far inside it. */
const RIM_GAP = 12;
const IN_PAD = 10;
/** Two boxes keep this far apart. */
const BOX_GAP = 10;
/** Between rows of the rim. */
const ROW_GAP = 8;
/** A wire keeps this far from every box but its two ends. */
const CLEAR = 5;
const GRID = 10;
/** The name at the circle's foot. */
const LABEL_SIZE = 10;
const LABEL_FOOT = 14;

// What a drawing costs. A fault costs more than any drawing without one, so a fault is kept only when every
// placement tried has one.
const OVERLAP = 1e6;
const UNDER_BOX = 1e5;
const CROSSING = 1e4;
const FAN = 600;
const MIN_FAN_DEG = 16;
/** A part with nothing pulling it drifts to the middle: this much per unit from the centre. */
const CENTRE_PULL = 0.4;
/** The share of the circle's area its boxes and their gaps take, at most. */
const FILL = 0.45;
/** How many moves the annealing tries on a drawing with a fault. */
const ANNEAL_STEPS = 12000;
/** How many seeds the search runs from, at most. */
const SEEDS = 3;

const f1 = (/** @type {number} */ n) => Math.round(n * 10) / 10;
const esc = (/** @type {string} */ s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A text's width, estimated from its letters: the drawing is made on the server, with no font to measure, so
 * each class of letter gets its share of an em, a little over the UI face's, so a box is never too narrow.
 * @param {string} s @param {number} size
 */
function textWidth(s, size) {
  let em = 0;
  for (const ch of s) {
    if (/[iljtfr.,:;'|!\s]/.test(ch)) em += 0.33;
    else if (/[-_()]/.test(ch)) em += 0.4;
    else if (/[mwMW]/.test(ch)) em += 0.88;
    else if (/[A-Z]/.test(ch)) em += 0.7;
    else if (/[0-9]/.test(ch)) em += 0.6;
    else em += 0.58;
  }
  return em * size;
}

/**
 * A part's name in one line, or two when it is wider than MAX_LINE: broken after a hyphen or at a space, where
 * the longer line is shortest.
 * @param {string} name
 */
function wrapName(name) {
  if (textWidth(name, NAME_SIZE) <= MAX_LINE) return [name];
  let best = [name];
  let widest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < name.length - 1; i++) {
    const ch = name[i];
    if (ch !== "-" && ch !== " " && ch !== "_") continue;
    const lines = ch === " " ? [name.slice(0, i), name.slice(i + 1)] : [name.slice(0, i + 1), name.slice(i + 1)];
    const w = Math.max(...lines.map((l) => textWidth(l, NAME_SIZE)));
    if (w < widest) {
      widest = w;
      best = lines;
    }
  }
  return best;
}

/** @param {{ id: string, name: string, kind: string }} c @returns {Node} */
function partNode(c) {
  const lines = wrapName(c.name);
  const w = Math.ceil(Math.max(MIN_BOX_W, ...lines.map((l) => textWidth(l, NAME_SIZE)), textWidth(c.kind, KIND_SIZE)) + 2 * BOX_PAD_X);
  return { id: c.id, role: "part", name: c.name, lines, sub: c.kind, w, h: 12 + lines.length * LINE_H + 11, store: STORE_KINDS.has(c.kind), x: 0, y: 0 };
}

/** @param {string} id @param {string} name @param {"outside" | "system"} role @param {boolean} [priv] @returns {Node} */
function rimNode(id, name, role, priv = false) {
  return { id, role, name, lines: [name], sub: "", w: Math.ceil(textWidth(name, RIM_SIZE) + 2 * RIM_PAD_X), h: RIM_H, private: priv, x: 0, y: 0 };
}

/**
 * What one system's circle draws: its parts, what is around its rim, and its wires, before anything is placed.
 * @param {SystemModel} model
 * @param {string} id
 */
export function sceneOf(model, id) {
  const system = model.systems.find((s) => s.id === id);
  if (!system) throw new Error(`no system ${id}`);
  const systems = new Map(model.systems.map((s) => [s.id, s]));
  const owner = new Map(model.containers.map((c) => [c.id, c.system]));
  const own = model.containers.filter((c) => c.system === id);
  /** @type {Node[]} */
  const nodes = [...own.filter((c) => c.kind !== EXTERNAL).map(partNode), ...own.filter((c) => c.kind === EXTERNAL).map((c) => rimNode(c.id, c.name, "outside"))];
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  /** Another system, on the rim, added when a line first reaches it. @param {string} other */
  const systemAt = (other) => {
    const key = `system:${other}`;
    let i = index.get(key);
    if (i === undefined) {
      const s = /** @type {SystemModel["systems"][number]} */ (systems.get(other));
      i = nodes.push(rimNode(key, s.name, "system", s.private)) - 1;
      index.set(key, i);
    }
    return i;
  };
  /** Where a relationship's end sits in this drawing: one of its own boxes, the circle, or another system. @param {string} end */
  const at = (end) => {
    if (index.has(end) && !end.startsWith("system:")) return /** @type {number} */ (index.get(end));
    if (end === id) return CIRCLE;
    const other = owner.get(end) ?? end;
    return other === id ? null : systemAt(other);
  };
  /** @type {Map<string, Wire>} */
  const wires = new Map();
  /** @type {Wire[]} */
  const stubs = [];
  for (const r of model.relationships) {
    // Only what touches this system: one of its parts, or the system itself.
    const touches = (/** @type {string} */ e) => e === id || owner.get(e) === id;
    if (!touches(r.from) && !touches(r.to)) continue;
    const a = at(r.from);
    const b = at(r.to);
    if (a === null || b === null || a === b) continue;
    const loose = LOOSE_KINDS.has(r.kind);
    if (a === CIRCLE || b === CIRCLE) {
      if (a === CIRCLE && b === CIRCLE) continue;
      const other = a === CIRCLE ? b : a;
      if (nodes[other].role !== "system") continue;
      const prior = stubs.find((s) => s.b === other);
      if (prior) prior.loose &&= loose;
      else stubs.push({ a: CIRCLE, b: other, from: id, to: nodes[other].id, loose });
      continue;
    }
    const key = a < b ? `${a} ${b}` : `${b} ${a}`;
    const prior = wires.get(key);
    if (prior) prior.loose &&= loose;
    else wires.set(key, { a, b, from: nodes[a].id, to: nodes[b].id, loose });
  }
  // A part's own wire to a system says more than the circle's: the circle's is drawn only where there is none.
  const wired = new Set([...wires.values()].flatMap((w) => [w.a, w.b]));
  const all = [...wires.values(), ...stubs.filter((s) => !wired.has(s.b))];
  // A system that some line reached only as a whole and lost it keeps its place: it is still connected.
  return { system, nodes, wires: all };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry.

/** @param {Node} n */
const rectOf = (n) => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h });
/** @param {{ x: number, y: number, w: number, h: number }} r @param {number} g */
const grow = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });

/**
 * Whether segment p-q passes through the rectangle's inside (a touch is not a hit).
 * @param {number} px @param {number} py @param {number} qx @param {number} qy @param {{ x: number, y: number, w: number, h: number }} r
 */
function segmentHitsRect(px, py, qx, qy, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = qx - px;
  const dy = qy - py;
  const edges = [
    [-dx, px - r.x],
    [dx, r.x + r.w - px],
    [-dy, py - r.y],
    [dy, r.y + r.h - py],
  ];
  for (const [pk, qk] of edges) {
    if (pk === 0) {
      if (qk <= 0) return false;
      continue;
    }
    const t = qk / pk;
    if (pk < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return false;
  }
  return t1 - t0 > 1e-9;
}

/**
 * Whether segment p-q passes through a box grown by g, from the box's own numbers (the search's hot path).
 * @param {number[]} s [px, py, qx, qy] @param {Node} n @param {number} g
 */
function hitsBox(s, n, g) {
  const x0 = n.x - n.w / 2 - g;
  const x1 = n.x + n.w / 2 + g;
  const y0 = n.y - n.h / 2 - g;
  const y1 = n.y + n.h / 2 + g;
  // Both ends on one side of the box: no hit.
  if ((s[0] <= x0 && s[2] <= x0) || (s[0] >= x1 && s[2] >= x1) || (s[1] <= y0 && s[3] <= y0) || (s[1] >= y1 && s[3] >= y1)) return false;
  return segmentHitsRect(s[0], s[1], s[2], s[3], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
}

/**
 * Whether segments a-b and c-d cross at a point inside both.
 * @param {number[]} s @param {number[]} t each [ax, ay, bx, by]
 */
function segmentsCross(s, t) {
  if (Math.max(s[0], s[2]) < Math.min(t[0], t[2]) || Math.max(t[0], t[2]) < Math.min(s[0], s[2]) || Math.max(s[1], s[3]) < Math.min(t[1], t[3]) || Math.max(t[1], t[3]) < Math.min(s[1], s[3])) return false;
  const rx = s[2] - s[0];
  const ry = s[3] - s[1];
  const sx = t[2] - t[0];
  const sy = t[3] - t[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return false;
  const u = ((t[0] - s[0]) * sy - (t[1] - s[1]) * sx) / den;
  const v = ((t[0] - s[0]) * ry - (t[1] - s[1]) * rx) / den;
  return u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
}

/**
 * Where the line from a box's centre toward a point leaves the box.
 * @param {Node} n @param {number} tx @param {number} ty
 */
function exitPoint(n, tx, ty) {
  const dx = tx - n.x;
  const dy = ty - n.y;
  const t = Math.min(dx ? n.w / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY, dy ? n.h / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY);
  return t >= 1 ? [n.x, n.y] : [n.x + dx * t, n.y + dy * t];
}

/**
 * A wire's segment, from edge to edge: between two boxes along the line joining their centres; from the circle,
 * at the point facing the box.
 * @param {Wire} w @param {Node[]} nodes @param {number} r
 * @returns {number[]}
 */
function segmentOf(w, nodes, r) {
  const b = nodes[w.b];
  if (w.a === CIRCLE) {
    const d = Math.hypot(b.x, b.y) || 1;
    const [qx, qy] = exitPoint(b, 0, 0);
    return [(b.x / d) * r, (b.y / d) * r, qx, qy];
  }
  const a = nodes[w.a];
  const [px, py] = exitPoint(a, b.x, b.y);
  const [qx, qy] = exitPoint(b, a.x, a.y);
  return [px, py, qx, qy];
}

/** A small deterministic generator, so the same model always draws the same way. @param {number} seed */
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The rim.

/**
 * Places one half of the rim, left to right, hugging the circle: spread over the half's arc, kept apart, inside
 * the drawing's width, as close to the circle as each box's width allows. A half too full for one row takes
 * two, alternating, so each line to the outer row has a gap in the inner one to pass through.
 * @param {Node[]} row @param {number} r @param {number} halfW @param {1 | -1} sign -1 above the circle, 1 below
 */
function placeHalf(row, r, halfW, sign) {
  const n = row.length;
  if (!n) return;
  const avail = 2 * (halfW - MARGIN);
  const rows = row.reduce((s, b) => s + b.w, 0) + (n - 1) * BOX_GAP <= avail ? 1 : 2;
  const reach = r + RIM_GAP + 30;
  const xs = row.map((_, i) => -reach * Math.cos((Math.PI * (i + 0.5)) / n));
  /** @param {number} i @param {number} j */
  const sameRow = (i, j) => rows === 1 || i % 2 === j % 2;
  // Apart, left to right; then back inside the right edge, right to left; then inside the left edge.
  const apart = () => {
    for (let i = 1; i < n; i++) {
      for (let j = i - 1; j >= 0 && j >= i - 2; j--) {
        if (sameRow(i, j)) xs[i] = Math.max(xs[i], xs[j] + (row[i].w + row[j].w) / 2 + BOX_GAP);
      }
    }
  };
  apart();
  const right = halfW - MARGIN;
  for (let i = n - 1; i >= 0; i--) {
    xs[i] = Math.min(xs[i], right - row[i].w / 2);
    for (let j = i + 1; j < n && j <= i + 2; j++) {
      if (sameRow(i, j)) xs[i] = Math.min(xs[i], xs[j] - (row[i].w + row[j].w) / 2 - BOX_GAP);
    }
  }
  for (let i = 0; i < n; i++) xs[i] = Math.max(xs[i], -right + row[i].w / 2);
  apart();
  /** How far from the centre line a box at x must sit to keep `d` from the circle's centre. @param {number} x @param {Node} b @param {number} d */
  const hug = (x, b, d) => {
    const nx = Math.max(0, Math.abs(x) - b.w / 2);
    return (nx >= d ? 0 : Math.sqrt(d * d - nx * nx)) + b.h / 2;
  };
  const ys = row.map((b, i) => Math.max(b.h / 2 + 4, hug(xs[i], b, r + RIM_GAP)));
  if (rows === 2) {
    for (let i = 1; i < n; i += 2) {
      let y = Math.max(ys[i], hug(xs[i], row[i], r + RIM_GAP + RIM_H + ROW_GAP));
      for (let j = 0; j < n; j += 2) {
        if (Math.abs(xs[i] - xs[j]) < (row[i].w + row[j].w) / 2 + 4) y = Math.max(y, ys[j] + (row[i].h + row[j].h) / 2 + ROW_GAP);
      }
      ys[i] = y;
    }
  }
  row.forEach((b, i) => {
    b.x = f1(xs[i]);
    b.y = f1(sign * ys[i]);
  });
}

/**
 * The rim in its order: the first `top` of `seq` above the circle, left to right, the rest below it, right to
 * left, so the order runs once round the circle clockwise.
 * @param {Node[]} nodes @param {number[]} seq @param {number} top @param {number} r @param {number} halfW
 */
function placeRim(nodes, seq, top, r, halfW) {
  placeHalf(
    seq.slice(0, top).map((i) => nodes[i]),
    r,
    halfW,
    -1,
  );
  placeHalf(
    seq
      .slice(top)
      .reverse()
      .map((i) => nodes[i]),
    r,
    halfW,
    1,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The cost of a drawing.

/**
 * @param {Node[]} nodes @param {Wire[]} wires @param {number} r @param {{ x: number, y: number, w: number, h: number } | null} label
 */
function coster(nodes, wires, r, label) {
  const n = nodes.length;
  /** Each node's wires. @type {number[][]} */
  const incident = nodes.map(() => []);
  wires.forEach((w, k) => {
    if (w.a !== CIRCLE) incident[w.a].push(k);
    incident[w.b].push(k);
  });
  /** @type {number[][]} */
  const segs = wires.map((w) => segmentOf(w, nodes, r));
  const zone = label ? grow(label, 3) : null;
  const shares = (/** @type {Wire} */ u, /** @type {Wire} */ v) => u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b;

  /** Two boxes too close. @param {number} i @param {number} j */
  const overlap = (i, j) => {
    const a = nodes[i];
    const b = nodes[j];
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + BOX_GAP && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + BOX_GAP / 2 ? OVERLAP : 0;
  };
  /** A wire's own cost: its length, and every box or the name it runs under. @param {number} k */
  const own = (k) => {
    const w = wires[k];
    const s = segs[k];
    let c = Math.hypot(s[2] - s[0], s[3] - s[1]);
    for (let m = 0; m < n; m++) {
      if (m === w.a || m === w.b) continue;
      if (hitsBox(s, nodes[m], CLEAR)) c += UNDER_BOX;
    }
    if (zone && segmentHitsRect(s[0], s[1], s[2], s[3], zone)) c += UNDER_BOX;
    return c;
  };
  /** Two wires that cross, or leave one box so close together they read as one. @param {number} k @param {number} o */
  const pair = (k, o) => {
    const u = wires[k];
    const v = wires[o];
    if (!shares(u, v)) return segmentsCross(segs[k], segs[o]) ? CROSSING : 0;
    // From the box they share, the angle between them.
    const at = u.a === v.a || u.a === v.b ? u.a : u.b;
    if (at === CIRCLE) return 0;
    const far = (/** @type {Wire} */ w, /** @type {number[]} */ s) => (w.a === at ? [s[2], s[3]] : [s[0], s[1]]);
    const [ux, uy] = far(u, segs[k]);
    const [vx, vy] = far(v, segs[o]);
    const c = nodes[at];
    let ang = Math.abs(Math.atan2(uy - c.y, ux - c.x) - Math.atan2(vy - c.y, vx - c.x)) * (180 / Math.PI);
    ang = Math.min(ang, 360 - ang);
    return ang < MIN_FAN_DEG ? FAN : 0;
  };
  /** @param {number} i */
  const pull = (i) => (nodes[i].role === "part" ? CENTRE_PULL * Math.hypot(nodes[i].x, nodes[i].y) : 0);
  const total = () => {
    let c = 0;
    for (let i = 0; i < n; i++) c += pull(i);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c += overlap(i, j);
    for (let k = 0; k < wires.length; k++) {
      c += own(k);
      for (let o = k + 1; o < wires.length; o++) c += pair(k, o);
    }
    return c;
  };
  /** Everything a move of node i can change. @param {number} i */
  const partial = (i) => {
    let c = pull(i);
    for (let j = 0; j < n; j++) if (j !== i) c += overlap(i, j);
    const mine = incident[i];
    const mineSet = new Set(mine);
    for (const k of mine) {
      c += own(k);
      for (let o = 0; o < wires.length; o++) {
        if (o === k || (mineSet.has(o) && o < k)) continue;
        c += pair(k, o);
      }
    }
    // Other wires running under this box.
    for (let k = 0; k < wires.length; k++) {
      if (mineSet.has(k)) continue;
      if (hitsBox(segs[k], nodes[i], CLEAR)) c += UNDER_BOX;
    }
    return c;
  };
  /** @param {number} i */
  const refresh = (i) => {
    for (const k of incident[i]) segs[k] = segmentOf(wires[k], nodes, r);
  };
  const refreshAll = () => {
    for (let k = 0; k < wires.length; k++) segs[k] = segmentOf(wires[k], nodes, r);
  };
  return { total, partial, refresh, refreshAll, segs };
}

// ---------------------------------------------------------------------------------------------------------------
// The search.

/**
 * The circle's radius for its parts: room for each box and its share of the gaps, at under half the circle's
 * area. A circle too wide for the shell widens the drawing, which then draws a little smaller.
 * @param {Node[]} parts
 */
function radiusFor(parts) {
  if (!parts.length) return 104;
  const area = parts.reduce((s, b) => s + (b.w + BOX_GAP) * (b.h + BOX_GAP), 0);
  return Math.max(parts.length > 2 ? 118 : 96, Math.sqrt(area / (FILL * Math.PI)) + IN_PAD);
}

/**
 * Every place a part may sit: on the grid, wholly inside the circle and clear of its name.
 * @param {Node} b @param {number} r @param {{ x: number, y: number, w: number, h: number } | null} label
 */
function slotsFor(b, r, label) {
  const out = [];
  const lim = r - IN_PAD;
  for (let y = -Math.floor(lim / GRID) * GRID; y <= lim; y += GRID) {
    for (let x = -Math.floor(lim / GRID) * GRID; x <= lim; x += GRID) {
      const hx = Math.abs(x) + b.w / 2;
      const hy = Math.abs(y) + b.h / 2;
      if (hx * hx + hy * hy > lim * lim) continue;
      if (label && Math.abs(x - (label.x + label.w / 2)) < (b.w + label.w) / 2 + 4 && Math.abs(y - (label.y + label.h / 2)) < (b.h + label.h) / 2 + 4) continue;
      out.push([x, y]);
    }
  }
  return out;
}

/**
 * The rim's first order: what wires to the same part side by side, the parts in the order the model gives them,
 * then the systems reached only as wholes.
 * @param {Node[]} nodes @param {Wire[]} wires @param {number[]} rim
 */
function firstOrder(nodes, wires, rim) {
  const anchor = new Map(rim.map((i) => [i, Number.POSITIVE_INFINITY]));
  for (const w of wires) {
    for (const [me, other] of [
      [w.a, w.b],
      [w.b, w.a],
    ]) {
      if (anchor.has(me) && other !== CIRCLE && nodes[other].role === "part") anchor.set(me, Math.min(/** @type {number} */ (anchor.get(me)), other));
    }
  }
  return [...rim].sort((p, q) => /** @type {number} */ (anchor.get(p)) - /** @type {number} */ (anchor.get(q)) || p - q);
}

/**
 * The parts' first places. The part most wires run to sits in the middle. Each other part with a wire to the
 * rim sits toward what it wires to there; a part that wires only to the middle one (a store under its Worker)
 * goes into the widest gap left between the middle one's spokes, so its own spoke is short and none passes it.
 * @param {Node[]} nodes @param {Wire[]} wires @param {number[]} parts @param {number[][][]} slots @param {number} r @param {() => number} rand
 */
function firstPlaces(nodes, wires, parts, slots, r, rand) {
  const near = (/** @type {number} */ i) => wires.flatMap((w) => (w.a === i ? [w.b] : w.b === i ? [w.a] : [])).filter((o) => o !== CIRCLE);
  const degree = new Map(parts.map((i) => [i, near(i).length]));
  const order = [...parts].sort((p, q) => /** @type {number} */ (degree.get(q)) - /** @type {number} */ (degree.get(p)) || p - q);
  const hub = order.length && /** @type {number} */ (degree.get(order[0])) >= 3 ? order[0] : -1;
  const leaf = (/** @type {number} */ i) => near(i).every((o) => o === hub);
  /** @type {Set<number>} */
  const placed = new Set();
  /** The angles already taken round the middle. @type {number[]} */
  const taken = hub >= 0 ? near(hub).filter((o) => nodes[o].role !== "part").map((o) => Math.atan2(nodes[o].y, nodes[o].x)) : [];
  const put = (/** @type {number} */ i, /** @type {number} */ gx, /** @type {number} */ gy) => {
    let best = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const [x, y] of slots[parts.indexOf(i)]) {
      const clash = [...placed].some((j) => Math.abs(nodes[j].x - x) < (nodes[j].w + nodes[i].w) / 2 + BOX_GAP && Math.abs(nodes[j].y - y) < (nodes[j].h + nodes[i].h) / 2 + BOX_GAP / 2);
      if (clash) continue;
      const d = Math.hypot(x - gx, y - gy);
      if (d < bestD) {
        bestD = d;
        best = [x, y];
      }
    }
    const list = slots[parts.indexOf(i)];
    const [x, y] = best ?? list[Math.floor(rand() * list.length)] ?? [0, 0];
    nodes[i].x = x;
    nodes[i].y = y;
    placed.add(i);
  };
  if (hub >= 0) put(hub, 0, 0);
  // Parts with wires of their own first, toward what they wire to; then the leaves, into the gaps.
  const rest = order.filter((i) => i !== hub);
  for (const i of [...rest.filter((i) => !leaf(i)), ...rest.filter(leaf)]) {
    let ang;
    if (!leaf(i)) {
      let tx = 0;
      let ty = 0;
      for (const o of near(i)) {
        if (o === hub || (nodes[o].role === "part" && !placed.has(o))) continue;
        tx += nodes[o].x;
        ty += nodes[o].y;
      }
      ang = tx || ty ? Math.atan2(ty, tx) : rand() * 2 * Math.PI;
    } else if (taken.length) {
      const sorted = [...taken].sort((p, q) => p - q);
      let gap = -1;
      ang = 0;
      for (const [k, t] of sorted.entries()) {
        const next = k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + 2 * Math.PI;
        if (next - t > gap) {
          gap = next - t;
          ang = t + gap / 2;
        }
      }
    } else ang = rand() * 2 * Math.PI;
    taken.push(Math.atan2(Math.sin(ang), Math.cos(ang)));
    const reach = hub >= 0 ? 0.62 * r : 1000;
    put(i, Math.cos(ang) * reach, Math.sin(ang) * reach);
  }
}

/** The bends a wire may take: its control point this share of its length to one side. */
const CURVE_STEPS = 10;
/** A curve's control point sits at most this share of the wire's length from its middle: gently curved. */
const MAX_BOW = 0.55;

/**
 * A wire's shape: straight, or a quadratic curve through the control point (cx, cy), leaving each box toward
 * it. As points along it, for the checks, and as a path.
 * @param {Wire} w @param {Node[]} nodes @param {number} r @param {number[] | null} control
 */
function shapeOf(w, nodes, r, control) {
  if (w.a === CIRCLE || !control) {
    const [ax, ay, bx, by] = segmentOf(w, nodes, r).map(f1);
    return { pts: [[ax, ay], [bx, by]], d: `M${ax},${ay} L${bx},${by}`, bow: 0 };
  }
  const a = nodes[w.a];
  const b = nodes[w.b];
  const [cx, cy] = control;
  const [px, py] = exitPoint(a, cx, cy);
  const [qx, qy] = exitPoint(b, cx, cy);
  /** @type {number[][]} */
  const pts = [];
  for (let k = 0; k <= CURVE_STEPS; k++) {
    const t = k / CURVE_STEPS;
    const u = 1 - t;
    pts.push([f1(u * u * px + 2 * u * t * cx + t * t * qx), f1(u * u * py + 2 * u * t * cy + t * t * qy)]);
  }
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const bow = Math.hypot(cx - (a.x + b.x) / 2, cy - (a.y + b.y) / 2) / len;
  return { pts, d: `M${f1(px)},${f1(py)} Q${f1(cx)},${f1(cy)} ${f1(qx)},${f1(qy)}`, bow };
}

/**
 * Each wire straight where it can be, and gently curved where a straight line would run under a box or cross
 * another wire: every wire with a fault tries curves through control points over the drawing, keeping the one
 * with the fewest faults, then the least bowed. A wire between two parts stays inside the circle.
 * @param {Node[]} nodes @param {Wire[]} wires @param {number} r @param {{ x: number, y: number, w: number, h: number } | null} label
 */
function bendWires(nodes, wires, r, label) {
  const shapes = wires.map((w) => shapeOf(w, nodes, r, null));
  const zone = label ? grow(label, 3) : null;
  const shares = (/** @type {Wire} */ u, /** @type {Wire} */ v) => u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b;
  /** Faults, a box or the name ten times a crossing. @param {number} k @param {number[][]} pts */
  const faults = (k, pts) => {
    const w = wires[k];
    let n = 0;
    for (let s = 1; s < pts.length; s++) {
      const seg = [...pts[s - 1], ...pts[s]];
      for (let m = 0; m < nodes.length; m++) if (m !== w.a && m !== w.b && hitsBox(seg, nodes[m], CLEAR)) n += 10;
      if (zone && segmentHitsRect(seg[0], seg[1], seg[2], seg[3], zone)) n += 10;
      for (let o = 0; o < wires.length; o++) {
        if (o === k || shares(w, wires[o])) continue;
        const other = shapes[o].pts;
        for (let t = 1; t < other.length; t++) if (segmentsCross(seg, [...other[t - 1], ...other[t]])) n += 1;
      }
    }
    return n;
  };
  const inside = (/** @type {number[][]} */ pts) => pts.every(([x, y]) => Math.hypot(x, y) <= r - 2);
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (let k = 0; k < wires.length; k++) {
      const w = wires[k];
      if (w.a === CIRCLE) continue;
      const now = faults(k, shapes[k].pts);
      if (now === 0 && shapes[k].bow === 0) continue;
      const a = nodes[w.a];
      const b = nodes[w.b];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const both = a.role === "part" && b.role === "part";
      let best = shapes[k];
      let bestScore = now * 1000 + best.bow * 100;
      const straight = shapeOf(w, nodes, r, null);
      const s0 = faults(k, straight.pts) * 1000;
      if (s0 < bestScore - 1e-6) {
        best = straight;
        bestScore = s0;
      }
      const step = Math.max(6, len / 12);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      for (let dx = -MAX_BOW * len; dx <= MAX_BOW * len; dx += step) {
        for (let dy = -MAX_BOW * len; dy <= MAX_BOW * len; dy += step) {
          if (Math.hypot(dx, dy) > MAX_BOW * len) continue;
          const s = shapeOf(w, nodes, r, [mx + dx, my + dy]);
          if (both && !inside(s.pts)) continue;
          const score = faults(k, s.pts) * 1000 + s.bow * 100;
          if (score < bestScore - 1e-6) {
            best = s;
            bestScore = score;
          }
        }
      }
      if (best !== shapes[k]) {
        shapes[k] = best;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return shapes.map((s) => ({ seg: [...s.pts[0], ...s.pts[s.pts.length - 1]], pts: s.pts, d: s.d, bow: s.bow }));
}

/**
 * Lays out one system's circle.
 * @param {ReturnType<typeof sceneOf>} scene @param {number} minWidth the drawing's width at least: the shell's
 * @returns {Layout}
 */
export function layoutScene(scene, minWidth) {
  // At each size the search runs from up to SEEDS fixed seeds while a fault is left, and the drawing kept is the
  // one with the fewest faults once its wires are curved (a wire under a box counting ten crossings), the smallest
  // of those tied. A circle with any fault left is drawn larger, a twentieth at a time up to half again: room lets
  // a wire bow round the others, which is the only way past two parts that share three boxes (Carrel's Worker and
  // its fifteen-minute check each wire to the site, Google and Email; straight, one pair must cross). A circle
  // with no fault stops at the first size, so only a circle that needs the room pays for it in width.
  /** @type {{ l: Layout, score: number } | null} */
  let best = null;
  let width = 0;
  const scoreOf = (/** @type {Layout} */ l) =>
    (l.cost >= OVERLAP ? 1e6 : 0) + faultsOf(l).reduce((n, f) => n + (f.includes(" crosses ") ? 1 : 10), 0);
  for (let grown = 1; grown <= 1.5; grown *= 1.05) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const l = layoutAt(scene, minWidth, grown, seed);
      width ||= l.width;
      if (l.width > width && l.cost >= OVERLAP / 2) continue;
      const score = scoreOf(l);
      if (!best || score < best.score) best = { l, score };
      if (score === 0) return l;
    }
  }
  return /** @type {{ l: Layout, score: number }} */ (best).l;
}

/**
 * One circle at one size.
 * @param {ReturnType<typeof sceneOf>} scene @param {number} minWidth @param {number} grown @param {number} seed
 * @returns {Layout}
 */
function layoutAt(scene, minWidth, grown, seed) {
  const nodes = scene.nodes.map((n) => ({ ...n }));
  const wires = scene.wires;
  const parts = nodes.map((n, i) => (n.role === "part" ? i : -1)).filter((i) => i >= 0);
  const rim = nodes.map((n, i) => (n.role !== "part" ? i : -1)).filter((i) => i >= 0);
  const r = f1(radiusFor(parts.map((i) => nodes[i])) * grown);
  const width = Math.max(minWidth, Math.ceil(2 * (r + MARGIN)));
  const halfW = width / 2;
  const name = scene.system.name;
  // With parts inside, the name sits at the circle's foot, as Capsomer's does; with none, in the middle.
  const labelW = Math.ceil(textWidth(name.toUpperCase(), LABEL_SIZE) * 1.1 + 6);
  const label = parts.length ? { x: -labelW / 2, y: r - LABEL_FOOT - 10, w: labelW, h: 13 } : null;
  const slots = parts.map((i) => slotsFor(nodes[i], r, label));
  // A part most of the wires run to (a Worker that every store and service hangs off) is the hub: it stays near
  // the middle, so its wires run out like spokes rather than across the circle.
  const degree = parts.map((i) => wires.filter((w) => w.a === i || w.b === i).length);
  const hub = degree.indexOf(Math.max(0, ...degree));
  if (hub >= 0 && degree[hub] >= 5 && degree[hub] >= 0.4 * wires.length) {
    const near = slots[hub].filter(([x, y]) => Math.hypot(x, y) <= 0.3 * r);
    if (near.length) slots[hub] = near;
  }
  const rand = random(nodes.length * 7919 + wires.length * 104729 + seed);

  const cost = coster(nodes, wires, r, label);
  const order = firstOrder(nodes, wires, rim);
  let seq = [...order];
  let top = Math.ceil(rim.length / 2);
  let current = 0;
  /** Each part over every place it may take, then the rim's order, until nothing improves. @param {number} rounds @param {boolean} withRim */
  const descend = (rounds, withRim) => {
    placeRim(nodes, seq, top, r, halfW);
    cost.refreshAll();
    current = cost.total();
    for (let round = 0; round < rounds; round++) {
      let improved = false;
      for (const [pi, i] of parts.entries()) {
        const keep = [nodes[i].x, nodes[i].y];
        let pick = keep;
        const before = cost.partial(i);
        let bestDelta = -1e-6;
        // Every other place first, then every place near the best of those and near where it is.
        const around = (/** @type {number[]} */ p, /** @type {number[]} */ c) => Math.abs(p[0] - c[0]) <= 2 * GRID && Math.abs(p[1] - c[1]) <= 2 * GRID;
        for (const pass of [0, 1]) {
          const centre = pick;
          for (const p of slots[pi]) {
            const coarse = (p[0] / GRID) % 2 === 0 && (p[1] / GRID) % 2 === 0;
            if (pass === 0 ? !coarse : coarse || (!around(p, centre) && !around(p, keep))) continue;
            nodes[i].x = p[0];
            nodes[i].y = p[1];
            cost.refresh(i);
            const delta = cost.partial(i) - before;
            if (delta < bestDelta) {
              bestDelta = delta;
              pick = p;
            }
          }
        }
        nodes[i].x = pick[0];
        nodes[i].y = pick[1];
        cost.refresh(i);
        if (pick !== keep) {
          current += bestDelta;
          improved = true;
        }
      }
      if (withRim) {
        // Then the rim: any two swapped, or one more or fewer above the circle.
        const tryRim = (/** @type {number[]} */ next, /** @type {number} */ nextTop) => {
          placeRim(nodes, next, nextTop, r, halfW);
          cost.refreshAll();
          const c = cost.total();
          if (c < current - 1e-6) {
            current = c;
            seq = next;
            top = nextTop;
            improved = true;
          }
        };
        // The order the parts ask for: each round the circle toward what it wires to (barycentric), its count above.
        const want = seq.map((i) => {
          let tx = 0;
          let ty = 0;
          for (const w of wires) {
            const o = w.a === i ? w.b : w.b === i ? w.a : null;
            if (o === null || o === CIRCLE) continue;
            tx += nodes[o].x - nodes[i].x * 0.25;
            ty += nodes[o].y - nodes[i].y * 0.25;
          }
          return { i, ang: tx || ty ? Math.atan2(ty, tx) : Math.atan2(nodes[i].y, nodes[i].x) };
        });
        want.sort((p, q) => p.ang - q.ang);
        tryRim(
          want.map((w) => w.i),
          Math.max(1, Math.min(seq.length - 1, want.filter((w) => w.ang < 0).length)),
        );
        for (let a = 0; a < seq.length; a++) {
          for (let b = a + 1; b < seq.length; b++) {
            const next = [...seq];
            [next[a], next[b]] = [next[b], next[a]];
            tryRim(next, top);
          }
        }
        for (const t of [top - 1, top + 1]) if (t >= 0 && t <= seq.length) tryRim([...seq], t);
        placeRim(nodes, seq, top, r, halfW);
        cost.refreshAll();
        current = cost.total();
      }
      if (!improved) break;
    }
  };
  /** @type {{ cost: number, at: number[][], seq: number[], top: number } | null} */
  let best = null;
  const keepBest = () => {
    if (!best || current < best.cost - 1e-6) best = { cost: current, at: nodes.map((n) => [n.x, n.y]), seq: [...seq], top };
  };
  /**
   * Annealing from where the search stands: a part moved, near or anywhere, or one of the rim moved to another
   * place in its order, each kept when it costs less, or sometimes when it costs a little more while the
   * temperature is high, so the search climbs out of a drawing no single move improves (simulated annealing,
   * from a fixed seed). The best drawing seen is kept.
   */
  const slotAt = slots.map((list) => new Map(list.map((p) => [`${p[0]} ${p[1]}`, p])));
  const anneal = () => {
    for (let step = 0; step < ANNEAL_STEPS; step++) {
      const temp = 3e4 * Math.pow(1e-4, step / ANNEAL_STEPS);
      if (seq.length > 1 && rand() < 0.12) {
        const from = Math.floor(rand() * seq.length);
        const to = Math.floor(rand() * seq.length);
        if (from === to) continue;
        const next = [...seq];
        if (rand() < 0.5) [next[from], next[to]] = [next[to], next[from]];
        else next.splice(to, 0, ...next.splice(from, 1));
        const nextTop = rand() < 0.2 ? Math.max(0, Math.min(seq.length, top + (rand() < 0.5 ? -1 : 1))) : top;
        placeRim(nodes, next, nextTop, r, halfW);
        cost.refreshAll();
        const c2 = cost.total();
        if (c2 < current || rand() < Math.exp((current - c2) / temp)) {
          current = c2;
          seq = next;
          top = nextTop;
        } else {
          placeRim(nodes, seq, top, r, halfW);
          cost.refreshAll();
        }
      } else {
        const pi = Math.floor(rand() * parts.length);
        const i = parts[pi];
        const list = slots[pi];
        const keep = [nodes[i].x, nodes[i].y];
        const before = cost.partial(i);
        let p;
        if (rand() < 0.5) p = list[Math.floor(rand() * list.length)];
        else {
          p = slotAt[pi].get(`${keep[0] + GRID * (Math.floor(rand() * 7) - 3)} ${keep[1] + GRID * (Math.floor(rand() * 7) - 3)}`);
        }
        if (!p) continue;
        nodes[i].x = p[0];
        nodes[i].y = p[1];
        cost.refresh(i);
        const delta = cost.partial(i) - before;
        if (delta < 0 || rand() < Math.exp(-delta / temp)) current += delta;
        else {
          nodes[i].x = keep[0];
          nodes[i].y = keep[1];
          cost.refresh(i);
        }
      }
      keepBest();
    }
  };
  // From each start: the rim's first order turned round by a quarter at a time, the parts placed toward it,
  // settled; annealed while a fault is left; settled again.
  const turns = rim.length > 1 ? [0, 0.25, 0.5, 0.75].map((f) => Math.round(f * rim.length)).filter((t, i, a) => a.indexOf(t) === i) : [0];
  for (const turn of turns) {
    seq = [...order.slice(turn), ...order.slice(0, turn)];
    top = Math.ceil(rim.length / 2);
    placeRim(nodes, seq, top, r, halfW);
    firstPlaces(nodes, wires, parts, slots, r, rand);
    descend(8, true);
    keepBest();
    if (current < CROSSING) break;
    if (!parts.length) continue;
    anneal();
    const c = /** @type {{ cost: number, at: number[][], seq: number[], top: number }} */ (/** @type {unknown} */ (best));
    nodes.forEach((n, i) => {
      n.x = c.at[i][0];
      n.y = c.at[i][1];
    });
    seq = [...c.seq];
    top = c.top;
    descend(8, true);
    keepBest();
    if (/** @type {{ cost: number }} */ (/** @type {unknown} */ (best)).cost < CROSSING) break;
  }
  const done = /** @type {{ cost: number, at: number[][], seq: number[], top: number }} */ (/** @type {unknown} */ (best));
  placeRim(nodes, done.seq, done.top, r, halfW);
  nodes.forEach((n, i) => {
    n.x = done.at[i][0];
    n.y = done.at[i][1];
  });
  cost.refreshAll();
  const routes = bendWires(nodes, wires, r, label);
  // The drawing: the shell's width, and as tall as the rim reaches.
  let above = -r - MARGIN;
  let below = r + MARGIN;
  for (const n of nodes) {
    above = Math.min(above, n.y - n.h / 2 - MARGIN);
    below = Math.max(below, n.y + n.h / 2 + MARGIN);
  }
  const faults = Math.floor(done.cost / CROSSING);
  return { name, r, label, nodes, wires: wires.map((w, k) => ({ ...w, ...routes[k] })), top: f1(above), bottom: f1(below), width, faults, cost: done.cost };
}

// ---------------------------------------------------------------------------------------------------------------
// The markup.

/**
 * Text inside the circle of a system with no parts drawn: its summary, wrapped to the circle.
 * @param {string} text @param {number} r
 */
function wrapText(text, r) {
  const max = 1.5 * r;
  const words = text.split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, RIM_SIZE) > max) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

/**
 * One system's inside layer, in Capsomer's classes, so its stylesheet draws it and, for the core, its controller
 * plays the flows over it: each part a `.cap-system-map-box`, what is outside it the same with data-external, each
 * wire a `.cap-system-map-wire` carrying the ids of its two ends and its route. Another system on the rim is a
 * `.systems-rim` carrying data-goto, which the site's script turns into a tap that zooms there.
 * @param {Layout} l
 * @param {{ id: string, summary: string, token?: boolean, viewBox: number[] }} o
 */
function insideLayerSvg(l, o) {
  const [vx, vy, vw, vh] = o.viewBox;
  const wires = l.wires
    .map((w) => {
      const route = w.pts.map(([x, y]) => `${x},${y}`).join(" ");
      return `<path class="cap-system-map-wire" data-from="${esc(w.from)}" data-to="${esc(w.to)}"${w.loose ? " data-loose" : ""}${w.a === CIRCLE ? " data-whole" : ""} data-route="${route}" d="${w.d}"/>`;
    })
    .join("");
  const boxes = l.nodes
    .map((n) => {
      const x = f1(n.x - n.w / 2);
      const y = f1(n.y - n.h / 2);
      if (n.role === "system") {
        const sys = n.id.slice("system:".length);
        return `<g class="systems-rim" data-goto="${esc(sys)}"${n.private ? " data-private" : ""}><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}"/><text class="systems-rim-name" x="${n.x}" y="${f1(n.y + 4)}">${esc(n.name)}</text></g>`;
      }
      if (n.role === "outside") {
        return `<g class="cap-system-map-box" data-id="${esc(n.id)}" data-x="${n.x}" data-y="${n.y}" data-external><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="4"/><text class="cap-system-map-box-name" x="${n.x}" y="${f1(n.y + 4)}">${esc(n.name)}</text></g>`;
      }
      const names = n.lines.map((line, i) => `<text class="cap-system-map-box-name" x="${n.x}" y="${f1(y + 16 + i * LINE_H)}">${esc(line)}</text>`).join("");
      return `<g class="cap-system-map-box" data-id="${esc(n.id)}" data-x="${n.x}" data-y="${n.y}"${n.store ? " data-store" : ""}><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.store ? 12 : 5}"/>${names}<text class="cap-system-map-box-kind" x="${n.x}" y="${f1(y + n.h - 8)}">${esc(n.sub)}</text></g>`;
    })
    .join("");
  const parts = l.nodes.some((n) => n.role === "part");
  const middle = parts
    ? `<text class="cap-system-map-inside-title" x="0" y="${f1(l.r - LABEL_FOOT)}">${esc(l.name)}</text>`
    : (() => {
        const lines = wrapText(o.summary, l.r);
        const top = -((lines.length - 1) * 14) / 2 + 8;
        return `<text class="systems-inside-name" x="0" y="${f1(top - 16)}">${esc(l.name)}</text>${lines.map((t, i) => `<text class="systems-inside-text" x="0" y="${f1(top + 4 + i * 14)}">${esc(t)}</text>`).join("")}`;
      })();
  const token = o.token ? `<circle class="cap-system-map-token" r="6" cx="0" cy="0"/>` : "";
  return `<svg class="cap-system-map-layer" data-layer="inside" data-system="${esc(o.id)}" viewBox="${vx} ${vy} ${vw} ${vh}" aria-hidden="true" focusable="false"><circle class="cap-system-map-boundary" cx="0" cy="0" r="${l.r}"/>${middle}${wires}${boxes}${token}</svg>`;
}

/**
 * What a laid-out circle gets wrong, in words: boxes too close, a wire under a box it does not end at or under
 * the name, and two wires crossing. The tests hold the committed model's drawings to it.
 * @param {Layout} l
 */
export function faultsOf(l) {
  const out = [];
  const { nodes, wires } = l;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2) out.push(`${a.id} touches ${b.id}`);
    }
  }
  const name = (/** @type {Wire} */ w) => `${w.from}-${w.to}`;
  const segsOf = (/** @type {{ pts: number[][] }} */ w) => w.pts.slice(1).map((q, i) => [...w.pts[i], ...q]);
  for (const [k, w] of wires.entries()) {
    const mine = segsOf(w);
    for (const [m, n] of nodes.entries()) {
      if (m !== w.a && m !== w.b && mine.some(([px, py, qx, qy]) => segmentHitsRect(px, py, qx, qy, rectOf(n)))) out.push(`${name(w)} runs under ${n.id}`);
    }
    if (l.label && mine.some(([px, py, qx, qy]) => segmentHitsRect(px, py, qx, qy, /** @type {{ x: number, y: number, w: number, h: number }} */ (l.label)))) out.push(`${name(w)} runs under the name`);
    for (const v of wires.slice(k + 1)) {
      const shares = w.a === v.a || w.a === v.b || w.b === v.a || w.b === v.b;
      if (!shares && mine.some((s) => segsOf(v).some((t) => segmentsCross(s, t)))) out.push(`${name(w)} crosses ${name(v)}`);
    }
  }
  return out;
}

/**
 * Every system's inside layer, as markup, by id: laid out at the shell's width, each at least the shell's
 * height for that width, so zooming into a small system leaves the stage its size. The core's carries Capsomer's
 * token when it has flows to play. Run at build time (scripts/lib/system-insides-plugin.mjs): the search takes
 * seconds, and a Worker should not.
 * @param {SystemModel} model
 * @param {(s: SystemModel["systems"][number]) => string} summaryOf what a circle with no parts says
 * @param {ReturnType<typeof import("../../app/lib/systems.mjs").mapData>} data what the map draws, for the flows it can play
 * @returns {Record<string, string>}
 */
export function insideLayers(model, summaryOf, data) {
  const shell = layoutMap(data.systems).viewBox;
  const core = data.systems.find((s) => s.ring === "core");
  const flows = playableFlows(data, core).length > 0;
  /** @type {Record<string, string>} */
  const out = {};
  for (const s of model.systems) {
    const l = layoutScene(sceneOf(model, s.id), shell[2]);
    // Never shorter, for its width, than the shell, so the stage does not shrink when a small system is chosen.
    const minH = (l.width * shell[3]) / shell[2];
    const pad = Math.max(0, minH - (l.bottom - l.top)) / 2;
    const viewBox = [f1(-l.width / 2), f1(l.top - pad), l.width, f1(l.bottom - l.top + 2 * pad)];
    out[s.id] = insideLayerSvg(l, { id: s.id, summary: summaryOf(s), token: flows && s.id === core?.id, viewBox });
  }
  return out;
}
