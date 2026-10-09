// node scripts/build-references.mjs: read data/references/*.fasta and write app/kb/registry/references.generated.mjs.
import { writeReferences } from "./lib/references.mjs";

const { references, changed } = writeReferences();
console.log(`build-references: ${changed ? "wrote" : "kept"} app/kb/registry/references.generated.mjs (${Object.keys(references).length} references)`);
