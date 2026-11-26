import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTsxComments } from "./strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ROUTES_DIR = join(root, "app", "routes");

/**
 * Route module file names, sorted, whose source with comments stripped matches `pattern`. Stripped
 * first because routes name helpers in prose while explaining why they do not call them; TSX by the
 * parser, because the tokenizer misreads an apostrophe in JSX text.
 *
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function routesMatching(pattern) {
  return readdirSync(ROUTES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => pattern.test(stripTsxComments(readFileSync(join(ROUTES_DIR, name), "utf8"))))
    .sort();
}

/**
 * The shared-cached HTML pages: every `.tsx` route that calls `publicHtmlHeaders()`, re-exports
 * `taxonomyHeaders` (which calls it) or names `SHARED_CACHE_CONTROL`. The feeds, twins and sitemap
 * that share the header are `.ts` resource routes with no document, so the extension is the HTML
 * boundary and no exclusion list can drift.
 *
 * @returns {string[]}
 */
export function sharedCacheHtmlRoutes() {
  return routesMatching(/publicHtmlHeaders\(|taxonomyHeaders|SHARED_CACHE_CONTROL/);
}
