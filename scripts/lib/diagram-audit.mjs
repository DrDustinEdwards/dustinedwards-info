/**
 * The tokens-only audit over a rendered diagram SVG, run by the build on every asset it writes and
 * by the gate over every asset already committed.
 *
 * BOUNDARY: it asserts that every color a reader can SEE comes from the palette, computing
 * reachability structurally rather than from an allowlist, so what it cannot judge is a rule or an
 * attribute this document never paints with.
 */

import { parseHTML } from "linkedom";

import { normalizeHex } from "./tokens.mjs";

/** Properties and attributes whose value is a color. */
const COLOUR_PROPERTIES = new Set([
  "fill",
  "stroke",
  "color",
  "background",
  "background-color",
  "stop-color",
  "flood-color",
  "border",
  "border-color",
  "outline",
  "outline-color",
]);

/**
 * Values that name no color at all. `currentColor` is included because it resolves to the
 * `color` property, which is itself audited wherever it is set.
 */
const NON_COLOUR_VALUES = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
]);

/**
 * Splits a stylesheet into top level rules by BRACE DEPTH, not by splitting on `}`: mermaid's
 * stylesheet opens with at-rules whose bodies a naive split cuts into fragments.
 *
 * @param {string} text
 * @returns {Array<{ selector: string, body: string }>}
 */
export function cssRules(text) {
  /** @type {Array<{ selector: string, body: string }>} */
  const out = [];
  let depth = 0;
  let start = 0;
  let selectorEnd = -1;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "{") {
      if (depth === 0) selectorEnd = i;
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        out.push({
          selector: text.slice(start, selectorEnd).trim(),
          body: text.slice(selectorEnd + 1, i),
        });
        start = i + 1;
      }
    }
  }
  return out;
}

/**
 * Every color-carrying declaration in a rule body or an inline style.
 *
 * @param {string} body
 * @returns {Array<{ property: string, value: string }>}
 */
function colourDeclarations(body) {
  /** @type {Array<{ property: string, value: string }>} */
  const out = [];
  for (const m of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+)/g)) {
    const property = m[1].toLowerCase();
    if (COLOUR_PROPERTIES.has(property)) out.push({ property, value: m[2].trim() });
  }
  return out;
}

/**
 * Decides whether one color value is allowed, fail closed by construction: the value must BE a
 * palette color, a keyword naming no color, or a paint reference. Anything else is reported,
 * which is what catches the forms a hex-hunting regex misses.
 *
 * @param {string} value
 * @param {Set<string>} palette normalized hexes
 */
function colourProblem(value, palette) {
  const cleaned = value.replace(/!important/gi, "").trim();
  if (cleaned === "") return null;
  const lower = cleaned.toLowerCase();
  if (NON_COLOUR_VALUES.has(lower)) return null;
  if (lower.startsWith("url(")) return null;
  if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(cleaned)) {
    return palette.has(normalizeHex(cleaned)) ? null : `${cleaned} is not a ratified token value`;
  }
  return `${cleaned} is not a color token`;
}

/**
 * Audits one rendered SVG against one theme's resolved palette.
 *
 * @param {string} svg
 * @param {string[]} paletteHexes every color this theme is allowed to use
 * @returns {{ checked: number, skippedRules: number, overridden: number, problems: string[] }}
 */
export function auditDiagramSvg(svg, paletteHexes) {
  const palette = new Set(paletteHexes.map(normalizeHex));
  /** @type {string[]} */
  const problems = [];
  let checked = 0;
  let skippedRules = 0;
  let overridden = 0;

  const { document } = parseHTML(`<!DOCTYPE html><html><body>${svg}</body></html>`);
  const root = document.querySelector("svg");
  if (!root) {
    return { checked: 0, skippedRules: 0, overridden: 0, problems: ["no <svg> element"] };
  }

  // The stylesheet mermaid embeds. Kept afterwards as well, so the attribute pass can ask which
  // properties a rule takes over for a given element.
  /** @type {Array<{ selectors: string[], properties: Set<string> }>} */
  const styling = [];

  for (const style of document.querySelectorAll("style")) {
    for (const rule of cssRules(style.textContent ?? "")) {
      const declarations = colourDeclarations(rule.body);
      if (declarations.length === 0) continue;
      if (rule.selector.startsWith("@")) {
        skippedRules += 1;
        continue;
      }
      const selectors = rule.selector.split(",").map((s) => s.trim()).filter(Boolean);
      styling.push({
        selectors,
        properties: new Set(declarations.map((d) => d.property)),
      });

      let reachable = false;
      for (const one of selectors) {
        try {
          if (document.querySelector(one)) reachable = true;
        } catch {
          // A selector this parser cannot evaluate is treated as reachable, so an unreadable rule fails
          // loudly rather than passing by default.
          reachable = true;
        }
      }
      if (!reachable) {
        skippedRules += 1;
        continue;
      }
      for (const { property, value } of declarations) {
        checked += 1;
        const problem = colourProblem(value, palette);
        if (problem) problems.push(`${rule.selector} { ${property}: ${problem} }`);
      }
    }
  }

  /**
   * Whether a stylesheet rule takes this property over on this element, which is what makes a
   * presentation attribute dead rather than shipped.
   *
   * @param {any} element
   * @param {string} property
   */
  const styledBy = (element, property) =>
    styling.some((rule) => {
      if (!rule.properties.has(property)) return false;
      return rule.selectors.some((selector) => {
        try {
          return element.matches(selector);
        } catch {
          return false;
        }
      });
    });

  // Attributes and inline styles on drawn elements. Anything inside a `<defs>` subtree nothing
  // points at is never painted; the markers that draw arrowheads ARE pointed at, so they are audited.
  const serialized = root.toString();
  /** @type {Set<Element>} */
  const dead = new Set();
  for (const defs of document.querySelectorAll("defs")) {
    for (const child of defs.children) {
      const id = child.getAttribute("id");
      if (!id || !serialized.includes(`url(#${id})`)) {
        dead.add(child);
        for (const descendant of child.querySelectorAll("*")) dead.add(descendant);
      }
    }
  }

  for (const element of root.querySelectorAll("*")) {
    if (dead.has(element)) continue;
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      if (name === "style") {
        for (const { property, value } of colourDeclarations(attribute.value)) {
          checked += 1;
          const problem = colourProblem(value, palette);
          if (problem) problems.push(`<${element.localName} style> ${property}: ${problem}`);
        }
        continue;
      }
      if (!COLOUR_PROPERTIES.has(name)) continue;
      if (styledBy(element, name)) {
        overridden += 1;
        continue;
      }
      checked += 1;
      const problem = colourProblem(attribute.value, palette);
      if (problem) problems.push(`<${element.localName} ${name}> ${problem}`);
    }
  }

  return { checked, skippedRules, overridden, problems };
}
