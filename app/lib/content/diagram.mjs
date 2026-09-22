/**
 * The `:::diagram` directive: mermaid source in, a REFERENCE to a build-time
 * asset out.
 *
 * Pure, and imported by `pipeline.mjs`, so the two writers (the Node build and
 * the Worker's save/preview path) agree on the reference a diagram renders to.
 * Nothing here touches `node:fs`, `node:path` or the network, for the same
 * reason the rest of the pipeline does not: it has to run inside a Worker.
 *
 * **This module does not draw anything.** That is the whole ruling
 * (Capsid `dustinedwards/chart-stack.md`). Charts render inline into the gated
 * artifact because Observable Plot computes layout from DATA and was measured
 * byte-identical between Node and workerd. Diagram layout needs real font
 * metrics, so every diagram tool failed the same way: mermaid with linkedom dies
 * at `CSSStyleSheet is not defined` with `SVGTextElement.getBBox()` behind it,
 * and Pintora at `Cannot set properties of null (setting 'font')`. mermaid-cli
 * drives a real Chromium for exactly that reason, which a Worker cannot do.
 *
 * So diagrams take the social-card pattern instead: rendered at build time by
 * `scripts/build-diagrams.mjs` into `public/diagrams/`, under a key that is a
 * pure function of the source, and referenced from the post. The rendered
 * HTML carries the KEY and the SOURCE, never the SVG, so the determinism and
 * drift comparisons still cover everything the pipeline produced while the
 * bytes that came out of a browser engine stay out of every byte comparison.
 *
 * The gap that leaves is real and recorded, the same one social cards have: a
 * diagram authored or edited in the admin editor has no asset until someone runs
 * `npm run build:diagrams`. An editor save needs no special handling to preserve
 * an existing reference, because the reference is DERIVED from the source rather
 * than stored: an unchanged diagram computes the same key on every writer.
 */

/**
 * Bumped whenever the diagram TEMPLATE changes: the token map below, the values
 * those tokens resolve to in `app/app.css`, or the mermaid version that draws
 * them.
 *
 * Same reasoning as `OG_TEMPLATE_VERSION` in `pipeline.mjs`, and the same trap.
 * The key is what makes the asset safe to serve immutable and what lets
 * `build:diagrams` skip work, and the key is a hash of the SOURCE. The template
 * is not one of those inputs, so restyling a diagram without bumping this leaves
 * every already-rendered asset at the old colours forever, and `build:diagrams`
 * will cheerfully report that it had nothing to do.
 *
 * 1: the first cut, 2026-07-30.
 */
const DIAGRAM_TEMPLATE_VERSION = 1;

/** Where rendered assets live, relative to the site root. */
export const DIAGRAM_ASSET_DIR = "diagrams";

/** The two renders every diagram produces. */
export const DIAGRAM_THEMES = ["light", "dark"];

/**
 * Mermaid theme variables, as TOKEN NAMES rather than colours.
 *
 * Names, deliberately. `build:diagrams` resolves each one against the light and
 * dark blocks of `app/app.css`, so the stylesheet stays the single source of the
 * palette and a retuned token moves the diagram with it. Writing hexes here
 * would put a second, silently diverging copy of the palette in the repo, which
 * is the drift `check:contrast` already exists to catch. `check:diagrams` fails
 * on any value here that is not a `--token` name, and on any token missing from
 * either theme block.
 *
 * Mermaid will not take a custom property. Measured 2026-07-30 against
 * mermaid-cli 11.16.0: `themeVariables: { primaryColor: "var(--paper)" }`
 * fails the render with `Error: Unsupported color format: "var(--surface-2)"`,
 * because khroma parses every value in order to derive the ones you did not
 * supply. That is the first of the two reasons there is no single themed asset.
 *
 * There is no diagram colour vocabulary for authors, on purpose. A diagram says
 * what it means with SHAPE and LABEL, which is design-tokens.md rule 3 taken to
 * its conclusion: a refusal is an edge labelled `403`, not a red arrow. The
 * deliberate first cut, exactly like `:::chart` shipping four mark types.
 */
export const DIAGRAM_THEME_TOKENS = {
  // Shared
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

  // Flowchart
  mainBkg: "--paper",
  nodeBorder: "--border-strong",
  nodeTextColor: "--text",
  clusterBkg: "--tint-brand",
  clusterBorder: "--border",
  // The label sits ON an edge, and an edge crosses page background rather than a
  // panel, so the plate behind it has to be the page's own background or the
  // line shows through the text.
  edgeLabelBackground: "--paper",
  arrowheadColor: "--border-strong",

  // Sequence
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
 * Normalises a diagram source before it is hashed.
 *
 * Line endings and surrounding blank lines are not part of what a diagram MEANS,
 * and this repo checks out `content/posts/*.md` as LF while the rest of the tree
 * takes CRLF. Without this a Windows clone and a Linux clone would compute
 * different keys for the same diagram and each would think the other's asset was
 * missing.
 *
 * @param {string} source
 */
export function normalizeDiagramSource(source) {
  return source.replace(/\r\n/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
}

/**
 * The asset key for a diagram source.
 *
 * FNV-1a, matching `ogImageKey`: pure JS, identical in Node and in a Worker, no
 * imports, and this is a cache-busting key rather than a security boundary. The
 * key changes exactly when the drawing would and never otherwise, which is what
 * makes `build:diagrams` idempotent and lets the asset be served immutable.
 *
 * @param {string} source the mermaid source, unnormalised
 */
export function diagramKey(source) {
  const input = `${DIAGRAM_TEMPLATE_VERSION}\n${normalizeDiagramSource(source)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * The site-absolute path of one rendered asset.
 *
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 */
export function diagramAssetPath(key, theme) {
  return `/${DIAGRAM_ASSET_DIR}/${key}-${theme}.svg`;
}

/**
 * Validates the directive's attributes and source into a render-ready model.
 *
 * Every failure here is a build failure that names the problem, exactly as
 * `:::chart` and `:::figure` do.
 *
 * @param {Record<string, string>} attrs
 * @param {string} source the fenced mermaid block's contents
 */
export function buildDiagramModel(attrs, source) {
  // WCAG 2.2 AA, and the rule :::figure and :::chart already enforce. A diagram
  // is a picture of a structure; for a reader who cannot see it, the alt IS the
  // structure, so "flowchart of the save path" is a failure and naming the boxes
  // and the arrows is the standard. There is no generated equivalent here the
  // way a chart has a data table: the .md twin already serves the mermaid source
  // verbatim, which is the machine-readable form, and the alt is the human one.
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

/** @param {string} tagName @param {Record<string, any>} properties @param {any[]} children */
const h = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});

/** @param {string} value */
const text = (value) => ({ type: "text", value });

/**
 * Renders a validated model into the hast children of the figure.
 *
 * TWO images, one per theme, and only one of them is ever displayed.
 *
 * That is forced rather than chosen. An SVG referenced by `<img>` is an
 * independent document: the page's custom properties do not cross into it, so
 * the single-asset trick that makes `:::chart` theme itself is unavailable here,
 * and `prefers-color-scheme` inside the asset would be wrong anyway because this
 * site resolves its theme from a COOKIE and a `data-theme` attribute, not from
 * the OS. A reader who chose light under a dark OS would get the dark drawing.
 * The pair is switched with `display: none` in `app.css`, which also keeps the
 * hidden one out of the accessibility tree, so both may carry the same alt
 * without announcing it twice.
 *
 * The accessible name is the `alt` attribute, not `role="img"` plus
 * `aria-label`. On an `<img>` those are a redundant override of a native name
 * that already works; the corrected contract in chart-stack.md is about naming
 * the element that IS the graphic rather than its figure, and for an `<img>`
 * that element is named by `alt`.
 *
 * No width or height. The pipeline is not allowed to look at the filesystem, and
 * the asset legitimately may not exist yet, so there is nothing honest to
 * measure. `app.css` gives the pair `max-width: 100%; height: auto` and the
 * SVG's own viewBox supplies the aspect ratio once it loads.
 *
 * @param {ReturnType<typeof buildDiagramModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 */
export function renderDiagramHast(model, captionChildren) {
  /** @type {any[]} */
  const children = [];

  if (model.title) {
    // A <p>, deliberately not a heading: rehypeCollectToc scans h2 and h3, so a
    // heading here would inject diagram titles into the post's table of contents.
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
