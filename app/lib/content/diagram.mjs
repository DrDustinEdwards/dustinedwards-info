// Prelum's editorial pack emits the <img> pair and the key; scripts/build-diagrams.mjs draws the assets they name with
// Prelum's render/diagram-draw, in this site's colors. DIAGRAM_TEMPLATE_VERSION in Prelum's render-diagram.mjs is bumped
// there when the role map, the token values in app.css or the Mermaid version changes.

// Token names, not colors: build:diagrams resolves them against app.css. Mermaid rejects var(--x) because khroma parses
// every value, so each theme is a separate render. One token per role in Prelum's DIAGRAM_ROLE_NAMES.
export const DIAGRAM_ROLE_TOKENS = {
  paper: "--paper",
  raised: "--surface-popover",
  text: "--text",
  heading: "--text-heading",
  border: "--border",
  borderStrong: "--border-strong",
  tint: "--tint-brand",
  onAccent: "--on-brand",
  danger: "--text-danger",
  dangerTint: "--tint-danger",
};
