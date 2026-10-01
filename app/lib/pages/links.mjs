// The internal links of a page, judged at save time. check:links is CI's full gate over every link the
// site publishes, built from the repository's sources; a save through the operator API is live before CI
// runs, so the part of that judgement a Worker can make from D1 and code is made here, with the same
// gateway functions the router uses (docs/PAGES.md).
//
// It refuses only what it can PROVE broken: a link into a namespace this module can list completely
// (the Research, Teaching, Software and recipe pages, the procedures, the posts) that names nothing in
// it, a path the gateway answers 410, a draft post, and an anchor missing from a content page. Any other
// address passes here and is left to check:links.

import { CONTENT_PAGE_PATHS, contentPageMarkdownPath } from "../content-pages.mjs";
import { movedPathTarget } from "../path-moves.mjs";
import { wordpressDisposition } from "../wordpress-redirects.mjs";

/**
 * @typedef {{
 *   procedurePaths: ReadonlySet<string>,
 *   posts: ReadonlyMap<string, boolean>,
 *   idsOf: (path: string) => ReadonlySet<string> | null,
 * }} AddressBook
 * `posts` maps `/writing/<slug>` to whether a reader can open it; `idsOf` is the element ids a content
 * page carries, or null for a path that is not one.
 */

const decodeEntities = (/** @type {string} */ value) =>
  value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const safeDecode = (/** @type {string} */ value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const SITE_HOST = /^https?:\/\/(?:www\.)?dustinedwards\.info(?=[/?#]|$)/i;

/** Every element id in rendered HTML. */
export function idsIn(/** @type {string} */ html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1] ?? "")));
}

const PAGE_SET = new Set(/** @type {readonly string[]} */ (CONTENT_PAGE_PATHS));
const PAGE_TWINS = new Set(CONTENT_PAGE_PATHS.map((p) => contentPageMarkdownPath(p)));

/** The namespaces this module can list completely. */
const OWNED = /^\/(?:research|teaching|software|recipes|writing)(?:\/|$)/;
/** Listed elsewhere: papers and citation exports, feeds, tag and series pages. */
const NOT_LISTED = /^\/(?:research\/publications|writing\/(?:tags|series|rss\.xml|feed\.json|atom\.xml))(?:[/.]|$)/;

/**
 * @param {string} path
 * @param {AddressBook} book
 * @param {number} [hops]
 * @returns {{ kind: "ok" | "unlisted" | "gone" | "draft" | "missing", path: string }}
 */
function resolve(path, book, hops = 0) {
  if (hops > 5) return { kind: "missing", path };
  const redirect = wordpressDisposition(path) ?? (() => {
    const moved = movedPathTarget(path);
    return moved === null ? null : { status: 301, location: moved };
  })();
  if (redirect && "status" in redirect && redirect.status === 410) return { kind: "gone", path };
  if (redirect && "location" in redirect && redirect.location) {
    return resolve(String(redirect.location).split("#")[0] ?? "", book, hops + 1);
  }
  if (!OWNED.test(path) || NOT_LISTED.test(path)) return { kind: "unlisted", path };
  if (PAGE_SET.has(path) || PAGE_TWINS.has(path)) return { kind: "ok", path };
  const procedure = path.replace(/(?:\.md|\/sheet)$/, "");
  if (book.procedurePaths.has(procedure)) return { kind: "ok", path };
  const visible = book.posts.get(path.replace(/\.md$/, ""));
  if (visible !== undefined) return { kind: visible ? "ok" : "draft", path };
  return { kind: "missing", path };
}

/**
 * @param {{ html: string }} page
 * @param {AddressBook} book
 * @returns {string[]}
 */
export function pageLinkErrors({ html }, book) {
  /** @type {string[]} */
  const errors = [];
  const seen = new Set();
  for (const raw of [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => decodeEntities(m[1] ?? ""))) {
    const href = SITE_HOST.test(raw) ? raw.replace(SITE_HOST, "") || "/" : raw;
    if (!href.startsWith("/") || href.startsWith("//") || seen.has(href)) continue;
    seen.add(href);
    const [pathAndQuery = "", anchor] = href.split("#");
    const path = (pathAndQuery.split("?")[0] ?? "").replace(/(.)\/+$/, "$1");
    const found = resolve(path, book);
    if (found.kind === "gone") errors.push(`the link ${href} goes to ${path}, which the site answers 410 Gone`);
    else if (found.kind === "draft") errors.push(`the link ${href} goes to a draft or scheduled post, which every reader gets a 404 for`);
    else if (found.kind === "missing") errors.push(`the link ${href} goes to ${found.path}, which this site does not serve`);
    else if (found.kind === "ok" && anchor && found.path === path) {
      const ids = book.idsOf(found.path);
      if (ids && !ids.has(safeDecode(anchor))) errors.push(`the link ${href} names an anchor that ${found.path} does not have`);
    }
  }
  return errors;
}
