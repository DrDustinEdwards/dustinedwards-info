// No `--brand` ink in the figures: purple means a reader can click it. `--fig-ink` and
// `--fig-cell` are local aliases, not tokens, because each needs a different ramp step per theme.

import { PUBLICATIONS } from "~/data/publications";

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
