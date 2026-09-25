import { parseHTML } from "linkedom";

import { normalizeHex } from "./tokens.mjs";

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

// `currentColor` is safe because it resolves to `color`, which is itself audited.
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
 * By brace depth, not splitting on `}`: mermaid's stylesheet opens with nested at-rules. Unbalanced
 * braces throw: a stray `}` drove the depth negative and every later rule was silently lost.
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
      if (depth < 0) throw new Error(`unbalanced stylesheet: a "}" at offset ${i} closes nothing`);
      if (depth === 0) {
        out.push({
          selector: text.slice(start, selectorEnd).trim(),
          body: text.slice(selectorEnd + 1, i),
        });
        start = i + 1;
      }
    }
  }
  if (depth !== 0) throw new Error(`unbalanced stylesheet: ${depth} "{" never closed`);
  return out;
}

/** At-rules whose body is more rules, applied when a condition holds, so their rules are audited. */
const GROUPING_AT_RULES = /^@(media|supports|layer|container|document|scope)\b/i;

/**
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
 * Allowlist, not a hex hunt, so rgb(), hsl() and named colors are caught too.
 *
 * @param {string} value
 * @param {Set<string>} palette
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
 * @param {string} svg
 * @param {string[]} paletteHexes
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

  /** @type {Array<{ selectors: string[], properties: Set<string> }>} */
  const styling = [];

  /**
   * Conditional group rules (`@media (prefers-color-scheme: dark)`) are recursed into, since they
   * paint whenever their condition holds; any other at-rule (`@keyframes`) is audited whole, since
   * its colors paint when the animation runs and it has no element to be unreachable from.
   *
   * @param {string} text
   */
  const auditRules = (text) => {
    for (const rule of cssRules(text)) {
      if (GROUPING_AT_RULES.test(rule.selector)) {
        auditRules(rule.body);
        continue;
      }
      const declarations = colourDeclarations(rule.body);
      if (declarations.length === 0) continue;
      if (rule.selector.startsWith("@")) {
        for (const { property, value } of declarations) {
          checked += 1;
          const problem = colourProblem(value, palette);
          if (problem) problems.push(`${rule.selector} { ${property}: ${problem} }`);
        }
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
          // Unparseable selectors count as reachable, so the rule is audited rather than skipped.
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
  };
  for (const style of document.querySelectorAll("style")) auditRules(style.textContent ?? "");

  /**
   * A presentation attribute a stylesheet rule overrides is never painted.
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

  // Unreferenced `<defs>` children are never painted. A reference is `url(#id)` (markers, gradients)
  // or an `href` to `#id` (`<use>`), and both keep the target audited.
  const serialized = root.toString();
  /** @type {Set<string>} */
  const hrefs = new Set();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const name of ["href", "xlink:href"]) {
      const value = element.getAttribute(name);
      if (value?.startsWith("#")) hrefs.add(value.slice(1));
    }
  }
  /** @type {Set<Element>} */
  const dead = new Set();
  for (const defs of document.querySelectorAll("defs")) {
    for (const child of defs.children) {
      const id = child.getAttribute("id");
      if (!id || (!serialized.includes(`url(#${id})`) && !hrefs.has(id))) {
        dead.add(child);
        for (const descendant of child.querySelectorAll("*")) dead.add(descendant);
      }
    }
  }

  // The root itself carries attributes too (mermaid writes its background into `style`).
  for (const element of [root, ...root.querySelectorAll("*")]) {
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
