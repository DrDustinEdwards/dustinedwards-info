/** sync-content's D1 side: the target database, applying a statement file, and the reads that guard and prove a write. */

import { writeFile } from "node:fs/promises";
import { retryRead } from "./retry.mjs";
import { resolveD1Address } from "./d1-address.mjs";
import { runWrangler } from "./wrangler-run.mjs";
import { applySqlFile } from "./d1-apply.mjs";
import { splitOversizeStatements } from "./split-statements.mjs";
import { deleteFloor } from "./delete-floor.mjs";

// `--preview` converges the Worker Previews database instead (scripts/build-preview.mjs). It is
// remote by nature and named, so no flag combination can point a preview build at production.
export const PREVIEW = process.argv.includes("--preview");
const DB_NAME = PREVIEW ? "dustinedwards-preview" : "dustinedwards";

/**
 * Reads the frozen copies back: every published, versioned procedure has a sealed copy, made from the file as it is.
 * A sealed copy made from other bytes means the file was edited after its version was published; the copy keeps the
 * published words, and this says so, naming the fix, rather than passing.
 *
 * @param {string} target --local or --remote
 * @param {any[]} rows content/generated/procedures.json's rows
 */
export function verifyFrozenVersions(target, rows) {
  const wanted = rows.filter((r) => r.status === "published" && r.version);
  if (wanted.length === 0) {
    console.log("sync:content procedure versions: none published with a version, nothing frozen");
    return;
  }
  const read = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT slug, version, source_blob_sha FROM procedure_versions WHERE sealed = 1;"',
  );
  if (read.status !== 0) {
    console.error(read.output);
    throw new Error("the procedure versions read-back failed");
  }
  const match = read.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse the procedure versions read-back:\n${read.output}`);
  /** @type {Array<{ slug: string, version: string, source_blob_sha: string }>} */
  const stored = JSON.parse(match[0])[0].results;
  const byKey = new Map(stored.map((s) => [`${s.slug} ${s.version}`, s]));
  const missing = wanted.filter((r) => !byKey.has(`${r.slug} ${r.version}`));
  if (missing.length > 0) {
    throw new Error(
      `published versions have no sealed frozen copy after the write: ${missing.map((r) => `${r.slug} ${r.version}`).join(", ")}`,
    );
  }
  const changed = wanted.filter(
    (r) => byKey.get(`${r.slug} ${r.version}`)?.source_blob_sha !== r.sourceBlobSha,
  );
  if (changed.length > 0) {
    throw new Error(
      `a file was edited after its version was published: ${changed.map((r) => `${r.slug} ${r.version}`).join(", ")}. ` +
        `The frozen copy kept the published words and the live page follows the file. Set a new version in the file and add a history entry that says what changed.`,
    );
  }
  console.log(
    `sync:content procedure versions=${stored.length} sealed, each made from the file it is a copy of`,
  );
}

/**
 * Reads the publications back: every file's row exists with the blob sha it was compiled from and a twin of
 * exactly the bytes the build made. The twin is appended in chunks, so this is what proves they joined.
 *
 * @param {string} target
 * @param {any[]} rows content/generated/publications.json's rows
 */
export function verifyPublications(target, rows) {
  const read = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT slug, source_blob_sha, length(CAST(markdown AS BLOB)) AS twin_bytes FROM publications;"',
  );
  if (read.status !== 0) {
    console.error(read.output);
    throw new Error("the publications read-back failed");
  }
  const match = read.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse the publications read-back:\n${read.output}`);
  /** @type {Array<{ slug: string, source_blob_sha: string, twin_bytes: number }>} */
  const stored = JSON.parse(match[0])[0].results;
  const bySlug = new Map(stored.map((r) => [r.slug, r]));
  const wrong = rows.filter((r) => {
    const row = bySlug.get(r.slug);
    return (
      !row ||
      row.source_blob_sha !== r.sourceBlobSha ||
      row.twin_bytes !== Buffer.byteLength(r.markdown)
    );
  });
  if (wrong.length > 0) {
    throw new Error(
      `the publications table does not match the files after the write: ${wrong.map((r) => r.slug).join(", ")}`,
    );
  }
  console.log(
    `sync:content publications=${stored.length}, every row carries its file's blob sha and its twin's bytes`,
  );
}

/**
 * Retried once, which is safe only because every file this runs deletes-and-replaces or upserts and
 * none appends.
 *
 * @param {() => Promise<{ status: number, stdout: string, output: string }>} apply @param {string} label @returns {Promise<{ status: number, stdout: string, output: string }>}
 */
async function applyRetried(apply, label) {
  /** @type {{ status: number, stdout: string, output: string }} */
  let last = { status: 1, stdout: "", output: "" };
  try {
    return await retryRead(
      async () => {
        last = await apply();
        // retryRead can only see a rejection; a failed apply RETURNS.
        if (last.status !== 0) throw new Error((last.output || "no output").slice(0, 200));
        return last;
      },
      { label },
    );
  } catch {
    return last;
  }
}

/**
 * search_docs is replaced wholesale, so its floor compares the artifact against what D1 holds now.
 * @param {string} target @param {any[]} records
 */
export function refuseSearchShrink(target, records) {
  const read = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT COUNT(*) AS docs FROM search_docs;"',
  );
  if (read.status !== 0) {
    console.error(read.output);
    throw new Error("the pre-write search_docs count failed, so the delete floor cannot hold");
  }
  const countMatch = read.stdout.match(/\[[\s\S]*\]/);
  if (!countMatch) throw new Error(`could not parse the search_docs count:\n${read.output}`);
  const current = JSON.parse(countMatch[0])[0].results[0]?.docs;
  const searchFloor = deleteFloor({
    what: "search records",
    keeping: records.length,
    removing: Number.isInteger(current) ? Math.max(0, current - records.length) : current,
  });
  if (searchFloor) {
    throw new Error(`REFUSED before any write: ${searchFloor}. D1 is untouched.`);
  }
}

/**
 * Reports per-post drift against D1 and refuses a write that would remove too many file-sourced
 * posts. The write runs whatever this finds, because converging D1 to the build is the repair; the
 * caller exits nonzero at the very end so ship can let the deploy stand.
 * @param {string} target @param {any[]} posts
 * @returns {string[]} the slugs whose render drifted
 */
export function readDrift(target, posts) {
  /** @type {string[]} */
  const renderDrift = [];
  const read = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT slug, source_blob_sha, render_hash FROM posts WHERE source_path IS NOT NULL;"',
  );
  if (read.status !== 0) {
    console.error(read.output);
    throw new Error("the pre-write drift read failed, so drift cannot be reported");
  }
  const rowsMatch = read.stdout.match(/\[[\s\S]*\]/);
  if (!rowsMatch) throw new Error(`could not parse the drift read:\n${read.output}`);
  /** @type {Array<{slug: string, source_blob_sha: string | null, render_hash: string | null}>} */
  const rows = JSON.parse(rowsMatch[0])[0].results;

  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
  const buildSlugs = new Set(posts.map((/** @type {any} */ p) => p.slug));
  let unchanged = 0;
  let sourceChanged = 0;
  let missing = 0;
  for (const post of posts) {
    const row = rowBySlug.get(post.slug);
    if (!row) {
      missing += 1;
      console.log(`  missing-in-d1: ${post.slug}`);
    } else if (row.source_blob_sha !== post.sourceBlobSha) {
      sourceChanged += 1;
      console.log(`  source-changed: ${post.slug} (expected: the repo moved)`);
    } else if (row.render_hash !== post.renderHash) {
      renderDrift.push(post.slug);
      console.log(
        `  RENDER DRIFT: ${post.slug} renders differently in the Worker and ` +
          `the Node build from the same source ${post.sourceBlobSha}: ` +
          `d1=${row.render_hash} build=${post.renderHash}`,
      );
    } else {
      unchanged += 1;
    }
  }
  const extra = rows.filter((r) => !buildSlugs.has(r.slug));
  for (const row of extra) console.log(`  extra-in-d1: ${row.slug} (the write removes it)`);

  // Before the drift line, which ship reads as "every write ran": a refusal must not print it.
  const postFloor = deleteFloor({
    what: "file-sourced posts",
    keeping: posts.length,
    removing: extra.length,
  });
  if (postFloor) {
    throw new Error(`REFUSED before any write: ${postFloor}. D1 is untouched.`);
  }

  // Ship reads this line, so it prints every run.
  console.log(
    `sync:content drift: unchanged=${unchanged} source-changed=${sourceChanged} ` +
      `render-drift=${renderDrift.length} missing-in-d1=${missing} extra-in-d1=${extra.length}`,
  );
  return renderDrift;
}

/**
 * Writes one statement file and applies it, throwing with the output on failure.
 * @param {string} target @param {string} file @param {string} body
 * @param {string} label @param {string} failure
 */
export async function applySql(target, file, body, label, failure) {
  // D1 refuses a statement over 100 KB and these are literal rows, so a long procedure, paper or post is cut
  // into an INSERT and appended pieces (scripts/lib/split-statements.mjs). A cut row is written with a blank
  // blob sha and render hash and given the real ones last, so a run that stops half way reads as not current.
  await writeFile(
    file,
    splitOversizeStatements(body, { lateColumns: ["source_blob_sha", "render_hash"] }),
    "utf8",
  );
  // Remote, a batch through D1's query API, never an import: scripts/lib/d1-apply.mjs.
  const address = resolveD1Address(DB_NAME, target);
  const applied = await applyRetried(() => applySqlFile({ address, target, file }), label);
  if (applied.status !== 0) {
    console.error(applied.output);
    throw new Error(failure);
  }
}

/**
 * Counts the FTS docsize shadow: a count on an external-content fts5 table reads through to the
 * content table.
 * @param {string} target @param {any[]} posts @param {any[]} records
 */
export function verify(target, posts, records) {
  const verify = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT (SELECT COUNT(*) FROM posts) AS posts, ' +
      "(SELECT COUNT(*) FROM posts WHERE source_path IS NOT NULL) AS file_posts, " +
      "(SELECT COUNT(*) FROM post_tags) AS post_tags, (SELECT COUNT(*) FROM tags) AS tags, " +
      "(SELECT COUNT(*) FROM search_docs) AS docs, " +
      "(SELECT COUNT(*) FROM search_identity_docsize) AS identity, " +
      '(SELECT COUNT(*) FROM search_prose_docsize) AS prose;"',
  );
  if (verify.status !== 0) {
    console.error(verify.output);
    throw new Error("post-sync verification query failed");
  }

  const match = verify.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse verification output:\n${verify.output}`);
  const row = JSON.parse(match[0])[0].results[0];

  console.log(`sync:content posts=${row.posts} tags=${row.tags} post_tags=${row.post_tags}`);
  console.log(`sync:content search_docs=${row.docs} identity=${row.identity} prose=${row.prose}`);

  // File-sourced rows only: hand-authored pages would otherwise make up a shortfall in the posts.
  if (row.file_posts < posts.length) {
    throw new Error(
      `expected at least ${posts.length} file-sourced posts in D1, found ${row.file_posts}`,
    );
  }
  // Same trap as the post index: a count on either search index reads through to its content table.
  // These count the docsize shadows, which go to zero on a failed rebuild.
  if (row.docs !== records.length) {
    throw new Error(`search_docs=${row.docs} but the artifact carries ${records.length} records.`);
  }
  if (row.identity !== row.docs || row.prose !== row.docs) {
    throw new Error(
      `search index drift: search_docs=${row.docs} but identity=${row.identity} and ` +
        `prose=${row.prose}. A rebuild did not take.`,
    );
  }
  console.log("sync:content ok. FTS and search index row counts match.");
}
