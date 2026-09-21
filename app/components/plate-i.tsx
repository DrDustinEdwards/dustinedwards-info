/**
 * Plate I: one drawn lawn carrying one specimen of every plaque morphology a phage hunter has to
 * learn to call, labelled i to vi on leaders out to the rim, with a 1 cm scale bar.
 *
 * THE SIX ROWS BELOW ARE THE FIGURE'S SOURCE. The drawing is generated from them, so changing the
 * taxonomy is changing rows rather than redrawing: add a seventh and a seventh specimen appears in
 * the plate, in the key strip, and in the described alt text. The handoff asks for exactly that.
 *
 * FLAT LINE WORK, ruling 124. Outline, hairlines and stipple. No gradient, no field, no shadowed
 * rim, and no lamp: a lit diagram is a diagram pretending to be a photograph, and a plate shows
 * what is measurable rather than what a camera sees.
 *
 * COLOUR, ruling 122. Plaque outlines and the dish rim are `--text`; the lawn stipple, the halo
 * ring and the dashed inner margin are `--fig-dust-300`, which is texture and never a series;
 * leaders and labels are oxide, which is what annotation is for. `--brand` appears nowhere: purple
 * means a reader can click it and nothing in a drawing is clickable.
 *
 * `--plate-annotation` is a LOCAL alias, not a new token. Oxide needs a different ramp step per
 * theme to hold its measured pair (5.5:1 light on `--fig-oxide-400`, 5.4:1 dark on
 * `--fig-oxide-300`), and a component-scoped variable is how this repo swaps a step per theme
 * without inventing a global name. home.css declares it.
 *
 * NOT DATA. It does not change with the corpus: it is a teaching drawing of six morphologies, and
 * the only numbers on the page that move are in the evidence row and the two figures below it.
 */

/** A drawn specimen. Geometry is the handoff's, coordinate for coordinate. */
type Plaque = {
  /** The roman label, which is also its order in the key. */
  label: string;
  name: string;
  /** One sentence, which the key strip prints as real text beside the drawing. */
  reading: string;
  /** Centre and radius on the 500 unit dish. */
  cx: number;
  cy: number;
  r: number;
  /** The leader's elbow and its horizontal run out to the label. */
  elbow: [number, number];
  tick: [number, number];
  anchor: "start" | "end";
  /** A clear centre inside a turbid plaque. */
  innerR?: number;
  /** A diffuse ring beyond the plaque, drawn dashed because it has no edge. */
  haloR?: number;
  /** The lawn survives inside this plaque, so stipple is kept rather than cleared. */
  lawnInside?: boolean;
  /** No boundary at all: drawn as a dashed irregular outline rather than a circle. */
  outline?: string;
};

export const PLAQUES: Plaque[] = [
  {
    label: "i",
    name: "Clear",
    reading:
      "Complete lysis edge to edge, a lytic infection with no lawn surviving inside the boundary.",
    cx: 334.3,
    cy: 179.3,
    r: 31.3,
    elbow: [458.4, 75.2],
    tick: [482.4, 75.2],
    anchor: "start",
  },
  {
    label: "ii",
    name: "Turbid",
    reading:
      "Lawn survives within the plaque. The signature of a temperate phage lysogenising as it spreads.",
    cx: 311.6,
    cy: 328.8,
    r: 28.8,
    elbow: [417.5, 464.3],
    tick: [441.5, 464.3],
    anchor: "start",
    lawnInside: true,
  },
  {
    label: "iii",
    name: "Bullseye",
    reading:
      "A clear centre inside a turbid ring: two behaviours in one plaque, read from the middle out.",
    cx: 227,
    cy: 86.6,
    r: 30,
    innerR: 13.5,
    elbow: [212.1, -19.4],
    tick: [188.1, -19.4],
    anchor: "end",
    lawnInside: true,
  },
  {
    label: "iv",
    name: "Halo",
    reading:
      "A defined plaque with a diffuse ring beyond it, from a depolymerase moving ahead of the phage.",
    cx: 399.2,
    cy: 265.7,
    r: 23.8,
    haloR: 41.6,
    elbow: [520.5, 278.4],
    tick: [544.5, 278.4],
    anchor: "start",
  },
  {
    label: "v",
    name: "Pinpoint",
    reading:
      "Under a millimetre. Slow adsorption or a poor host match, and easy to miss on a crowded plate.",
    cx: 159.7,
    cy: 343.5,
    r: 8.5,
    elbow: [61.1, 445.7],
    tick: [37.1, 445.7],
    anchor: "end",
  },
  {
    label: "vi",
    name: "Diffuse edge",
    reading:
      "No defined boundary: the plaque fades into lawn instead of stopping at one.",
    cx: 243.9,
    cy: 424.9,
    r: 30,
    elbow: [240.5, 521.8],
    tick: [216.5, 521.8],
    anchor: "end",
    outline:
      "M272.8 424.9L276.2 430.0L267.8 432.7L266.9 436.6L270.4 444.2L263.2 444.2L257.4 443.5L258.7 453.9L253.6 454.8L247.5 447.5L243.9 454.2L238.7 457.5L236.1 448.8L232.0 448.3L223.8 452.6L224.6 444.2L225.1 438.6L215.8 439.2L215.4 434.1L220.7 428.6L213.9 424.9L212.3 419.9L220.4 417.2L220.5 413.0L217.2 405.5L225.1 406.1L229.5 405.1L229.4 396.5L234.8 397.0L240.3 402.2L243.9 393.4L248.8 394.1L251.4 401.9L256.4 400.3L263.4 398.0L262.1 406.6L264.0 410.3L273.4 409.9L271.4 416.0L266.9 421.3L275.5 424.9Z",
  },
];

/**
 * THE VIEWBOX IS WIDER THAN THE DISH, and that is a correction to the handoff rather than a
 * departure from it. Its SVG is 500 by 500 while three of the six labels sit outside that box
 * (`iii` at y -19, `iv` at x 549, `vi` at y 525), so the drawing clips its own key at the frame.
 * The dish geometry is unchanged; the frame grew to hold what the leaders point at.
 */
const VIEW = { x: -78, y: -40, w: 700, h: 590 };

const DISH_R = 246;
const MARGIN_R = 235;

/**
 * Deterministic stipple. A seeded generator rather than 570 hand-placed dots: the coordinates
 * carry no information, only texture, and the same seed gives the same bytes on every render,
 * which is what keeps a cached page and a fresh render byte-identical.
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

/** Where the lawn has been eaten away, no stipple is drawn. That IS the plaque. */
function clearedBy(x: number, y: number): boolean {
  for (const p of PLAQUES) {
    const d = Math.hypot(x - p.cx, y - p.cy);
    if (p.lawnInside) {
      /* Turbid and the bullseye ring keep their lawn; only a bullseye's clear centre is empty. */
      if (p.innerR !== undefined && d < p.innerR) return true;
      continue;
    }
    if (d < p.r) return true;
  }
  return false;
}

function lawn(): { x: number; y: number; r: number }[] {
  const rand = mulberry32(0x5ea1ed);
  const dots: { x: number; y: number; r: number }[] = [];
  /* Rejection sampling inside the dashed margin, so no dot sits on the rim or outside it. */
  for (let i = 0; i < 4200 && dots.length < 560; i += 1) {
    const t = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * (MARGIN_R - 6);
    const x = 250 + Math.cos(t) * rr;
    const y = 250 + Math.sin(t) * rr;
    if (clearedBy(x, y)) continue;
    dots.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round((0.8 + rand() * 0.6) * 10) / 10 });
  }
  return dots;
}

/**
 * The surviving lawn inside a turbid plaque, and inside a bullseye's outer ring.
 *
 * THIS IS THE PLATE'S WHOLE CLAIM, so it is drawn rather than left to the lawn's own density. The
 * handoff fills turbid with `--paper` exactly as it fills clear, which makes i and ii identical on
 * a plate whose caption says it shows every plaque a phage hunter has to learn to call; the
 * difference survives only in the small key beneath. Lawn at the ambient density would not fix it
 * either: a 28.8 unit plaque holds about nine dots at that rate, which reads as empty.
 *
 * So a turbid plaque carries its own haze, denser than the lawn around it. That is also what the
 * thing looks like down a scope: survivors inside the boundary, not a clearing.
 */
function haze(): { x: number; y: number; r: number }[] {
  const rand = mulberry32(0x7b1d);
  const dots: { x: number; y: number; r: number }[] = [];
  for (const p of PLAQUES) {
    if (!p.lawnInside) continue;
    const inner = p.innerR ?? 0;
    /* Per unit of surviving area, about thirteen times the lawn's rate, which is what reads. */
    const target = Math.round((p.r * p.r - inner * inner) * 0.045);
    let placed = 0;
    for (let i = 0; i < target * 20 && placed < target; i += 1) {
      const t = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * (p.r - 2);
      if (rr < inner + 1.5) continue;
      dots.push({
        x: Math.round((p.cx + Math.cos(t) * rr) * 10) / 10,
        y: Math.round((p.cy + Math.sin(t) * rr) * 10) / 10,
        r: Math.round((0.7 + rand() * 0.5) * 10) / 10,
      });
      placed += 1;
    }
  }
  return dots;
}

/** The alt text carries the key in words, in label order, because the figure is information. */
const LABELS = PLAQUES.map((p) => p.label);
const DESCRIPTION =
  `Plaque assay drawn as a key: one specimen of each plaque morphology on a single lawn, ` +
  PLAQUES.map((p) => p.name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1") +
  `, each labelled ${LABELS.at(0) ?? ""} to ${LABELS.at(-1) ?? ""} on a leader.`;

export function PlateI() {
  const dots = lawn();
  const survivors = haze();
  return (
    <svg
      className="plate"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-labelledby="plate-i-title plate-i-desc"
    >
      <title id="plate-i-title">Plate I. Plaque morphology drawn as a key.</title>
      <desc id="plate-i-desc">{DESCRIPTION}</desc>

      <circle cx="250" cy="250" r={DISH_R} fill="none" stroke="var(--text)" strokeWidth="1.6" />
      <circle
        cx="250"
        cy="250"
        r={MARGIN_R}
        fill="none"
        stroke="var(--fig-dust-300)"
        strokeDasharray="2 6"
      />

      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="var(--fig-dust-300)" />
      ))}

      {/* Drawn after the lawn and before the outlines, so the haze sits inside its own plaque. */}
      {survivors.map((d, i) => (
        <circle key={`h${i}`} cx={d.x} cy={d.y} r={d.r} fill="var(--fig-dust-300)" />
      ))}

      {PLAQUES.map((p) => (
        <g key={p.label}>
          {p.haloR !== undefined ? (
            <circle
              cx={p.cx}
              cy={p.cy}
              r={p.haloR}
              fill="none"
              stroke="var(--fig-dust-300)"
              strokeDasharray="3 4"
            />
          ) : null}
          {p.outline ? (
            <path
              d={p.outline}
              fill="var(--paper)"
              stroke="var(--text)"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
          ) : (
            <circle
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={p.lawnInside ? "none" : "var(--paper)"}
              stroke="var(--text)"
              strokeWidth="1.4"
            />
          )}
          {p.innerR !== undefined ? (
            <circle
              cx={p.cx}
              cy={p.cy}
              r={p.innerR}
              fill="var(--paper)"
              stroke="var(--text)"
              strokeWidth="1.1"
            />
          ) : null}
          <line
            x1={p.cx}
            y1={p.cy}
            x2={p.elbow[0]}
            y2={p.elbow[1]}
            stroke="var(--plate-annotation)"
            strokeWidth="1"
          />
          <line
            x1={p.elbow[0]}
            y1={p.elbow[1]}
            x2={p.tick[0]}
            y2={p.tick[1]}
            stroke="var(--plate-annotation)"
            strokeWidth="1"
          />
          <text
            className="plate-label"
            x={p.anchor === "start" ? p.tick[0] + 5 : p.tick[0] - 5}
            y={p.tick[1] + 4}
            textAnchor={p.anchor}
          >
            {p.label} · {p.name.toLowerCase()}
          </text>
        </g>
      ))}

      {/* The scale bar. A plate without one is a picture rather than a measurement. */}
      <line x1="16" y1="486" x2="86" y2="486" stroke="var(--text)" strokeWidth="1.5" />
      <text className="plate-scale" x="16" y="478">
        1 cm
      </text>
    </svg>
  );
}

/**
 * The key strip: the six drawn again small, each with its name and sentence as REAL TEXT, so a
 * reader who cannot see the drawing still gets the taxonomy rather than a description of a picture.
 */
export function PlateKey() {
  return (
    <ul className="plate-key" aria-label="Plaque morphology">
      {PLAQUES.map((p) => (
        <li key={p.label} className="plate-key-item">
          <svg className="plate-key-mark" viewBox="0 0 76 76" role="presentation" focusable="false">
            {p.haloR !== undefined ? (
              <circle
                cx="38"
                cy="38"
                r="32"
                fill="none"
                stroke="var(--fig-dust-300)"
                strokeDasharray="3 4"
              />
            ) : null}
            {p.outline ? (
              <circle
                cx="38"
                cy="38"
                r="28"
                fill="none"
                stroke="var(--text)"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
            ) : (
              <circle
                cx="38"
                cy="38"
                r={p.label === "v" ? 6.6 : p.label === "iv" ? 18.6 : 30}
                fill="none"
                stroke="var(--text)"
                strokeWidth="1.6"
              />
            )}
            {p.innerR !== undefined ? (
              <circle cx="38" cy="38" r="13.5" fill="none" stroke="var(--text)" strokeWidth="1.2" />
            ) : null}
            {p.label === "v" ? (
              <circle
                cx="38"
                cy="38"
                r="30"
                fill="none"
                stroke="var(--fig-dust-300)"
                strokeDasharray="1 5"
              />
            ) : null}
          </svg>
          <p className="plate-key-name">
            <span className="plate-key-label">{p.label}</span> {p.name}
          </p>
          <p className="plate-key-reading">{p.reading}</p>
        </li>
      ))}
    </ul>
  );
}
