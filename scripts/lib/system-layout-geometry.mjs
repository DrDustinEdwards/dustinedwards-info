// The shapes and sizes the inside views are drawn from (system-layout.mjs): the drawing's units, the box and text
// estimates, and the segment and rectangle tests the search scores with.

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

export const LOOSE_KINDS = new Set(["coordinates", "watches"]);
export const STORE_KINDS = new Set(["database", "bucket", "kv", "queue"]);
export const EXTERNAL = "external";
/** The circle's own end of a line between two systems as wholes. */
export const CIRCLE = -1;

// Sizes, in the shell's drawing units (a 390 px phone draws a unit at about 0.94 px).
export const NAME_SIZE = 11.5;
export const KIND_SIZE = 9;
export const RIM_SIZE = 11;
export const LINE_H = 13;
export const BOX_PAD_X = 8;
/** A part's name wider than this wraps onto a second line, at a hyphen or a space. */
const MAX_LINE = 96;
export const MIN_BOX_W = 58;
export const RIM_H = 24;
export const RIM_PAD_X = 10;
export const MARGIN = 12;
/** Every rim box keeps this far outside the circle, and every part this far inside it. */
export const RIM_GAP = 12;
export const IN_PAD = 10;
/** Two boxes keep this far apart. */
export const BOX_GAP = 10;
/** Between rows of the rim. */
export const ROW_GAP = 8;
/** A wire keeps this far from every box but its two ends. */
export const CLEAR = 5;
export const GRID = 10;
/** The name at the circle's foot. */
export const LABEL_SIZE = 10;
export const LABEL_FOOT = 14;

// What a drawing costs. A fault costs more than any drawing without one, so a fault is kept only when every
// placement tried has one.
export const OVERLAP = 1e6;
export const UNDER_BOX = 1e5;
export const CROSSING = 1e4;
export const FAN = 600;
export const MIN_FAN_DEG = 16;
/** A part with nothing pulling it drifts to the middle: this much per unit from the centre. */
export const CENTRE_PULL = 0.4;
/** The share of the circle's area its boxes and their gaps take, at most. */
export const FILL = 0.45;
/** How many moves the annealing tries on a drawing with a fault. */
export const ANNEAL_STEPS = 12000;
/** How many seeds the search runs from, at most. */
export const SEEDS = 3;

export const f1 = (/** @type {number} */ n) => Math.round(n * 10) / 10;
export const esc = (/** @type {string} */ s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A text's width, estimated from its letters: the drawing is made on the server, with no font to measure, so
 * each class of letter gets its share of an em, a little over the UI face's, so a box is never too narrow.
 * @param {string} s @param {number} size
 */
export function textWidth(s, size) {
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
export function wrapName(name) {
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


// ---------------------------------------------------------------------------------------------------------------
// Geometry.

/** @param {Node} n */
export const rectOf = (n) => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h });
/** @param {{ x: number, y: number, w: number, h: number }} r @param {number} g */
export const grow = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });

/**
 * Whether segment p-q passes through the rectangle's inside (a touch is not a hit).
 * @param {number} px @param {number} py @param {number} qx @param {number} qy @param {{ x: number, y: number, w: number, h: number }} r
 */
export function segmentHitsRect(px, py, qx, qy, r) {
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
export function hitsBox(s, n, g) {
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
export function segmentsCross(s, t) {
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
export function exitPoint(n, tx, ty) {
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
export function segmentOf(w, nodes, r) {
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
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
