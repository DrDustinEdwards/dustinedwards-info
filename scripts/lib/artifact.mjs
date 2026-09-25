import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  recordsForPages,
  recordsForPapers,
  recordsForPosts,
} from "../../app/lib/search/records.mjs";

/**
 * @param {any[]} posts
 * @param {any[]} pages
 * @param {any[]} papers
 * @returns {string}
 */
export function serializeArtifact(posts, pages, papers) {
  // Required, not defaulted: a missing argument yields a smaller artifact that passes every shape
  // check and only fails later as an unplaceable byte difference.
  if (!Array.isArray(pages)) {
    throw new Error(
      "serializeArtifact needs the page inputs as its second argument. " +
        "Pass colophonPages(stack, features); without them the artifact would " +
        "silently omit every page record.",
    );
  }

  if (!Array.isArray(papers)) {
    throw new Error(
      "serializeArtifact needs the publication inputs as its third argument. " +
        "Pass paperSearchInputs(PUBLICATIONS); without them the artifact would " +
        "silently omit every paper record.",
    );
  }

  // Derived here rather than stored per post, so adding a post cannot leave another's records stale.
  return `${JSON.stringify(
    {
      posts,
      records: [
        ...recordsForPosts(posts),
        ...recordsForPages(pages),
        ...recordsForPapers(papers),
      ],
    },
    null,
    2,
  )}\n`;
}

/** The content artifact on disk, as build:content writes it. */
export const ARTIFACT_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "generated", "posts.json");

/** @type {any} */
let parsed;

/**
 * The artifact, read and parsed once per process: gates read it in several sections, and each
 * section parsing its own copy was the same work repeated. Callers read it and never mutate it.
 *
 * @returns {{ posts: any[], records: any[] }}
 */
export function readArtifact() {
  parsed ??= JSON.parse(readFileSync(ARTIFACT_FILE, "utf8"));
  return parsed;
}
