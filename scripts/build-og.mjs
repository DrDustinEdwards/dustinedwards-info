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
 *
 * ## THE COUPLING LAW, NOW ENFORCED
 *
 * **This script uploads AND prunes in one pass**, against the keys the current
 * artifact references. The live site serves what is in D1's `og_image`, which
 * changes only when `sync:content` runs. Run this outside a ship window, after
 * any retitle or template bump, and it deletes every card production points at.
 * Since 2026-08-21 a guard before the prune reads the live keys out of D1 and
 * REFUSES if any of them is about to be deleted.
 *
 * `/og-samples/` in `.gitignore` is LOAD-BEARING, not cosmetic: `ship` refuses
 * untracked files, so without the ignore every `--out` review run would have to
 * be cleaned by hand before the next ship.
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
import { stripComments } from "./lib/strip-comments.mjs";
import { ARTIFACT_PATH } from "./build-content.mjs";
import { markElement } from "./lib/mark.mjs";
import { listForPrune } from "./lib/r2.mjs";
import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./lib/tokens.mjs";
import { bucketFor, databaseFor } from "./lib/wrangler-config.mjs";

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
  fg: FG,
  bg: BG,
} = resolveTokens(
  {
    chrome: "--surface-chrome",
    onChrome: "--on-chrome",
    onChromeMuted: "--on-chrome-muted",
    fg: "--text",
    bg: "--bg",
  },
  LIGHT,
  "build:og",
);

/**
 * THE WORDMARK, READ OUT OF `app/lib/seo.ts`. The string is not spelled here.
 *
 * `SITE.name` is what the site header renders beside this same mark, and a card
 * that disagrees with the page it opens is two identities. So the card takes
 * the value from the module that owns it, the way the colours take theirs from
 * `app.css` and the mark takes its geometry from the ratified fixtures.
 *
 * READ AS TEXT, NOT IMPORTED, and the reason is measured rather than assumed.
 * Node loads `seo.ts` directly: it imports nothing, and type stripping has been
 * on by default since 22.18 against this package's declared `node >=22.22.0`
 * floor. TypeScript is the one that refuses. `npx tsc -b` on
 * `import { SITE } from "../app/lib/seo.ts"` fails twice, TS5097 for the `.ts`
 * specifier without `allowImportingTsExtensions`, and TS6307 because `seo.ts`
 * belongs to the app project and not to `tsconfig.node.json`. Fixing that means
 * turning on a compiler flag for every script and pulling app sources into the
 * node project's file list, which is a much larger change than one wordmark
 * justifies. Bundling it through esbuild, as `check:invariants` does to
 * `schema.ts`, would put a bundler on the card path to read one string.
 *
 * So it is parsed, and it fails closed three ways: the declaration renamed, the
 * block shaped differently, or `name` given anything but a plain string.
 *
 * @returns {string}
 */
function siteName() {
  /*
   * THE SHARED STRIPPER, and this site was NOT in the audit's inventory of
   * nine. It stripped BLOCK comments only, which is weaker than every other
   * reader of a .ts file in this repo, and the anchor below is an indexOf on a
   * declaration that seo.ts is exactly the kind of file to quote in prose.
   *
   * MEASURED 2026-08-23 by planting `// export const SITE = { name: "WRONG" };`
   * above the real declaration: block-only stripping found the COMMENT first
   * and read WRONG as the site name, so every social card would have been
   * rendered with it. Nothing would have failed; the cards would just be wrong.
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
        // The mark itself, from `scripts/lib/mark.mjs`, which reads the
        // ratified fixtures and owns how the mark is drawn. This file owns only
        // where it sits, which is the 24px of air before the wordmark.
        //
        // That module is a SEAM, not a convenience: `check:logo` renders this
        // same node and compares the result against a rasterisation of the
        // committed fixture, so the shape this card embeds is asserted rather
        // than assumed.
        markElement({ marginRight: 24 }),
        // The wordmark is the NAME, from `siteName()` above rather than a
        // string spelled again here.
        //
        // The card briefly said `dustinedwards.info`, on the reasoning that a
        // feed is doing attribution and the address is the actionable thing.
        // Researched and reversed: every platform that renders one of these
        // previews already prints the domain beneath it, from the URL, so the
        // card was spending its only line of chrome type on the one string the
        // reader was getting anyway, while the name appeared nowhere in the
        // preview at all. And this band is the header: same mark, so the same
        // wordmark beside it. A card that says something different from the
        // page it opens is two identities, not one.
        el(
          "div",
          { style: { color: ON_CHROME, fontWeight: 700, fontSize: 32 } },
          SITE_NAME,
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

/**
 * The card keys the DEPLOYED site is actually serving, read from D1.
 *
 * `sync-content.mjs` writes `og_image` as `/media/${ogImageKey(post)}`, so the
 * stored value is this bucket's key with one prefix on the front. That prefix is
 * STRIPPED here rather than the key rebuilt, because rebuilding it would be a
 * second copy of a rule sync already owns.
 *
 * FAILS CLOSED BY CONSTRUCTION. An unreadable database, a wrangler error, or a
 * response that is not the expected shape all throw out of here, and the prune
 * below never runs. That is the correct direction: not knowing what is live is a
 * reason to delete nothing, never a reason to proceed.
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

  /*
   * ==========================================================================
   * THE OG COUPLING LAW, ENFORCED RATHER THAN WRITTEN DOWN. Added 2026-08-21.
   * ==========================================================================
   *
   * **This script UPLOADS AND PRUNES IN ONE PASS, and the two halves disagree
   * about what "live" means.** `live` above is the set of keys the CURRENT
   * ARTIFACT references. The DEPLOYED site serves the keys in D1's `og_image`
   * column, and those change only when `sync:content` runs.
   *
   * So after any retitle, retag, or `OG_TEMPLATE_VERSION` bump, and BEFORE the
   * next sync, every key the live site is serving is an orphan by this script's
   * definition. **Run it then and it 404s every social card on the site, with no
   * deploy having occurred and nothing to roll back.**
   *
   * That was a law with no enforcement: "run it only inside a ship window,
   * adjacent to sync:content." Two things made that weak. **ship does not invoke
   * this script at all**, so there is no ship context to detect. And the law
   * lived in a Capsid paragraph, where the 2026-08-21 consolidation deleted it.
   *
   * ## WHY THIS SHAPE, RATHER THAN REFUSING OUTSIDE A SHIP WINDOW
   *
   * "Am I inside a ship window" is not a question this process can answer
   * honestly, and any flag it checked would be one a hurried operator passes.
   * The PROPERTY the law protects is checkable directly: **no object the live
   * site is currently pointing at may be deleted.** So that is what is asserted,
   * and it is strictly stronger, because it also catches a divergence arising
   * for a reason nobody anticipated.
   *
   * `listForPrune` already refuses a listing it cannot trust. This is the other
   * side of the same worry: a listing that is perfectly correct, against a
   * corpus that has moved.
   *
   * ## OBSERVATION BOUNDARY
   *
   * It compares against what D1 SAYS, not against what R2 holds or what a
   * browser would fetch. A card row pointing at an object that is already gone
   * looks live here. It also runs only for `--remote` and only when there is
   * something to delete, because those are the only conditions under which the
   * law can be broken.
   */
  if (target === "--remote" && !dryRun && orphans.length > 0) {
    const liveKeys = await liveCardKeys();

    /*
     * SCOPE, ASSERTED. An empty read makes the comparison below pass by
     * examining nothing, which is this repo's most repeated defect class. And
     * if the artifact references cards while D1 names none, that IS the
     * unsynced state this guard exists for, so it refuses rather than shrugs.
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
