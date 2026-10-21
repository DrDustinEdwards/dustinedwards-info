import { BOX_GAP, CENTRE_PULL, CIRCLE, CLEAR, CROSSING, FAN, FILL, GRID, IN_PAD, MARGIN, MIN_FAN_DEG, OVERLAP, RIM_GAP, RIM_H, ROW_GAP, UNDER_BOX, exitPoint, f1, grow, hitsBox, segmentHitsRect, segmentOf, segmentsCross } from "./system-layout-geometry.mjs";
/** @typedef {import("./system-layout-geometry.mjs").Node} Node */
/** @typedef {import("./system-layout-geometry.mjs").Wire} Wire */

// How a circle's places are searched for (system-layout.mjs): the rim, the cost of a drawing, the first places
// and the bent wires. layoutAt in system-layout.mjs runs the search.

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
export function placeRim(nodes, seq, top, r, halfW) {
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
export function coster(nodes, wires, r, label) {
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
export function radiusFor(parts) {
  if (!parts.length) return 104;
  const area = parts.reduce((s, b) => s + (b.w + BOX_GAP) * (b.h + BOX_GAP), 0);
  return Math.max(parts.length > 2 ? 118 : 96, Math.sqrt(area / (FILL * Math.PI)) + IN_PAD);
}

/**
 * Every place a part may sit: on the grid, wholly inside the circle and clear of its name.
 * @param {Node} b @param {number} r @param {{ x: number, y: number, w: number, h: number } | null} label
 */
export function slotsFor(b, r, label) {
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
export function firstOrder(nodes, wires, rim) {
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
export function firstPlaces(nodes, wires, parts, slots, r, rand) {
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
export function bendWires(nodes, wires, r, label) {
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
