// node scripts/build-published-pages.mjs: read which pages in content/pages are published and write
// app/lib/published-pages.generated.mjs, which the footer reads.
import { writePublishedPages } from "./lib/published-pages.mjs";

const { paths, changed } = writePublishedPages();
console.log(`build-published-pages: ${changed ? "wrote" : "kept"} app/lib/published-pages.generated.mjs (${paths.length} published pages)`);
