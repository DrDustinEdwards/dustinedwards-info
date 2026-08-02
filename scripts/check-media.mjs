/**
 * Gate: the D1 media index must agree with R2 and with `public/`, both ways.
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

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { classify, storageOf } from "../app/lib/media/classify.mjs";
import { listAllObjects } from "./lib/r2.mjs";
import { ASSET_MANIFEST_PATH, walkPublic } from "./build-assets.mjs";

const DB_NAME = "dustinedwards";
const BUCKET = "dustinedwards-media";

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
 * @returns {Array<{ key: string, storage: string, kind: string }>}
 */
function mediaRows(target) {
  const result = wrangler(
    `d1 execute ${DB_NAME} ${target} --json --command ` +
      `"SELECT key, storage, kind FROM media ORDER BY key;"`,
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

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  console.log(`\ncheck:media reconciling the D1 index against R2 and public/ (${target.slice(2)})\n`);

  const objects = await listAllObjects({ bucket: BUCKET, remote: target === "--remote" });
  const files = await walkPublic();
  const rows = mediaRows(target);

  // An assertion that can pass by reading nothing is not an assertion. All three
  // sides must have found something before any comparison below means anything.
  if (objects.length === 0) {
    throw new Error(
      `listed 0 objects in ${BUCKET}. Either the bucket is genuinely empty or the listing ` +
        `failed; both make every comparison below pass vacuously, so this is a failure.`,
    );
  }
  if (files.length === 0) {
    throw new Error("walked public/ and found 0 files, which cannot be right");
  }

  console.log(`  R2 ${BUCKET}: ${objects.length} object(s)`);
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

  // The manifest the Worker rebuild reads. Checked against the filesystem here
  // so a stale manifest is NAMED as one, rather than surfacing later as a
  // confusing D1 diff whose real cause is two directories away.
  let manifestPaths = [];
  try {
    manifestPaths = JSON.parse(await readFile(ASSET_MANIFEST_PATH, "utf8")).paths ?? [];
  } catch {
    problems.push(`${ASSET_MANIFEST_PATH} is missing or unparseable. Run: npm run build:assets`);
  }
  if (manifestPaths.length > 0 && JSON.stringify(manifestPaths) !== JSON.stringify(files)) {
    const missing = files.filter((f) => !manifestPaths.includes(f));
    const extra = manifestPaths.filter((/** @type {string} */ p) => !fileKeys.has(p));
    problems.push(
      `${ASSET_MANIFEST_PATH} disagrees with public/. Run: npm run build:assets\n` +
        `        ${missing.length} file(s) missing from the manifest, ${extra.length} stale entr(ies)`,
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
    if (row.kind !== expected.kind) {
      misclassified.push(`${row.key}: kind is "${row.kind}", classify() says "${expected.kind}"`);
    }
    if (row.storage !== expectedStorage) {
      misclassified.push(
        `${row.key}: storage is "${row.storage}", storageOf() says "${expectedStorage}"`,
      );
    }
  }
  if (misclassified.length > 0) {
    problems.push(
      `${misclassified.length} row(s) disagree with classify.mjs:\n${sample(misclassified)}`,
    );
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`\n  FAIL  ${problem}`);
    console.error("");
    throw new Error(`${problems.length} reconciliation failure(s)`);
  }

  const byStorage = new Map();
  for (const row of rows) byStorage.set(row.storage, (byStorage.get(row.storage) ?? 0) + 1);
  console.log(
    `\n  indexed: ${[...byStorage.entries()]
      .sort()
      .map(([s, n]) => `${n} ${s}`)
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
