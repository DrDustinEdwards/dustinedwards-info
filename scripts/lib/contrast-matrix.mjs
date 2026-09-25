// The tables check:contrast measures against: the APCA keystone vectors, the ratified pair matrix,
// the tokens declared outside app.css, the tokens with no ratio of their own, and the opacity
// exemptions. Data only; the gate owns every assertion made with it.

/** apca-w3 0.1.9 keystone vectors, both polarities, so the sign is tested. */
export const APCA_KEYSTONE = [
  ["#888", "#fff", 63.056469930209424],
  ["#fff", "#888", -68.54146436644962],
  ["#000", "#aaa", 58.146262578561334],
  ["#aaa", "#000", -56.24113336839742],
  ["#123", "#def", 91.66830811481631],
  ["#def", "#123", -93.06770049484275],
  ["#123", "#444", 8.32326136957393],
  ["#444", "#123", -7.526878460278154],
];

// No --fill-* on --paper row: a fill always carries text.
export const TEXT = 4.5; // WCAG 1.4.3 AA, normal text
export const UI = 3.0; // WCAG 1.4.11, non-text UI and graphical objects
// No disabled floor: WCAG exempts inactive components.

/** @type {Array<[string, string, number, string]>} fg, bg, min, note */
export const MATRIX = [
  ["--text", "--paper", TEXT, "body text on paper"],
  ["--text-heading", "--paper", TEXT, "heading text on paper"],
  ["--text-accent", "--paper", TEXT, "accent text on paper"],
  ["--text", "--surface-popover", TEXT, "body on popover"],
  ["--text-heading", "--surface-popover", TEXT, "heading on popover"],
  // No --text-disabled on --surface-popover row: it fails there, nothing ships it.
  ["--text", "--mark-bg", TEXT, "body on search highlight"],
  ["--text", "--selection-bg", TEXT, "body on selection"],
  ["--text", "--tint-brand", TEXT, "body on brand tint"],
  ["--text-secondary", "--paper", TEXT, "quiet ink on paper"],
  ["--text-secondary", "--surface-popover", TEXT, "muted on popover"],
  // No disabled row: WCAG exempts inactive controls. See NON_PARTICIPATING.

  // Borders are non-text UI
  ["--border", "--paper", UI, "a hairline on paper"],
  // No --border on --surface-popover row: it fails there, so the popover step takes
  // --border-strong.
  ["--border-strong", "--paper", UI, "a control edge on paper"],
  ["--border-strong", "--surface-popover", UI, "strong border on popover"],

  ["--brand", "--paper", TEXT, "a link, a focus ring and the header mark, all on paper"],
  ["--brand", "--surface-popover", TEXT, "a link and its focus ring on the popover step"],
  // The cover picker rings the chosen thumbnail in brand, on the drawer.
  ["--brand", "--tint-brand", TEXT, "brand on its own tint"],
  ["--brand-hover", "--paper", TEXT, "a hovered link on paper"],
  // The admin identity block hovers on the shell surface, not the page.
  ["--brand-pressed", "--paper", TEXT, "a pressed link on paper"],
  ["--on-brand", "--brand", TEXT, "text on brand fill"],
  ["--on-brand", "--brand-hover", TEXT, "text on brand hover fill"],
  ["--on-brand", "--brand-pressed", TEXT, "the label on a pressed primary button"],
  ["--visited", "--paper", TEXT, "a visited link on paper"],
  ["--focus-ring-on-brand", "--brand", UI, "inner ring on brand fill"],
  // No --focus-ring-on-brand against --fill-danger. It measures 1.47:1 in dark,
  // so app.css does not draw that ring and this does not pretend it does.

  // Chrome text is measured against the chrome, not the page.
  ["--on-chrome", "--surface-chrome", TEXT, "wordmark and current nav on chrome"],
  ["--on-chrome-muted", "--surface-chrome", TEXT, "nav at rest on chrome"],
  // The mark is a graphical object, not text, so it takes the 1.4.11 floor.
  ["--mark-on-chrome", "--surface-chrome", UI, "logo mark on chrome"],
  ["--focus-ring-on-chrome", "--surface-chrome", UI, "focus ring on chrome"],
  // Inverted pair: WCAG is symmetric, APCA is not.
  ["--surface-chrome", "--on-chrome-muted", TEXT, "pressed toggle and skip link, inverted"],
  // The caption band is opaque, so the ratio ignores the picture.
  ["--on-scrim", "--scrim", TEXT, "tile caption over the image"],

  // No --border-strong on --surface-chrome row: a seam has no 3:1 obligation.

  ["--text-danger", "--paper", TEXT, "danger text on paper"],
  // Revert to draft, as a row in the overflow menu on the popover step.
  ["--text-danger", "--surface-popover", TEXT, "danger text on popover"],
  ["--on-tint-danger", "--tint-danger", TEXT, "text on danger tint"],
  ["--border-danger", "--paper", UI, "danger border"],
  ["--on-fill-danger", "--fill-danger", TEXT, "text on danger fill"],
  ["--on-fill-danger", "--fill-danger-hover", TEXT, "text on danger hover fill"],

  ["--text-warning", "--paper", TEXT, "warning text on paper, including the command bar dirty state"],
  ["--on-tint-warning", "--tint-warning", TEXT, "text on warning tint"],
  ["--border-warning", "--paper", UI, "a warning border on paper, including the dirty dot ring"],
  ["--border-warning", "--tint-warning", UI, "warning border on its own tint"],
  // The dirty-state indicator in the command bar: amber text and an amber fill
  // dot, both on the shell surface rather than on the page.
  ["--brand", "--tint-warning", UI, "brand fill edge on warning tint"],
  ["--on-fill-warning", "--fill-warning", TEXT, "text on warning fill"],

  ["--text-success", "--paper", TEXT, "success text on paper"],
  ["--on-tint-success", "--tint-success", TEXT, "text on success tint"],
  ["--border-success", "--paper", UI, "a success border on paper"],
  ["--on-fill-success", "--fill-success", TEXT, "text on success fill"],

  // Accent, decorative but still read as text

  // Charts are graphical objects
  ["--chart-cadet", "--paper", UI, "chart cadet"],
  ["--chart-purple", "--paper", UI, "chart purple"],
  ["--chart-claret", "--paper", UI, "chart claret"],
  ["--chart-sage", "--paper", UI, "chart sage"],
  ["--chart-gold", "--paper", UI, "chart gold"],
  ["--chart-rust", "--paper", UI, "chart rust"],

  ["--text-destructive", "--paper", TEXT, "destructive text on paper"],
  ["--text-destructive", "--surface-popover", TEXT, "destructive text in a popover"],
  ["--text-destructive", "--tint-destructive", TEXT, "destructive text on its own tint"],

  ["--text", "--glass-fill-paper", TEXT, "body on paper glass, composited"],
  ["--text-secondary", "--glass-fill-paper", TEXT, "muted copy on paper glass"],
  // The placeholder must sit below the value that replaces it.
  ["--placeholder", "--paper", TEXT, "placeholder in a field"],

  // The header mark's purple paths take --brand, measured by the --brand on --paper row. Its three
  // warm paths would fail (2.72, 1.93, 1.58:1 on limestone) but are logotype ink, which 1.4.11 exempts.
  ["--brand", "--glass-fill-paper", TEXT, "link on paper glass"],
  ["--visited", "--glass-fill-paper", TEXT, "visited link on paper glass"],
  ["--visited", "--error-tint", TEXT, "visited link on an error tint"],
  ["--visited", "--warning-tint", TEXT, "visited link on a warning tint"],
  ["--visited", "--success-tint", TEXT, "visited link on a success tint"],

  // No bar rows: a pair against a surface nothing paints is not coverage.

  // No --dust row on paper: it cannot identify a control; --line-strong does.
  ["--line-strong", "--paper", UI, "a control edge on paper"],
  // The underline is what marks a paragraph link, since link and body text sit under 3:1.
  ["--link-underline", "--paper", UI, "a paragraph link's resting underline on paper"],

  ["--error", "--paper", TEXT, "error text on paper"],
  ["--error", "--error-tint", TEXT, "error text on its own tint"],
  ["--on-error-fill", "--error-fill", TEXT, "label on a destructive fill"],
  ["--warning", "--paper", TEXT, "warning text on paper"],
  ["--warning", "--warning-tint", TEXT, "warning text on its own tint"],
  ["--on-warning-fill", "--warning-fill", TEXT, "label on a warning fill"],
  ["--success", "--paper", TEXT, "success text on paper"],
  ["--success", "--success-tint", TEXT, "success text on its own tint"],
  ["--on-success-fill", "--success-fill", TEXT, "label on a success fill"],

  // Every series carries lines and labels, so its stroke must clear 1.4.11; an area fill may sit lighter.
  ["--fig-s1", "--fig-ground", UI, "figure series 1 stroke"],
  ["--fig-s2", "--fig-ground", UI, "figure series 2 stroke"],
  ["--fig-s3", "--fig-ground", UI, "figure series 3 stroke"],
  ["--fig-s4", "--fig-ground", UI, "figure series 4 stroke"],
  ["--fig-s5", "--fig-ground", UI, "figure series 5 stroke"],
  // Axis and grid take --fig-dust-400: an axis carries meaning, so 1.4.11 applies.
  ["--fig-dust-400", "--fig-ground", UI, "figure axis and grid stroke"],
  ["--text-secondary", "--fig-ground", TEXT, "figure label"],
  ["--text", "--fig-ground", TEXT, "figure key label"],
  // A leader identifies which label names which plaque, so 1.4.11 applies. Oxide 300 is measured in
  // every theme because it is the weaker on the light lawn (3.2:1 against 400's 4.3:1).
  ["--fig-oxide-300", "--fig-lawn", UI, "plate leader on the lawn"],
  ["--text", "--fig-lawn", UI, "plaque outline on the lawn"],
  ["--text", "--fig-turbid", UI, "plaque outline on the turbid tone"],
];

/** @type {Map<string, string>} token -> why it is declared outside app.css */
export const DECLARED_ELSEWHERE = new Map([
  [
    "--shiki-light",
    "written inline by Shiki on each highlighted span, per token, per code block",
  ],
  ["--shiki-dark", "the dark half of the same inline pair"],
  [
    "--shiki-light-bg",
    "inline on the span; app.css matches it with span[style*=...] and reads it back",
  ],
  ["--shiki-dark-bg", "the dark half of the same inline background pair"],
  [
    "--swatch",
    "written inline by the :swatch directive on each chip, one per chip, per post; " +
      "prose.css reads it back as var(--swatch, transparent). Same shape as the four " +
      "Shiki tokens above and for the same reason: the value is per instance and comes " +
      "from the post, so there is no theme block it could live in. It is deliberately " +
      "NOT declared, which is what keeps the participation assertion below untouched " +
      "and its exemption map empty: the color being SHOWN is not a color this system " +
      "chose, and no ratio can be asserted about it",
  ],
]);

/** @type {Map<string, string>} token -> why no ratio of its own can be asserted */
export const NON_PARTICIPATING = new Map([
  [
    "--dust",
    "lines only, and deliberately below the floor: 1.57:1 on limestone. It rules, hairlines and " +
      "outlines a disabled control, and it may never be the thing that identifies one. That is why " +
      "--line-strong exists, and --line-strong carries the rows",
  ],
  [
    "--text-disabled",
    "an INACTIVE component, which WCAG 1.4.3 exempts outright. MEASURED 2.46:1 on limestone and " +
      "recorded as failing rather than quietly unmeasured: a disabled control that met 4.5:1 would " +
      "read as available. It is identified by the disabled attribute, the recess, and text beside it",
  ],
  [
    "--lamp-chroma-on-paper",
    "a catch hue mixed in behind the one paper glass surface. The brief's rule is that light is " +
      "atmosphere and never meaning, so nothing reads it and no pair can be required of it. Its " +
      "companion --lamp-chroma-on-bar was deleted 2026-09-14 with the bar it lit",
  ],
  // Dust 300 is texture on Plate I, the halo's dashed outer ring: it marks an edge and identifies nothing.
  [
    "--fig-dust-300",
    "texture: the halo's dashed ring on Plate I, below the stroke floor because it identifies nothing",
  ],
  // Unused ramp steps: interiors may sit below 3:1, only edges may not.
  ...(/** @type {Array<[string, string]>} */ (
    [
      "--fig-purple-400",
      "--fig-leaf-100",
      "--fig-leaf-400",
      "--fig-leaf-500",
      "--fig-oxide-100",
      "--fig-oxide-200",
      "--fig-oxide-500",
      "--fig-dust-100",
      "--fig-dust-200",
    ].map((t) => [
      t,
      "a ramp step no series slot resolves through: a fill or a letterbox ground, which step 4 " +
        "exempts from the stroke floor",
    ])
  )),
]);

/*
 * Refuses 0 < opacity < 1 unless listed (0 and 1 are a reveal pair). A group is exempt only
 * when every member matches.
 * @type {Array<{ test: RegExp, why: string }>}
 */
export const OPACITY_EXEMPT = [
  {
    test: /:disabled|\[disabled\]|\[aria-disabled="true"\]/,
    why:
      "a disabled control, which WCAG 1.4.3 exempts outright, aria-disabled included: it is " +
      "the same state kept focusable",
  },
  {
    test: /\[data-pending\]/,
    why: "a transient pending state, seconds at a time, on the admin plane",
  },
  { test: /-scrim/, why: "a scrim, not text" },
  {
    /* Anchored at the end, per the vacuity rule: a bare `backdrop` matches `.backdrop-blur`. */
    test: /(?:::backdrop|-backdrop)$/,
    why:
      "a modal veil, not text. Nothing is drawn on this layer: it exists to dim " +
      "what is behind it, so there is no foreground to price a ratio against. " +
      "Same class as -scrim above, reached by a different selector shape since " +
      "the dialogs became native <dialog> and their scrims became ::backdrop",
  },
  {
    test: /^\.search-why-sep$/,
    why: 'incidental punctuation, the "/" between why-terms, recorded as LEFT in this header',
  },
];
