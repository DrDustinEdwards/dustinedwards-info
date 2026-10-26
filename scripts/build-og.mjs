// Build time only: satori and resvg cannot run in the Worker. It prunes against the keys the current
// artifact references while the live site serves D1, so run outside a ship window it deletes live cards.
// The target is never defaulted: `-- --remote` or `-- --local` on every run that touches R2.

import { execSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import {
  cardDescription,
  cardTitle,
  ogImageKey,
  titleFontSize,
} from "../app/lib/content/og-card-text.mjs";
import { contentPageCardInput, hasPageCard } from "../app/lib/content-pages.mjs";
import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { longDateUTC } from "../app/lib/long-date.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { ARTIFACT_PATH, renderContentPages } from "./build-content.mjs";
import { deleteFloor, requirePosts } from "./lib/delete-floor.mjs";
import { markElement } from "./lib/mark.mjs";
import { listForPrune } from "./lib/r2.mjs";
import { requireTarget } from "./lib/target-flag.mjs";
import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./lib/tokens.mjs";
import { bucketFor, databaseFor } from "./lib/wrangler-config.mjs";
import { isMain } from "./lib/is-main.mjs";

/** DERIVED from the wrangler config: a stale name aims a DELETE at whatever answers to it. */
const BUCKET = bucketFor("OG");
/** Every generated key begins here, and the prune will not look outside it. */
const PREFIX = "og/";
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Ink on paper, from the light block: a card is drawn once and shown in feeds with no idea of the
 * reader's theme, and the paper ground is the site's own. Every pair here is measured on --paper.
 */
const PAPER_BLOCK = tokenBlock("build:og", THEME_SELECTORS.light);
const {
  ground: GROUND,
  ink: INK,
  muted: MUTED,
} = resolveTokens(
  {
    ground: "--paper",
    ink: "--text-heading",
    muted: "--text-secondary",
  },
  PAPER_BLOCK,
  "build:og",
);

/* SITE.name in app/lib/seo.ts is this same field. */
const SITE_NAME = IDENTITY.name;

/*
 * The poster's own colors: Capsomer's purple ramp (light 3, 8, 10 and 12) under its amber sun, as
 * Capsid's card sets its teal (explorer/og-card.mjs). Fixed, not read from the theme: the scene is a
 * picture, and every word on the card sits on the paper or the ink band, whose pairs are measured.
 */
const SKY = "#f4efff";
const HILL = "#b29ae3";
const PLAIN = "#7d50c1";
const NIGHT = "#1d162c";
const SUN = "#f0b429";

/**
 * A phage come down on the plain like a lander: the head a hexagon, the tail, three legs. In the night
 * ink, as the poster's craft.
 * @param {number} x the foot of the tail @param {number} y @param {number} r the head's radius
 */
function phage(x, y, r) {
  const head = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i;
      return `${(x + r * Math.cos(a)).toFixed(1)},${(y - 2.6 * r + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  const top = y - 1.6 * r;
  return [
    { type: "polygon", props: { points: head, fill: NIGHT } },
    { type: "rect", props: { x: x - r * 0.18, y: top, width: r * 0.36, height: 1.2 * r, fill: NIGHT } },
    ...[-1, 0, 1].map((d) => ({
      type: "path",
      props: { d: `M${x} ${y - 0.4 * r} L${x + d * 1.1 * r} ${y + 0.25 * r}`, stroke: NIGHT, strokeWidth: r * 0.14 },
    })),
  ];
}

/**
 * The scene: a travel poster in the manner of JPL's Visions of the Future (2016), after the 1930s
 * national-park posters. Flat layered shapes, the sun over the hills, three phages on the plain. It is
 * drawn 300px tall and set at the foot of the space the words leave, on more of its sky, so a long
 * title crops the sky, never the plain.
 */
function scene() {
  return {
    type: "svg",
    props: {
      width: WIDTH,
      height: 300,
      viewBox: `0 0 ${WIDTH} 300`,
      style: { position: "absolute", left: 0, bottom: 0 },
      children: [
        { type: "rect", props: { width: WIDTH, height: 300, fill: SKY } },
        { type: "circle", props: { cx: 930, cy: 150, r: 110, fill: SUN } },
        { type: "path", props: { d: "M0 200 L180 160 L360 186 L560 140 L760 180 L960 148 L1200 182 L1200 300 L0 300Z", fill: HILL } },
        { type: "path", props: { d: "M0 250 L240 226 L470 246 L700 220 L940 240 L1200 226 L1200 300 L0 300Z", fill: PLAIN } },
        ...phage(260, 262, 20),
        ...phage(640, 254, 26),
        ...phage(1010, 262, 18),
      ],
    },
  };
}

/**
 * The poster over the title block: the scene with the mark on its sky, then the title, the description
 * and the meta line on the paper, as before. The title block keeps the side padding og-card-text.mjs's
 * ladder was measured against, and grows upward into the scene.
 *
 * @param {{
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */
function card(post) {
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

  /* THE MEASURE: the side padding sets the width og-card-text.mjs's ladder was measured against. */
  const PAD_X = 72;

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: GROUND,
        fontFamily: "Schibsted Grotesk",
      },
    },
    el(
      "div",
      { style: { display: "flex", position: "relative", flex: 1, minHeight: 120, overflow: "hidden", padding: `40px ${PAD_X}px`, background: SKY } },
      scene(),
      el("div", { style: { display: "flex", position: "relative" } }, markElement()),
    ),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", padding: `36px ${PAD_X}px 0` } },
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Source Serif 4",
            fontSize: titleFontSize(title),
            fontWeight: 700,
            color: INK,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            // Satori honors `wordBreak` but ignores `overflowWrap`.
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
                marginTop: 18,
                fontSize: 26,
                color: MUTED,
                lineHeight: 1.4,
                // Same reason as the title's. A URL in a description is the realistic form of an
                // unbreakable word.
                wordBreak: "break-word",
              },
            },
            description,
          )
        : null,
    ),
    // The foot as the livery's band: the site and the date in light type on the night ink.
    el(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          marginTop: 28,
          padding: `16px ${PAD_X}px`,
          background: NIGHT,
          borderTop: `8px solid ${PLAIN}`,
          color: SKY,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.16em",
        },
      },
      el("div", { style: { display: "flex" } }, SITE_NAME.toUpperCase()),
      el("div", { style: { display: "flex", fontWeight: 400, letterSpacing: "0.04em" } }, date ?? ""),
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

/**
 * ONE derivation of which posts and pages get a card: two loops applying the cover rule is how a prune
 * deletes the card the writer just uploaded. A page is carded by its root (CARDED_PAGE_ROOTS in
 * app/lib/content-pages.mjs), and its route names the same key through contentPageCardPath.
 * @param {any[]} posts
 * @param {Array<{ path: string, seoTitle: string, description: string }>} pages
 */
function selectCards(posts, pages) {
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
  for (const page of pages) {
    if (!hasPageCard(page.path)) continue;
    const post = contentPageCardInput(page);
    cards.push({ post, key: ogImageKey(post) });
  }
  // A post slug of the `page-` form could name a page's card; drawing both under one key would leave
  // whichever rendered last serving for the other.
  const seen = new Set();
  for (const { key } of cards) {
    if (seen.has(key)) throw new Error(`build:og: two cards share the key ${key}. Nothing was rendered.`);
    seen.add(key);
  }
  return { cards, skipped };
}

/**
 * Renders every card, to `outDir` when given and otherwise to R2 at `target`.
 * @param {Array<{ post: any, key: string }>} cards
 * @param {{ dryRun: boolean, outDir: string | null, target: string | null, fonts: any[] }} options
 */
async function render(cards, { dryRun, outDir, target, fonts }) {
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
  return written;
}

/**
 * Deletes the cards under PREFIX the corpus no longer references, behind the live-card coupling
 * check and the delete floor. The key hashes template version, slug, title and description.
 * `listForPrune` refuses an empty listing, and one missing a key the corpus still references.
 * @param {Array<{ post: any, key: string }>} cards
 * @param {string} target @param {boolean} dryRun
 */
async function prune(cards, target, dryRun) {
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

  // A template bump orphans exactly the old half; more than that is an artifact that lost posts.
  const refusal = deleteFloor({
    what: "social cards",
    keeping: present.length - orphans.length,
    removing: orphans.length,
  });
  if (refusal) {
    throw new Error(`build:og REFUSED to prune: ${refusal}. Nothing was pruned.`);
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
  return { orphans, pruned };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const outFlag = process.argv.indexOf("--out");
  const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : null;
  if (outFlag >= 0 && !outDir) {
    throw new Error("--out needs a directory: npm run build:og -- --out samples");
  }
  // --out renders to disk and never reaches R2, so only it may run without a target.
  const target = outDir ? null : requireTarget(process.argv.slice(2), "build:og");
  const posts = requirePosts(JSON.parse(await readFile(ARTIFACT_PATH, "utf8")), ARTIFACT_PATH);

  /** @type {any[]} */
  const fonts = [
    {
      // The site's interface face. satori reads woff but not woff2, so these are the latin woff files.
      name: "Schibsted Grotesk",
      weight: 400,
      style: "normal",
      data: await readFile(path.join("assets", "fonts", "SchibstedGrotesk-Regular.woff")),
    },
    {
      name: "Schibsted Grotesk",
      weight: 700,
      style: "normal",
      data: await readFile(path.join("assets", "fonts", "SchibstedGrotesk-Bold.woff")),
    },
    {
      // A static instance of the served variable file (wght 700, opsz 60): satori reads neither
      // woff2 nor variation axes. check:fonts pins it to the served family.
      name: "Source Serif 4",
      weight: 700,
      style: "normal",
      data: await readFile(path.join("assets", "fonts", "SourceSerif4-Display-Bold.ttf")),
    },
  ];

  const { cards, skipped } = selectCards(posts, await renderContentPages());

  const written = await render(cards, { dryRun, outDir, target, fonts });

  // Local render mode returns here, before the prune: after a template bump every existing object is
  // an orphan, and those are what the deployed site still serves.
  if (outDir || !target) {
    console.log(
      `\n  ${written} card(s) rendered to ${outDir}. ` +
        `Nothing was uploaded and nothing was pruned.\n`,
    );
    return;
  }

  const { orphans, pruned } = await prune(cards, target, dryRun);

  console.log(
    `build:og ${written} generated, ${skipped} skipped, ` +
      `${dryRun ? `${orphans.length} orphaned (dry run, nothing changed)` : `${pruned} pruned`} ` +
      `(${target.slice(2)})`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:og failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
