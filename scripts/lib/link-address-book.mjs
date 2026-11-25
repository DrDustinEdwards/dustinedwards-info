/** check:links' address book: every path the site answers, built offline from the sources, and how a link resolves against it. */

import { readFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_PAGE_PATHS,
  contentPageMarkdownPath,
  publishedContentPagePaths,
} from "../../app/lib/content-pages.mjs";
import { idsIn } from "../../app/lib/pages/links.mjs";
import { paperSlashTarget } from "../../app/lib/publications/pdf-redirect.mjs";
import { paperMarkdownPath, paperPath } from "../../app/lib/publications/paths.mjs";
import { isPubliclyVisible } from "@drdustinedwards/site-helpers/search";
import { statusForDraft } from "../../app/lib/search/visibility.mjs";
import { seriesPath } from "../../app/lib/series-path.mjs";
import { tagPath } from "../../app/lib/tag-path.mjs";
import { loadSystemModel, systemPath } from "../../app/lib/systems.mjs";
import { wordpressDisposition } from "../../app/lib/wordpress-redirects.mjs";
import { renderContentPages, renderOwnRoutePages } from "../build-content.mjs";
import { buildDictionary } from "./dictionary.mjs";
import { renderPost } from "./content.mjs";
import { buildProcedures } from "./procedures.mjs";
import { buildRegistry } from "./registry.mjs";
import { hasItemPage, itemPath, kindPath } from "../../app/kb/registry/address.mjs";
import { buildPublications } from "./publications.mjs";
import { fixedSectionIds } from "../../app/kb/procedures/render-sections.mjs";
import { declaredRouteModules } from "./features/anchors.mjs";
import { parseSource, ts } from "@dustinedwards/devkit/node/syntax";
import { readPublishedPages } from "./published-pages.mjs";
import { walkFiles } from "@dustinedwards/devkit/node";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const rel = (/** @type {string} */ file) => relative(root, file).split(sep).join("/");

/** The hosts whose URLs are this site's own links, written absolute. */
export const SITE_HOST = /^https?:\/\/(?:www\.)?dustinedwards\.info(?=[/?#]|$)/i;

/** @type {Set<string>} */
const served = new Set();
/** @type {Map<string, string>} path to the route module that renders it */
const moduleOf = new Map();

const routes = await declaredRouteModules();
for (const [path, file] of routes) {
  if (path.includes(":") || path.includes("*")) continue;
  served.add(path);
  moduleOf.set(path, file);
}

const PUBLIC = join(root, "public");
export const publicFiles = walkFiles(PUBLIC).map(
  (file) => `/${relative(PUBLIC, file).split(sep).join("/")}`,
);
for (const path of publicFiles) served.add(path);

// The page twins are written by build:content and gitignored, so they are named from the page list. A draft page
// and its twin answer 404 to a reader, so they are not served; `postVisibility` below marks them as drafts.
const PUBLISHED_PAGE_PATHS = publishedContentPagePaths(readPublishedPages());
const DRAFT_PAGE_PATHS = CONTENT_PAGE_PATHS.filter((path) => !PUBLISHED_PAGE_PATHS.includes(path));
for (const path of DRAFT_PAGE_PATHS) served.delete(path);
for (const path of PUBLISHED_PAGE_PATHS) served.add(contentPageMarkdownPath(path));

// The procedures (docs/PROCEDURES.md): each page, its sheet and its twin, drawn from D1 by one
// parameterized route per profile root, compiled here the way sync:content writes them.
export const procedureRows = (await buildProcedures()).rows.filter(
  (row) => row.status === "published",
);
for (const row of procedureRows) {
  served.add(row.path);
  served.add(`${row.path}.md`);
  served.add(`${row.path}/sheet`);
  moduleOf.set(row.path, routes.get(`${row.path.slice(0, row.path.lastIndexOf("/"))}/:slug`) ?? "");
}

// The lab registry (docs/REGISTRY.md): the inventory and its twin, each kind's page, and each published item with its
// twin, drawn from D1 by routes, compiled here the way sync:content writes them.
served.add("/research/lab.md");
const registryItems = (await buildRegistry()).items.filter((item) => item.status === "published");
for (const kind of new Set(registryItems.map((item) => item.kind))) {
  served.add(kindPath(kind));
  served.add(`${kindPath(kind)}.md`);
  moduleOf.set(kindPath(kind), routes.get("/research/lab/:kind/:id?") ?? "");
}
// A kind that is one table has no page for an item, so no address is served for one.
for (const item of registryItems.filter((i) => hasItemPage(i.kind))) {
  served.add(itemPath(item.kind, item.id));
  served.add(`${itemPath(item.kind, item.id)}.md`);
  moduleOf.set(itemPath(item.kind, item.id), routes.get("/research/lab/:kind/:id?") ?? "");
}

// The network of systems (app/lib/systems.mjs): each system's page and its twin, from the committed model.
const systemModel = loadSystemModel(
  JSON.parse(readFileSync(join(root, "data/system-model.json"), "utf8")),
);
for (const { id } of systemModel.systems) {
  served.add(systemPath(id));
  served.add(`${systemPath(id)}.md`);
  moduleOf.set(systemPath(id), routes.get("/systems/:id") ?? "");
}

// The papers (docs/PUBLICATIONS.md): each page, its twin and its exports, drawn from D1 by routes, compiled
// here the way sync:content writes them.
export const publicationRows = (await buildPublications()).rows.filter(
  (row) => row.status === "published",
);
for (const { slug } of publicationRows) {
  const page = paperPath(slug);
  served.add(page);
  moduleOf.set(page, routes.get("/research/publications/:slug") ?? "");
  served.add(paperMarkdownPath(slug));
  served.add(`/research/publications/${slug}.bib`);
  served.add(`/research/publications/${slug}.ris`);
}

/**
 * @typedef {{ slug: string, html: string, toc?: unknown, draft?: boolean, publishAt: string,
 *   tags?: string[], series?: string | null, furtherReading?: Array<{ title: string, url: string }> }} Post
 */

const POSTS_DIR = join(root, "content", "posts");
/** @type {Array<{ file: string, post: Post }>} */
export const posts = [];
for (const name of walkFiles(POSTS_DIR, { keep: (n) => n.endsWith(".md") }).sort()) {
  const file = `content/posts/${basename(name)}`;
  const rendered = /** @type {unknown} */ (await renderPost(file, readFileSync(name, "utf8")));
  posts.push({ file, post: /** @type {Post} */ (rendered) });
}

const now = Date.now();
/** @param {Post} post */
export const isPublic = (post) =>
  isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt }, now);

/** @type {Map<string, boolean>} post (or draft page) path to whether a reader can open it */
const postVisibility = new Map();
for (const path of DRAFT_PAGE_PATHS) {
  postVisibility.set(path, false);
  postVisibility.set(contentPageMarkdownPath(path), false);
}
const postModule = routes.get("/writing/:slug") ?? "";
for (const { post } of posts) {
  const path = `/writing/${post.slug}`;
  postVisibility.set(path, isPublic(post));
  postVisibility.set(`${path}.md`, isPublic(post));
  moduleOf.set(path, postModule);
  if (!isPublic(post)) continue;
  for (const tag of post.tags ?? []) {
    for (const suffix of ["", "/rss.xml", "/feed.json"]) served.add(`${tagPath(tag)}${suffix}`);
  }
  if (post.series) {
    for (const suffix of ["", "/rss.xml", "/feed.json"])
      served.add(`${seriesPath(post.series)}${suffix}`);
  }
}

/* The anchors: the ids each page carries, from its rendered markdown and the components that draw it. */

/** @type {Map<string, Set<string>>} */
const renderedIds = new Map();

for (const { post } of posts) renderedIds.set(`/writing/${post.slug}`, idsIn(post.html));

export const pages = await renderContentPages();
export const { entryFor: dictionaryEntryFor } = await buildDictionary();
for (const page of pages) renderedIds.set(page.path, idsIn(page.html));

/** Every string in a procedure record: its HTML fragments are where its ids and links are. */
export const stringsIn = (/** @type {unknown} */ value) => {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {unknown} */ v) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out.join(" ");
};
for (const row of procedureRows) {
  const record = JSON.parse(row.record);
  const ids = idsIn(stringsIn(record.sections));
  for (const entry of record.toc) ids.add(entry.id);
  for (const id of fixedSectionIds(record.profile)) ids.add(id);
  for (const t of record.troubleshooting) ids.add(`trouble-${t.id}`);
  for (const s of record.solutions) ids.add(`solution-${s.id}`);
  renderedIds.set(row.path, ids);
}

// About is a page file with a route of its own (docs/PAGES.md): its ids and its links are read from the same compile.
export const ownRoutePages = await renderOwnRoutePages();
for (const page of ownRoutePages) renderedIds.set(page.path, idsIn(page.html));

/**
 * Static `id="x"` in a module and the components it imports, and the prefixes of template ids
 * (`year-${...}`), which an anchor may match without this gate being able to say more.
 *
 * @type {Map<string, { ids: Set<string>, prefixes: string[] }>}
 */
const moduleIdMemo = new Map();

/** @param {string} file */
function moduleIds(file) {
  const memo = moduleIdMemo.get(file);
  if (memo) return memo;
  /** @type {{ ids: Set<string>, prefixes: string[] }} */
  const out = { ids: new Set(), prefixes: [] };
  moduleIdMemo.set(file, out);
  const files = [file];
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/from\s+["']~\/components\/([\w-]+)["']/g)) {
    files.push(join(root, "app", "components", `${m[1]}.tsx`));
  }
  // A route that re-exports another (teaching.tsx from content-page.tsx) renders that one's ids.
  for (const m of text.matchAll(/from\s+["']\.\/([\w.$-]+)["']/g)) {
    const next = join(dirname(file), `${m[1]}.tsx`);
    if (next === file) continue;
    try {
      readFileSync(next);
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
      continue;
    }
    const inner = moduleIds(next);
    for (const id of inner.ids) out.ids.add(id);
    out.prefixes.push(...inner.prefixes);
  }
  for (const each of files) {
    let source;
    try {
      source = readFileSync(each, "utf8");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
      continue;
    }
    const sf = parseSource(each, source);
    const visit = (/** @type {ts.Node} */ n) => {
      if (ts.isJsxAttribute(n) && n.name.getText(sf) === "id" && n.initializer) {
        const init = n.initializer;
        if (ts.isStringLiteral(init)) out.ids.add(init.text);
        else if (ts.isJsxExpression(init) && init.expression) {
          const e = init.expression;
          if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) out.ids.add(e.text);
          else if (ts.isTemplateExpression(e) && e.head.text) out.prefixes.push(e.head.text);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

/**
 * @param {string} path
 * @param {string} anchor
 * @returns {"found" | "missing" | "unverifiable"}
 */
export function anchorOn(path, anchor) {
  const id = safeDecode(anchor);
  if (renderedIds.get(path)?.has(id)) return "found";
  const file = moduleOf.get(path);
  if (!file) return "unverifiable";
  const { ids, prefixes } = moduleIds(file);
  if (ids.has(id)) return "found";
  if (prefixes.some((prefix) => id.startsWith(prefix))) return "unverifiable";
  return "missing";
}

/* ---------------------------------------------------------------------------------------------------
 * Resolution, in the gateway's order (workers/app.ts): the WordPress map (links are read on the apex
 * host), then the paper slash form, then the router.
 * ------------------------------------------------------------------------------------------------ */

/**
 * @param {string} path
 * @returns {{ status: 301, location: string } | { status: 410 } | null}
 */
function gatewayRedirect(path) {
  const wordpress = wordpressDisposition(path);
  if (wordpress) return wordpress;
  const slashed = paperSlashTarget(path);
  return slashed === null ? null : { status: 301, location: slashed };
}

/** @typedef {{ kind: "ok" | "missing" | "gone" | "draft" | "media", path: string, hops: string[] }} Resolution */

/**
 * @param {string} path
 * @param {string[]} [hops]
 * @returns {Resolution}
 */
export function resolvePath(path, hops = []) {
  if (hops.length > 5) return { kind: "missing", path, hops };
  const redirect = gatewayRedirect(path);
  if (redirect?.status === 410) return { kind: "gone", path, hops };
  if (redirect?.status === 301) {
    const [next] = redirect.location.split("#");
    return resolvePath(next, [...hops, redirect.location]);
  }
  // Media blobs live in R2, which an offline gate cannot list. Counted, never passed as checked.
  if (path.startsWith("/media/")) return { kind: "media", path, hops };
  const visible = postVisibility.get(path);
  if (visible !== undefined) return { kind: visible ? "ok" : "draft", path, hops };
  return { kind: served.has(path) ? "ok" : "missing", path, hops };
}

/** @param {string} value */
export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
