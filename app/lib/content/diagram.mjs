// Prelum's editorial pack emits the <img> pair and the key (DIAGRAM_TEMPLATE_VERSION in its
// render-diagram.mjs, bumped there when the token map, the token values in app.css or the mermaid
// version changes); scripts/build-diagrams.mjs draws the assets they name with this site's colors.

import { ASSET_PREFIX } from "../media/classify.mjs";

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
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 */
export function diagramAssetPath(key, theme) {
  return `/${DIAGRAM_ASSET_DIR}/${ASSET_PREFIX}${key}-${theme}.svg`;
}
