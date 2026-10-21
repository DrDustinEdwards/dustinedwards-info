// Prints the Zenodo deposit metadata for one procedure's current version, for `.zenodo.json` or the upload
// form: `npm run zenodo:metadata -- phage-dna-extraction`. It reads the same compile the save tool runs and
// refuses a procedure with no assigned version, because a DOI is minted only for a version being cited.
// The DOI Zenodo mints goes on that version's `history` entry in the file, not here.


import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { citeFacts, zenodoMetadata } from "../app/kb/procedures/cite.mjs";
import { compileDirectory, PROCEDURES_SOURCE_DIR } from "./lib/procedures.mjs";
import { SITE_ORIGIN as origin } from "../app/lib/site-origin.mjs";


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
