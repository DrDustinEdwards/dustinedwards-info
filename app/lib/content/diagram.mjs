// Draws nothing: diagram layout needs real font metrics, which no DOM shim in a Worker provides, so
// scripts/build-diagrams.mjs renders assets at build time and the HTML carries only the key and source.

import { ASSET_PREFIX } from "../media/classify.mjs";
import { fnv1a32 } from "../bytes.mjs";
import { h, text } from "./hast.mjs";

// Bump when the token map, the token values in app.css or the mermaid version changes: the key hashes
// only the source, so a restyle without a bump leaves every rendered asset at the old colors forever.
const DIAGRAM_TEMPLATE_VERSION = 1;

export const DIAGRAM_ASSET_DIR = "diagrams";

export const DIAGRAM_THEMES = ["light", "dark"];

// Token names, not colors: build:diagrams resolves them against app.css. Mermaid rejects var(--x)
// because khroma parses every value, so each theme is a separate render.
export const DIAGRAM_THEME_TOKENS = {
  background: "--paper",
  primaryColor: "--paper",
  primaryBorderColor: "--border-strong",
  primaryTextColor: "--text",
  secondaryColor: "--surface-popover",
  secondaryBorderColor: "--border",
  secondaryTextColor: "--text",
  tertiaryColor: "--tint-brand",
  tertiaryBorderColor: "--border",
  tertiaryTextColor: "--text",
  lineColor: "--border-strong",
  textColor: "--text",
  titleColor: "--text-heading",
  errorBkgColor: "--tint-danger",
  errorTextColor: "--text-danger",

  mainBkg: "--paper",
  nodeBorder: "--border-strong",
  nodeTextColor: "--text",
  clusterBkg: "--tint-brand",
  clusterBorder: "--border",
  // An edge crosses page background, so the label plate must match it or the line shows through.
  edgeLabelBackground: "--paper",
  arrowheadColor: "--border-strong",

  actorBkg: "--paper",
  actorBorder: "--border-strong",
  actorTextColor: "--text",
  actorLineColor: "--border",
  signalColor: "--border-strong",
  signalTextColor: "--text",
  labelBoxBkgColor: "--paper",
  labelBoxBorderColor: "--border-strong",
  labelTextColor: "--text",
  loopTextColor: "--text",
  noteBkgColor: "--surface-popover",
  noteBorderColor: "--border",
  noteTextColor: "--text",
  activationBkgColor: "--surface-popover",
  activationBorderColor: "--border-strong",
  sequenceNumberColor: "--on-brand",
  altBackground: "--paper",
};

/**
 * Posts check out as LF and the rest of the tree as CRLF; without this, clones on different OSes
 * compute different keys for the same diagram.
 *
 * @param {string} source
 */
export function normalizeDiagramSource(source) {
  return source.replace(/\r\n/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
}

/**
 * @param {string} source the mermaid source, unnormalised
 */
export function diagramKey(source) {
  const input = `${DIAGRAM_TEMPLATE_VERSION}\n${normalizeDiagramSource(source)}`;
  return fnv1a32(input);
}

/**
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 */
export function diagramAssetPath(key, theme) {
  return `/${DIAGRAM_ASSET_DIR}/${ASSET_PREFIX}${key}-${theme}.svg`;
}

/**
 * @param {Record<string, string>} attrs
 * @param {string} source the fenced mermaid block's contents
 */
export function buildDiagramModel(attrs, source) {
  // The alt must name the boxes and arrows: there is no generated equivalent like a chart's data table.
  const alt = (attrs.alt ?? "").trim();
  if (!alt) {
    throw new Error(`:::diagram "${attrs.title ?? "untitled"}" requires an alt attribute`);
  }

  const normalized = normalizeDiagramSource(source);
  if (!normalized) throw new Error(":::diagram source is empty");

  return {
    alt,
    title: (attrs.title ?? "").trim(),
    source: normalized,
    key: diagramKey(source),
  };
}

/**
 * Two images switched by display: none in app.css, because an <img> SVG cannot see the page's custom
 * properties and the theme comes from a cookie, not prefers-color-scheme. No width or height: the
 * asset may not exist yet and the pipeline cannot read the filesystem.
 *
 * @param {ReturnType<typeof buildDiagramModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 */
export function renderDiagramHast(model, captionChildren) {
  /** @type {any[]} */
  const children = [];

  if (model.title) {
    // A <p>, not a heading: rehypeCollectToc would put diagram titles in the table of contents.
    children.push(h("p", { className: ["diagram-title"] }, [text(model.title)]));
  }

  for (const theme of DIAGRAM_THEMES) {
    children.push(
      h("img", {
        className: ["diagram-image", `diagram-${theme}`],
        src: diagramAssetPath(model.key, theme),
        alt: model.alt,
      }, []),
    );
  }

  if (captionChildren.length > 0) {
    children.push(h("figcaption", {}, captionChildren));
  }

  return children;
}
