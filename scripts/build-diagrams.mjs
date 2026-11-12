import { errorMessage } from "@dustinedwards/site-runtime/log";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES } from "@drdustinedwards/site-helpers/render/diagram";
import { drawDiagrams, pruneDiagrams } from "@drdustinedwards/site-helpers/render/diagram-draw";

import { BLOG_DIAGRAM_KEYS, inlineAssetNames } from "../app/lib/content/blog-diagrams.mjs";
import { DIAGRAM_ROLE_TOKENS } from "../app/lib/content/diagram.mjs";
import { ASSET_PREFIX } from "../app/lib/media/classify.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";
import { diagramsFrom } from "./lib/artifact-diagrams.mjs";
import { deleteFloor } from "./lib/delete-floor.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";
import { isMain } from "./lib/is-main.mjs";
import { buildAssetManifest } from "./build-assets.mjs";

const DIAGRAM_DIR = path.join("public", DIAGRAM_ASSET_DIR);

async function main() {
  const diagrams = diagramsFrom(JSON.parse(await readFile(ARTIFACT_PATH, "utf8")), ARTIFACT_PATH);
  // These three are drawn inline. Mermaid must not write their light/dark files back.
  const mermaid = diagrams.filter((d) => !BLOG_DIAGRAM_KEYS.has(d.key));

  let removed = 0;
  for (const name of inlineAssetNames()) {
    try {
      await unlink(path.join(DIAGRAM_DIR, name));
      removed += 1;
      console.log(`  pruned /${DIAGRAM_ASSET_DIR}/${name}`);
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
    }
  }

  if (mermaid.length === 0) {
    console.log(`build:diagrams ${diagrams.length} inline, 0 mermaid, ${removed} pruned`);
    if (removed > 0) await buildAssetManifest();
    return;
  }

  // Prelum draws what is missing, in Mermaid's own renderer, and refuses a drawing that paints a color outside these.
  const { written, current, stale } = await drawDiagrams({
    diagrams: mermaid.map((d) => ({ ...d, label: d.posts.join(", ") })),
    dir: DIAGRAM_DIR,
    assetPrefix: ASSET_PREFIX,
    colors: {
      light: resolveTokens(
        DIAGRAM_ROLE_TOKENS,
        tokenBlock("light", THEME_SELECTORS.light),
        "light",
      ),
      dark: resolveTokens(DIAGRAM_ROLE_TOKENS, tokenBlock("dark", THEME_SELECTORS.dark), "dark"),
    },
    force: process.argv.includes("--force"),
  });

  // Prune: an upsert keyed by filename leaves a deleted diagram on disk forever, and the write path
  // alone is not enough.
  const refusal = deleteFloor({
    what: "diagram files",
    keeping: mermaid.length * DIAGRAM_THEMES.length,
    removing: stale.length,
  });
  if (refusal) {
    throw new Error(
      `REFUSED to prune: ${refusal}. Nothing was deleted from ${DIAGRAM_DIR}; check the artifact ` +
        `with npm run build:content before deleting diagrams by hand.`,
    );
  }
  await pruneDiagrams(DIAGRAM_DIR, stale);
  for (const name of stale) console.log(`  pruned /${DIAGRAM_ASSET_DIR}/${name}`);

  console.log(
    `build:diagrams ${diagrams.length} diagrams (${mermaid.length} mermaid), ${written.length} rendered, ` +
      `${current} already current, ${stale.length} pruned`,
  );

  // The media index cannot be rebuilt from here, needing the Worker's binding, so this says so loudly.
  if (written.length > 0 || stale.length > 0) {
    try {
      await buildAssetManifest();
    } catch (error) {
      throw new Error(`build:assets failed after diagrams changed. ${errorMessage(error)}`, {
        cause: error,
      });
    }
    console.log(
      `\n  NOTE: ${written.length + stale.length} diagram asset(s) changed, so the media index is now\n` +
        `        stale, and the health check's media-index-drift reports it until it\n` +
        `        is rebuilt. Press "Rebuild media index" on /admin/media.\n`,
    );
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`build:diagrams failed. ${errorMessage(error)}`);
    process.exit(1);
  });
}
