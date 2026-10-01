// The published procedures' page paths, read from the repository's files: the routes that answer in
// D1 at request time, for the gates and tests that need to know which addresses are real pages.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "procedures");

/** @returns {string[]} */
export function publishedProcedurePaths() {
  return readdirSync(DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => matter(readFileSync(join(DIR, name), "utf8")).data)
    .filter((data) => data.draft !== true && typeof data.path === "string")
    .map((data) => String(data.path))
    .sort();
}
