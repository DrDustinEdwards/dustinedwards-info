// Loads TypeScript from another site's repository, as it stands on that repository's origin/main, so a fixture can be captured
// from the site's REAL code and not from a transcription of it. Registered with `node --import`, it maps that site's `~/`
// alias to its app directory and lets a run replace the few modules that need Cloudflare bindings (a database, the request
// context) with stubs, named in SITE_STUBS as a JSON object of specifier to absolute file path.
//
//   SITE_APP=<clone>/app SITE_STUBS='{"~/db":"/abs/stub-db.mjs"}' node --import ./scripts/lib/site-clone-loader.mjs capture.mjs
//
// Node strips the types itself (erasable syntax only); a module that cannot be stripped fails loudly, and the capture says so.

import { register } from "node:module";

register(new URL("./site-clone-loader-hooks.mjs", import.meta.url));
