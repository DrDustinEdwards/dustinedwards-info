/**
 * Generates the social card for every post and uploads it to R2.
 *
 *   npm run build:og -- --local|--remote
 *
 * BUILD TIME ONLY, in Node. This is a deliberate deviation from "generation or
 * save" and it is the fallback the spec allows, taken for two measured reasons:
 *
 *   1. Running satori in the Worker means `workers-og` (1.87 MB unpacked) on top
 *      of a Worker already carrying 3.46 MB plus a 0.44 MB WASM binary, for code
 *      that would only ever run on the admin save path.
 *   2. Rasterising needs resvg. The Node build uses the native addon; a Worker
 *      would need the WASM one, and Workers refuse to compile WASM from bytes
 *      (measured 2026-07-28), so it would need the static-import treatment as
 *      well.
 *
 * The gap this leaves is real and recorded: a post created or retitled in the
 * editor has no generated card until someone runs this script and re-syncs. The
 * editor never writes a card URL it cannot back with an object, so the failure
 * mode is a missing image rather than a broken one.
 *
 * Nothing here touches the gated artifact. The KEY is deterministic content;
 * the PNG bytes are not, and are never compared.
 */

import { execSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";

const BUCKET = "dustinedwards-media";
const WIDTH = 1200;
const HEIGHT = 630;

/** Hill Country LIGHT tokens, mirrored from app.css. Kept in sync by hand,
 *  deliberately: the card is an image, so it cannot read a stylesheet.
 *
 *  Light values, always. A card is rendered once and served into a feed that
 *  has no idea which theme the reader prefers, so there is no variant to pick.
 *
 *  Changing any of these MUST bump OG_TEMPLATE_VERSION in pipeline.mjs, or the
 *  key stays the same, the object is served immutable, and every already-cached
 *  card keeps the old colours forever. */
const BRAND = "#4F2D7F";
const FG = "#2B2320";
const MUTED = "#5C5248";
const BG = "#FAF7F2";

/**
 * The card layout, as satori's element objects rather than JSX so this file
 * needs no build step of its own.
 *
 * @param {{ title: string, description: string, tags: string[] }} post
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

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        padding: "64px 72px",
        // The brand bar is the only chrome, so the card reads as this site
        // without needing a logo file.
        borderTop: `16px solid ${BRAND}`,
        fontFamily: "Inter",
      },
    },
    el(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      el(
        "div",
        {
          style: {
            fontSize: 60,
            fontWeight: 700,
            color: FG,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            // satori has no ellipsis, so long titles are clamped by line count.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          },
        },
        post.title,
      ),
      el(
        "div",
        {
          style: {
            marginTop: 24,
            fontSize: 28,
            color: MUTED,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          },
        },
        post.description,
      ),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 24,
        },
      },
      el("div", { style: { color: BRAND, fontWeight: 700 } }, "dustinedwards.info"),
      el(
        "div",
        { style: { color: MUTED } },
        post.tags.slice(0, 3).join("  ") || "",
      ),
    ),
  );
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
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

  const workDir = await mkdtemp(path.join(tmpdir(), "og-"));
  let written = 0;
  let skipped = 0;

  try {
    for (const post of posts) {
      // A post with its own cover never gets a generated card.
      if (post.cover) {
        skipped += 1;
        console.log(`  skip   ${post.slug} (has a cover)`);
        continue;
      }

      const key = ogImageKey(post);
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

      const file = path.join(workDir, path.basename(key));
      await writeFile(file, png);

      // One quoted command string, not an args array. With shell:true an array
      // is concatenated unquoted, and the cache-control value contains a comma
      // and spaces, so wrangler saw three arguments instead of one.
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

  console.log(`build:og ${written} generated, ${skipped} skipped (${target.slice(2)})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `build:og failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
