/**
 * Plate I: one drawn lawn carrying a specimen of eight plaque morphologies, each called out by a
 * thin oxide circle on a leader to its roman numeral, with a 1 cm scale bar. The caption names and
 * describes the eight; the plate carries numerals only.
 *
 * BOUNDARY: nothing here measures legibility. Whether the three tones separate on a screen is a
 * shot, not an assertion.
 *
 * THREE FLAT VALUES AND NO MORE: the lawn, the paper a clearing shows, and one turbid tone between
 * them. Flat, never lit (ruling 124). Plaques carry no outline; a clearing is a shape of lighter
 * tone on the lawn, which is what one looks like.
 *
 * COLOUR, ruling 122. Lawn and turbidity are dust, texture and never a series; the dish rim is
 * `--text`; callout circles, leaders and numerals are oxide, which is what annotation is for.
 * `--brand` appears nowhere: purple means a reader can click it.
 *
 * `--fig-ink`, `--fig-lawn` and `--fig-turbid` are LOCAL aliases, not new tokens. Each holds a
 * different ramp step per theme, which is how this repo swaps a step without inventing a global
 * name. home.css declares them.
 *
 * NOT DATA. It does not change with the corpus, and it carries no citation: it draws established
 * knowledge (ruling 127).
 */

/** How a specimen is drawn. The row picks one; the renderer owns the geometry. */
type Kind =
  | "clear"
  | "turbid"
  | "bullseye"
  | "turbid-centre"
  | "halo"
  | "sectored"
  | "rough"
  | "pinpoint";

/** A called-out specimen. Polar, because the callouts read as a ring and the leaders radiate. */
type Plaque = {
  /** The roman numeral, which is also its order in the caption. */
  label: string;
  name: string;
  /** The caption's sentence. Stated here so the plate and the caption cannot disagree. */
  reading: string;
  kind: Kind;
  /** Degrees clockwise from the dish's three o'clock, and distance from its center. */
  ang: number;
  rad: number;
  /** Plaque radius. For `halo` this is the inner clearing and `haloR` the diffuse zone. */
  r: number;
  haloR?: number;
};

/**
 * THE EIGHT ARE THE FIGURE'S SOURCE. The drawing, the callouts, the caption and the alt text are
 * generated from these rows, so changing the taxonomy is changing rows rather than redrawing.
 */
export const PLAQUES: Plaque[] = [
  {
    label: "i",
    name: "Clear",
    reading: "Complete lysis, typical of lytic phages.",
    kind: "clear",
    ang: -62,
    rad: 150,
    r: 30,
  },
  {
    label: "ii",
    name: "Turbid",
    reading:
      "A cloudy clearing, often from temperate phages where some cells become lysogens.",
    kind: "turbid",
    ang: -118,
    rad: 150,
    r: 28,
  },
  {
    label: "iii",
    name: "Bull's-eye",
    reading: "A clear center with turbid edges, as lysis slows while the plaque grows.",
    kind: "bullseye",
    ang: -170,
    rad: 145,
    r: 31,
  },
  {
    label: "iv",
    name: "Turbid center",
    reading: "A cloudy middle from microcolonies of the earliest lysogens.",
    kind: "turbid-centre",
    ang: 148,
    rad: 150,
    r: 27,
  },
  {
    label: "v",
    name: "Halo",
    reading: "A semi-transparent zone around the plaque, from diffusing phage enzymes.",
    kind: "halo",
    ang: 100,
    rad: 140,
    r: 24,
    haloR: 36,
  },
  {
    label: "vi",
    name: "Sectored",
    reading: "A clearing with a notched or starred edge.",
    kind: "sectored",
    ang: 52,
    rad: 150,
    r: 29,
  },
  {
    label: "vii",
    name: "Rough border",
    reading: "Small, with an irregular edge.",
    kind: "rough",
    ang: 8,
    rad: 165,
    r: 16,
  },
  {
    label: "viii",
    name: "Pinpoint",
    reading: "Very small.",
    kind: "pinpoint",
    ang: -28,
    rad: 190,
    r: 7,
  },
];

const CX = 250;
const CY = 250;
const DISH_R = 246;

/** The gap the handoff asks for between a plaque's edge and the circle calling it out. */
const CALLOUT_GAP = 11;
/**
 * The inner disc of the bullseye and of the turbid center, as a fraction of the plaque.
 *
 * KEPT WELL UNDER THE HALO'S RATIO. A halo is a plaque with a rim around it and a bullseye is a
 * ring with a small middle; drawn at similar fractions the two read as the same object.
 */
const CORE = 0.42;
/**
 * Where a leader stops and its numeral sits, both measured from the dish center.
 *
 * THE LEADER STOPS AT THE RIM. It is drawn in `--fig-callout`, the step measured against the LAWN,
 * so it never crosses onto a ground it was not measured for; the numeral sits clear of the rim and
 * takes `--fig-ink`, the step measured against paper.
 */
const LEADER_END = DISH_R;
const NUMERAL_AT = 262;

/**
 * The frame is wider than the dish because the numerals sit outside the rim. The dish geometry is
 * the handoff's; the box grew to hold what the leaders point at.
 */
const VIEW = { x: -44, y: -34, w: 596, h: 606 };

/** Degrees to a unit vector out from the dish center. */
function out(ang: number): { x: number; y: number } {
  const t = (ang * Math.PI) / 180;
  return { x: Math.cos(t), y: Math.sin(t) };
}

function centreOf(p: Plaque): { x: number; y: number } {
  const u = out(p.ang);
  return { x: CX + u.x * p.rad, y: CY + u.y * p.rad };
}

/** The circle that calls a specimen out. It clears the halo, not just the plaque. */
function calloutR(p: Plaque): number {
  return (p.haloR ?? p.r) + CALLOUT_GAP;
}

/** One decimal everywhere, so the emitted bytes are stable across renders. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Deterministic scatter and edges. The same seed gives the same bytes on every render, which is
 * what keeps a cached page and a fresh one identical.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A closed polygon through radii sampled around a center. Straight segments: the edge is jagged. */
function blob(cx: number, cy: number, radii: number[]): string {
  const step = (Math.PI * 2) / radii.length;
  return (
    radii
      .map((rr, i) => {
        const t = i * step;
        return `${i === 0 ? "M" : "L"}${r1(cx + Math.cos(t) * rr)} ${r1(cy + Math.sin(t) * rr)}`;
      })
      .join("") + "Z"
  );
}

/**
 * Sectored: eleven notches cut into the edge. No randomness, because the form is regular, and the
 * notches are SHALLOW: cut deeper and it stops reading as a plaque and starts reading as a star.
 */
function sectoredPath(cx: number, cy: number, r: number): string {
  const radii: number[] = [];
  for (let i = 0; i < 22; i += 1) radii.push(i % 2 === 0 ? r : r * 0.79);
  return blob(cx, cy, radii);
}

/** Rough border: twenty sampled radii, none of them equal. */
function roughPath(cx: number, cy: number, r: number): string {
  const rand = mulberry32(0x0c7a11);
  const radii: number[] = [];
  for (let i = 0; i < 20; i += 1) radii.push(r * (0.74 + rand() * 0.26));
  return blob(cx, cy, radii);
}

/** Distance from a point to a segment, used to keep the scatter out from under the leaders. */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

type Scatter = { x: number; y: number; r: number; turbid: boolean };

/**
 * The unlabelled plaques. A plate carries many and only some are worth calling out, so the drawing
 * says so. Rejection sampling keeps them inside the lawn, off each other, and clear of every
 * callout circle and leader, which is what stops the annotation becoming unreadable.
 */
function scatter(): Scatter[] {
  const rand = mulberry32(0x91a7e5);
  const rings = PLAQUES.map((p) => ({ c: centreOf(p), r: calloutR(p) }));
  const leaders = PLAQUES.map((p) => {
    const u = out(p.ang);
    const c = centreOf(p);
    const ring = calloutR(p);
    return {
      ax: c.x + u.x * ring,
      ay: c.y + u.y * ring,
      bx: CX + u.x * DISH_R,
      by: CY + u.y * DISH_R,
    };
  });

  const placed: Scatter[] = [];
  for (let i = 0; i < 4000 && placed.length < 30; i += 1) {
    const t = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 214;
    const x = CX + Math.cos(t) * rr;
    const y = CY + Math.sin(t) * rr;
    const size = 4 + rand() * 17;
    if (rr + size > 228) continue;
    if (rings.some((g) => Math.hypot(x - g.c.x, y - g.c.y) < g.r + size + 7)) continue;
    if (leaders.some((l) => distToSegment(x, y, l.ax, l.ay, l.bx, l.by) < size + 6)) continue;
    if (placed.some((q) => Math.hypot(x - q.x, y - q.y) < q.r + size + 6)) continue;
    placed.push({ x: r1(x), y: r1(y), r: r1(size), turbid: rand() < 0.22 });
  }
  return placed;
}

/** A caption sentence folded into the alt text's running list. */
function lower(sentence: string): string {
  const body = sentence.replace(/\.$/, "");
  return body.charAt(0).toLowerCase() + body.slice(1);
}

/** The alt text carries the key in words, in numeral order, because the figure is information. */
const DESCRIPTION =
  "A bacterial lawn in a petri dish, cleared in many places by phage plaques of varied size. " +
  "Eight are circled and numbered on leaders: " +
  PLAQUES.map((p) => `${p.label}, ${p.name.toLowerCase()}, ${lower(p.reading)}`).join("; ") +
  ". A scale bar marks 1 cm.";

/** One specimen, drawn from its kind. No stroke on any of them: tone alone makes the clearing. */
function Specimen({ p }: { p: Plaque }) {
  const c = centreOf(p);
  const paper = "var(--paper)";
  const turbid = "var(--fig-turbid)";
  const cx = r1(c.x);
  const cy = r1(c.y);
  switch (p.kind) {
    case "turbid":
      return <circle cx={cx} cy={cy} r={p.r} fill={turbid} />;
    case "bullseye":
      return (
        <>
          <circle cx={cx} cy={cy} r={p.r} fill={turbid} />
          <circle cx={cx} cy={cy} r={r1(p.r * CORE)} fill={paper} />
        </>
      );
    case "turbid-centre":
      return (
        <>
          <circle cx={cx} cy={cy} r={p.r} fill={paper} />
          <circle cx={cx} cy={cy} r={r1(p.r * CORE)} fill={turbid} />
        </>
      );
    case "halo":
      return (
        <>
          <circle cx={cx} cy={cy} r={p.haloR} fill={turbid} />
          <circle cx={cx} cy={cy} r={p.r} fill={paper} />
        </>
      );
    case "sectored":
      return <path d={sectoredPath(c.x, c.y, p.r)} fill={paper} />;
    case "rough":
      return <path d={roughPath(c.x, c.y, p.r)} fill={paper} />;
    default:
      return <circle cx={cx} cy={cy} r={p.r} fill={paper} />;
  }
}

/** The circle, the leader and the numeral, all oxide. Only a called-out specimen gets one. */
function Callout({ p }: { p: Plaque }) {
  const c = centreOf(p);
  const u = out(p.ang);
  const ring = calloutR(p);
  /* Anchored away from the dish, so a numeral never sits back over the rim it points away from. */
  const anchor = u.x > 0.3 ? "start" : u.x < -0.3 ? "end" : "middle";
  const nudge = anchor === "start" ? 3 : anchor === "end" ? -3 : 0;
  return (
    <g>
      <circle
        cx={r1(c.x)}
        cy={r1(c.y)}
        r={r1(ring)}
        fill="none"
        stroke="var(--fig-callout)"
        strokeWidth="1"
      />
      <line
        x1={r1(c.x + u.x * ring)}
        y1={r1(c.y + u.y * ring)}
        x2={r1(CX + u.x * LEADER_END)}
        y2={r1(CY + u.y * LEADER_END)}
        stroke="var(--fig-callout)"
        strokeWidth="1"
      />
      <text
        className="plate-label"
        x={r1(CX + u.x * NUMERAL_AT + nudge)}
        y={r1(CY + u.y * NUMERAL_AT + 3.6 + u.y * 5.4)}
        textAnchor={anchor}
      >
        {p.label}
      </text>
    </g>
  );
}

export function PlateI() {
  const unlabelled = scatter();
  return (
    <svg
      className="plate"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-labelledby="plate-i-title plate-i-desc"
    >
      <title id="plate-i-title">Plate I. Plaque morphology drawn as a key.</title>
      <desc id="plate-i-desc">{DESCRIPTION}</desc>

      {/* The lawn is the dish's fill, and the rim is the one ink line on the drawing. */}
      <circle
        cx={CX}
        cy={CY}
        r={DISH_R}
        fill="var(--fig-lawn)"
        stroke="var(--text)"
        strokeWidth="1.6"
      />

      {unlabelled.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.turbid ? "var(--fig-turbid)" : "var(--paper)"}
        />
      ))}

      {PLAQUES.map((p) => (
        <Specimen key={p.label} p={p} />
      ))}

      {/* Annotation last, so no clearing is ever drawn over a leader. */}
      {PLAQUES.map((p) => (
        <Callout key={p.label} p={p} />
      ))}

      {/* The scale bar. A plate without one is a picture rather than a measurement. */}
      <line x1="-36" y1="552" x2="34" y2="552" stroke="var(--text)" strokeWidth="1.5" />
      <text className="plate-scale" x="-36" y="544">
        1 cm
      </text>
    </svg>
  );
}

/**
 * The caption's key: the eight named and described as real text, in the plate's own numeral order,
 * so a reader who cannot see the drawing still gets the taxonomy. It sits inside the figcaption,
 * which is the one place these sentences live.
 */
export function PlateKey() {
  return (
    <ol className="plate-key">
      {PLAQUES.map((p) => (
        <li key={p.label} className="plate-key-item">
          <span className="plate-key-label">{p.label}</span>
          {/* Name and sentence in ONE element: the row is a two-column grid and a bare text node
              beside them would become a third grid item on a row of its own. */}
          <span className="plate-key-text">
            <span className="plate-key-name">{p.name}.</span> {p.reading}
          </span>
        </li>
      ))}
    </ol>
  );
}
