// AI Search puts the id of the D1 row an indexed chunk came from on every chunk of it, as `row_id`
// (https://developers.cloudflare.com/ai-search/configuration/data-source/d1/#column-conventions), and the Ask
// index's ids are the pages' own URLs (ASK_INDEX_QUERY in search.server.ts), so a citation is its row id.

import { PUBLICATIONS_PATH } from "../publications/paths.mjs";

/**
 * A paper longer than one row may hold is indexed in parts, `<page>#part-2` and on. Every part cites the page.
 */
export const PAPER_PART = "#part-";

const POST_ID = /^\/writing\/[a-z0-9][a-z0-9-]*(#[^#\s]+)?$/;
const PAPER_ID = new RegExp(`^${PUBLICATIONS_PATH}/[a-z0-9][a-z0-9-]*/(${PAPER_PART}\\d+)?$`);

/**
 * The row id a chunk carries, or "" for a chunk that carries none.
 *
 * @param {unknown} chunk a chunk from AI Search's search, or from the `chunks` event of its chat completions
 * @returns {string}
 */
export function rowIdOf(chunk) {
  const id = /** @type {{ item?: { metadata?: { row_id?: unknown } } } | null} */ (chunk)?.item
    ?.metadata?.row_id;
  return typeof id === "string" ? id : "";
}

/**
 * The page a row id cites: a post or one of its sections as it is, a paper's part as the paper's page, with the
 * canonical trailing slash. Null for an id this site's query cannot produce, so nothing is guessed.
 *
 * @param {string} id
 * @returns {string | null}
 */
export function urlForRowId(id) {
  if (typeof id !== "string") return null;
  if (POST_ID.test(id)) return id;
  if (PAPER_ID.test(id)) return id.split(PAPER_PART)[0] ?? null;
  return null;
}

/**
 * The post a row id belongs to. Posts only: a paper has no posts row, and passing its URL as a slug would make every
 * answer citing it unreplayable forever.
 *
 * @param {string} id
 * @returns {string | null}
 */
export function slugForRowId(id) {
  if (typeof id !== "string" || !POST_ID.test(id)) return null;
  return (id.split("#")[0] ?? "").replace(/^\/writing\//, "") || null;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function labelForUrl(url) {
  const [path, anchor] = url.split("#");
  // The slug, not a DOI: the DOI-to-slug fold is lossy, and a plausible reconstruction is worse than none.
  if ((path ?? "").startsWith(`${PUBLICATIONS_PATH}/`)) {
    return `Paper ${(path ?? "").replace(`${PUBLICATIONS_PATH}/`, "").replace(/\/$/, "")}`;
  }
  const target = anchor ?? (path ?? "").replace(/^\/writing\//, "");
  const words = target.replace(/^\d+-/, "").split("-").filter(Boolean);
  if (words.length === 0) return "Untitled";
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
