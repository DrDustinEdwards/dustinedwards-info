import { AnnotatedDrawing, AnnotatedFigure, AnnotatedKey } from "capsomer/react/annotated-figure";

import {
  KEY_ICONS,
  NARROW,
  WIDE,
  WIDE_VIEW,
  type PlateLayout,
  type Shape,
} from "./plate-i-geometry";

import "capsomer/annotated-figure.css";

// Capsomer's annotated figure (capsomer/annotated-figure.css) shows one of the two drawings by the
// figure's width; `display: none` removes the other from the accessibility tree and the tab order, so a
// reader meets one plate either way.

/** The six, in numeral order. The drawing, its labels and the row all read from this. */
const PLAQUES = [
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

const FILL = {
  paper: "var(--paper)",
  lawn: "var(--fig-lawn)",
  turbid: "var(--fig-turbid)",
  none: "none",
};
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
  const { cx, cy, rim, lawn } = layout.dish;
  const [sx1, sy1, sx2, sy2] = layout.scale.line;
  return (
    <AnnotatedDrawing
      id={`plate-i-${variant}`}
      layout={variant}
      view={VIEW[variant]}
      title="Plate I. Plaque morphology, drawn."
      description={DESCRIPTION}
      art={
        <>
          <circle
            cx={cx}
            cy={cy}
            r={rim}
            fill="var(--paper)"
            stroke="var(--text)"
            strokeWidth="1.6"
          />
          <circle cx={cx} cy={cy} r={lawn} fill="var(--fig-lawn)" />
        </>
      }
      callouts={layout.plaques.map((p) => {
        const meta = plaque(p.id);
        return {
          id: p.id,
          name: `Plaque ${p.id}, ${meta.name}`,
          label: `${p.id} · ${meta.name}`,
          target: p.shapes.map((s, j) => <ShapeOf key={j} s={s} />),
          leader: p.leader,
          text: p.label,
        };
      })}
      after={
        <>
          <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="var(--text)" strokeWidth="1.5" />
          <text
            x={layout.scale.label.x}
            y={layout.scale.label.y}
            className="plate-scale"
            aria-hidden="true"
          >
            {layout.scale.label.text}
          </text>
        </>
      }
    />
  );
}

/** Plate I's two drawings, wide and narrow, as one figure the key below names. */
export function PlateI() {
  return (
    <AnnotatedFigure id="plate-i" draw>
      <Drawing layout={WIDE} variant="wide" />
      <Drawing layout={NARROW} variant="narrow" />
    </AnnotatedFigure>
  );
}

export function PlateKeyRow() {
  return (
    <div className="u-wide home-key">
      <AnnotatedKey
        for="plate-i"
        label="Plate I key"
        entries={KEY_ICONS.map((icon, i) => {
          const p = plaque(PLAQUE_IDS[i] ?? "");
          return {
            id: p.id,
            number: p.id,
            name: p.title,
            note: p.note,
            art: icon.map((s, j) => <ShapeOf key={j} s={s} />),
            artLabel: `${p.title} plaque, drawn.`,
          };
        })}
      />
    </div>
  );
}
