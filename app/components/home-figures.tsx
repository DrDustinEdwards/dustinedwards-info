/**
 * The home page's two computed figures. Both are DERIVED: the numbers come from the data files
 * that own them, so neither can drift from the corpus the way a drawn chart would.
 *
 * FLAT LINE WORK, ruling 124. Rules, hairlines and filled cells. No gradient, no field, no lamp.
 * Ruling 122 assigns the ink: oxide is series 1 and every annotation, cadet is series 3, `--dust`
 * rules and nothing else. `--brand` is absent, because purple means a reader can click it.
 *
 * `--fig-ink` and `--fig-cell` are LOCAL aliases rather than new tokens: oxide and cadet
 * each need a different ramp step per theme to hold their measured pairs, and home.css declares
 * both on the figure.
 */

import { PUBLICATIONS } from "~/data/publications";
import { PHAGE_YEARS } from "~/data/phage-hunters";

/* ---------------------------------------------------------------- Figure 1 */

const FIRST_YEAR = 2007;
const LAST_YEAR = 2026;

/** One bin per calendar year, including the empty ones. */
function papersPerYear(): { year: number; count: number }[] {
  const bins = new Map<number, number>();
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y += 1) bins.set(y, 0);
  for (const p of PUBLICATIONS) {
    const y = typeof p.year === "number" ? p.year : Number.NaN;
    if (Number.isFinite(y) && bins.has(y)) bins.set(y, (bins.get(y) ?? 0) + 1);
  }
  return [...bins.entries()].map(([year, count]) => ({ year, count }));
}

/**
 * Papers per year.
 *
 * EVERY YEAR GETS A POSITION, including the five with nothing in them, and that is a correction to
 * the handoff rather than a departure from it. Its chart plots only the fifteen years that have a
 * paper, evenly spaced, so a reader counts fifteen consecutive years and never sees 2009, 2010,
 * 2013, 2016 or 2017. The section's own sentence is that the corpus is UNEVEN on purpose, and an
 * axis that closes the gaps is an axis that hides the thing the sentence is pointing at.
 */
export function FigurePapersPerYear() {
  const bins = papersPerYear();
  const max = Math.max(...bins.map((b) => b.count));
  const W = 460;
  const H = 100;
  const BASE = 74;
  const UNIT = 10.5;
  const step = W / bins.length;
  const x = (i: number) => step * (i + 0.5);

  return (
    <svg
      className="fig"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="fig1-title fig1-desc"
    >
      <title id="fig1-title">Figure 1. Papers per year.</title>
      <desc id="fig1-desc">
        {`Peer-reviewed output by year from ${FIRST_YEAR} to ${LAST_YEAR}, ${PUBLICATIONS.length} papers in all. ` +
          `The tallest year is ${max}, and ${bins.filter((b) => b.count === 0).length} years have none.`}
      </desc>

      {bins.map((b, i) => (
        <line
          key={b.year}
          x1={x(i)}
          y1={BASE}
          x2={x(i)}
          y2={BASE - b.count * UNIT}
          stroke="var(--fig-ink)"
          strokeWidth="6"
        />
      ))}

      {/* The baseline, and the dashed line at six: the year that stands apart is worth a datum. */}
      <line x1="0" y1={BASE + 0.5} x2={W} y2={BASE + 0.5} stroke="var(--dust)" />
      <line
        x1="0"
        y1={BASE - 6 * UNIT + 0.5}
        x2={W}
        y2={BASE - 6 * UNIT + 0.5}
        stroke="var(--dust)"
        strokeDasharray="2 5"
      />

      {bins.map((b, i) =>
        b.year % 5 === 0 || b.year === LAST_YEAR ? (
          <text key={b.year} className="fig-label" x={x(i)} y="94" textAnchor="middle">
            {String(b.year).slice(2)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- Figure 2 */

/**
 * A hexagon centered on (cx, cy), `w` across the flats, drawn slightly inside its cell.
 *
 * THE GAP IS LOAD-BEARING. Packed edge to edge the cells merge into one navy mass and nothing can
 * be counted, which defeats a figure whose whole claim is one cell per researcher. The handoff's
 * own geometry is 26 units wide, which fits 21 of them into 588 against a 460 viewBox, so its
 * widest cohorts run off the frame; the size here is computed from the widest cohort instead.
 */
function hex(cx: number, cy: number, w: number): string {
  const rx = (w / 2) * 0.88;
  const ry = rx * 1.1;
  const q = ry / 2;
  return (
    `M${cx.toFixed(1)} ${(cy - ry).toFixed(1)}` +
    `L${(cx + rx).toFixed(1)} ${(cy - q).toFixed(1)}` +
    `L${(cx + rx).toFixed(1)} ${(cy + q).toFixed(1)}` +
    `L${cx.toFixed(1)} ${(cy + ry).toFixed(1)}` +
    `L${(cx - rx).toFixed(1)} ${(cy + q).toFixed(1)}` +
    `L${(cx - rx).toFixed(1)} ${(cy - q).toFixed(1)}Z`
  );
}

/**
 * One cell per researcher, one row per cohort, newest first.
 *
 * The roster page carries their names; this is the shape of the program, not a substitute for
 * it. Hexagonal packing is the arrangement, not an ornament: it is how cells sit on a plate.
 */
export function FigureRoster() {
  const cohorts = [...PHAGE_YEARS].sort((a, b) => b.year - a.year);
  const total = cohorts.reduce((n, c) => n + c.researchers.length, 0);
  const widest = Math.max(...cohorts.map((c) => c.researchers.length));

  /* Cell width falls out of the widest cohort, so a bigger intake shrinks the cells rather than
     running off the frame. The half-cell offset on alternate rows needs the extra half. */
  const W = 460;
  const LEFT = 44;
  const cell = (W - LEFT - 4) / (widest + 0.5);
  const ROW = cell * 1.0;
  const TOP = cell * 0.8;
  const H = TOP + ROW * (cohorts.length - 1) + cell * 1.1 + 6;

  return (
    <svg
      className="fig"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="fig2-title fig2-desc"
    >
      <title id="fig2-title">Figure 2. The roster, one cell per researcher.</title>
      <desc id="fig2-desc">
        {`${total} undergraduate researchers in ${cohorts.length} cohorts, ` +
          `${cohorts.at(-1)?.year ?? ""} to ${cohorts.at(0)?.year ?? ""}. ` +
          `The largest cohort is ${widest} and the smallest is ${Math.min(...cohorts.map((c) => c.researchers.length))}.`}
      </desc>

      {cohorts.map((cohort, row) => {
        const cy = TOP + row * ROW;
        /* Offset every other row by half a cell, which is what makes the packing hexagonal. */
        const shift = row % 2 === 1 ? cell / 2 : 0;
        return (
          <g key={cohort.year}>
            <text className="fig-label" x={LEFT - 8} y={cy + 3.5} textAnchor="end">
              {cohort.year}
            </text>
            {cohort.researchers.map((_, i) => (
              <path
                key={i}
                d={hex(LEFT + shift + cell / 2 + i * cell, cy, cell)}
                fill="var(--fig-cell)"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
