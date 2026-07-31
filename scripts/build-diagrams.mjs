/**
 * Renders every `:::diagram` in the corpus to a static SVG asset.
 *
 *   npm run build:diagrams [-- --force]
 *
 * BUILD TIME ONLY, in Node, driving a real Chromium through mermaid-cli. That is
 * not a preference, it is the ruling (Capsid `dustinedwards/chart-stack.md`) and
 * it was decided by measurement: diagram layout needs real font metrics, so
 * mermaid on a DOM shim dies at `CSSStyleSheet is not defined` with
 * `SVGTextElement.getBBox()` behind it, and Pintora at `Cannot set properties of
 * null (setting 'font')`. Charts pass the both-writers rule and render inline;
 * diagrams cannot and take the social-card pattern instead.
 *
 * The gap that leaves is the same one social cards have and it is recorded
 * rather than papered over: a diagram authored or edited in the admin editor has
 * no asset until this runs. The post still renders, with a missing image, which
 * is why `check:diagrams` fails on a referenced asset that is not on disk.
 *
 * Nothing here touches the gated artifact. The KEY is deterministic content and
 * lives in the artifact; the SVG bytes come out of a browser engine and are
 * exactly the kind of input a byte-comparison gate must never be handed.
 *
 * Two renders per diagram, light and dark. Forced, not chosen, and both halves
 * were measured:
 *
 *   1. mermaid will not accept a custom property. `themeVariables:
 *      { primaryColor: "var(--surface)" }` fails the render outright with
 *      `Error: Unsupported color format: "var(--surface-2)"`, because khroma
 *      parses every value to derive the ones it was not given.
 *   2. An SVG referenced by `<img>` is an independent document, so even a
 *      successfully embedded `var()` would resolve against nothing. And this
 *      site resolves its theme from a cookie, not from the OS, so a
 *      `prefers-color-scheme` block inside the asset would hand a reader who
 *      chose light under a dark OS the wrong drawing.
 */

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderMermaid } from "@mermaid-js/mermaid-cli";
import puppeteer from "puppeteer";

import {
  DIAGRAM_ASSET_DIR,
  DIAGRAM_THEMES,
  DIAGRAM_THEME_TOKENS,
} from "../app/lib/content/diagram.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";
import { auditDiagramSvg } from "./lib/diagram-audit.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";

export const DIAGRAM_DIR = path.join("public", DIAGRAM_ASSET_DIR);

/**
 * The id mermaid writes onto the SVG root and prefixes every internal id with.
 *
 * Set explicitly rather than left to mermaid-cli's default, so the bytes do not
 * move if that default ever does. Two diagrams on one page cannot collide on it:
 * each asset is its own document behind its own `<img>`.
 */
const SVG_ID = "diagram";

/** Fixed, so nothing about the output depends on the machine it was built on. */
const VIEWPORT = { width: 1200, height: 800, deviceScaleFactor: 1 };

/**
 * The font stack the diagram is laid out with, and the one it is displayed in.
 *
 * A recorded limitation rather than a solved problem. The site's prose is Inter,
 * loaded as a webfont, and an SVG inside an `<img>` may not load external
 * resources, so a diagram cannot be set in Inter without embedding the font in
 * every asset. It is set in the system sans instead, which also means the
 * viewer's font is not guaranteed to be the one this build measured text with:
 * mermaid bakes box sizes from the metrics it sees. A wider font on the reader's
 * machine eats into node padding rather than being clipped, which is why the
 * padding below is generous rather than default.
 */
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colours already resolved from app.css
 * @returns {import("mermaid").MermaidConfig}
 */
function mermaidConfig(theme, colours) {
  return {
    // "base" is the only built-in theme whose variables are fully overridable;
    // every other one hardcodes part of its palette.
    theme: "base",
    // Everything khroma would otherwise derive is supplied. What is not supplied
    // still gets derived, which is why the audit exists rather than trusting
    // this list to be complete.
    themeVariables: { ...colours, darkMode: theme === "dark", fontFamily: FONT_FAMILY },
    // Labels as real <text>, never <foreignObject>. Measured: mermaid's default
    // wraps flowchart labels in foreignObject, and foreignObject is not rendered
    // at all when an SVG is loaded through <img>, so every node would come out
    // blank on the page while looking correct in a standalone viewer.
    htmlLabels: false,
    flowchart: { htmlLabels: false, padding: 12, useMaxWidth: false },
    // Tightened from mermaid's defaults, and the reason is layout rather than
    // taste. The prose column is 44rem, so a drawing wider than about 700px is
    // scaled down by `max-width: 100%` and takes its type with it: a default
    // five-participant sequence diagram came out 1210px, which lands 16px text
    // at an effective 9px. Narrowing the gaps shrinks the drawing without
    // shrinking the text, which is the only lever that helps.
    sequence: {
      useMaxWidth: false,
      wrap: false,
      actorMargin: 24,
      width: 120,
      boxMargin: 8,
      noteMargin: 8,
      messageMargin: 28,
      // The mirrored row of actors at the foot repeats what the head already
      // said and costs height a figure this size cannot spare.
      mirrorActors: false,
    },
  };
}

/**
 * Makes the SVG sizeable by an `<img>`.
 *
 * mermaid emits `width="100%"` plus an inline `max-width`. Inside an `<img>`
 * that is an SVG with no intrinsic width, and the browser falls back to the
 * default 300x150 replaced-element size instead of the drawing's own. The
 * viewBox already carries the real size, so it is copied onto the root and the
 * `max-width` that would fight `app.css` is dropped.
 *
 * Done with a targeted rewrite of the ROOT TAG rather than by parsing and
 * re-serialising: an `.svg` file is served as XML and parsed strictly, so a
 * serialiser that emits one unclosed tag produces a file that renders as
 * nothing.
 *
 * @param {string} svg
 * @param {string} label
 */
function sizeRoot(svg, label) {
  const openTag = svg.match(/<svg\b[^>]*>/);
  if (!openTag) throw new Error(`${label}: no <svg> root tag`);
  const viewBox = openTag[0].match(/viewBox="([\d.\-\s]+)"/);
  if (!viewBox) throw new Error(`${label}: root <svg> has no viewBox to size from`);
  const [, , width, height] = viewBox[1].trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`${label}: viewBox "${viewBox[1]}" has no usable size`);
  }

  const rewritten = openTag[0]
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace(/max-width:\s*[^;"]+;?\s*/, "")
    .replace(/<svg\b/, `<svg width="${Math.ceil(width)}" height="${Math.ceil(height)}"`);

  return svg.replace(openTag[0], rewritten);
}

/**
 * Renders one source at one theme.
 *
 * mermaid-cli's own `renderMermaid` against a browser this script owns, rather
 * than the `mmdc` command. Three reasons, the first of them measured here:
 *
 *   1. Node refuses to spawn the `npx.cmd` shim without `shell: true`, exiting
 *      `spawnSync npx.cmd EINVAL`, and `shell: true` concatenates an argument
 *      array WITHOUT quoting, which has already split one value containing
 *      spaces into three arguments in this repo. Temp paths on this host sit
 *      under a user directory whose name can contain anything.
 *   2. One browser serves every render instead of one launch per file.
 *   3. The source and the config never touch a temp file or a command line, so
 *      nothing can be mangled on the way in.
 *
 * @param {import("puppeteer").Browser} browser
 * @param {string} source
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colours
 * @param {string} label
 */
async function render(browser, source, theme, colours, label) {
  const { data } = await renderMermaid(browser, source, "svg", {
    backgroundColor: "transparent",
    mermaidConfig: mermaidConfig(theme, colours),
    svgId: SVG_ID,
    viewport: VIEWPORT,
  });
  return sizeRoot(Buffer.from(data).toString("utf8"), label);
}

async function main() {
  const force = process.argv.includes("--force");

  const artifact = JSON.parse(await readFile(ARTIFACT_PATH, "utf8"));
  /** @type {Array<{ posts: string[], key: string, source: string }>} */
  const diagrams = [];
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const post of artifact.posts ?? []) {
    for (const diagram of post.diagrams ?? []) {
      const at = seen.get(diagram.key);
      if (at !== undefined) {
        // The same drawing in two posts is one asset, by construction: the key
        // is a hash of the source and nothing else.
        diagrams[at].posts.push(post.slug);
        continue;
      }
      seen.set(diagram.key, diagrams.length);
      diagrams.push({ posts: [post.slug], key: diagram.key, source: diagram.source });
    }
  }

  const light = resolveTokens(
    DIAGRAM_THEME_TOKENS,
    tokenBlock("light", THEME_SELECTORS.light),
    "light",
  );
  const dark = resolveTokens(
    DIAGRAM_THEME_TOKENS,
    tokenBlock("dark", THEME_SELECTORS.dark),
    "dark",
  );
  /** @type {Record<string, Record<string, string>>} */
  const palettes = { light, dark };

  await mkdir(DIAGRAM_DIR, { recursive: true });

  const outstanding = diagrams.flatMap((diagram) =>
    DIAGRAM_THEMES.filter(
      (theme) => force || !existsSync(path.join(DIAGRAM_DIR, `${diagram.key}-${theme}.svg`)),
    ).map((theme) => ({ diagram, theme })),
  );
  const skipped = diagrams.length * DIAGRAM_THEMES.length - outstanding.length;

  // The browser is only launched when there is something to draw, so a build
  // with every asset already current costs nothing and needs no Chromium.
  const browser = outstanding.length > 0 ? await puppeteer.launch() : null;

  let written = 0;
  try {
    for (const { diagram, theme } of outstanding) {
      const file = path.join(DIAGRAM_DIR, `${diagram.key}-${theme}.svg`);
      const label = `${diagram.key}-${theme}`;
      const svg = await render(
        /** @type {import("puppeteer").Browser} */ (browser),
        diagram.source,
        /** @type {"light" | "dark"} */ (theme),
        palettes[theme],
        label,
      );

      // Audited before it is written, so a colour mermaid derived rather than
      // took from the palette stops the build instead of shipping.
      const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
      if (audit.problems.length > 0) {
        throw new Error(
          `${label} (${diagram.posts.join(", ")}) uses colours that are not ratified tokens:\n` +
            audit.problems.map((p) => `    ${p}`).join("\n"),
        );
      }

      await writeFile(file, svg, "utf8");
      written += 1;
      console.log(
        `  wrote  /${DIAGRAM_ASSET_DIR}/${diagram.key}-${theme}.svg ` +
          `(${Math.round(svg.length / 1024)} kB, ${audit.checked} colours checked, ` +
          `${audit.overridden} attributes overridden, ${audit.skippedRules} unreachable rules)`,
      );
    }
  } finally {
    await browser?.close();
  }

  // Prune. An upsert keyed by filename leaves a deleted diagram on disk forever,
  // and the same reasoning already applies to the Ask index: the write path
  // alone is not enough, something has to remove what the corpus no longer
  // names.
  const live = new Set(
    diagrams.flatMap((d) => DIAGRAM_THEMES.map((t) => `${d.key}-${t}.svg`)),
  );
  let pruned = 0;
  for (const name of await readdir(DIAGRAM_DIR)) {
    if (!name.endsWith(".svg") || live.has(name)) continue;
    await unlink(path.join(DIAGRAM_DIR, name));
    pruned += 1;
    console.log(`  pruned /${DIAGRAM_ASSET_DIR}/${name}`);
  }

  console.log(
    `build:diagrams ${diagrams.length} diagrams, ${written} rendered, ` +
      `${skipped} already current, ${pruned} pruned`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:diagrams failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
