/**
 * Gate: the D1 media index must agree with R2 and with `public/`, both ways.
 *
 * OBSERVATION BOUNDARY, REWRITTEN 2026-08-18 rather than extended, because two
 * of its sentences went false when the manifest half moved out. A boundary note
 * is a claim that ages (hard rule 7), and this file has now aged one twice.
 *
 * It reconciles KEYS. It lists R2, walks public/ and diffs both against D1. For
 * everything except the social cards it still never FETCHES one of those URLs,
 * and an object that exists with a row and 404s through the serving route
 * passes, which is exactly how 58 static rows carried broken /media//path
 * thumbnails while this gate was green.
 *
 * **THE SOCIAL CARDS ARE THE ONE EXCEPTION, and they are the exception because
 * the key-only reading is what let them break.** Added 2026-09-11 after ten of
 * eleven published posts served a 404 `og:image` for an unknown number of days:
 * the bucket held cards under the posts' OLD slugs, D1 held the new ones, and
 * every reconciliation any gate performed was internally consistent. The OG
 * block below therefore asserts BOTH directions, and one of them leaves this
 * file's usual boundary on purpose. See it for what each half can and cannot
 * see.
 *
 * **IT NO LONGER READS content/generated/assets.json AT ALL.** That comparison
 * was pure filesystem, so it was the one offline-capable assertion in a gate
 * that must be remote, and it now lives in `check:content` beside the two other
 * artifacts in that directory. What follows from the move, and it is the part
 * worth reading twice: this gate still detects a stale manifest, but only
 * INDIRECTLY and only AFTER A REBUILD. The Worker writes rows from the manifest,
 * so a manifest missing a file becomes a public/ file with no D1 row, which is
 * direction 3 below. Between a bad `build:assets` and the next rebuild, this
 * gate sees nothing, and when it does speak it names a missing ROW rather than
 * the manifest that caused it. That is precisely the "confusing D1 diff whose
 * real cause is two directories away" the old comment here warned about, and it
 * is now someone else's job to say it first, offline.
 *
 * So: manifest-to-filesystem is NOT here. Manifest-to-D1 is here, transitively,
 * late, and under a different name.
 *
 *   npm run check:media -- --local
 *   npm run check:media -- --remote
 *
 * **This gate is the entire reason the index is allowed to exist.** The ruling
 * (decisions.md, 2026-08-02) turns on one principle: an index is legitimate
 * exactly when it can be reconciled against its source. A USAGE cache cannot be,
 * because a citation may live outside the corpus and no scan can enumerate what
 * it does not know about. An EXISTENCE index can be, because R2 `list` is a
 * total function over the bucket and `public/` is a directory walk. So the
 * reconciler is not a follow-up to the index; it ships with it or the index is
 * not justified.
 *
 * FOUR directions, and it fails on any of them:
 *   1. an R2 object with no D1 row          -> backfill it
 *   2. a D1 row with no R2 object           -> delete the row
 *   3. a public/ file with no row           -> backfill it
 *   4. a storage='static' row with no file  -> delete the row
 *
 * Note which way each repair runs. **R2 WINS**, and `public/` wins for static.
 * A row is deleted because an object is absent; an object is NEVER deleted
 * because a row is. That asymmetry is what keeps D1 derived rather than a second
 * truth, and it is why this script only ever REPORTS: it has no repair mode at
 * all, because the repair for half these cases would be destroying data.
 *
 * DERIVED, never hardcoded, on the same rule `check-backup.mjs` follows: its
 * table list comes from `drizzle/` rather than a literal, so a new table is
 * covered the moment its migration lands. Here the expected sets come from R2
 * itself and from walking `public/`. Nothing in this file names an asset.
 *
 * FAILS CLOSED on an empty enumeration. A gate that passes because it examined
 * nothing is the failure mode that looks most like success, and this repo has
 * already been bitten by it: `COUNT(*)` on an fts5 index reads through to its
 * content table and reported 7 while the index held 0.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { classify, roleOf, storageOf } from "../app/lib/media/classify.mjs";
import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { SITE_ORIGIN } from "../app/lib/seo.ts";
import { listAllObjects } from "./lib/r2.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { retryRead } from "./lib/retry.mjs";
import { walkPublic } from "./build-assets.mjs";
import { bucketNames } from "./lib/wrangler-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
import { resolveD1Address } from "./lib/d1-address.mjs";

const DB_NAME = "dustinedwards";
// DERIVED from the wrangler config, never restated. Two buckets split on
// lifecycle, and both are indexed: an OG card that existed but appeared in no
// listing is exactly the invisible-object problem the index exists to end.
const BUCKETS = bucketNames();

/**
 * Runs wrangler as one already-quoted command string. Passing an args array
 * alongside shell:true concatenates without quoting, which has split an
 * argument containing a space twice in this repo.
 *
 * @param {string} args
 */
function wrangler(args) {
  const result = spawnSync(`npx wrangler ${args}`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

/**
 * Every row in the media index.
 *
 * @param {string} target
 * @returns {Array<{ key: string, storage: string, kind: string, role: string, alt: string | null }>}
 */
function mediaRows(target) {
  const result = wrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      // alt joins the projection so the roster comparison below has an index
      // side to compare against. It was absent on the first run of that
      // assertion, which read every row's alt as "" and reported nine
      // disagreements that were really one missing column.
      `"SELECT key, storage, kind, role, alt FROM media ORDER BY key;"`,
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    throw new Error("could not read the media table");
  }
  const match = result.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse d1 output:\n${result.stdout}`);
  return JSON.parse(match[0])[0].results;
}

/** @param {string[]} list */
function sample(list, n = 8) {
  return list
    .slice(0, n)
    .map((k) => `        ${k}`)
    .concat(list.length > n ? [`        ... and ${list.length - n} more`] : [])
    .join("\n");
}

/**
 * The reference collector, over a fixture that exercises every form.
 *
 * **This exists because the real corpus exercises NONE of it.** All 12 posts
 * carry zero images, zero figure directives and zero covers, so the collector
 * could be completely broken and every other gate would still pass. A code path
 * with no coverage and no exercise is exactly the thing this repo refuses to
 * ship, and "it returned 0 refs" would look identical whether it worked or not.
 *
 * Pure: no network, no database. Runs FIRST so a contract failure is immediate.
 *
 * @returns {Promise<string[]>} problems
 */
async function checkReferenceForms() {
  // Imported lazily. It pulls shiki and an oniguruma WASM binary, which is a
  // real cost to pay before the cheap filesystem work below has had a chance to
  // fail.
  const { renderBody } = await import("../app/lib/content/pipeline.mjs");

  const body = [
    "![a plain image](/media/aabbccddeeff0011.png)",
    "",
    ':::figure{src="/media/1122334455667788.webp" alt="figured"}',
    "A caption.",
    ":::",
    "",
    "[a download](/publications/some-paper.pdf)",
    "",
    "[absolute](https://dustinedwards.info/media/99aabbccddeeff00.png)",
    "",
    '<img src="/media/rawhtml0011223344.png" alt="raw">',
    "",
    "[ref style][d1]",
    "",
    "[d1]: /media/def0123456789abc.gif",
    "",
    "Not media: [a post](/blog/something) and [an anchor](#top).",
    "",
    "```",
    "![in a code fence](/media/codefence00112233.png)",
    "```",
  ].join("\n");

  const { mediaRefs } = await renderBody({
    file: "check-media fixture",
    body,
    // The fixture's keys name nothing real, so there are no bytes to measure.
    // Zeroes rather than nulls only because that is the signature; nothing in
    // this check reads a dimension.
    resolveImage: async () => ({ width: 0, height: 0 }),
  });

  const got = new Set(mediaRefs.map((/** @type {any} */ r) => `${r.form} ${r.key}`));
  /** @type {string[]} */
  const problems = [];

  const expected = [
    ["markdown-image aabbccddeeff0011.png", "a markdown image"],
    ["figure-directive 1122334455667788.webp", "a :::figure directive"],
    ["link /publications/some-paper.pdf", "a link to a STATIC asset, indexed by its public path"],
    ["link 99aabbccddeeff00.png", "an absolute URL, origin stripped"],
    ["html rawhtml0011223344.png", "raw HTML written into a post"],
    ["link def0123456789abc.gif", "a reference-style link definition"],
  ];
  for (const [key, label] of expected) {
    if (!got.has(key)) problems.push(`reference form not collected: ${label} (${key})`);
  }

  // The negatives matter as much as the positives. Over-collection puts rows in
  // media_refs that can never join to anything, and every one of them would
  // refuse a delete forever for a citation that does not exist.
  for (const [needle, label] of [
    ["/blog/something", "a page link"],
    ["#top", "a bare anchor"],
    ["codefence00112233", "a URL inside a code fence"],
  ]) {
    if ([...got].some((k) => k.includes(needle))) {
      problems.push(`collected something it should not: ${label} (${needle})`);
    }
  }

  // An assertion that can pass by collecting nothing is not an assertion.
  if (mediaRefs.length === 0) {
    problems.push("the fixture collected zero references, so every check above passed vacuously");
  }

  console.log(`  reference forms: ${mediaRefs.length} collected from the fixture, 6 required`);
  return problems;
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  console.log(`\ncheck:media reconciling the D1 index against R2 and public/ (${target.slice(2)})\n`);

  const formProblems = await checkReferenceForms();
  if (formProblems.length > 0) {
    for (const problem of formProblems) console.error(`\n  FAIL  ${problem}`);
    console.error("");
    throw new Error(`${formProblems.length} reference-collection failure(s)`);
  }

  /** @type {Array<{ key: string, size: number, uploaded: string, etag: string }>} */
  const objects = [];
  for (const [binding, bucket] of Object.entries(BUCKETS)) {
    // RETRIED ONCE. The R2 list HUNG on 2026-08-07 with a 400 carrying no
    // CF-R2-Error header, taking check:all past a ten minute timeout, and was
    // clean on retry at 27s. retryRead wraps a timeout as well as a rejection
    // precisely for that symptom. Read only.
    const listed = await retryRead(
      () => listAllObjects({ bucket, remote: target === "--remote" }),
      { label: `check:media R2 list (${bucket})` },
    );
    console.log(`  R2 ${bucket} (${binding}): ${listed.length} object(s)`);
    objects.push(...listed);
  }
  const files = await walkPublic();
  const rows = mediaRows(target);

  // An assertion that can pass by reading nothing is not an assertion. Both
  // sides must have found something before any comparison below means anything.
  if (objects.length === 0) {
    throw new Error(
      `listed 0 objects across ${Object.values(BUCKETS).join(", ")}. Either they are genuinely ` +
        `empty or the listing failed; both make every comparison below pass vacuously.`,
    );
  }
  if (files.length === 0) {
    throw new Error("walked public/ and found 0 files, which cannot be right");
  }

  /*
   * AND FLOORS, not just the two `=== 0` guards above, added by the 2026-08-24
   * floor sweep. This gate had no floor of any kind, and `=== 0` is the weakest
   * form of an anti-vacuity check: it catches a listing that returned NOTHING
   * and nothing else.
   *
   * The failure it cannot see is the one this gate is for. Every comparison
   * below is a set difference between three enumerations, so they are satisfied
   * by the enumerations shrinking TOGETHER: a listing that paginates once and
   * stops, a walk that stops descending, a `mediaRows` query that grows a
   * WHERE clause. Ten objects against ten rows reconcile perfectly, and the
   * fifty-nine that vanished are reported by no one. `rows` had no guard at all,
   * not even `=== 0`.
   *
   * MEASURED THROUGH THIS GATE 2026-08-24 by running it --remote: 11 R2
   * objects, 59 public files, 69 D1 rows. Floors about eight percent under.
   * These track CONTENT, so they are expected to move up as media is added and
   * they are deliberately not tight.
   */
  const scopeFloor = (/** @type {string} */ what, /** @type {number} */ n, /** @type {number} */ min) => {
    if (n < min) {
      throw new Error(
        `${what}: ${n}, expected at least ${min}. Three enumerations shrinking together ` +
          `reconcile perfectly against each other, which is what the zero-checks above miss.`,
      );
    }
  };
  scopeFloor("R2 objects listed", objects.length, 10);
  scopeFloor("files walked under public/", files.length, 54);
  scopeFloor("D1 media rows read", rows.length, 63);

  console.log(`  public/:               ${files.length} file(s)`);
  console.log(`  D1 media:              ${rows.length} row(s)`);

  const rowKeys = new Set(rows.map((r) => r.key));
  const objectKeys = new Set(objects.map((o) => o.key));
  // Static assets are indexed under their site-absolute public path, which is
  // exactly what walkPublic() returns, so the two sides speak the same strings.
  const fileKeys = new Set(files);

  /** @type {string[]} */
  const problems = [];

  // 1. R2 object with no row.
  const unindexedObjects = [...objectKeys].filter((k) => !rowKeys.has(k)).sort();
  if (unindexedObjects.length > 0) {
    problems.push(
      `${unindexedObjects.length} R2 object(s) with no D1 row. R2 wins: BACKFILL these rows ` +
        `(rebuild the media index).\n${sample(unindexedObjects)}`,
    );
  }

  // 2. Row claiming R2 storage with no object.
  const orphanRows = rows
    .filter((r) => r.storage !== "static" && !objectKeys.has(r.key))
    .map((r) => r.key)
    .sort();
  if (orphanRows.length > 0) {
    problems.push(
      `${orphanRows.length} D1 row(s) with no R2 object. R2 wins: DELETE these rows. Never ` +
        `recreate the object to match.\n${sample(orphanRows)}`,
    );
  }

  // 3. public/ file with no row.
  const unindexedFiles = [...fileKeys].filter((k) => !rowKeys.has(k)).sort();
  if (unindexedFiles.length > 0) {
    problems.push(
      `${unindexedFiles.length} public/ file(s) with no D1 row. BACKFILL these as ` +
        `storage='static' (rebuild the media index).\n${sample(unindexedFiles)}`,
    );
  }

  // 4. Static row with no file.
  const orphanStatic = rows
    .filter((r) => r.storage === "static" && !fileKeys.has(r.key))
    .map((r) => r.key)
    .sort();
  if (orphanStatic.length > 0) {
    problems.push(
      `${orphanStatic.length} storage='static' row(s) with no file under public/. The ` +
        `filesystem wins: DELETE these rows.\n${sample(orphanStatic)}`,
    );
  }

  // Every row's storage and kind must be what classify.mjs says they are. This
  // is what stops a row being hand-written, or written by a path that guessed,
  // and it costs one function call per row because the classifier is pure.
  /** @type {string[]} */
  const misclassified = [];
  for (const row of rows) {
    let expected;
    try {
      expected = classify(row.key);
    } catch (error) {
      misclassified.push(`${row.key}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const expectedStorage = storageOf(row.key);
    const expectedRole = roleOf(row.key);
    if (row.kind !== expected.kind) {
      misclassified.push(`${row.key}: kind is "${row.kind}", classify() says "${expected.kind}"`);
    }
    if (row.storage !== expectedStorage) {
      misclassified.push(
        `${row.key}: storage is "${row.storage}", storageOf() says "${expectedStorage}"`,
      );
    }
    // ROLE, verified against the deriver exactly as kind and storage are. This
    // is what stops the picker filter silently rotting: a row whose role drifts
    // from `roleOf()` either hides a real image or offers half a diagram pair,
    // and neither is visible from anywhere else.
    if (row.role !== expectedRole) {
      misclassified.push(`${row.key}: role is "${row.role}", roleOf() says "${expectedRole}"`);
    }
  }
  if (misclassified.length > 0) {
    problems.push(
      `${misclassified.length} row(s) disagree with classify.mjs:\n${sample(misclassified)}`,
    );
  }

  /*
   * NO SOCIAL CARD MAY EXIST FOR A POST THE PUBLIC CANNOT SEE.
   *
   * MEASURED 2026-08-23, which is why this block exists: the draft
   * `charts-on-workers-fixture` had a card in the OG bucket answering 200 with
   * 41,149 bytes of PNG at /media/og/charts-on-workers-fixture-8af354a5.png,
   * while /blog/charts-on-workers-fixture answered 404. The card renders the
   * post's TITLE, so an unpublished headline was public. `build-og.mjs` had no
   * notion of visibility: its loop skipped posts with a cover and nothing else.
   *
   * The key is a hash of the template version, slug, title and tags, so it is
   * not guessable at a glance. That is not a defence and is not treated as one:
   * the object is public, unauthenticated and served with
   * `max-age=31536000, immutable`, and the URL is written into D1's og_image
   * for every post including this one.
   *
   * THE VISIBILITY RULE IS IMPORTED. `isPubliclyVisible` is the one JavaScript
   * owner of it; a second copy here is the shape that put five drafts into Ask
   * in July.
   *
   * Direction: cards that must NOT exist. This is the SECURITY half.
   *
   * **THE OTHER DIRECTION IS NOW ASSERTED TOO, in the block after this one.**
   * It used to be skipped on the reasoning that "cards are written by a manual
   * `build:og --remote` and a missing one is a cosmetic gap, not a disclosure".
   * The first clause is still true and is exactly why the second one failed:
   * nothing runs `build:og`, ship does not call it, and the key is a hash of
   * the slug, title and description, so a rename or a retitle silently moves
   * every card. Measured 2026-09-11: ten of eleven published posts served a
   * 404 og:image, and every unfurler got a broken card.
   */
  {
    const artifactPath = join(root, "content", "generated", "posts.json");
    const artifactPosts = existsSync(artifactPath)
      ? (JSON.parse(readFileSync(artifactPath, "utf8")).posts ?? [])
      : [];

    // SCOPE, PROVEN NON-EMPTY BEFORE ANY CONCLUSION. With no posts read, the
    // loop below finds no forbidden keys and this reports a clean sweep it
    // never performed.
    if (artifactPosts.length === 0) {
      problems.push(
        `the OG visibility scan read NO posts from content/generated/posts.json, so it ` +
          `proved nothing. A clean result here would be indistinguishable from a clean sweep.`,
      );
    }

    const liveOg = new Set(objects.map((o) => o.key).filter((k) => k.startsWith("og/")));
    /** @type {string[]} */
    const exposed = [];
    let hidden = 0;
    for (const post of artifactPosts) {
      if (post.cover) continue;
      const visible = isPubliclyVisible({
        status: statusForDraft(post.draft),
        publishAt: post.publishAt,
      });
      if (visible) continue;
      hidden += 1;
      const key = ogImageKey(post);
      if (liveOg.has(key)) {
        exposed.push(`${key}  (post "${post.slug}" is not publicly visible)`);
      }
    }
    console.log(
      `  OG visibility: ${liveOg.size} card(s) live, ${hidden} non-visible post(s) checked`,
    );
    if (exposed.length > 0) {
      problems.push(
        `${exposed.length} social card(s) are PUBLIC for post(s) that are not. The card ` +
          `renders the title, so this discloses an unpublished headline. Repair: ` +
          `npm run build:og -- --remote, whose prune deletes them.\n${sample(exposed)}`,
      );
    }

    /*
     * EVERY PUBLICLY VISIBLE POST HAS A CARD, in the bucket and on the wire.
     *
     * TWO ASSERTIONS OVER ONE EXPECTED SET, and they are separate because they
     * fail for different reasons and neither implies the other.
     *
     *   KEY RECONCILIATION reads the R2 listing this gate already has. It is
     *   the half that names the DEFECT: `build:og` has not been run since the
     *   slug or the title moved, and the card the site advertises was never
     *   generated. It needs no HTTP request of its own.
     *
     *   THE WIRE READ fetches each card through the deployed serving route.
     *   It is the half that can see what the key comparison cannot: a bucket
     *   the route is not bound to, a cache rule swallowing `/media/og/`, a
     *   deploy that never happened. It is the 58-broken-thumbnails lesson at
     *   the top of this file applied to the one class of object where a 404 is
     *   visible to every stranger who shares a link.
     *
     * Neither half is a substitute for the other, and the plant that proved
     * these two assertions MEASURED that rather than arguing it. On
     * 2026-09-11 one card key was deleted from the live bucket and the gate
     * re-run: the key reconciliation named the slug immediately, and the wire
     * read still reported 11 of 11 answering 200. Cards are served
     * `max-age=31536000, immutable`, so the edge kept serving an object that
     * no longer existed.
     *
     * Read that in both directions, because it is the whole argument for
     * running both. The KEY half sees a missing card the wire cannot see for
     * up to a year. The WIRE half sees a bucket the route is not bound to, a
     * cache rule swallowing `/media/og/`, or a deploy that never happened,
     * none of which a key comparison can reach. The repair for either is the
     * same one command.
     *
     * THE EXPECTED SET IS THE SAME `cards` DERIVATION `build-og.mjs` USES,
     * spelled through the same two imported predicates rather than restated:
     * publicly visible, and no cover of its own. A post with a cover uses the
     * cover as its og:image and has no generated card, which is why it is not
     * in this set and why asserting over every post would fail on it forever.
     */
    /** @type {Array<{ slug: string, key: string }>} */
    const expected = [];
    for (const post of artifactPosts) {
      if (post.cover) continue;
      if (!isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt })) {
        continue;
      }
      expected.push({ slug: post.slug, key: ogImageKey(post) });
    }

    /*
     * SCOPE, PROVEN NON-EMPTY. An artifact whose posts are all drafts, or a
     * `cover` field that started arriving on everything, empties this set, and
     * both loops below then sweep clean over nothing. The floor is a floor and
     * not a zero-check for the reason every floor in this repo is: 11 was
     * measured on 2026-09-11 and a set that has fallen to one is a scan that
     * has stopped finding posts, not a blog that lost ten.
     */
    if (expected.length < 8) {
      problems.push(
        `the OG coverage scan expected ${expected.length} card(s), floor 8, measured 11 on ` +
          `2026-09-11. Below the floor this comparison covered less than it reports, and at ` +
          `zero it proved nothing at all.`,
      );
    }

    const uncovered = expected.filter((e) => !liveOg.has(e.key)).map((e) => `${e.key}  (post "${e.slug}")`);
    console.log(`  OG coverage: ${expected.length - uncovered.length}/${expected.length} card(s) in the bucket`);
    if (uncovered.length > 0) {
      problems.push(
        `${uncovered.length} publicly visible post(s) have NO card in the OG bucket, so ` +
          `their og:image is a 404 for every unfurler. The key is a hash of the slug, ` +
          `title and description, so a rename or a retitle moves it and nothing ` +
          `regenerates on its own. Repair: npm run build:og -- ${target}.\n${sample(uncovered)}`,
      );
    }

    /*
     * THE WIRE. Fetched from SITE_ORIGIN, which is the deployed host and NOT
     * whatever `--local` points at, because a local miniflare bucket has no
     * bearing on what a scraper gets. GET rather than HEAD: the serving route
     * is allowed to answer a HEAD differently and a 404 body is what the
     * audit actually observed.
     */
    /** @type {string[]} */
    const unreachable = [];
    for (const { slug, key } of expected) {
      const url = `${SITE_ORIGIN}/media/${key}`;
      let status = 0;
      let note = "";
      try {
        const response = await fetch(url, { redirect: "manual" });
        status = response.status;
        // Drain it. An undrained body on a keep-alive socket is what makes a
        // loop of fetches hang at the end of a Node script.
        await response.arrayBuffer();
      } catch (error) {
        note = ` (${error instanceof Error ? error.message : String(error)})`;
      }
      if (status !== 200) unreachable.push(`${status || "no response"} ${url}  (post "${slug}")${note}`);
    }
    console.log(`  OG on the wire: ${expected.length - unreachable.length}/${expected.length} card(s) answer 200 at ${SITE_ORIGIN}`);
    if (unreachable.length > 0) {
      problems.push(
        `${unreachable.length} published post(s) advertise an og:image that does not answer ` +
          `200 on the deployed host. This is what a stranger sharing the link gets, and no ` +
          `key comparison can see it.\n${sample(unreachable)}`,
      );
    }
  }

  /*
   * THE ROSTER'S ALT TEXT AND THE MEDIA INDEX'S MUST BE THE SAME STRING.
   *
   * MEASURED 2026-08-23: they were not. D1 held "Group photo of the 2019 Phage
   * Discovery Program cohort" for /phage-hunters/2019.webp and the page shipped
   * "The 2019 research group." Two owners of one fact, and the weaker string was
   * the one a screen reader actually got, on the only page on this site whose
   * whole content is photographs of people.
   *
   * NOTHING COULD SEE IT. The media library's no-alt lens counts EMPTY alt, so
   * a row with good text and a page with worse text is invisible to it; the page
   * renders from a typed data file, so a missing alt is a typecheck failure and
   * a divergent one is not. Both halves were individually correct.
   *
   * The page keeps rendering from the data file rather than querying D1: it is a
   * static page on a shared-cached route, and a per-request read to fetch a
   * constant is a cost with no reader. So the data file stays the render source
   * and THIS is what stops the two drifting.
   *
   * The pairs are extracted rather than imported because the data file is .ts
   * and this gate is .mjs. The extraction is scoped tightly (a src line, then
   * the next alt line) and its count is asserted, so a parser that stopped
   * matching reports zero pairs and fails rather than sweeping clean.
   */
  {
    const rosterPath = join(root, "app", "data", "phage-hunters.ts");
    const rosterSrc = existsSync(rosterPath) ? readFileSync(rosterPath, "utf8") : "";
    /** @type {Array<[string, string]>} */
    const pairs = [];
    let at = rosterSrc.indexOf('src: "/phage-hunters/');
    while (at !== -1) {
      const keyStart = at + 'src: "'.length;
      const keyEnd = rosterSrc.indexOf('"', keyStart);
      const altAt = rosterSrc.indexOf('alt: "', keyEnd);
      if (altAt !== -1 && altAt - keyEnd < 220) {
        const altStart = altAt + 'alt: "'.length;
        pairs.push([rosterSrc.slice(keyStart, keyEnd), rosterSrc.slice(altStart, rosterSrc.indexOf('"', altStart))]);
      }
      at = rosterSrc.indexOf('src: "/phage-hunters/', keyEnd);
    }

    const rosterRows = new Map(
      rows.filter((r) => r.key.startsWith("/phage-hunters/")).map((r) => [r.key, r.alt ?? ""]),
    );
    /*
     * FLOORED rather than zero-checked, since the 2026-08-24 sweep. The nine
     * cohort photographs are a FIXED set in a committed data file, so a scan
     * that returns eight has stopped matching one of them and the missing one
     * is precisely where a drifted alt would hide.
     */
    if (pairs.length < 8 || rosterRows.size < 8) {
      problems.push(
        `the roster alt scan found ${pairs.length} pair(s) in the data file and ` +
          `${rosterRows.size} row(s) in D1, floor 8, measured 9 on 2026-08-24. Either side ` +
          `short means this comparison covered less than it reports, and either side empty ` +
          `means it proved nothing, which is indistinguishable from agreement.`,
      );
    }

    /** @type {string[]} */
    const altDrift = [];
    for (const [key, alt] of pairs) {
      if (!rosterRows.has(key)) {
        altDrift.push(`${key}: rendered by the roster but absent from the media index`);
        continue;
      }
      const indexed = rosterRows.get(key);
      if (indexed !== alt) {
        altDrift.push(`${key}\n      page:  ${JSON.stringify(alt)}\n      index: ${JSON.stringify(indexed)}`);
      }
    }
    console.log(`  roster alt: ${pairs.length} rendered photo(s) checked against the index`);
    if (altDrift.length > 0) {
      problems.push(
        `${altDrift.length} roster photo(s) render alt text that disagrees with the media ` +
          `index. A screen reader gets the page's copy, so the index being right is not ` +
          `enough.\n${sample(altDrift)}`,
      );
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`\n  FAIL  ${problem}`);
    console.error("");
    throw new Error(`${problems.length} reconciliation failure(s)`);
  }

  const byStorage = new Map();
  for (const row of rows) byStorage.set(row.storage, (byStorage.get(row.storage) ?? 0) + 1);
  const byRole = new Map();
  for (const row of rows) byRole.set(row.role, (byRole.get(row.role) ?? 0) + 1);
  console.log(
    `\n  by storage: ${[...byStorage.entries()]
      .sort()
      .map(([s, n]) => `${n} ${s}`)
      .join(", ")}`,
  );
  console.log(
    `  by role:    ${[...byRole.entries()]
      .sort()
      .map(([r, n]) => `${n} ${r}`)
      .join(", ")}`,
  );
  console.log(
    `\ncheck:media ok. ${objects.length} object(s) and ${files.length} file(s) reconcile ` +
      `against ${rows.length} row(s), both directions.\n`,
  );
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`check:media failed. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
