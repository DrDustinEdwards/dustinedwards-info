// Every /research/protocols/ page carries the protocol record protocols.md defines (Capsid,
// dustinedwards), and every field it lacks is either on record as waiting on someone or fails.
//
// A gap listed in content/protocols-known-missing.json is printed and passes: those values are
// Dustin's to supply, and a gate that failed on them would be red until he did. A gap NOT listed
// fails, so a new protocol or a deleted value cannot slip in. A listed gap that has been filled
// fails too, so the list only ever names real gaps. Values are never filled to make this pass.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { CONTENT_PAGE_PATHS, contentPageFile } from "../app/lib/content-pages.mjs";
import { renderBody } from "../app/lib/content/pipeline.mjs";
import { compareKnownMissing, inspectProtocol } from "./lib/protocols.mjs";
import { createTally } from "./lib/tally.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KNOWN_MISSING_PATH = "content/protocols-known-missing.json";
const PREFIX = "/research/protocols/";

const tally = createTally({ separator: ": " });
const { ok } = tally;

console.log("\ncheck:protocols\n");

const protocols = CONTENT_PAGE_PATHS.filter((p) => p.startsWith(PREFIX));
ok("CONTENT_PAGE_PATHS lists protocol pages", protocols.length > 0, `no path starts with ${PREFIX}`);

/** @type {Map<string, string[]>} */
const found = new Map();
for (const pagePath of protocols) {
  const file = join("content", "pages", contentPageFile(pagePath));
  const parsed = matter(readFileSync(join(root, file), "utf8"));
  const { toc } = await renderBody({
    file,
    body: parsed.content,
    resolveImage: async (src) => {
      throw new Error(`${file} references an image ("${src}") and these pages have no image pipeline.`);
    },
  });
  const anchors = new Set(toc.map((h) => h.id));
  const { missing, errors } = inspectProtocol(parsed.data.protocol, { anchors });
  ok(`${pagePath} carries a protocol record`, parsed.data.protocol != null, `${file} has no protocol: block`);
  for (const error of errors) ok(`${pagePath}`, false, error);
  found.set(pagePath, missing);
}

const knownRaw = JSON.parse(readFileSync(join(root, KNOWN_MISSING_PATH), "utf8"));
const known = Array.isArray(knownRaw.entries) ? knownRaw.entries : [];
ok(`${KNOWN_MISSING_PATH} has an entries list`, Array.isArray(knownRaw.entries));

const { unrecorded, stale, recorded, malformed } = compareKnownMissing(found, known);
for (const m of malformed) ok(KNOWN_MISSING_PATH, false, m);
for (const gap of unrecorded) {
  ok(
    `missing field, not on record as waiting: ${gap}`,
    false,
    `supply the value from the protocol's source, or add it to ${KNOWN_MISSING_PATH} with the reason it is missing`,
  );
}
for (const gap of stale) {
  ok(`listed as missing but present: ${gap}`, false, `remove the entry from ${KNOWN_MISSING_PATH}`);
}
ok("every protocol's gaps are recorded", unrecorded.length === 0);
ok("the known-missing list names only real gaps", stale.length === 0);

console.log(`\n  ${protocols.length} protocol(s); ${recorded.length} field(s) known missing, waiting on a value:`);
for (const protocol of protocols) {
  const rows = recorded.filter((e) => e.protocol === protocol);
  if (rows.length === 0) continue;
  console.log(`\n  ${protocol}`);
  for (const e of rows) console.log(`    MISSING  ${e.field}  (${e.reason})`);
}

/* 9 on 2026-09-29, measured by running the gate: one check per protocol page (five) and four on the list. */
const MINIMUM_CHECKS = 9;
tally.floor("check:protocols", "checks", MINIMUM_CHECKS, "A protocol page or the list was skipped rather than failing.");

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
