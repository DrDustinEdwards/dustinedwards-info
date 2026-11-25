// This script runs no gate: run `npm run check:content` first. It writes production D1, and the
// bulk path deletes the search index and replaces the media citations wholesale.

import { errorMessage } from "@dustinedwards/site-runtime/log";
import { spawnSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ARTIFACT_PATH, PAGES_ARTIFACT_PATH } from "./build-content.mjs";
import { CV_ARTIFACT_PATH } from "./lib/cv.mjs";
import { DICTIONARY_ARTIFACT_PATH } from "./lib/dictionary.mjs";
import { PROCEDURES_ARTIFACT_PATH } from "./lib/procedures.mjs";
import { citationSeeds, PUBLICATIONS_ARTIFACT_PATH } from "./lib/publications.mjs";
import { PHAGES_ARTIFACT_PATH } from "./lib/phages.mjs";
import { REGISTRY_ARTIFACT_PATH } from "./lib/registry.mjs";
import { ROSTER_ARTIFACT_PATH } from "./lib/roster.mjs";
import { requireTarget } from "./lib/target-flag.mjs";
import { sqlLiteral as sql } from "./lib/sql-literal.mjs";
import { requirePosts, syncablePostProblems } from "./lib/delete-floor.mjs";
import {
  PREVIEW,
  applySql,
  readDrift,
  refuseSearchShrink,
  verify,
  verifyFrozenVersions,
  verifyPublications,
} from "./lib/sync-d1.mjs";
import {
  buildCvSql,
  buildDictionarySql,
  buildPagesSql,
  buildPhagesSql,
  buildProceduresSql,
  buildPublicationsSql,
  buildRegistrySql,
  buildRosterSql,
  buildSearchSql,
  buildSql,
} from "./lib/sync-sql.mjs";

const LLMS_PATH = "content/llms.txt";

async function main() {
  const target = PREVIEW ? "--remote" : requireTarget(process.argv.slice(2), "sync:content");

  // The content's source first: a path D1 has never held is copied in from the repository (scripts/seed-sources.mjs).
  const seeded = spawnSync(
    process.execPath,
    [path.join("scripts", "seed-sources.mjs"), PREVIEW ? "--preview" : target],
    { stdio: "inherit" },
  );
  if (seeded.status !== 0) throw new Error("the source seed failed; nothing else was written.");

  const artifact = JSON.parse(await readFile(ARTIFACT_PATH, "utf8"));
  // Every delete below converges D1 to this artifact, so an empty one would empty production.
  const posts = requirePosts(artifact, ARTIFACT_PATH);
  const { records } = artifact;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(
      `${ARTIFACT_PATH} carries no search records. Run npm run build:content first; ` +
        `nothing was written.`,
    );
  }
  const problems = syncablePostProblems(posts);
  if (problems.length > 0) {
    throw new Error(
      `${ARTIFACT_PATH} has posts sync cannot trust, so nothing was written:\n  ` +
        problems.join("\n  "),
    );
  }

  refuseSearchShrink(target, records);

  const renderDrift = readDrift(target, posts);

  // mkdir returns undefined when the directory already exists, so the path is
  // computed here rather than taken from its return value.
  const dir = path.join(os.tmpdir(), "dustinedwards-sync");
  await mkdir(dir, { recursive: true });

  console.log(`sync:content applying ${posts.length} posts to ${target.slice(2)} D1`);
  await applySql(
    target,
    path.join(dir, "sync-content.sql"),
    buildSql(posts),
    `sync:content posts import (${target})`,
    "wrangler d1 execute failed",
  );

  // Read as a Buffer and decoded explicitly: it is compared byte for byte, and the platform text layer
  // is not UTF-8 here.
  const llms = (await readFile(LLMS_PATH)).toString("utf8");
  if (llms.includes("\r")) {
    throw new Error(
      `${LLMS_PATH} contains CR. It is pinned to LF in .gitattributes; a CRLF ` +
        `checkout would sync CRLF into D1 and change what /llms.txt serves.`,
    );
  }
  const settingsSql =
    `INSERT INTO settings (key, value) VALUES ('llms.txt', ${sql(llms)})\n` +
    `  ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`;
  console.log(`sync:content applying llms.txt (${Buffer.byteLength(llms)} bytes)`);
  await applySql(
    target,
    path.join(dir, "sync-settings.sql"),
    settingsSql,
    `sync:content llms.txt import (${target})`,
    "wrangler d1 execute failed for the llms.txt settings row",
  );

  // Procedures before the search index: a failure names the procedures, and the index then carries
  // the procedure records the table now matches.
  const procedureRows = JSON.parse(await readFile(PROCEDURES_ARTIFACT_PATH, "utf8")).procedures;
  if (!Array.isArray(procedureRows) || procedureRows.length === 0) {
    throw new Error(
      `${PROCEDURES_ARTIFACT_PATH} carries no procedures. Run npm run build:content first.`,
    );
  }
  console.log(`sync:content applying ${procedureRows.length} procedures`);
  await applySql(
    target,
    path.join(dir, "sync-procedures.sql"),
    buildProceduresSql(procedureRows),
    `sync:content procedures import (${target})`,
    "the procedures import failed",
  );
  verifyFrozenVersions(target, procedureRows);

  // Publications before the search index too: the index then carries the paper records the table matches.
  const publicationRows = JSON.parse(
    await readFile(PUBLICATIONS_ARTIFACT_PATH, "utf8"),
  ).publications;
  if (!Array.isArray(publicationRows) || publicationRows.length === 0) {
    throw new Error(
      `${PUBLICATIONS_ARTIFACT_PATH} carries no publications. Run npm run build:content first.`,
    );
  }
  console.log(`sync:content applying ${publicationRows.length} publications`);
  await applySql(
    target,
    path.join(dir, "sync-publications.sql"),
    buildPublicationsSql(publicationRows, await citationSeeds()),
    `sync:content publications import (${target})`,
    "the publications import failed",
  );
  verifyPublications(target, publicationRows);

  // Dictionary entries before the pages: the page lead is drawn from this table, and the pages' twins and search
  // records below were compiled with these same entries.
  const dictionaryRows = JSON.parse(await readFile(DICTIONARY_ARTIFACT_PATH, "utf8")).dictionary;
  if (!Array.isArray(dictionaryRows) || dictionaryRows.length === 0) {
    throw new Error(
      `${DICTIONARY_ARTIFACT_PATH} carries no dictionary entries. Run npm run build:content first.`,
    );
  }
  console.log(`sync:content applying ${dictionaryRows.length} dictionary entries`);
  await applySql(
    target,
    path.join(dir, "sync-dictionary.sql"),
    buildDictionarySql(dictionaryRows),
    `sync:content dictionary import (${target})`,
    "the dictionary import failed",
  );

  // Pages likewise: the table first, so a failure names the pages, and the index then carries the page
  // records the table now matches.
  const pageRows = JSON.parse(await readFile(PAGES_ARTIFACT_PATH, "utf8")).pages;
  if (!Array.isArray(pageRows) || pageRows.length === 0) {
    throw new Error(`${PAGES_ARTIFACT_PATH} carries no pages. Run npm run build:content first.`);
  }
  console.log(`sync:content applying ${pageRows.length} pages`);
  await applySql(
    target,
    path.join(dir, "sync-pages.sql"),
    buildPagesSql(pageRows),
    `sync:content pages import (${target})`,
    "the pages import failed",
  );

  // The CV likewise: its rows, so a failure names the CV, and the index then carries the CV's search records.
  const cvRows = JSON.parse(await readFile(CV_ARTIFACT_PATH, "utf8")).cv;
  if (!Array.isArray(cvRows) || cvRows.length === 0) {
    throw new Error(`${CV_ARTIFACT_PATH} carries no CV files. Run npm run build:content first.`);
  }
  console.log(`sync:content applying ${cvRows.length} CV files`);
  await applySql(
    target,
    path.join(dir, "sync-cv.sql"),
    buildCvSql(cvRows),
    `sync:content CV import (${target})`,
    "the CV import failed",
  );

  // The roster beside them: the table, so a failure names the cohorts. Nothing in the search index reads it.
  const rosterRows = JSON.parse(await readFile(ROSTER_ARTIFACT_PATH, "utf8")).roster;
  if (!Array.isArray(rosterRows) || rosterRows.length === 0) {
    throw new Error(`${ROSTER_ARTIFACT_PATH} carries no cohorts. Run npm run build:content first.`);
  }
  console.log(`sync:content applying ${rosterRows.length} roster cohorts`);
  await applySql(
    target,
    path.join(dir, "sync-roster.sql"),
    buildRosterSql(rosterRows),
    `sync:content roster import (${target})`,
    "the roster import failed",
  );

  // The phages beside them: the table, so a failure names the phages. The page that draws them was written above
  // from the same compile; nothing in the search index reads this table.
  const phageRows = JSON.parse(await readFile(PHAGES_ARTIFACT_PATH, "utf8")).phages;
  if (!Array.isArray(phageRows) || phageRows.length === 0) {
    throw new Error(`${PHAGES_ARTIFACT_PATH} carries no phages. Run npm run build:content first.`);
  }
  console.log(`sync:content applying ${phageRows.length} phages`);
  await applySql(
    target,
    path.join(dir, "sync-phages.sql"),
    buildPhagesSql(phageRows),
    `sync:content phages import (${target})`,
    "the phages import failed",
  );

  // The registry beside them: its own table, so a failure names the registry. Nothing is drawn from these rows into
  // another store yet, so there is no page to write before it. An empty list is valid; a missing key is not, because
  // that artifact was not built by this checkout's build:content.
  const registryRows = JSON.parse(await readFile(REGISTRY_ARTIFACT_PATH, "utf8")).registry;
  if (!Array.isArray(registryRows)) {
    throw new Error(
      `${REGISTRY_ARTIFACT_PATH} has no registry list. Run npm run build:content first.`,
    );
  }
  console.log(`sync:content applying ${registryRows.length} registry items`);
  await applySql(
    target,
    path.join(dir, "sync-registry.sql"),
    buildRegistrySql(registryRows),
    `sync:content registry import (${target})`,
    "the registry import failed",
  );

  // A separate statement file, so a failure here names the search index rather than the content.
  console.log(`sync:content applying ${records.length} search records`);
  await applySql(
    target,
    path.join(dir, "sync-search.sql"),
    buildSearchSql(records),
    `sync:content search index import (${target})`,
    "wrangler d1 execute failed for the search index",
  );

  verify(target, posts, records);

  // Nonzero last, after every write stood: render drift means the shared pipeline is not shared in practice.
  if (renderDrift.length > 0) {
    console.error(
      `sync:content: RENDER DRIFT on ${renderDrift.length} slug(s): ` +
        `${renderDrift.join(", ")}. The Worker and the Node build rendered the same ` +
        `source bytes differently; D1 has been converged to the build. Whether that ` +
        `is a defect or the benign first-sync ordering artifact (a render from the ` +
        `previously deployed Worker) is decided by a ` +
        `SECOND run of this sync, which ship performs: drift that clears was a row ` +
        `written by the previously deployed Worker, and drift that survives the ` +
        `converge is the defect.`,
    );
    process.exit(1);
  }
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`sync:content failed. ${errorMessage(error)}`);
  process.exit(1);
});
