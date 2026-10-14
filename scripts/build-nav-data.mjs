// node scripts/build-nav-data.mjs: read the content the header's panels show and write app/lib/nav-data.generated.mjs.
import { navDataProblems, writeNavData } from "./lib/nav-data.mjs";

const { data, changed } = writeNavData();
console.log(`build-nav-data: ${changed ? "wrote" : "kept"} app/lib/nav-data.generated.mjs (${data.posts.length} posts; latest paper ${data.latestPaper?.slug ?? "none"})`);
// The install must not fail on a content edit: say what was left out, and let test/nav.test.mjs fail on it.
for (const problem of navDataProblems()) console.warn(`build-nav-data: left out: ${problem}`);
