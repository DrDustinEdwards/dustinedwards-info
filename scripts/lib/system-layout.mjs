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
// A private system is drawn like any other: its parts inside, its links around the rim.
//
// The places are searched for, from fixed starts, so the same model always draws the same way: each part over a
// grid inside the circle, the rim's order around it, until no wire crosses another or runs under a box it does
// not end at, and then the shortest wires. The drawing is the shell's width, so a unit is the same size as on the
// map, and as tall as it needs.
import { layoutMap, playableFlows } from "capsomer/behaviour/system-map";
import { ANNEAL_STEPS, BOX_PAD_X, CIRCLE, CROSSING, EXTERNAL, GRID, KIND_SIZE, LABEL_FOOT, LABEL_SIZE, LINE_H, LOOSE_KINDS, MARGIN, MIN_BOX_W, NAME_SIZE, OVERLAP, RIM_H, RIM_PAD_X, RIM_SIZE, SEEDS, STORE_KINDS, esc, f1, random, rectOf, segmentHitsRect, segmentsCross, textWidth, wrapName } from "./system-layout-geometry.mjs";
import { bendWires, coster, firstOrder, firstPlaces, placeRim, radiusFor, slotsFor } from "./system-layout-search.mjs";
/** @typedef {import("./system-layout-geometry.mjs").SystemModel} SystemModel */
/** @typedef {import("./system-layout-geometry.mjs").Node} Node */
/** @typedef {import("./system-layout-geometry.mjs").Wire} Wire */
/** @typedef {import("./system-layout-geometry.mjs").Layout} Layout */

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
