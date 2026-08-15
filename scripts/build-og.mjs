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
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";
import { listForPrune } from "./lib/r2.mjs";
import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./lib/tokens.mjs";
import { bucketFor } from "./lib/wrangler-config.mjs";

/**
 * The derived-card bucket, DERIVED from the wrangler config rather than named
 * here.
 *
 * It used to be the literal `"dustinedwards-media"`. That was survivable while
 * this script only ever PUT objects; it stopped being survivable when the prune
 * landed, because a stale literal aims a DELETE at whatever bucket still answers
 * to that name. Reading the binding means a rename in the config is a rename
 * here, and a binding that no longer exists is a named error rather than a
 * silent no-op against the wrong bucket.
 */
const BUCKET = bucketFor("OG");
/** Every generated key begins here, and the prune will not look outside it. */
const PREFIX = "og/";
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Hill Country LIGHT tokens, RESOLVED FROM app.css rather than restated.
 *
 * These were four hex literals, defended by a comment saying the card is an
 * image and so cannot read a stylesheet. That conflates two different moments.
 * The RENDERED CARD is an image and cannot read CSS when someone looks at it;
 * this SCRIPT runs in Node at build time and can read app.css perfectly well,
 * which is exactly what `scripts/lib/tokens.mjs` exists for and exactly what
 * the diagram renderer already does. The diagram renderer also produces images.
 *
 * So the restatement bought nothing and cost the stated-once law: the palette
 * moved to purple chrome at v4 and these four sat unchanged, which is the
 * silent disagreement the shared reader was written to end.
 *
 * Light values, always. A card is rendered once and served into a feed that has
 * no idea which theme the reader prefers, so there is no variant to pick.
 *
 * Changing WHICH TOKENS the card uses, or the layout, MUST still bump
 * OG_TEMPLATE_VERSION in pipeline.mjs. Resolving a value no longer requires an
 * edit here, but it does still change the rendered card, so a RETUNED TOKEN in
 * app.css now moves the card without touching this file. That is the intended
 * behaviour and the reason the version bump is a judgement rather than a
 * mechanical consequence of editing this line.
 */
const LIGHT = tokenBlock("build:og", THEME_SELECTORS.light);
const {
  chrome: CHROME,
  onChrome: ON_CHROME,
  onChromeMuted: ON_CHROME_MUTED,
  mark: MARK,
  fg: FG,
  bg: BG,
} = resolveTokens(
  {
    chrome: "--surface-chrome",
    onChrome: "--on-chrome",
    onChromeMuted: "--on-chrome-muted",
    mark: "--mark-on-chrome",
    fg: "--text",
    bg: "--bg",
  },
  LIGHT,
  "build:og",
);

/**
 * THE REAL MARK, READ FROM THE RATIFIED ASSETS. No path data is stated here.
 *
 * The first draft of this band drew a filled round in `--mark-on-chrome` and
 * called it the mark. It was a placeholder, and it never shipped: the site's
 * identity in a feed would have been a circle nothing else in the repo draws.
 *
 * The mark's single source is `app/components/site-logo.tsx`, which the Worker
 * renders, and the four `public/*.svg` are the fixtures `check:logo` derives
 * from and compares it against IN BOTH DIRECTIONS. A Node script cannot import
 * the .tsx module without a build step, so it reads the fixtures the gate
 * already binds that module to. That is the same source one hop along a link
 * something else keeps honest, not a second copy: hand-edit either side and
 * `check:logo` fails before this script is ever run.
 *
 * WHICH PATHS ARE THE BRAND PATHS IS DERIVED, NOT LISTED. The light and dark
 * fixtures are identical except for the fills on the five purple paths, so the
 * paths whose fill DIFFERS between the two files are exactly the ones that take
 * a brand colour, and the three warm ones (identical in both) keep the fill the
 * asset gives them. Nothing here restates a hex or a path index, and the brand
 * fill substituted in is `--mark-on-chrome` resolved above, the token the real
 * header binds the mark to on brand surface.
 *
 * It fails closed on every way the fixtures could stop agreeing: a different
 * viewBox, a different path count, a path whose geometry differs between the
 * variants, or no differing fill at all (which would mean the brand paths were
 * no longer identifiable and would silently paint the mark in asset colours).
 *
 * @returns {{ viewBox: string, width: number, height: number, paths: Array<{ fill: string, d: string }> }}
 */
function readMark() {
  /** @param {string} file */
  const parse = (file) => {
    const source = readFileSync(path.join("public", file), "utf8");
    const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`build:og: ${file} has no viewBox`);
    const paths = [
      ...source.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\s*\/>/g),
    ].map((m) => ({ fill: m[1].toUpperCase(), d: m[2] }));
    if (paths.length === 0) throw new Error(`build:og: ${file} has no paths`);
    return { file, viewBox, paths };
  };

  // The HEADER crop, 78 15 232 328, because this band is the header. The square
  // master would sit in a 132px band surrounded by its own whitespace.
  const light = parse("logo-header.svg");
  const dark = parse("logo-header-dark.svg");
  if (light.viewBox !== dark.viewBox) {
    throw new Error(`build:og: ${light.file} and ${dark.file} disagree on the viewBox`);
  }
  if (light.paths.length !== dark.paths.length) {
    throw new Error(
      `build:og: ${light.file} has ${light.paths.length} paths, ` +
        `${dark.file} has ${dark.paths.length}`,
    );
  }

  const paths = light.paths.map((p, i) => {
    if (p.d !== dark.paths[i].d) {
      throw new Error(`build:og: path ${i} differs in geometry between the two fixtures`);
    }
    return { fill: p.fill === dark.paths[i].fill ? p.fill : MARK, d: p.d };
  });
  const branded = paths.filter((p) => p.fill === MARK).length;
  if (branded === 0) {
    throw new Error("build:og: no path changes fill between the fixtures, so none is the brand");
  }

  /*
   * SIZED FROM THE viewBox, AND THE viewBox PADDED TO THE BOX, never guessed.
   *
   * A width that is not the viewBox's aspect times the height is a squashed
   * mark, and satori will not say so. The subtler failure is the one measured
   * here: satori LAYS OUT at integer pixels but writes the embedded svg at the
   * viewBox's exact aspect, so 232x328 at 64px tall gives a 45.27px-wide image
   * inside a 45px-wide box, and resvg letterboxes the difference. The mark then
   * renders 0.4% short and 0.2px off centre, which is invisible and is also
   * enough to stop the render matching the fixture pixel for pixel, which is
   * how this mark is proved.
   *
   * So the CROP is padded, symmetrically, until its aspect is exactly the
   * integer box's. Only the empty margin around the mark moves; no path is
   * touched, and the padding here is 1.96 viewBox units, under a fifth of a
   * rendered pixel.
   */
  const [x, y, boxWidth, boxHeight] = light.viewBox.split(/\s+/).map(Number);
  const height = 64;
  const width = Math.round((height * boxWidth) / boxHeight);
  const want = width / height;
  const grow =
    boxWidth / boxHeight > want
      ? { dx: 0, dy: boxWidth / want - boxHeight }
      : { dx: boxHeight * want - boxWidth, dy: 0 };
  const viewBox = [
    x - grow.dx / 2,
    y - grow.dy / 2,
    boxWidth + grow.dx,
    boxHeight + grow.dy,
  ].join(" ");

  return { viewBox, width, height, paths };
}

const SITE_MARK = readMark();

/**
 * The card layout, as satori's element objects rather than JSX so this file
 * needs no build step of its own.
 *
 * @param {{ title: string, tags: string[] }} post
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

  /**
   * THE LINE CLAMP DOES NOT WORK, AND HAS NEVER WORKED.
   *
   * The title and the description both carried `display: -webkit-box` with
   * `WebkitLineClamp`, and a comment saying satori has no ellipsis so long
   * titles are clamped by line count. Measured on satori 0.29.0 while building
   * this card: rendering the same overlong string with and without the clamp
   * produces 269194 and 269341 bytes of SVG, one glyph path each. The property
   * is inert.
   *
   * It went unnoticed because the v2 layout was `space-between` on a full-height
   * canvas, which gave unclamped text room to sprawl without visibly colliding
   * with anything. The chrome band and foot rule take 144px of that room.
   *
   * So the clamp is done HERE, in JavaScript, where it actually happens. Cutting
   * on a word boundary rather than mid-word, and only when the text exceeds the
   * cap, so nothing short is touched. The description is gone, so the title is
   * the only caller left, and it is exactly the one that needed a real clamp:
   * it is the block that would otherwise run into the foot rule.
   *
   * @param {string} value
   * @param {number} max
   */
  const clamp = (value, max) => {
    const text = (value ?? "").trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/, "")}…`;
  };

  /*
   * CHROME v4. The site's header and footer are BRAND SURFACE, so the card that
   * represents the site in a feed carries the same identity: a purple band at
   * the top holding the wordmark, and the reading area on the page canvas.
   *
   * This is the same relationship the page itself has, which is the point. The
   * previous card was canvas everywhere with a 16px purple rule, chosen when
   * purple was an accent rather than the chrome. Under v4 that reads as an old
   * version of the site.
   *
   * Binding rule 7 is respected: the TITLE sits on the canvas, not on the brand
   * surface. Only the mark, the wordmark and the tags ride the chrome, and all
   * three take ratified on-chrome pairs.
   *
   * THE BANDS ARE 132 AND 12 ON PURPOSE, and everything that has to be read
   * stays inside them. Platforms crop a 1.91:1 card differently and several of
   * them crop the edges, so a band is the right place for the identity (it
   * survives being trimmed, and nothing is lost if it is) and the wrong place
   * for the title.
   */
  const BAND = 132;

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        fontFamily: "Inter",
      },
    },
    // The chrome band. Wordmark left, tags right, exactly as the site header
    // carries the wordmark and its nav.
    el(
      "div",
      {
        style: {
          height: BAND,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: CHROME,
          padding: "0 72px",
        },
      },
      el(
        "div",
        { style: { display: "flex", alignItems: "center" } },
        // The mark itself, from `readMark` above. satori takes an inline `svg`
        // node and emits it as an `<image>` whose href is the same markup
        // URL-encoded, so the path data reaches resvg VERBATIM: no re-fitting,
        // no simplification, no reinterpretation of the arcs. Measured on
        // satori 0.29.0, and the sample renders are compared against a direct
        // resvg rasterisation of the fixture rather than looked at.
        el(
          "svg",
          {
            width: SITE_MARK.width,
            height: SITE_MARK.height,
            viewBox: SITE_MARK.viewBox,
            style: { marginRight: 24 },
          },
          ...SITE_MARK.paths.map((p) => el("path", { fill: p.fill, d: p.d })),
        ),
        // The wordmark is the DOMAIN, not the person, which is what v2 put in
        // its foot and what the previous draft of this band replaced with the
        // name. A card in a feed is doing attribution, and the thing a reader
        // can act on is the address; the person is already attached to every
        // one of these posts as the author, in the same markup that carries
        // this image.
        //
        // It does NOT match the site header, which renders SITE.name, "Dustin
        // Edwards", beside the same mark (app/lib/seo.ts). That divergence is
        // deliberate and one-directional: a header is read by someone already
        // on the site, where the domain is in the address bar.
        el(
          "div",
          { style: { color: ON_CHROME, fontWeight: 700, fontSize: 32 } },
          "dustinedwards.info",
        ),
      ),
      el(
        "div",
        { style: { color: ON_CHROME_MUTED, fontSize: 24 } },
        post.tags.slice(0, 3).join("   ") || "",
      ),
    ),
    /*
     * The reading area, on canvas. THE TITLE, AND NOTHING ELSE.
     *
     * The description was here at 28px and has been REMOVED, not shortened:
     *
     *   1. A card is delivered at roughly 300 to 600px wide in a timeline. At
     *      the 1200px it is rendered, 28px type scales to between 7 and 14px on
     *      the reader's screen, which is below the size at which a second block
     *      of prose is read rather than seen.
     *   2. It was the same sentence twice. The same route that emits this
     *      image emits `og:description` beside it, and that is the post's own
     *      description unless a per-post `ogDescription` override replaces it
     *      (`postSocial`, app/lib/seo.ts). The platform renders that next to
     *      the card as selectable text at a legible size. Putting it on the
     *      card too printed it once readable and once cut off.
     *
     * The 128-character clamp went with it, along with the `--text-muted`
     * resolution, which had no other reader. Both blocks were vertically
     * centred as a pair; the title is now centred alone, which is why the type
     * moved from 60px to 72px rather than staying put with more air.
     */
    el(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 72px",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: 72,
            fontWeight: 700,
            color: FG,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          },
        },
        /*
         * 110 characters, and every number here is a measurement off a rendered
         * card rather than an estimate. Ink is the bounding box of pixels that
         * are not the background, in the canvas region, at 1200x630.
         *
         *   67 chars, the longest real title:  3 lines, ink y 263..499,
         *                                      119px clear of the foot rule
         *   36 chars, the shortest:            2 lines, ink y 304..443
         *   110 chars of ordinary prose:       5 lines, ink y 180..568,
         *                                      50px clear
         *   109 chars SHOUTED IN CAPITALS:     5 lines, ink y 183..581,
         *                                      37px clear
         *
         * So the cap is set where the widest realistic title still clears the
         * rule, and the corpus is nowhere near it. Two honest limits: the cap
         * counts CHARACTERS and the constraint is WIDTH, so a synthetic string
         * of nothing but capital Ws in short words fills the canvas to within
         * 4px; and an unbroken word wider than the 1056px measure runs off the
         * right edge, because satori has no word-break. The longest token in
         * any real title is 12 characters against roughly 28 that would fit.
         */
        clamp(post.title, 110),
      ),
    ),
    // A quiet foot rule in the chrome colour, so the card is bracketed rather
    // than top-heavy. Not text, so it carries no contrast obligation.
    el("div", { style: { display: "flex", height: 12, background: CHROME } }),
  );
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  const dryRun = process.argv.includes("--dry-run");

  /*
   * LOCAL RENDER MODE: `--out <dir>` renders every card to disk and touches R2
   * with nothing. No put, no list, no delete.
   *
   * It exists because a restyle needs a review stop, and neither existing mode
   * provides one: the normal run uploads AND prunes in the same pass, and
   * `--dry-run` skips the render entirely, so there was no way to look at a
   * proposed card before it became the live one. An aesthetic decision that
   * cannot be seen before it ships is not a decision.
   *
   * It returns BEFORE the prune for the same reason it skips the upload. See
   * the prune's own comment: with a bumped template version every existing
   * object becomes an orphan by definition, and the objects the live site is
   * currently serving are exactly the ones that would be deleted.
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

  // ONE derivation of "which posts get a card", used by the writer below and by
  // the prune after it. Two loops each applying the cover rule for themselves is
  // how a prune ends up deleting the card the writer just uploaded.
  /** @type {Array<{ post: any, key: string }>} */
  const cards = [];
  let skipped = 0;
  for (const post of posts) {
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

  /*
   * LOCAL RENDER MODE RETURNS HERE, before the prune, and the ordering is the
   * safety property rather than a tidiness one.
   *
   * The prune below computes orphans as "present in R2 and not referenced by
   * the CURRENT corpus". After an OG_TEMPLATE_VERSION bump every existing
   * object is an orphan by that definition, and those objects are precisely the
   * ones the DEPLOYED site is still serving, because the live card URLs live in
   * D1 and only change when `sync:content` runs at ship. So a plain run of this
   * script during a restyle would upload the new cards and delete every card
   * the live site currently points at, in one pass.
   */
  if (outDir) {
    console.log(
      `\n  ${written} card(s) rendered to ${outDir}. ` +
        `Nothing was uploaded and nothing was pruned.\n`,
    );
    return;
  }

  // Prune. `build:diagrams` has had one since it shipped; cards never did, so
  // every OG_TEMPLATE_VERSION bump and every retitle has left an orphan behind:
  // the key is a hash of the template version, slug, title and description, so
  // changing any of them writes a NEW object and abandons the old one under a
  // name nothing will ever ask for again.
  //
  // **It will not act on a listing it cannot trust.** On 2026-08-02 a run
  // printed `WSARecv(): #64 The specified network name is no longer available`
  // in the middle of its output and carried on to report one orphan. It was
  // right that time, and a run that had been cut short would have looked
  // identical. `listForPrune` refuses an empty listing outright and refuses one
  // that is missing any key the corpus still references, because a listing
  // demonstrably missing objects that exist proves nothing about the objects it
  // appears not to have.
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
