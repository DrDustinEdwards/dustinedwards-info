// node scripts/build-source-dates.mjs: read each source file's last commit day from git and write
// app/lib/source-dates.generated.mjs, which the sitemap's `lastmod` reads.
import { writeSourceDates } from "./lib/source-dates.mjs";

const { dates, changed } = writeSourceDates();
console.log(`build-source-dates: ${changed ? "wrote" : "kept"} app/lib/source-dates.generated.mjs (${Object.keys(dates).length} files dated)`);
