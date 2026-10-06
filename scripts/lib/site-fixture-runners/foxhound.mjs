// Runs foxhound's own feed and sitemap loaders (its origin/main, loaded by site-clone-loader) on fixed sample posts and prints each
// output as JSON. See scripts/capture-site-helper-fixtures.mjs.

import { join } from "node:path";
import { pathToFileURL } from "node:url";

const APP = process.env.SITE_APP ?? "";
const load = (/** @type {string} */ file) => import(pathToFileURL(join(APP, file)).href);
const { cloudflareContext } = await import(pathToFileURL(join(process.env.SITE_STUB_DIR ?? "", "foxhound-stubs.mjs")).href);
const context = { get: (/** @type {unknown} */ key) => (key === cloudflareContext ? { env: {} } : undefined) };

const out = {};
const feed = await load("routes/files/feed.ts");
out["feed.rss"] = await (await feed.loader({ context })).text();
const sitemap = await load("routes/files/sitemap.ts");
out["sitemap.xml"] = await (await sitemap.loader({ context })).text();
const llms = await load("routes/files/llms.ts");
out["llms.txt"] = await (await llms.loader({ context })).text();

console.log(JSON.stringify(out));
