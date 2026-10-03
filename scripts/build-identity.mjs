// node scripts/build-identity.mjs: derive the owner's identity from the CV and write app/lib/identity.generated.mjs.
import { writeIdentity } from "./lib/identity.mjs";

const { identity, changed } = writeIdentity();
console.log(`build-identity: ${changed ? "wrote" : "kept"} app/lib/identity.generated.mjs (${identity.role}; ${identity.jobTitle})`);
