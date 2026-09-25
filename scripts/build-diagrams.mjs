import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { renderMermaid } from "@mermaid-js/mermaid-cli";
import puppeteer from "puppeteer";

import {
  DIAGRAM_ASSET_DIR,
  DIAGRAM_THEMES,
  DIAGRAM_THEME_TOKENS,
  diagramAssetPath,
} from "../app/lib/content/diagram.mjs";

const fileName = (/** @type {string} */ key, /** @type {string} */ theme) =>
  path.basename(diagramAssetPath(key, theme));
import { ARTIFACT_PATH } from "./build-content.mjs";
import { diagramsFrom } from "./lib/artifact-diagrams.mjs";
import { deleteFloor } from "./lib/delete-floor.mjs";
import { auditDiagramSvg } from "./lib/diagram-audit.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";
import { isMain } from "./lib/is-main.mjs";

export const DIAGRAM_DIR = path.join("public", DIAGRAM_ASSET_DIR);

/** Set explicitly so the bytes do not move if the tool's default does. */
const SVG_ID = "diagram";

/** Fixed, so nothing about the output depends on the machine it was built on. */
const VIEWPORT = { width: 1200, height: 800, deviceScaleFactor: 1 };

/**
 * An SVG inside an `<img>` may not load external resources, so the viewer's font may differ from the
 * one this build measured with, which is why the padding below is generous.
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
    // Labels as real text, never `<foreignObject>`: a foreignObject is not rendered at all through
    // `<img>`, so every node would come out blank on the page while looking correct standalone.
    htmlLabels: false,
    flowchart: { htmlLabels: false, padding: 12, useMaxWidth: false },
    // Tightened from the defaults, for layout rather than taste: a wider drawing is scaled down and
    // takes its type with it, and narrowing the gaps shrinks the drawing without shrinking the text.
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
 * Inside an `<img>` a percentage width means no intrinsic width, so the viewBox size is copied onto
 * the root. A targeted rewrite rather than re-serializing, because an `.svg` is parsed strictly.
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
 * The renderer's API rather than its CLI: Node will not spawn the shim without a shell, and a shell
 * joins an argument array without quoting.
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

  const diagrams = diagramsFrom(JSON.parse(await readFile(ARTIFACT_PATH, "utf8")), ARTIFACT_PATH);

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
      (theme) => force || !existsSync(path.join(DIAGRAM_DIR, fileName(diagram.key, theme))),
    ).map((theme) => ({ diagram, theme })),
  );
  const skipped = diagrams.length * DIAGRAM_THEMES.length - outstanding.length;

  // The browser is only launched when there is something to draw, so a build
  // with every asset already current costs nothing and needs no Chromium.
  const browser = outstanding.length > 0 ? await puppeteer.launch() : null;

  let written = 0;
  try {
    for (const { diagram, theme } of outstanding) {
      const file = path.join(DIAGRAM_DIR, fileName(diagram.key, theme));
      const label = `${diagram.key}-${theme}`;
      const svg = await render(
        /** @type {import("puppeteer").Browser} */ (browser),
        diagram.source,
        /** @type {"light" | "dark"} */ (theme),
        palettes[theme],
        label,
      );

      // Audited before it is written, so a color mermaid derived rather than
      // took from the palette stops the build instead of shipping.
      const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
      if (audit.problems.length > 0) {
        throw new Error(
          `${label} (${diagram.posts.join(", ")}) uses colors that are not ratified tokens:\n` +
            audit.problems.map((p) => `    ${p}`).join("\n"),
        );
      }

      await writeFile(file, svg, "utf8");
      written += 1;
      console.log(
        `  wrote  ${diagramAssetPath(diagram.key, theme)} ` +
          `(${Math.round(svg.length / 1024)} kB, ${audit.checked} colors checked, ` +
          `${audit.overridden} attributes overridden, ${audit.skippedRules} unreachable rules)`,
      );
    }
  } finally {
    await browser?.close();
  }

  // Prune: an upsert keyed by filename leaves a deleted diagram on disk forever, and the write path
  // alone is not enough.
  const live = new Set(
    diagrams.flatMap((d) => DIAGRAM_THEMES.map((t) => fileName(d.key, t))),
  );
  const onDisk = (await readdir(DIAGRAM_DIR)).filter((name) => name.endsWith(".svg"));
  const stale = onDisk.filter((name) => !live.has(name));
  const refusal = deleteFloor({
    what: "diagram files",
    keeping: onDisk.length - stale.length,
    removing: stale.length,
  });
  if (refusal) {
    throw new Error(
      `REFUSED to prune: ${refusal}. Nothing was deleted from ${DIAGRAM_DIR}; check the artifact ` +
        `with npm run build:content before deleting diagrams by hand.`,
    );
  }
  let pruned = 0;
  for (const name of stale) {
    await unlink(path.join(DIAGRAM_DIR, name));
    pruned += 1;
    console.log(`  pruned /${DIAGRAM_ASSET_DIR}/${name}`);
  }

  console.log(
    `build:diagrams ${diagrams.length} diagrams, ${written} rendered, ` +
      `${skipped} already current, ${pruned} pruned`,
  );

  // The media index cannot be rebuilt from here, needing the Worker's binding, so this says so loudly.
  if (written > 0 || pruned > 0) {
    const manifest = spawnSync("node scripts/build-assets.mjs", {
      encoding: "utf8",
      shell: true,
    });
    process.stdout.write(manifest.stdout ?? "");
    if (manifest.status !== 0) {
      process.stderr.write(manifest.stderr ?? "");
      throw new Error("build:assets failed after diagrams changed");
    }
    console.log(
      `\n  NOTE: ${written + pruned} diagram asset(s) changed, so the media index is now\n` +
        `        stale, and the health check's media-index-drift reports it until it\n` +
        `        is rebuilt. Press "Rebuild media index" on /admin/media.\n`,
    );
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:diagrams failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
