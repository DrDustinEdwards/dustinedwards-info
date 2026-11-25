// The share card's drawing: a satori element tree for a post or page, set as a travel poster over the title block.
import { CARD_TITLE_SIZES, titleFontSize } from "@dustinedwards/site-runtime/share-card";
import { formatDate } from "capsomer/behavior/time";

import { cardDescription, cardTitle } from "../../app/lib/content/og-card-text.mjs";
import { IDENTITY } from "../../app/lib/identity.generated.mjs";
import { markElement } from "./mark.mjs";
import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./tokens.mjs";

export const WIDTH = 1200;
export const HEIGHT = 630;

/**
 * Ink on paper, from the light block: a card is drawn once and shown in feeds with no idea of the
 * reader's theme, and the paper ground is the site's own. Every pair here is measured on --page-paper.
 */
const PAPER_BLOCK = tokenBlock("build:og", THEME_SELECTORS.light);
const {
  ground: GROUND,
  ink: INK,
  muted: MUTED,
} = resolveTokens(
  {
    ground: "--page-paper",
    ink: "--text-heading",
    muted: "--text-secondary",
  },
  PAPER_BLOCK,
  "build:og",
);

/* SITE.name in app/lib/seo.ts is this same field. */
const SITE_NAME = IDENTITY.name;

/*
 * The poster's own colors: Capsomer's purple ramp (light 3, 8, 10 and 12) under its amber sun, as
 * Capsid's card sets its teal (explorer/og-card.mjs). Fixed, not read from the theme: the scene is a
 * picture, and every word on the card sits on the paper or the ink band, whose pairs are measured.
 */
const SKY = "#f4efff";
const HILL = "#b29ae3";
const PLAIN = "#7d50c1";
const NIGHT = "#1d162c";
const SUN = "#f0b429";

/**
 * A phage come down on the plain like a lander: the head a hexagon, the tail, three legs. In the night
 * ink, as the poster's craft.
 * @param {number} x the foot of the tail @param {number} y @param {number} r the head's radius
 */
function phage(x, y, r) {
  const head = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i;
      return `${(x + r * Math.cos(a)).toFixed(1)},${(y - 2.6 * r + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  const top = y - 1.6 * r;
  return [
    { type: "polygon", props: { points: head, fill: NIGHT } },
    {
      type: "rect",
      props: { x: x - r * 0.18, y: top, width: r * 0.36, height: 1.2 * r, fill: NIGHT },
    },
    ...[-1, 0, 1].map((d) => ({
      type: "path",
      props: {
        d: `M${x} ${y - 0.4 * r} L${x + d * 1.1 * r} ${y + 0.25 * r}`,
        stroke: NIGHT,
        strokeWidth: r * 0.14,
      },
    })),
  ];
}

/**
 * The scene: a travel poster in the manner of JPL's Visions of the Future (2016), after the 1930s
 * national-park posters. Flat layered shapes, the sun over the hills, three phages on the plain. It is
 * drawn 300px tall and set at the foot of the space the words leave, on more of its sky, so a long
 * title crops the sky, never the plain.
 */
function scene() {
  return {
    type: "svg",
    props: {
      width: WIDTH,
      height: 300,
      viewBox: `0 0 ${WIDTH} 300`,
      style: { position: "absolute", left: 0, bottom: 0 },
      children: [
        { type: "rect", props: { width: WIDTH, height: 300, fill: SKY } },
        { type: "circle", props: { cx: 930, cy: 150, r: 110, fill: SUN } },
        {
          type: "path",
          props: {
            d: "M0 200 L180 160 L360 186 L560 140 L760 180 L960 148 L1200 182 L1200 300 L0 300Z",
            fill: HILL,
          },
        },
        {
          type: "path",
          props: {
            d: "M0 250 L240 226 L470 246 L700 220 L940 240 L1200 226 L1200 300 L0 300Z",
            fill: PLAIN,
          },
        },
        ...phage(260, 262, 20),
        ...phage(640, 254, 26),
        ...phage(1010, 262, 18),
      ],
    },
  };
}

/**
 * The poster over the title block: the scene with the mark on its sky, then the title, the description
 * and the meta line on the paper. The title block keeps the side padding og-card-text.mjs's
 * ladder was measured against, and grows upward into the scene.
 *
 * @param {{
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */
export function card(post) {
  /**
   * @param {string} type
   * @param {any} props
   * @param {...any} children
   * @returns {any}
   */
  const el = (type, props, ...children) => ({
    type,
    props: { ...props, children: children.length === 1 ? children[0] : children },
  });

  /* Both cuts happen HERE, in JavaScript: satori's line clamp reads like a guarantee and is inert. */
  const title = cardTitle(post.title);
  const description = cardDescription(post.description);

  // Filtered, because the formatter returns null rather than "Invalid Date", which would be permanent
  // on an immutable object.
  const date = formatDate(post.publishAt);

  /* THE MEASURE: the side padding sets the width og-card-text.mjs's ladder was measured against. */
  const PAD_X = 72;

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: GROUND,
        // A share card is a standalone poster, so it is set wholly in Jost, the free Futura: NASA NHB
        // 1430.2 section 5.4 allows Futura for a self-contained piece, headed in its Demibold.
        fontFamily: "Jost",
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          position: "relative",
          flex: 1,
          minHeight: 120,
          overflow: "hidden",
          background: SKY,
        },
      },
      scene(),
      el(
        "div",
        { style: { display: "flex", position: "absolute", top: 40, left: PAD_X } },
        markElement(),
      ),
    ),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", padding: `36px ${PAD_X}px 0` } },
      el(
        "div",
        {
          style: {
            display: "flex",
            fontSize: titleFontSize(title, CARD_TITLE_SIZES),
            fontWeight: 600,
            color: INK,
            lineHeight: 1.12,
            letterSpacing: "-0.005em",
            // Satori honors `wordBreak` but ignores `overflowWrap`.
            wordBreak: "break-word",
          },
        },
        title,
      ),
      // Two lines of muted type is texture; a third would be prose asking to be read at a size it cannot be.
      description
        ? el(
            "div",
            {
              style: {
                display: "flex",
                marginTop: 18,
                fontSize: 26,
                color: MUTED,
                lineHeight: 1.4,
                // Same reason as the title's. A URL in a description is the realistic form of an
                // unbreakable word.
                wordBreak: "break-word",
              },
            },
            description,
          )
        : null,
    ),
    // The foot as the livery's band: the site and the date in light type on the night ink.
    el(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          marginTop: 28,
          padding: `16px ${PAD_X}px`,
          background: NIGHT,
          borderTop: `8px solid ${PLAIN}`,
          color: SKY,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.16em",
        },
      },
      el("div", { style: { display: "flex" } }, SITE_NAME.toUpperCase()),
      el(
        "div",
        { style: { display: "flex", fontWeight: 400, letterSpacing: "0.04em" } },
        date ?? "",
      ),
    ),
  );
}
