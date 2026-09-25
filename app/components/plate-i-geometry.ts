// Coordinates are lifted from the approved canvas file (part-c/09-solid-lawn.html), not retyped.
// One departure: the canvas's 375 frame clips labels i, iv and v, so in NARROW those leaders fold inward.

type Fill = "paper" | "lawn" | "turbid" | "none";
type Stroke = "ink" | "dust" | "none";

type Paint = { fill: Fill; stroke: Stroke; width: number; dash: string | null };
export type Shape =
  | ({ kind: "circle"; c: [number, number, number] } & Paint)
  | ({ kind: "path"; d: string } & Paint);

type Segment = [number, number, number, number];

export type PlateLayout = {
  size: number;
  dish: { cx: number; cy: number; rim: number; lawn: number };
  scale: { line: Segment; label: { x: number; y: number; text: string } };
  plaques: Array<{
    id: string;
    shapes: Shape[];
    leader: Segment[];
    label: { x: number; y: number; anchor: "start" | "end" };
  }>;
};

const CANVAS_WIDE: PlateLayout = {
  size: 500,
  dish: {"cx":250,"cy":250,"rim":246,"lawn":235},
  scale: {"line":[16,486,86,486],"label":{"x":16,"y":478,"text":"1 cm"}},
  plaques: [
    {
      id: "i",
      shapes: [
        {"kind":"circle","c":[334.3,179.3,31.3],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[334.3,179.3,458.4,75.2],[458.4,75.2,482.4,75.2]],
      label: {"x":487.4,"y":79.2,"anchor":"start"},
    },
    {
      id: "ii",
      shapes: [
        {"kind":"circle","c":[311.6,328.8,28.8],"fill":"turbid","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[311.6,328.8,417.5,464.3],[417.5,464.3,441.5,464.3]],
      label: {"x":446.5,"y":468.3,"anchor":"start"},
    },
    {
      id: "iii",
      shapes: [
        {"kind":"circle","c":[227,86.6,30],"fill":"turbid","stroke":"ink","width":1.4,"dash":null},
        {"kind":"circle","c":[227,86.6,13.5],"fill":"paper","stroke":"ink","width":1.1,"dash":null},
      ],
      leader: [[227,86.6,212.1,-19.4],[212.1,-19.4,188.1,-19.4]],
      label: {"x":183.1,"y":-15.4,"anchor":"end"},
    },
    {
      id: "iv",
      shapes: [
        {"kind":"circle","c":[399.2,265.7,41.6],"fill":"turbid","stroke":"dust","width":1,"dash":"3 4"},
        {"kind":"circle","c":[399.2,265.7,23.8],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[399.2,265.7,520.5,278.4],[520.5,278.4,544.5,278.4]],
      label: {"x":549.5,"y":282.4,"anchor":"start"},
    },
    {
      id: "v",
      shapes: [
        {"kind":"circle","c":[159.7,343.5,8.5],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[159.7,343.5,61.1,445.7],[61.1,445.7,37.1,445.7]],
      label: {"x":32.1,"y":449.7,"anchor":"end"},
    },
    {
      id: "vi",
      shapes: [
        {"kind":"path","d":"M272.8 424.9L276.2 430.0L267.8 432.7L266.9 436.6L270.4 444.2L263.2 444.2L257.4 443.5L258.7 453.9L253.6 454.8L247.5 447.5L243.9 454.2L238.7 457.5L236.1 448.8L232.0 448.3L223.8 452.6L224.6 444.2L225.1 438.6L215.8 439.2L215.4 434.1L220.7 428.6L213.9 424.9L212.3 419.9L220.4 417.2L220.5 413.0L217.2 405.5L225.1 406.1L229.5 405.1L229.4 396.5L234.8 397.0L240.3 402.2L243.9 393.4L248.8 394.1L251.4 401.9L256.4 400.3L263.4 398.0L262.1 406.6L264.0 410.3L273.4 409.9L271.4 416.0L266.9 421.3L275.5 424.9Z","fill":"paper","stroke":"ink","width":1.2,"dash":"4 3"},
      ],
      leader: [[243.9,424.9,240.5,521.8],[240.5,521.8,216.5,521.8]],
      label: {"x":211.5,"y":525.8,"anchor":"end"},
    },
  ],
};

// 610 is the hero's right half at 1280 with a desktop scrollbar, plus the 90px gap beside the name.
// Only the dish, plaques, leader starts and 1 cm bar scale; labels, tails and strokes keep canvas size.
const WIDE_WIDTH = 610;
// Longest left label is 131 at 14px mono and the one-line legend under it (240) must clear the rim;
// longest right label is 85.
const LEFT_LABELS = 198;
const RIGHT_LABELS = 88;
/** Leader elbow, tail and label gap on each side of the dish. */
const LEADER = 31;
const K = (WIDE_WIDTH - 2 * LEADER - LEFT_LABELS - RIGHT_LABELS) / 2 / CANVAS_WIDE.dish.rim;
const RIM = CANVAS_WIDE.dish.rim * K;
const at = (x: number, y: number): [number, number] => [
  +((x - CANVAS_WIDE.dish.cx) * K).toFixed(1),
  +((y - CANVAS_WIDE.dish.cy) * K).toFixed(1),
];

// Label side and elbow height (fraction of rim), chosen so no leader crosses a plaque.
const SIDE_LABELS: Record<string, { side: 1 | -1; y: number }> = {
  i: { side: 1, y: -0.52 },
  iv: { side: 1, y: 0.07 },
  ii: { side: 1, y: 0.63 },
  iii: { side: -1, y: -0.77 },
  v: { side: -1, y: -0.12 },
  vi: { side: -1, y: 0.32 },
};

function scaleShape(s: Shape): Shape {
  if (s.kind === "circle") {
    const [x, y] = at(s.c[0], s.c[1]);
    return { ...s, c: [x, y, +(s.c[2] * K).toFixed(1)] };
  }
  const d = s.d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) =>
    at(Number(x), Number(y)).join(" "),
  );
  return { ...s, d };
}

export const WIDE: PlateLayout = {
  size: +(CANVAS_WIDE.size * K).toFixed(1),
  dish: { cx: 0, cy: 0, rim: +RIM.toFixed(1), lawn: +(CANVAS_WIDE.dish.lawn * K).toFixed(1) },
  scale: (() => {
    const [x1, , x2] = CANVAS_WIDE.scale.line;
    const right = Math.round(RIM);
    const y = Math.round(RIM) - 4;
    const left = +(right - (x2 - x1) * K).toFixed(1);
    return {
      line: [left, y, right, y],
      label: { x: left, y: y - 8, text: CANVAS_WIDE.scale.label.text },
    };
  })(),
  plaques: CANVAS_WIDE.plaques.map((p) => {
    const place = SIDE_LABELS[p.id];
    const start = p.leader[0];
    if (!place || !start) throw new Error(`Plate I: no label side or leader for plaque "${p.id}"`);
    const [sx, sy] = at(start[0], start[1]);
    const y = Math.round(place.y * RIM);
    const elbow = place.side * Math.round(RIM + 8);
    const tail = place.side * Math.round(RIM + 26);
    return {
      id: p.id,
      shapes: p.shapes.map(scaleShape),
      leader: [
        [sx, sy, elbow, y],
        [elbow, y, tail, y],
      ],
      label: { x: tail + place.side * 5, y: y + 4, anchor: place.side === 1 ? "start" : "end" },
    };
  }),
};

const R = Math.round(RIM);
export const WIDE_VIEW = { x: -(R + LEADER + LEFT_LABELS), y: -(R + 4), w: WIDE_WIDTH, h: 2 * R + 8 };

export const NARROW: PlateLayout = {
  size: 300,
  dish: {"cx":150,"cy":150,"rim":146,"lawn":135},
  scale: {"line":[16,286,86,286],"label":{"x":16,"y":278,"text":"1 cm"}},
  plaques: [
    {
      id: "i",
      shapes: [
        {"kind":"circle","c":[200.6,107.6,18.8],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[200.6,107.6,262,-20.3],[262,-20.3,238,-20.3]],
      label: {"x":233,"y":-16.3,"anchor":"end"},
    },
    {
      id: "ii",
      shapes: [
        {"kind":"circle","c":[186.9,197.3,17.3],"fill":"turbid","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[186.9,197.3,255.9,285.5],[255.9,285.5,279.9,285.5]],
      label: {"x":284.9,"y":289.5,"anchor":"start"},
    },
    {
      id: "iii",
      shapes: [
        {"kind":"circle","c":[136.2,52,18],"fill":"turbid","stroke":"ink","width":1.4,"dash":null},
        {"kind":"circle","c":[136.2,52,8.1],"fill":"paper","stroke":"ink","width":1.1,"dash":null},
      ],
      leader: [[136.2,52,126.1,-20.3],[126.1,-20.3,102.1,-20.3]],
      label: {"x":97.1,"y":-16.3,"anchor":"end"},
    },
    {
      id: "iv",
      shapes: [
        {"kind":"circle","c":[239.5,159.4,24.9],"fill":"turbid","stroke":"dust","width":1,"dash":"3 4"},
        {"kind":"circle","c":[239.5,159.4,14.3],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[239.5,159.4,258,252],[258,252,282,252]],
      label: {"x":287,"y":256,"anchor":"start"},
    },
    {
      id: "v",
      shapes: [
        {"kind":"circle","c":[95.8,206.1,5.1],"fill":"paper","stroke":"ink","width":1.4,"dash":null},
      ],
      leader: [[95.8,206.1,96,298],[96,298,80,298]],
      label: {"x":75,"y":302,"anchor":"end"},
    },
    {
      id: "vi",
      shapes: [
        {"kind":"path","d":"M163.2 254.9L166.3 258.1L161.2 259.8L160.4 262.1L162.6 266.8L157.9 266.5L154.7 266.5L154.7 271.4L151.9 272.1L148.5 268.8L146.3 272.9L143.3 274.1L141.7 269.2L139.1 269.0L134.4 271.3L134.7 266.6L134.6 263.4L129.2 263.7L129.3 260.5L132.4 257.1L128.8 254.9L126.8 251.8L133.0 250.6L132.2 247.7L130.2 243.2L135.0 243.6L137.6 242.9L137.6 237.8L140.7 237.7L144.1 241.0L146.3 236.2L149.3 236.1L150.9 241.0L153.7 240.4L157.9 239.0L157.0 244.3L158.2 246.3L163.7 246.1L162.4 249.7L160.8 252.6L165.6 254.9Z","fill":"paper","stroke":"ink","width":1.2,"dash":"4 3"},
      ],
      leader: [[146.3,254.9,144,321.9],[144,321.9,120,321.9]],
      label: {"x":115,"y":325.9,"anchor":"end"},
    },
  ],
};

/** The specimen row's icons, each drawn in a 76-unit square, in the plate's numeral order. */
export const KEY_ICONS: Shape[][] = [
  [
    {"kind":"circle","c":[38,38,30],"fill":"paper","stroke":"ink","width":1.6,"dash":null},
  ],
  [
    {"kind":"circle","c":[38,38,30],"fill":"turbid","stroke":"ink","width":1.6,"dash":null},
  ],
  [
    {"kind":"circle","c":[38,38,30],"fill":"turbid","stroke":"ink","width":1.6,"dash":null},
    {"kind":"circle","c":[38,38,13.8],"fill":"paper","stroke":"ink","width":1.2,"dash":null},
  ],
  [
    {"kind":"circle","c":[38,38,32],"fill":"turbid","stroke":"dust","width":1,"dash":"3 4"},
    {"kind":"circle","c":[38,38,18.6],"fill":"paper","stroke":"ink","width":1.6,"dash":null},
  ],
  [
    {"kind":"circle","c":[38,38,6.6],"fill":"paper","stroke":"ink","width":1.6,"dash":null},
    {"kind":"circle","c":[38,38,30],"fill":"none","stroke":"dust","width":1,"dash":"1 5"},
  ],
  [
    {"kind":"path","d":"M65.4 38.0L67.9 42.1L63.7 45.2L59.6 47.4L62.0 52.6L60.5 56.3L54.2 55.3L52.6 58.7L51.7 64.4L47.5 64.7L42.7 60.5L39.7 63.6L35.9 68.9L32.7 63.7L30.1 60.1L24.9 63.4L20.9 62.2L21.0 56.2L19.3 53.2L12.1 53.7L10.8 49.8L15.7 44.2L13.1 41.4L7.5 38.0L11.6 34.4L14.9 31.5L12.7 27.0L12.0 22.2L17.9 21.6L21.1 19.9L20.6 13.4L24.9 12.7L30.0 15.6L32.9 13.5L36.0 8.4L39.9 10.6L42.9 14.5L47.4 11.6L51.9 11.3L53.1 16.7L54.5 20.4L60.4 19.8L63.2 22.7L59.8 28.5L61.3 31.5L67.4 34.0L65.9 38.0Z","fill":"paper","stroke":"ink","width":1.2,"dash":"4 3"},
  ],
];
