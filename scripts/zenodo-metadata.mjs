// Prints the Zenodo deposit metadata for one procedure's current version, for `.zenodo.json` or the upload
// form: `npm run zenodo:metadata -- phage-dna-extraction`. It reads the same compile the save tool runs and
// refuses a procedure with no assigned version, because a DOI is minted only for a version being cited
// (protocols.md). The DOI Zenodo mints goes on that version's `history` entry in the file, not here.

import { readFileSync } from "node:fs";

import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { citeFacts, zenodoMetadata } from "../app/lib/procedures/cite.mjs";
import { compileDirectory, PROCEDURES_SOURCE_DIR } from "./lib/procedures.mjs";

// The origin is read out of seo.ts as the machine-readable gate does, so it is stored once.
const origin = (readFileSync("app/lib/seo.ts", "utf8").match(/export const SITE_ORIGIN = "([^"]+)"/) ?? [])[1];
if (!origin?.startsWith("https://")) throw new Error("SITE_ORIGIN could not be read out of app/lib/seo.ts.");

const slug = process.argv[2];
if (!slug) {
  console.error("usage: npm run zenodo:metadata -- <procedure slug>");
  process.exit(2);
}

const found = (await compileDirectory(PROCEDURES_SOURCE_DIR)).find((p) => p.slug === slug);
if (!found) {
  console.error(`No procedure named ${slug} in ${PROCEDURES_SOURCE_DIR}.`);
  process.exit(1);
}
if (!found.compiled.ok) {
  console.error(`${slug} does not compile:\n  ${found.compiled.errors.join("\n  ")}`);
  process.exit(1);
}
const { record } = found.compiled;
const facts = citeFacts(record);
if (!facts) {
  console.error(`${slug} has no assigned version, so there is nothing to cite or deposit yet. Set its version and a history entry first.`);
  process.exit(1);
}
const creator = { name: IDENTITY.name, affiliation: IDENTITY.affiliation };
console.log(JSON.stringify(zenodoMetadata(record, facts, { origin, creator }), null, 2));
