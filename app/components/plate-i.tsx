import { KEY_ICONS, NARROW, WIDE, WIDE_VIEW, type PlateLayout, type Shape } from "./plate-i-geometry";

// CSS shows one of the two drawings; `display: none` removes the other from the accessibility
// tree and the tab order, so a reader meets one plate either way.

/** The six, in numeral order. The drawing, its labels and the row all read from this. */
export const PLAQUES = [
  { id: "i", name: "clear", title: "Clear", note: "Complete lysis; lytic." },
  { id: "ii", name: "turbid", title: "Turbid", note: "Lawn survives inside; temperate." },
  { id: "iii", name: "bullseye", title: "Bullseye", note: "Clear center, turbid ring." },
  { id: "iv", name: "halo", title: "Halo", note: "Turbid ring beyond the edge; depolymerase." },
  { id: "v", name: "pinpoint", title: "Pinpoint", note: "Under 1 mm." },
  { id: "vi", name: "diffuse edge", title: "Diffuse edge", note: "No defined boundary." },
] as const;

/** The numerals in row order: the key's icons are drawn in this order. */
const PLAQUE_IDS: readonly string[] = PLAQUES.map((p) => p.id);

function plaque(id: string) {
  const meta = PLAQUES.find((p) => p.id === id);
  if (!meta) throw new Error(`Plate I: no plaque "${id}" in PLAQUES`);
  return meta;
}

const FILL = { paper: "var(--paper)", lawn: "var(--fig-lawn)", turbid: "var(--fig-turbid)", none: "none" };
const STROKE = { ink: "var(--text)", dust: "var(--fig-dust-300)", none: "none" };

const VIEW = {
  wide: WIDE_VIEW,
  narrow: { x: -14, y: -30, w: 375, h: 364 },
};

const DESCRIPTION =
  "A bacterial lawn in a petri dish with one plaque of each morphology, each on a leader to its " +
  "label: " +
  PLAQUES.map((p) => `${p.id}, ${p.name}`).join("; ") +
  ". A scale bar marks 1 cm.";

function ShapeOf({ s }: { s: Shape }) {
  const paint = {
    fill: FILL[s.fill],
    stroke: STROKE[s.stroke],
    strokeWidth: s.stroke === "none" ? undefined : s.width,
    strokeDasharray: s.dash ?? undefined,
  };
  return s.kind === "circle" ? (
    <circle cx={s.c[0]} cy={s.c[1]} r={s.c[2]} {...paint} />
  ) : (
    <path d={s.d} {...paint} />
  );
}

function Drawing({ layout, variant }: { layout: PlateLayout; variant: "wide" | "narrow" }) {
  const v = VIEW[variant];
  const { cx, cy, rim, lawn } = layout.dish;
  const [sx1, sy1, sx2, sy2] = layout.scale.line;
  return (
    <svg
      className={`plate plate--${variant}`}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      role="group"
      aria-labelledby={`plate-i-title-${variant} plate-i-desc-${variant}`}
    >
      <title id={`plate-i-title-${variant}`}>Plate I. Plaque morphology, drawn.</title>
      <desc id={`plate-i-desc-${variant}`}>{DESCRIPTION}</desc>

      <circle cx={cx} cy={cy} r={rim} fill="var(--paper)" stroke="var(--text)" strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={lawn} fill="var(--fig-lawn)" />

      {layout.plaques.map((p) => {
        const meta = plaque(p.id);
        return (
          <g key={p.id} className="plate-plaque" data-plaque={p.id} role="img" aria-label={`Plaque ${p.id}, ${meta.name}`}>
            {p.shapes.map((s, j) => (
              <ShapeOf key={j} s={s} />
            ))}
          </g>
        );
      })}

      {/* Annotation after every plaque, so no fill is ever drawn over a leader. */}
      {layout.plaques.map((p) => (
        <g key={p.id} className="plate-leader" data-plaque={p.id}>
          {p.leader.map(([x1, y1, x2, y2], j) => (
            <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
          <text x={p.label.x} y={p.label.y} textAnchor={p.label.anchor} className="plate-label" aria-hidden="true">
            {`${p.id} · ${plaque(p.id).name}`}
          </text>
        </g>
      ))}

      <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="var(--text)" strokeWidth="1.5" />
      <text x={layout.scale.label.x} y={layout.scale.label.y} className="plate-scale" aria-hidden="true">
        {layout.scale.label.text}
      </text>
    </svg>
  );
}

export function PlateI() {
  return (
    <>
      <Drawing layout={WIDE} variant="wide" />
      <Drawing layout={NARROW} variant="narrow" />
    </>
  );
}

export function PlateKeyRow() {
  return (
    <section className="plate-key u-wide" aria-label="Plate I key">
      {KEY_ICONS.map((icon, i) => {
        const p = plaque(PLAQUE_IDS[i] ?? "");
        return (
        <figure key={p.id} className="plate-key-entry" data-plaque={p.id}>
          <svg className="plate-key-art" viewBox="0 0 76 76" width="76" height="76" role="img" aria-label={`${p.title} plaque, drawn.`}>
            {icon.map((s, j) => (
              <ShapeOf key={j} s={s} />
            ))}
          </svg>
          <figcaption>
            <span className="plate-key-num">{p.id}</span>
            <b className="plate-key-name">{p.title}</b>
            <span className="plate-key-note">{p.note}</span>
          </figcaption>
        </figure>
        );
      })}
    </section>
  );
}
