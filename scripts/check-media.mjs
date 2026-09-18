/**
 * Gate: the D1 media index must agree with R2 and with `public/`, both ways.
 *
 *   npm run check:media -- --local
 *   npm run check:media -- --remote
 *
 * BOUNDARY: it reconciles KEYS, and except for the social cards it never FETCHES one, so an
 * object that exists with a row and 404s through the route passes. A boundary note is a claim
 * that ages, hard rule 7, and this file has aged one twice. **THE SOCIAL CARDS ARE THE ONE
 * EXCEPTION, because the key-only reading is what let them break.** IT NO LONGER READS THE ASSET
 * MANIFEST: it still detects a stale one, INDIRECTLY and only AFTER A REBUILD, naming a missing
 * ROW rather than the manifest.
 *
 * FOUR directions, and it fails on any of them:
 *   1. an R2 object with no D1 row          -> backfill it
 *   2. a D1 row with no R2 object           -> delete the row
 *   3. a public/ file with no row           -> backfill it
 *   4. a storage='static' row with no file  -> delete the row
 *
 * **R2 WINS**, and `public/` wins for static: a row is deleted because an object is absent, never
 * the reverse, which keeps D1 derived. FAILS CLOSED on an empty enumeration.
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
// DERIVED from the wrangler config. Two buckets split on lifecycle, and both are indexed: an
// object in no listing is the invisible-object problem the index exists to end.
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
      // `alt` joins the projection so the roster comparison has an index side: absent, every row's alt
      // read as "" and the run reported one missing column as disagreements.
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
 * The reference collector, over a fixture that exercises every form. **This exists because the
 * real corpus exercises NONE of it**, so the collector could be broken and "0 refs" would look
 * identical. Runs FIRST, so a contract failure is immediate.
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

  // The negatives matter as much: over-collection puts rows in `media_refs` that join to nothing
  // and refuse a delete forever for a citation that does not exist.
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
    // RETRIED ONCE: the R2 list has hung with no diagnostic header and was clean on retry, which is
    // the symptom `retryRead` wraps a timeout for. Read only.
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
   * AND FLOORS, not just the two `=== 0` guards, which catch a listing that returned NOTHING. The
   * failure they cannot see is the enumerations shrinking TOGETHER: a listing that paginates once
   * and stops, a walk that stops descending, a query that grows a WHERE clause. These track
   * CONTENT, so they move up as media is added and are deliberately not tight.
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

  // Every row's storage and kind must be what the classifier says, which is what stops a row being
  // hand-written or written by a path that guessed.
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
    // ROLE, verified against the deriver as kind and storage are: a drifted role hides a real image
    // or offers half a diagram pair, neither visible from anywhere else.
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
   * NO SOCIAL CARD MAY EXIST FOR A POST THE PUBLIC CANNOT SEE: a draft had a card answering 200
   * while its page 404d, and the card renders the TITLE. The key is a hash, which is not treated as
   * a defence: the object is public, immutable and written into D1. THE VISIBILITY RULE IS
   * IMPORTED, a second copy being what put drafts into the Ask index once already.
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
     * EVERY PUBLICLY VISIBLE POST HAS A CARD, in the bucket and on the wire. TWO ASSERTIONS OVER ONE
     * EXPECTED SET, failing for different reasons:
     *
     *   KEY RECONCILIATION reads the R2 listing and names the DEFECT, the generator not having run.
     *   THE WIRE READ fetches through the deployed route and sees what keys cannot: an unbound
     *   bucket, a cache rule swallowing the prefix, a deploy that never happened.
     *
     * A plant MEASURED that: one key deleted from the live bucket, and the key half named the slug
     * while the wire half still saw every card answering 200, cards being served immutable. THE
     * EXPECTED SET IS THE GENERATOR'S OWN DERIVATION, through the same two imported predicates.
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
     * SCOPE, PROVEN NON-EMPTY: an artifact whose posts are all drafts empties this set and both loops
     * sweep clean. A floor rather than a zero-check, a set fallen to one being a scan that stopped.
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
     * THE WIRE, from the deployed host and not whatever `--local` points at. GET rather than HEAD:
     * the route may answer a HEAD differently, and a 404 body is what was observed.
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
   * THE ROSTER'S ALT TEXT AND THE MEDIA INDEX'S MUST BE THE SAME STRING, and they were not: two
   * owners of one fact, the weaker string the one a screen reader got. NOTHING COULD SEE IT, the
   * no-alt lens counting EMPTY alt and the typecheck catching a missing alt but not a divergent
   * one. The pairs are extracted rather than imported, the data file being .ts, and the extraction
   * count is asserted, so a parser that stopped matching fails rather than sweeping clean.
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
     * FLOORED rather than zero-checked: the cohort photographs are a FIXED set, so one fewer means
     * the scan stopped matching one, which is precisely where a drifted alt would hide.
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
