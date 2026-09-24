// Build time only: satori and resvg cannot run in the Worker. It prunes against the keys the current
// artifact references while the live site serves D1, so run outside a ship window it deletes live cards.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import {
  cardDescription,
  cardTitle,
  titleFontSize,
} from "../app/lib/content/og-card-text.mjs";
import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { longDateUTC } from "../app/lib/long-date.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { stripComments } from "./lib/strip-comments.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";
import { markElement } from "./lib/mark.mjs";
import { listForPrune } from "./lib/r2.mjs";
import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./lib/tokens.mjs";
import { bucketFor, databaseFor } from "./lib/wrangler-config.mjs";

/** DERIVED from the wrangler config: a stale name aims a DELETE at whatever answers to it. */
const BUCKET = bucketFor("OG");
/** Every generated key begins here, and the prune will not look outside it. */
const PREFIX = "og/";
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Taken entirely from the dark block: the chrome tokens are ratified against `--surface-chrome`
 * within a theme, so mixing blocks leaves every measured pair.
 */
const CHROME_BLOCK = tokenBlock("build:og", THEME_SELECTORS.dark);
const {
  ground: GROUND,
  onGround: ON_GROUND,
  onGroundMuted: ON_GROUND_MUTED,
  accent: ACCENT,
} = resolveTokens(
  {
    ground: "--surface-chrome",
    onGround: "--on-chrome",
    onGroundMuted: "--on-chrome-muted",
    accent: "--focus-ring-on-chrome",
  },
  CHROME_BLOCK,
  "build:og",
);

/**
 * Parsed as text, because TypeScript refuses the cross-project specifier.
 *
 * @returns {string}
 */
function siteName() {
  // Stripped first: prose quoting this declaration would satisfy the indexOf below.
  const source = stripComments(readFileSync(path.join("app", "lib", "seo.ts"), "utf8"));
  const at = source.indexOf("export const SITE = {");
  if (at === -1) {
    throw new Error("build:og: app/lib/seo.ts no longer declares `export const SITE = {`");
  }
  const close = source.indexOf("};", at);
  if (close === -1) throw new Error("build:og: app/lib/seo.ts: unterminated SITE block");
  const name = source.slice(at, close).match(/\bname:\s*"([^"]+)"/);
  if (!name) {
    throw new Error("build:og: SITE.name is not a plain string literal in app/lib/seo.ts");
  }
  return name[1];
}

const SITE_NAME = siteName();

/**
 * The title block grows upward into the gap, so a long title eats air rather than the meta line.
 *
 * @param {{
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */
export function card(post) {
  /**
   * @param {string} type
   * @param {any} props
   * @param {...any} children
   * @returns {any}
   */
  const el = (type, props, ...children) => ({
    type,
    props: { ...props, children: children.length === 1 ? children[0] : children },
  });

  /* Both cuts happen HERE, in JavaScript: satori's line clamp reads like a guarantee and is inert. */
  const title = cardTitle(post.title);
  const description = cardDescription(post.description);

  // Filtered, because the formatter returns null rather than "Invalid Date", which would be permanent
  // on an immutable object.
  const date = longDateUTC(post.publishAt);

  /*
   * THE MEASURE: the side padding sets the width og-card-text.mjs's ladder was measured against, and
   * the vertical is the smallest margin at which the mark still reads as placed rather than cropped.
   */
  const PAD_Y = 64;
  const PAD_X = 72;

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: `${PAD_Y}px ${PAD_X}px`,
        background: GROUND,
        fontFamily: "Inter",
      },
    },
    el("div", { style: { display: "flex" } }, markElement()),
    el("div", { style: { display: "flex", flex: 1 } }),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: titleFontSize(title),
          fontWeight: 700,
          color: ON_GROUND,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          // Satori honours `wordBreak` but ignores `overflowWrap`.
          wordBreak: "break-word",
        },
      },
      title,
    ),
    // Two lines of muted type is texture; a third would be prose asking to be read at a size it cannot be.
    description
      ? el(
          "div",
          {
            style: {
              display: "flex",
              marginTop: 22,
              fontSize: 26,
              color: ON_GROUND_MUTED,
              lineHeight: 1.4,
              // Same reason as the title's, and the same measurement. A URL in
              // a description is the realistic form of an unbreakable word.
              wordBreak: "break-word",
            },
          },
          description,
        )
      : null,
    // The only pale gold with a ratified pair against this surface. A decorative gold would be a new
    // token, not a literal hex here.
    el("div", { style: { display: "flex", width: 84, height: 5, marginTop: 40, background: ACCENT } }),
    el(
      "div",
      {
        style: {
          display: "flex",
          marginTop: 22,
          fontSize: 22,
          fontWeight: 700,
          color: ON_GROUND_MUTED,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        },
      },
      [SITE_NAME, date].filter(Boolean).join("  ·  "),
    ),
  );
}

/** Fails closed by construction: not knowing what is live is a reason to delete nothing. */
async function liveCardKeys() {
  const raw = execSync(
    `npx wrangler d1 execute ${databaseFor("DB")} --remote --json ` +
      `--command "SELECT og_image FROM posts WHERE og_image IS NOT NULL"`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  let rows;
  try {
    rows = JSON.parse(raw)?.[0]?.results;
  } catch {
    throw new Error(
      "build:og could not parse the og_image read from D1, so it cannot know " +
        "which cards are live. Nothing was pruned.",
    );
  }
  if (!Array.isArray(rows)) {
    throw new Error(
      "build:og got no result set from D1 for og_image, so it cannot know which " +
        "cards are live. Nothing was pruned.",
    );
  }

  return new Set(rows.map((r) => String(r.og_image).replace(/^\/media\//, "")));
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  const dryRun = process.argv.includes("--dry-run");

  const outFlag = process.argv.indexOf("--out");
  const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : null;
  if (outFlag >= 0 && !outDir) {
    throw new Error("--out needs a directory: npm run build:og -- --out samples");
  }
  const artifact = JSON.parse(await readFile(ARTIFACT_PATH, "utf8"));
  const posts = artifact.posts ?? [];

  /** @type {any[]} */
  const fonts = [
    {
      name: "Inter",
      weight: 400,
      style: "normal",
      data: await readFile(path.join("assets", "fonts", "Inter-Regular.ttf")),
    },
    {
      name: "Inter",
      weight: 700,
      style: "normal",
      data: await readFile(path.join("assets", "fonts", "Inter-Bold.ttf")),
    },
  ];

  // ONE derivation of which posts get a card: two loops applying the cover rule is how a prune
  // deletes the card the writer just uploaded.
  /** @type {Array<{ post: any, key: string }>} */
  const cards = [];
  let skipped = 0;
  for (const post of posts) {
    // A draft never gets a card, because the card renders the title. The prune uses the same list, so a
    // post that stops being visible has its card deleted.
    if (!isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt })) {
      skipped += 1;
      console.log(`  skip   ${post.slug} (not publicly visible)`);
      continue;
    }

    if (post.cover) {
      skipped += 1;
      console.log(`  skip   ${post.slug} (has a cover)`);
      continue;
    }
    cards.push({ post, key: ogImageKey(post) });
  }

  if (outDir) await mkdir(outDir, { recursive: true });

  const workDir = await mkdtemp(path.join(tmpdir(), "og-"));
  let written = 0;

  try {
    for (const { post, key } of cards) {
      if (dryRun) continue;

      // satori's types want a ReactNode; these are the plain element objects it
      // actually accepts, built without JSX so this file needs no build step.
      const svg = await satori(/** @type {any} */ (card(post)), {
        width: WIDTH,
        height: HEIGHT,
        fonts,
      });
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: WIDTH },
      })
        .render()
        .asPng();

      if (outDir) {
        const sample = path.join(outDir, path.basename(key));
        await writeFile(sample, png);
        written += 1;
        console.log(`  render ${sample} (${Math.round(png.length / 1024)} kB)`);
        continue;
      }

      const file = path.join(workDir, path.basename(key));
      await writeFile(file, png);

      // One quoted command string: with shell:true an array is concatenated unquoted, and the value
      // contains a comma and spaces.
      execSync(
        `npx wrangler r2 object put "${BUCKET}/${key}" --file="${file}" ` +
          `--content-type=image/png ` +
          // The key changes whenever the card would, so the object never does.
          `--cache-control="public, max-age=31536000, immutable" ${target}`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );

      written += 1;
      console.log(`  wrote  /media/${key} (${Math.round(png.length / 1024)} kB)`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  // Local render mode returns here, before the prune: after a template bump every existing object is
  // an orphan, and those are what the deployed site still serves.
  if (outDir) {
    console.log(
      `\n  ${written} card(s) rendered to ${outDir}. ` +
        `Nothing was uploaded and nothing was pruned.\n`,
    );
    return;
  }

  // The key hashes template version, slug, title and description. `listForPrune` refuses an empty
  // listing, and one missing a key the corpus still references.
  const live = new Set(cards.map((card) => card.key));
  const present = await listForPrune({
    bucket: BUCKET,
    prefix: PREFIX,
    remote: target === "--remote",
    expected: live,
    label: "prune",
  });
  const orphans = present.map((o) => o.key).filter((key) => !live.has(key));

  console.log(
    `  ${present.length} object(s) under ${PREFIX}, ` +
      `${live.size} referenced by the corpus, ${orphans.length} orphaned`,
  );

  // Between a retitle and the next sync every key the site serves is an orphan here, so a prune then
  // 404s every card with no deploy to roll back. A row pointing at an object already gone looks live.
  if (target === "--remote" && !dryRun && orphans.length > 0) {
    const liveKeys = await liveCardKeys();

    // Scope: an empty read passes on nothing, and an artifact naming cards while D1 names none is the
    // unsynced state this guards.
    if (live.size > 0 && liveKeys.size === 0) {
      throw new Error(
        `build:og REFUSED to prune. The artifact references ${live.size} card(s) ` +
          `and D1 reports NO og_image at all, so either the corpus has never been ` +
          `synced or this read looked in the wrong place. Either way it cannot ` +
          `tell which objects are live. Nothing was pruned.`,
      );
    }

    const wouldBreak = orphans.filter((key) => liveKeys.has(key));
    if (wouldBreak.length > 0) {
      throw new Error(
        `build:og REFUSED to prune: ${wouldBreak.length} of ${orphans.length} ` +
          `orphan(s) are cards THE LIVE SITE IS SERVING RIGHT NOW.\n\n` +
          wouldBreak.map((k) => `  ${k}`).join("\n") +
          `\n\nThe artifact has moved since the last sync:content, so this run ` +
          `would upload the new cards and delete the ones production points at, ` +
          `in one pass, with no deploy to roll back.\n\n` +
          `Run this adjacent to sync:content inside a ship window. Nothing was ` +
          `pruned.`,
      );
    }

    console.log(
      `  coupling check: ${liveKeys.size} card(s) live in D1, none of them orphaned`,
    );
  }

  let pruned = 0;
  for (const key of orphans) {
    if (dryRun) {
      console.log(`  ORPHAN ${key}`);
      continue;
    }
    execSync(`npx wrangler r2 object delete "${BUCKET}/${key}" ${target}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    pruned += 1;
    console.log(`  pruned ${key}`);
  }

  console.log(
    `build:og ${written} generated, ${skipped} skipped, ` +
      `${dryRun ? `${orphans.length} orphaned (dry run, nothing changed)` : `${pruned} pruned`} ` +
      `(${target.slice(2)})`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:og failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
