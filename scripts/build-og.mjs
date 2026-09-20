/**
 * Generates the social card for every post and uploads it to R2.
 *
 *   npm run build:og -- --local|--remote
 *
 * BOUNDARY: BUILD TIME ONLY, in Node, because satori and resvg cannot run in the Worker, and it
 * uploads AND prunes against the keys the CURRENT artifact references while the live site serves
 * what is in D1, so run outside a ship window it deletes every card production points at.
 */

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
 * Hill Country tokens RESOLVED FROM app.css rather than restated, this being Node. TAKEN
 * ENTIRELY FROM THE DARK BLOCK, which is the property: `--on-chrome` and its siblings are
 * ratified against `--surface-chrome` within a theme, so mixing blocks leaves every measured
 * pair. The mark is the exception, sound only because its token is one hex in both by ruling.
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
 * THE WORDMARK, READ OUT OF `app/lib/seo.ts`: a card disagreeing with the page it opens is two
 * identities. Parsed as TEXT, because TypeScript refuses the cross-project specifier, and it
 * fails closed three ways: declaration renamed, block reshaped, or `name` not a plain string.
 *
 * @returns {string}
 */
function siteName() {
  /*
   * THE SHARED STRIPPER: the anchor below is an indexOf on a declaration this file is exactly the
   * kind to quote in prose, and a planted comment was read as the site name.
   */
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
 * The card layout as satori's element objects rather than JSX, so this file needs no build step.
 * EVERYTHING IS DERIVED except WHERE things sit. TWO ANCHORS, ONE AT EACH END: the title block
 * grows UPWARD into the gap, so a long title eats air rather than the meta line.
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

  /*
   * Through the ONE owner of a timestamp as a date a person reads. It returns null rather than
   * "Invalid Date", which would be permanent on an immutable object, so the line is filtered.
   */
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
    /*
     * The mark from `scripts/lib/mark.mjs`, a SEAM: `check:logo` renders this same node against the
     * committed fixture, so the shape is asserted rather than assumed.
     */
    el("div", { style: { display: "flex" } }, markElement()),
    // The gap. Everything below hangs off the foot, so a long title grows up
    // into this and never down into the meta line.
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
          /*
           * SATORI DOES HONOUR `wordBreak`; `overflowWrap` is the one it ignores. It does not replace the
           * character cap, which governs how much text there is rather than one unbreakable word.
           */
          wordBreak: "break-word",
        },
      },
      title,
    ),
    /*
     * Two lines of muted type is a TEXTURE, not something to read; a third would be prose asking to
     * be read at a size it cannot be.
     */
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
    /*
     * THE ONE ACCENT, A MEASURED PAIR: `--focus-ring-on-chrome` against `--surface-chrome` is a
     * check:contrast row at the graphical-object floor. THE NAME IS A DELIBERATE WART: this card
     * draws no focus ring, but that is the only pale gold with a ratified pair against this surface,
     * and a decorative gold wanted as its own thing is a NEW token, not a literal hex here.
     */
    el("div", { style: { display: "flex", width: 84, height: 5, marginTop: 40, background: ACCENT } }),
    /* ASSEMBLED FROM A FILTERED LIST, so an absent date takes its separator with it. */
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

/**
 * The keys the DEPLOYED site is serving, read from D1, prefix STRIPPED rather than rebuilt.
 * FAILS CLOSED BY CONSTRUCTION: not knowing what is live is a reason to delete nothing.
 */
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

  /*
   * LOCAL RENDER MODE touches R2 with nothing and returns BEFORE the prune, since after a template
   * bump every existing object is an orphan and those are what the live site serves.
   */
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
    /*
     * A DRAFT NEVER GETS A CARD: the card RENDERS THE TITLE, so an unpublished headline was public
     * while its page 404d. The rule is IMPORTED, and the prune uses the same list, so a post that
     * stops being visible has its card DELETED rather than merely not rewritten.
     */
    if (!isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt })) {
      skipped += 1;
      console.log(`  skip   ${post.slug} (not publicly visible)`);
      continue;
    }

    // A post with its own cover never gets a generated card.
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

      // LOCAL RENDER MODE stops here: written to the review directory, and R2
      // is not contacted at all.
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

  /*
   * LOCAL RENDER MODE RETURNS HERE, and the ordering is the safety property: after a template bump
   * every existing object is an orphan, and those are what the deployed site is still serving.
   */
  if (outDir) {
    console.log(
      `\n  ${written} card(s) rendered to ${outDir}. ` +
        `Nothing was uploaded and nothing was pruned.\n`,
    );
    return;
  }

  // Prune. The key hashes template version, slug, title and description, so any change abandons the
  // old object. **It will not act on a listing it cannot trust:** `listForPrune` refuses an empty
  // one and one missing a key the corpus still references.
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

  /*
   * THE OG COUPLING LAW, ENFORCED RATHER THAN WRITTEN DOWN. `live` is the keys the CURRENT
   * ARTIFACT references and the deployed site serves what is in D1, so between a retitle and the
   * next sync every key the site serves is an orphan here, and running it 404s every card with no
   * deploy to roll back. The PROPERTY is checkable directly and is stronger than any flag a
   * hurried operator would pass. BOUNDARY: a row pointing at an object already gone looks live.
   */
  if (target === "--remote" && !dryRun && orphans.length > 0) {
    const liveKeys = await liveCardKeys();

    /*
     * SCOPE, ASSERTED: an empty read makes the comparison pass on nothing, and an artifact naming
     * cards while D1 names none IS the unsynced state this guards.
     */
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
