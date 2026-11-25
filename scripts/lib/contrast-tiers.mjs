/** check:contrast's prefers-contrast tier: each mode's high-contrast block clears its floors and beats the default. */

import { readFileSync } from "node:fs";
import { contrast } from "../../app/lib/contrast.mjs";
import { CSS_PATH, stripCss } from "./tokens.mjs";
import { TEXT, UI } from "./contrast-matrix.mjs";
import { assert, assertPair, darkAttr, light } from "./contrast-model.mjs";

/** Stripped once for the @media tier reader below; the palette blocks come from lib/tokens. */
const css = stripCss(readFileSync(CSS_PATH, "utf8"));

/**
 * The declarations under `selector` inside the `@media ${query}` block, and only inside it: the
 * search is bounded by the block's own closing brace, so a selector missing from the tier throws
 * rather than matching the next rule of that name further down the file.
 *
 * @param {string} label
 * @param {string} query
 * @param {string} selector
 */
function contrastTierBlock(label, query, selector) {
  const head = new RegExp(`@media\\s*${query.replace(/[()]/g, "\\$&")}\\s*\\{`).exec(css);
  if (!head) throw new Error(`${label}: @media ${query} not found in app.css`);
  let depth = 0;
  let end = -1;
  for (let i = head.index + head[0].length - 1; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`${label}: @media ${query} is never closed`);
  const region = css.slice(head.index + head[0].length, end);
  const sel = region.indexOf(selector);
  if (sel === -1) throw new Error(`${label}: ${selector} not found inside @media ${query}`);
  const open = region.indexOf("{", sel + selector.length - 1);
  if (open === -1) throw new Error(`${label}: ${selector} has no block`);
  const close = region.indexOf("}", open);
  if (close === -1) throw new Error(`${label}: ${selector}'s block is never closed`);
  const body = region.slice(open + 1, close);

  /** @type {Record<string, string>} */
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  return out;
}

export function checkPrefersContrast() {
  const TIER = "(prefers-contrast: more)";
  const tierLight = contrastTierBlock("tier light", TIER, '[data-theme="light"]');
  const tierDark = contrastTierBlock("tier dark", TIER, '[data-theme="dark"]');
  /* A reader on "system" whose OS is dark gets THIS block, not the attribute one. Held to the
     attribute tier by parity, as the base palettes are, so the one that is measured below is the
     one they get. */
  const tierSystemDark = contrastTierBlock(
    "tier system dark",
    `${TIER} and (prefers-color-scheme: dark)`,
    ":root:not([data-theme])",
  );
  assert(
    `system-dark prefers-contrast declares the same tokens as the dark tier ` +
      `(${Object.keys(tierSystemDark).sort().join(", ")})`,
    Object.keys(tierSystemDark).sort().join() === Object.keys(tierDark).sort().join(),
  );
  for (const [name, value] of Object.entries(tierDark)) {
    assert(
      `system-dark prefers-contrast ${name} ${tierSystemDark[name]} equals the dark tier's ${value}`,
      String(tierSystemDark[name] ?? "").toLowerCase() === value.toLowerCase(),
    );
  }

  for (const [
    mode,
    tier,
    base,
  ] of /** @type {Array<[string, Record<string,string>, Record<string,string>]>} */ ([
    ["light", tierLight, light],
    ["dark", tierDark, darkAttr],
  ])) {
    for (const surface of ["--page-paper", "--surface-popover"]) {
      assertPair(
        `${mode} prefers-contrast: muted on ${surface}`,
        tier["--text-secondary"],
        base[surface],
        TEXT,
      );
    }
    assertPair(
      `${mode} prefers-contrast: border on --page-paper`,
      tier["--border"],
      base["--page-paper"],
      UI,
    );

    // The tier must be strictly better than the default, or it is a different mode, not a high-contrast one.
    assert(
      `${mode} prefers-contrast raises muted text` +
        ` (${contrast(base["--text-secondary"], base["--page-paper"]).toFixed(2)}` +
        ` -> ${contrast(tier["--text-secondary"], base["--page-paper"]).toFixed(2)})`,
      contrast(tier["--text-secondary"], base["--page-paper"]) >
        contrast(base["--text-secondary"], base["--page-paper"]),
    );
    assert(
      `${mode} prefers-contrast raises the default border` +
        ` (${contrast(base["--border"], base["--page-paper"]).toFixed(2)}` +
        ` -> ${contrast(tier["--border"], base["--page-paper"]).toFixed(2)})`,
      contrast(tier["--border"], base["--page-paper"]) >
        contrast(base["--border"], base["--page-paper"]),
    );
    // The strong edge rides the popover step (the header menu cards), so it is measured there.
    assertPair(
      `${mode} prefers-contrast: strong border on --surface-popover`,
      tier["--border-strong"],
      base["--surface-popover"],
      UI,
    );
    assert(
      `${mode} prefers-contrast raises the strong border` +
        ` (${contrast(base["--border-strong"], base["--surface-popover"]).toFixed(2)}` +
        ` -> ${contrast(tier["--border-strong"], base["--surface-popover"]).toFixed(2)})`,
      contrast(tier["--border-strong"], base["--surface-popover"]) >
        contrast(base["--border-strong"], base["--surface-popover"]),
    );
    // Which value the tier's border takes is a design default; that it clears 3:1 and rises is asserted above.
  }
}
