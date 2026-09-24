// No `--brand` ink in the figures: purple means a reader can click it. `--fig-ink` and
// `--fig-cell` are local aliases, not tokens, because each needs a different ramp step per theme.

import { PUBLICATIONS } from "~/data/publications";
import { PHAGE_YEARS } from "~/data/phage-hunters";

const FIRST_YEAR = 2007;
const LAST_YEAR = 2026;

function papersPerYear(): { year: number; count: number }[] {
  const bins = new Map<number, number>();
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y += 1) bins.set(y, 0);
  for (const p of PUBLICATIONS) {
    const y = typeof p.year === "number" ? p.year : Number.NaN;
    if (Number.isFinite(y) && bins.has(y)) bins.set(y, (bins.get(y) ?? 0) + 1);
  }
  return [...bins.entries()].map(([year, count]) => ({ year, count }));
}

// Every year gets a position, including the empty ones: an axis that closes the gaps hides
// the unevenness the section is pointing at.
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

// The 0.88 inset gap is load-bearing: packed edge to edge the cells merge and cannot be counted.
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

export function FigureRoster() {
  const cohorts = [...PHAGE_YEARS].sort((a, b) => b.year - a.year);
  const total = cohorts.reduce((n, c) => n + c.researchers.length, 0);
  const widest = Math.max(...cohorts.map((c) => c.researchers.length));

  // Cell width falls out of the widest cohort, so a bigger intake shrinks the cells rather than
  // running off the frame. The half-cell offset on alternate rows needs the extra half.
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
