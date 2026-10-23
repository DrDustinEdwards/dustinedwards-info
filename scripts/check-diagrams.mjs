import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  diagramAssetPath,
  DIAGRAM_ASSET_DIR,
  DIAGRAM_THEME_TOKENS,
  DIAGRAM_THEMES,
} from "../app/lib/content/diagram.mjs";
import { renderBody } from "../app/lib/content/pipeline.mjs";
import { auditDiagramSvg } from "./lib/diagram-audit.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";

const fileName = (/** @type {string} */ key, /** @type {string} */ theme) =>
  basename(diagramAssetPath(key, theme));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIAGRAM_DIR = join(root, "public", DIAGRAM_ASSET_DIR);
const ARTIFACT = join(root, "content", "generated", "posts.json");

let declarations = 0;
const tally = createTally({ print: false });
const { ok: assert, failed: failures } = tally;

// The model and its markup are Prelum's and tested there; this holds the site's configured renderer to the alt rule.
{
  const body = ':::diagram{title="T"}\n```mermaid\nflowchart LR\n  A --> B\n```\n:::\n';
  const refused = await renderBody({ file: "gate.md", body, resolveImage: async () => ({ width: 1, height: 1 }) }).then(
    () => false,
    (error) => /requires an alt attribute/.test(String(error?.message)),
  );
  assert("a diagram with no alt fails", refused);
}

const themeBlocks = {
  light: tokenBlock("light", THEME_SELECTORS.light),
  dark: tokenBlock("dark", THEME_SELECTORS.dark),
  darkSystem: tokenBlock("dark (system)", THEME_SELECTORS.darkSystem),
};

for (const [key, token] of Object.entries(DIAGRAM_THEME_TOKENS)) {
  assert(`${key} names a token, not a color`, /^--[a-z0-9-]+$/.test(token));
  // Both theme blocks land on the same element and do not cascade into one another, so a token
  // forgotten in dark keeps its LIGHT value and the diagram is drawn light on a dark page.
  assert(`${key} (${token}) exists in the light theme`, token in themeBlocks.light);
  assert(`${key} (${token}) exists in the dark theme`, token in themeBlocks.dark);
  assert(
    `${key} (${token}) agrees across both dark blocks`,
    themeBlocks.dark[token] === themeBlocks.darkSystem[token],
  );
}

/** @param {"light" | "dark"} theme */
function paletteFor(theme) {
  try {
    const palette = resolveTokens(DIAGRAM_THEME_TOKENS, themeBlocks[theme], theme);
    assert(`the ${theme} palette resolves`, true);
    return palette;
  } catch (error) {
    assert(error instanceof Error ? error.message : String(error), false);
    return {};
  }
}

/** @type {Record<string, Record<string, string>>} */
const palettes = { light: paletteFor("light"), dark: paletteFor("dark") };
assert(
  "the two palettes differ, so the pair is not two copies of one drawing",
  Object.keys(palettes.light).length > 0 &&
    JSON.stringify(palettes.light) !== JSON.stringify(palettes.dark),
);

if (!existsSync(ARTIFACT)) {
  failures.push(`the artifact is missing at ${ARTIFACT}; run build:content`);
} else {
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  /** @type {Map<string, { posts: string[] }>} */
  const referenced = new Map();
  for (const post of artifact.posts ?? []) {
    for (const diagram of post.diagrams ?? []) {
      const found = referenced.get(diagram.key);
      if (found) found.posts.push(post.slug);
      else referenced.set(diagram.key, { posts: [post.slug] });
    }
  }

  for (const [key, { posts }] of referenced) {
    for (const theme of DIAGRAM_THEMES) {
      const file = join(DIAGRAM_DIR, fileName(key, theme));
      const present = existsSync(file);
      assert(
        `${posts.join(", ")} references ${fileName(key, theme)}, which is on disk`,
        present,
      );
      if (!present) continue;

      const svg = readFileSync(file, "utf8");
      // An <img> needs an intrinsic size or the browser falls back to 300x150.
      assert(
        `${fileName(key, theme)} carries an explicit width and height`,
        /<svg\b[^>]*\swidth="\d+"[^>]*\sheight="\d+"/.test(svg.slice(0, 4000)),
      );
      // foreignObject is not rendered when an SVG is loaded through <img>, so a
      // diagram carrying one comes out with blank labels on the page while
      // looking correct in a standalone viewer.
      assert(`${fileName(key, theme)} has no foreignObject`, !svg.includes("foreignObject"));

      const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
      // Tallied apart from `checks`: added in, a few hundred declarations hid a skipped block from the floor.
      declarations += audit.checked;
      assert(
        `${fileName(key, theme)} uses only ratified token colors` +
          (audit.problems.length > 0 ? `: ${audit.problems.join("; ")}` : ""),
        audit.problems.length === 0,
      );
      assert(`${fileName(key, theme)} had colors to check`, audit.checked > 0);
    }
  }

  const onDisk = existsSync(DIAGRAM_DIR)
    ? readdirSync(DIAGRAM_DIR).filter((n) => n.endsWith(".svg"))
    : [];
  const live = new Set(
    [...referenced.keys()].flatMap((k) => DIAGRAM_THEMES.map((t) => fileName(k, t))),
  );
  for (const name of onDisk) {
    assert(`${name} is referenced by a post (run build:diagrams to prune)`, live.has(name));
  }

  // Not set just under the measurement: these counts are content, and a post may drop a diagram.
  assert(`the artifact yielded diagrams to check (${referenced.size} referenced)`, referenced.size >= 2);
  assert(`the diagram directory yielded assets to check (${onDisk.length} on disk)`, onDisk.length >= 4);

  console.log(
    `check:diagrams ${referenced.size} diagrams referenced, ${onDisk.length} assets on disk`,
  );
}

// Measured by running it, never summed: 198 checks and 202 declarations on 2026-10-23, over 3 diagrams.
const MINIMUM_CHECKS = 190;
const floorBreach = assertFloor("check:diagrams", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);
const MINIMUM_DECLARATIONS = 190;
const declarationBreach = assertFloor(
  "check:diagrams",
  "declarations",
  declarations,
  MINIMUM_DECLARATIONS,
  "The color audit examined fewer declarations than the committed diagrams carry.",
);
if (declarationBreach) failures.push(declarationBreach);

if (failures.length > 0) {
  console.error(`check:diagrams FAILED ${tally.failures} of ${tally.checks} assertions\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check:diagrams passed ${tally.checks} assertions`);
