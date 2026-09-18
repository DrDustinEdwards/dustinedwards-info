/**
 * Export the Capsid documents the canvas needs into the guidelines directory.
 *
 * WHY A COPY EXISTS AT ALL, when hard rule 17 says one owner per fact: the glob can only point at
 * files inside the workspace and drops anything whose realpath escapes it, while Capsid documents
 * are database rows. So the design agent cannot be handed a pointer, only text, and a copy is
 * forced.
 *
 * The honest version of a forced copy is a DERIVED one: Capsid stays the owner, this writes a
 * gitignored export, every file carries the stamp it was taken at, and the gate fails when the
 * source has moved. Same shape as hard rule 18, the store derived and the repair a re-run.
 *
 * THE CREDENTIAL is machine-local and not a wrangler secret, being read by a Node program here
 * rather than by deployed code. Absent, this REFUSES rather than writing a partial directory: a
 * half-exported guidelines set that still globs is worse than none.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readDevVar } from "./lib/dev-vars.mjs";
import { callTool, NAMESPACE, EXPORTED_DOCS, formatStamp } from "./lib/capsid.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO, ".design-sync/guidelines/capsid");

async function main() {
  const token = process.env.CAPSID_TOKEN || readDevVar("CAPSID_TOKEN");
  if (!token) {
    throw new Error(
      "CAPSID_TOKEN is absent from the environment and from .dev.vars, so the " +
        "documents cannot be read. It is a machine-local operator credential, not a " +
        "wrangler secret. Refusing rather than writing a partial export.",
    );
  }

  /** @type {{path: string, title: string, updated_at: string, body: string, why: string}[]} */
  const docs = [];
  for (const wanted of EXPORTED_DOCS) {
    const doc = await callTool(token, "read", { namespace: NAMESPACE, path: wanted.path });
    if (!doc || typeof doc.body !== "string" || doc.body.length === 0) {
      throw new Error(`${wanted.path}: read returned no body. Refusing to write an empty export.`);
    }
    docs.push({
      path: doc.path,
      title: doc.title ?? wanted.path,
      updated_at: doc.updated_at ?? "",
      body: doc.body,
      why: wanted.why,
    });
  }

  if (docs.length !== EXPORTED_DOCS.length) {
    throw new Error(`read ${docs.length} of ${EXPORTED_DOCS.length} documents; refusing a partial export`);
  }

  // Rebuild, so a document dropped from the list cannot survive as a stale file the glob still
  // ships.
  if (existsSync(OUT_DIR)) {
    for (const entry of readdirSync(OUT_DIR)) rmSync(join(OUT_DIR, entry), { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const written = [];
  for (const doc of docs) {
    if (!doc.updated_at) {
      throw new Error(`${doc.path}: Capsid returned no updated_at, so the export could not be stamped`);
    }
    const text =
      `${formatStamp({ namespace: NAMESPACE, path: doc.path, updated_at: doc.updated_at })}\n\n` +
      `# ${doc.title}\n\n` +
      `> Exported from Capsid \`${NAMESPACE}/${doc.path}\`, last updated ${doc.updated_at}.\n` +
      `> Capsid is the owner. This copy exists because guidelinesGlob can only point at\n` +
      `> files in this repository, and \`check:guidelines\` fails when the source moves.\n` +
      `> Included because ${doc.why}.\n\n` +
      `${doc.body.trim()}\n`;
    const name = doc.path.replace(/[^A-Za-z0-9._-]/g, "-");
    writeFileSync(join(OUT_DIR, name), text);
    written.push({ name, bytes: text.length, updated_at: doc.updated_at });
  }

  console.log(`capsid exports -> .design-sync/guidelines/capsid/`);
  for (const w of written) {
    console.log(`  ${w.name.padEnd(40)} ${String(w.bytes).padStart(7)} bytes   updated_at ${w.updated_at}`);
  }
  const total = written.reduce((n, w) => n + w.bytes, 0);
  console.log(`\n${written.length} document(s), ${(total / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error(
    `\nbuild-capsid-guidelines could not run: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
