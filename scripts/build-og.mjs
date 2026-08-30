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
 * Hill Country tokens, RESOLVED FROM app.css rather than restated.
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
 * ## THE DARK BLOCK, since the v4 card, and it is a choice rather than a mode
 *
 * A card is rendered once and served into a feed that has no idea which theme
 * the reader prefers, so there is no variant to PICK and there never was: what
 * this line chooses is which ratified surface the card is PAINTED ON. The
 * previous card was the page canvas with a purple band across the top, so it
 * took light values. This one is the deep plum surface edge to edge, and that
 * surface is the DARK block's `--surface-chrome`.
 *
 * Taking the whole set from one block is the property that matters, not which
 * block it is. `--on-chrome`, `--on-chrome-muted` and `--mark-on-chrome` are
 * ratified AGAINST `--surface-chrome` within a theme, and `check:contrast`
 * carries all three as matrix rows evaluated in every block. Mixing a light
 * foreground onto a dark ground would leave the card outside every pair the
 * palette has measured, which is the one thing this file must not do.
 *
 * `--mark-on-chrome` is the same hex in both blocks by ruling, so the mark
 * `scripts/lib/mark.mjs` resolves from the light block and the accent resolved
 * here cannot disagree. That is a coincidence worth naming rather than relying
 * on silently: if the ruling is ever reversed, this file resolves its own copy
 * and `check:logo` renders the other one.
 *
 * Changing WHICH TOKENS the card uses, or the layout, MUST still bump
 * OG_TEMPLATE_VERSION in pipeline.mjs. Resolving a value no longer requires an
 * edit here, but it does still change the rendered card, so a RETUNED TOKEN in
 * app.css now moves the card without touching this file. That is the intended
 * behaviour and the reason the version bump is a judgement rather than a
 * mechanical consequence of editing this line.
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
    accent: "--mark-on-chrome",
  },
  CHROME_BLOCK,
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
 * ## THE v4 CARD, and what it is derived from
 *
 * Every value here comes from something already ratified: the ground and the
 * three foreground colours are the chrome family from `app.css`, the mark is
 * `scripts/lib/mark.mjs` at the geometry `check:logo` pins, the wordmark is
 * `SITE.name`, the date is `longDateUTC`, the meta line's tracking and case are
 * `.eyebrow`'s, and the fitted type is `app/lib/content/og-card-text.mjs`.
 * Nothing on this card is invented here except WHERE things sit.
 *
 * ## THE GROUND IS THE WHOLE CARD, which is the change
 *
 * The previous card was the page canvas with a purple band across the top and a
 * purple rule across the foot. That was the right picture of a site whose
 * chrome is a band; it is the wrong picture of one whose identity IS the plum
 * surface. Full bleed also survives the crop: platforms trim a 1.91:1 card
 * differently, and a design whose meaning lives in two 12px-to-132px strips at
 * the edges is a design that loses its meaning to a crop it cannot see.
 *
 * ## BINDING RULE 7, NAMED RATHER THAN QUIETLY LEFT BEHIND
 *
 * design-tokens.md rule 7 says body prose sits on the page canvas, never on
 * cards. The previous template cited it to justify putting the title on the
 * canvas. It does not reach this: rule 7 governs READING SURFACES, the places a
 * person reads paragraphs, and its "cards" are the site's index cards. A social
 * card carries a headline, one sentence and a byline at a size chosen to be
 * seen rather than read, and it is one immutable image with no reading mode to
 * degrade. What rule 7 protects, prose legibility over a long read, is not the
 * property under test here; the contrast pairs are, and every pair the card
 * paints is a `check:contrast` matrix row.
 *
 * ## THE MARK IS IN A CORNER AND THE TEXT HANGS OFF THE FOOT
 *
 * Two anchors, one at each end, and nothing floating in the middle. The title
 * block grows UPWARD into the empty space as the title gets longer, so a long
 * title eats air rather than walking into the meta line. That is what makes the
 * fitted ladder a safety net rather than the only thing holding the layout
 * together.
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

  /*
   * THE TEXT AS DRAWN, from the module `ogImageKey` hashes through.
   *
   * Both cuts happen HERE rather than in the layout, and both happen in
   * JavaScript rather than in CSS, because satori's line clamp does not work
   * and has never worked: rendering the same overlong string with and without
   * `WebkitLineClamp` produced one glyph path of difference, measured on satori
   * 0.29.0 while the previous template was built. The property is inert. A
   * clamp that reads like a guarantee and is not one is worse than no clamp,
   * and it survived two templates.
   */
  const title = cardTitle(post.title);
  const description = cardDescription(post.description);

  /*
   * The date, through the ONE owner of "a timestamp as a date a person reads".
   *
   * `longDateUTC` returns null rather than the string "Invalid Date", which is
   * the defect it was extracted to end, and null is why the meta line below is
   * assembled from a filtered list instead of a template string. A card reading
   * "Dustin Edwards . Invalid Date" would be a permanent, immutable object.
   */
  const date = longDateUTC(post.publishAt);

  /*
   * THE MEASURE, and why the paddings are what they are.
   *
   * 72px of side padding leaves a 1056px measure, which is what the ladder in
   * og-card-text.mjs was measured against; changing it invalidates those
   * breakpoints and is not a cosmetic edit. 64px top and bottom is the smallest
   * margin at which the mark still reads as placed rather than as cropped.
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
     * The mark, top left, from `scripts/lib/mark.mjs`, which reads the ratified
     * fixtures and owns how the mark is drawn. This file owns only where it
     * sits.
     *
     * That module is a SEAM, not a convenience: `check:logo` renders this same
     * node and compares the result against a rasterisation of the committed
     * fixture, so the shape this card embeds is asserted rather than assumed.
     *
     * ALONE IN ITS CORNER, and the wordmark is NOT beside it any more. It moved
     * to the meta line at the foot, where it sits next to the date as a byline,
     * which is what it is. A wordmark beside the mark at the top was the header
     * quoted onto a card; a wordmark under the headline is attribution, and the
     * card now has a top and a bottom rather than a band and a body.
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
           * SATORI DOES HONOUR A WORD BREAK, contrary to the comment that stood
           * on this template through two versions.
           *
           * "satori has no word-break" was written beside the character cap and
           * inherited from there, and it is FALSE on satori 0.29.0. MEASURED
           * 2026-08-30 with a control, because a "no overflow" reading is
           * worthless without one: a 41-character unbroken word at 72px reaches
           * x=1199 of 1200 with no property set, and x=1111 with this one, so
           * the reading discriminates and the property took. `overflowWrap`, in
           * both its spellings, is the one satori ignores; that is probably
           * where the claim came from.
           *
           * It costs nothing on real titles, and that is measured too rather
           * than assumed: the whole corpus renders BYTE-IDENTICALLY with and
           * without it, so this only ever fires on the pathological case.
           *
           * It does not replace the character cap in `og-card-text.mjs`. The
           * cap governs how much text there is; this governs what happens to
           * one word that cannot fit the measure at any count.
           */
          wordBreak: "break-word",
        },
      },
      title,
    ),
    /*
     * The description, two lines of muted type.
     *
     * IT WAS REMOVED AT v3 AND IS BACK, so the argument that removed it is
     * answered rather than ignored. That argument was: at the 300 to 600px a
     * card is delivered at, 28px type scales to 7 to 14px, below the size at
     * which prose is read rather than seen; and the platform already prints
     * `og:description` beside the card as selectable text, so the card was
     * printing the same sentence once readable and once cut off.
     *
     * Both halves still hold for a card that is trying to be READ. This one is
     * not. Two lines of muted type under a headline is a TEXTURE that says
     * "this is an article, and here is roughly what about", and it is what
     * keeps a full-bleed card from being a poster with one line on it. It is
     * cut hard at two lines for exactly the reason the v3 note gives: a third
     * line would be prose asking to be read at a size it cannot be.
     *
     * Rendered only when there is one. An empty block would still occupy its
     * margin, and the layout closes up instead.
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
     * THE ONE ACCENT: a short rule in the logo's own purple.
     *
     * `--mark-on-chrome` is the lavender the mark's brand paths take on this
     * surface, so the rule is the mark's colour rather than a new one, and it
     * is a `check:contrast` matrix row against `--surface-chrome` at the 1.4.11
     * graphical-object floor. It is not text and carries no text obligation,
     * but it is measured anyway, because the palette measures every pair it
     * paints and an unmeasured one on a permanent image is not worth the
     * saving.
     *
     * GOLD WAS THE OTHER CANDIDATE and was not taken. The mark's own warm
     * accents are gold, so gold is already on this card exactly once, inside
     * the mark, which is what "sparingly" buys. The only gold in the chrome
     * family with a ratified pair against this surface is
     * `--focus-ring-on-chrome`, and painting a decorative rule with the focus
     * ring token is the kind of borrowing that reads as a defect a year later.
     */
    el("div", { style: { display: "flex", width: 84, height: 5, marginTop: 40, background: ACCENT } }),
    /*
     * The byline: the site name, then the date, in `.eyebrow`'s case and
     * tracking so the card's smallest type is the site's smallest type.
     *
     * ASSEMBLED FROM A FILTERED LIST rather than interpolated, so an absent
     * date takes its separator with it. The separator is a middot with hair
     * space either side; satori has no `gap` on inline text, and three spans
     * with margins would be three layout boxes for one line of type.
     */
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
    /*
     * A DRAFT NEVER GETS A CARD, and this line is a fix rather than a tidy.
     *
     * MEASURED on the live bucket 2026-08-23: the draft
     * `charts-on-workers-fixture` had a card at
     * /media/og/charts-on-workers-fixture-8af354a5.png answering 200 with
     * 41,149 bytes of PNG, while /blog/charts-on-workers-fixture answered
     * 404. The card RENDERS THE TITLE, so an unpublished post's headline was
     * public. This loop skipped only posts with a cover and had no notion of
     * visibility at all.
     *
     * The rule is IMPORTED, not restated. `isPubliclyVisible` is the one
     * JavaScript owner, and the July draft leak into Ask is what a
     * hand-rolled second copy of it costs.
     *
     * The prune below uses this same `cards` list, so a post that stops being
     * visible has its card DELETED on the next run rather than merely not
     * rewritten. That is the half that closes the class: unpublishing is as
     * common as publishing.
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
