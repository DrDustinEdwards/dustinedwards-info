/**
 * check:links. Every INTERNAL link the site publishes resolves to something the site serves: a page, a
 * post, a paper, a markdown twin or a static file, and, where the target's headings can be read, the
 * #anchor on it. Offline: the address book is built from the sources (app/routes.ts, the content,
 * app/data/publications.ts, public/), never from a database or the network.
 *
 * WHERE THE LINKS COME FROM
 *   content    every post, Research/Teaching/Software page, the CV and About, rendered with the site's
 *              own pipeline, so a link is read the way a reader gets it; a post's further_reading too
 *   app        every href/to/url in the route components, menus, footer and data (read off the syntax
 *              tree), every `${SITE_ORIGIN}/path`, and every https://dustinedwards.info/ URL in a string
 *   machines   content/llms.txt, the sitemap's static paths, every page twin and every paper twin
 *   redirects  the targets of the WordPress map and the PDF map, since a 301 into a 404 is a broken link
 *
 * WHAT A LINK MAY BE
 *   a page the site serves                                   ok
 *   a path the gateway 301s, to a page that exists           ok, and FLAGGED: link the target directly
 *   a post that is a draft or scheduled, from a public page  FAIL: every reader gets a 404
 *   anything else, a 410, or an anchor with no heading       FAIL
 *
 * Takes over the further_reading check that was in check:content, which covered one field of one
 * source; this covers it with the rest.
 */

import { readFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLICATIONS } from "../app/data/publications.ts";
import { CONTENT_PAGE_PATHS, contentPageMarkdownBody, contentPageMarkdownPath } from "../app/lib/content-pages.mjs";
import { movedPathTarget } from "../app/lib/path-moves.mjs";
import { paperSlashTarget, pdfRedirectTarget } from "../app/lib/publications/pdf-redirect.mjs";
import { doiSlug, paperMarkdownPath, paperPath } from "../app/lib/publications/paths.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { seriesPath } from "../app/lib/series-path.mjs";
import { postRedirectTarget } from "../app/lib/slug-redirect.mjs";
import { tagPath } from "../app/lib/tag-path.mjs";
import { EXPLICIT_ROWS, PROFILE_TARGET, wordpressDisposition } from "../app/lib/wordpress-redirects.mjs";
import { generateTwins } from "./build-publication-twins.mjs";
import { ABOUT_SOURCE, buildAbout, renderContentPages } from "./build-content.mjs";
import { renderPost } from "./lib/content.mjs";
import { declaredRouteModules } from "./lib/features/anchors.mjs";
import { parseSource, ts } from "./lib/syntax.mjs";
import { createTally } from "./lib/tally.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (/** @type {string} */ file) => relative(root, file).split(sep).join("/");

/** The hosts whose URLs are this site's own links, written absolute. */
const SITE_HOST = /^https?:\/\/(?:www\.)?dustinedwards\.info(?=[/?#]|$)/i;

console.log("\ncheck:links\n");

const tally = createTally({ print: false });
const { ok } = tally;

/* ---------------------------------------------------------------------------------------------------
 * The address book: every path the site answers, from the sources.
 * ------------------------------------------------------------------------------------------------ */

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

const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));

/** Every file under public/ is served at its own path by the asset handler. */
const PUBLIC = join(root, "public");
const publicFiles = walkFiles(PUBLIC).map((file) => `/${relative(PUBLIC, file).split(sep).join("/")}`);
for (const path of publicFiles) served.add(path);

// The page twins are written by build:content and gitignored, so they are named from the page list.
for (const path of CONTENT_PAGE_PATHS) served.add(contentPageMarkdownPath(path));

for (const paper of PUBLICATIONS) {
  const slug = doiSlug(paper.doi);
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
const posts = [];
for (const name of walkFiles(POSTS_DIR, { keep: (n) => n.endsWith(".md") }).sort()) {
  const file = `content/posts/${basename(name)}`;
  const rendered = /** @type {unknown} */ (await renderPost(file, readFileSync(name, "utf8")));
  posts.push({ file, post: /** @type {Post} */ (rendered) });
}

const now = Date.now();
/** @param {Post} post */
const isPublic = (post) =>
  isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt }, now);

/** @type {Map<string, boolean>} post path to whether a reader can open it */
const postVisibility = new Map();
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
    for (const suffix of ["", "/rss.xml", "/feed.json"]) served.add(`${seriesPath(post.series)}${suffix}`);
  }
}

/* ---------------------------------------------------------------------------------------------------
 * The anchors: the ids each page carries, from its rendered markdown and the components that draw it.
 * ------------------------------------------------------------------------------------------------ */

/** @type {Map<string, Set<string>>} */
const renderedIds = new Map();
/** @param {string} html */
const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1])));

for (const { post } of posts) renderedIds.set(`/writing/${post.slug}`, idsIn(post.html));

const pages = await renderContentPages();
for (const page of pages) renderedIds.set(page.path, idsIn(page.html));

const about = JSON.parse(await buildAbout());
renderedIds.set("/about", idsIn(about.html));

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
function anchorOn(path, anchor) {
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
 * host), then the moved sections, renamed posts, moved PDFs and the paper slash form, then the router.
 * ------------------------------------------------------------------------------------------------ */

/**
 * @param {string} path
 * @returns {{ status: 301, location: string } | { status: 410 } | null}
 */
function gatewayRedirect(path) {
  const wordpress = wordpressDisposition(path);
  if (wordpress) return wordpress;
  const moved = movedPathTarget(path);
  const next = moved ?? path;
  const renamed = postRedirectTarget(next, redirects.posts);
  const movedPdf = renamed === null ? pdfRedirectTarget(next, redirects.pdfs) : null;
  const slashed = renamed === null && movedPdf === null ? paperSlashTarget(next) : null;
  const target = renamed ?? movedPdf ?? slashed ?? moved;
  return target === null ? null : { status: 301, location: target };
}

/** @typedef {{ kind: "ok" | "missing" | "gone" | "draft" | "media", path: string, hops: string[] }} Resolution */

/**
 * @param {string} path
 * @param {string[]} [hops]
 * @returns {Resolution}
 */
function resolvePath(path, hops = []) {
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

/* ---------------------------------------------------------------------------------------------------
 * The links.
 * ------------------------------------------------------------------------------------------------ */

/**
 * @typedef {{ where: string, href: string, page: string | null, isPublic: boolean,
 *   pathOnly?: boolean }} Link
 */

/** @type {Link[]} */
const links = [];
/** @type {Map<string, number>} */
const perClass = new Map();

/**
 * @param {string} group
 * @param {Link} link
 */
function add(group, link) {
  links.push(link);
  perClass.set(group, (perClass.get(group) ?? 0) + 1);
}

/** @param {string} value */
function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** @param {string} value */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** @param {string} html */
const hrefsIn = (html) => [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => decodeEntities(m[1]));

/** @param {string} markdown */
const markdownLinks = (markdown) =>
  [...markdown.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);

// Content, rendered the way a reader gets it.
for (const { file, post } of posts) {
  const page = `/writing/${post.slug}`;
  const pub = isPublic(post);
  for (const href of hrefsIn(post.html)) add("posts", { where: file, href, page, isPublic: pub });
  for (const item of post.furtherReading ?? []) {
    add("further_reading", { where: `${file} further_reading`, href: item.url, page, isPublic: pub });
  }
}
for (const page of pages) {
  const where = page.path === "/cv" ? "app/data/cv.ts (/cv)" : `content/pages/${page.path.slice(1).replaceAll("/", "-")}.md`;
  for (const href of hrefsIn(page.html)) add("pages", { where, href, page: page.path, isPublic: true });
  for (const href of markdownLinks(contentPageMarkdownBody(page))) {
    add("page twins", { where: `${contentPageMarkdownPath(page.path)} (twin)`, href, page: page.path, isPublic: true });
  }
}
for (const href of hrefsIn(about.html)) {
  add("about", { where: ABOUT_SOURCE.split(sep).join("/"), href, page: "/about", isPublic: true });
}

// The app: route components, menus, footer and data, off the syntax tree.
const LINK_PROPS = new Set(["href", "to", "url"]);
const appFiles = walkFiles(join(root, "app"), {
  keep: (name) => /\.(ts|tsx|mjs)$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith(".generated.ts"),
}).sort();

/** @param {ts.Node} n */
function literalText(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isJsxExpression(n) && n.expression) return literalText(n.expression);
  return null;
}

let sitemapPaths = 0;
for (const file of appFiles) {
  const where = rel(file);
  const sf = parseSource(file, readFileSync(file, "utf8"));
  const visit = (/** @type {ts.Node} */ n) => {
    // <Link to="/x">, <a href="/x">, and { to: "/x" } in the menus, footer and data.
    /** @type {string | null} */
    let candidate = null;
    if (ts.isJsxAttribute(n) && LINK_PROPS.has(n.name.getText(sf)) && n.initializer) {
      candidate = literalText(n.initializer);
    } else if (
      ts.isPropertyAssignment(n) &&
      (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
      LINK_PROPS.has(n.name.text)
    ) {
      candidate = literalText(n.initializer);
    }
    if (candidate !== null && candidate.startsWith("/") && !candidate.startsWith("//")) {
      add("app", { where, href: candidate, page: null, isPublic: true });
    }

    // `${SITE_ORIGIN}/path`: the path is a link; a fragment here is a JSON-LD id, not an anchor.
    if (
      ts.isTemplateExpression(n) &&
      n.head.text === "" &&
      n.templateSpans.length === 1 &&
      ts.isIdentifier(n.templateSpans[0].expression) &&
      ["SITE_ORIGIN", "origin"].includes(n.templateSpans[0].expression.text) &&
      n.templateSpans[0].literal.text.startsWith("/")
    ) {
      add("app", { where, href: n.templateSpans[0].literal.text, page: null, isPublic: true, pathOnly: true });
    }

    // https://dustinedwards.info/... written out in any string.
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      for (const m of n.text.matchAll(/https?:\/\/(?:www\.)?dustinedwards\.info(?:\/[^\s"'`<>)]*)?/gi)) {
        add("app", { where, href: m[0], page: null, isPublic: true });
      }
    }

    // The sitemap's static paths are its own list, not link props.
    if (
      where === "app/routes/sitemap.ts" &&
      ts.isVariableDeclaration(n) &&
      n.name.getText(sf) === "STATIC_PATHS" &&
      n.initializer &&
      ts.isArrayLiteralExpression(n.initializer)
    ) {
      for (const element of n.initializer.elements) {
        if (ts.isStringLiteral(element)) {
          sitemapPaths += 1;
          add("sitemap", { where: `${where} STATIC_PATHS`, href: element.text, page: null, isPublic: true });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// llms.txt names paths in prose. A path written just before "301s" is documenting the redirect.
{
  const text = readFileSync(join(root, "content", "llms.txt"), "utf8");
  const tokens = text.split(/\s+/);
  tokens.forEach((raw, i) => {
    const token = raw.replace(/^[("'`]+/, "").replace(/[)"'`,;:]+$/, "").replace(/\.$/, "");
    const internal = token.startsWith("/") ? token : SITE_HOST.test(token) ? token : null;
    if (!internal || internal.startsWith("//")) return;
    if (/[<{]/.test(internal)) return;
    if (tokens[i + 1] === "301s") return;
    add("llms.txt", { where: "content/llms.txt", href: internal, page: null, isPublic: true });
  });
}

// The paper twins, generated in memory as build:publication-twins would write them.
for (const [name, body] of await generateTwins()) {
  for (const href of markdownLinks(body)) {
    add("paper twins", { where: `public/research/publications/${name} (twin)`, href, page: null, isPublic: true });
  }
}

// The redirect maps' targets: a 301 into a 404 is a broken link the gateway publishes.
for (const [from, to] of Object.entries(EXPLICIT_ROWS)) {
  add("redirect targets", { where: `app/lib/wordpress-redirects.mjs ${from}`, href: to, page: null, isPublic: true });
}
add("redirect targets", { where: "app/lib/wordpress-redirects.mjs PROFILE_TARGET", href: PROFILE_TARGET, page: null, isPublic: true });
for (const [from, to] of Object.entries(redirects.pdfs ?? {})) {
  add("redirect targets", { where: `content/redirects.json pdfs ${from}`, href: String(to), page: null, isPublic: true });
}

/* ---------------------------------------------------------------------------------------------------
 * Judge each link.
 * ------------------------------------------------------------------------------------------------ */

/** @type {string[]} */
const flags = [];
let checked = 0;
let external = 0;
let media = 0;
let anchorsChecked = 0;
let anchorsUnverifiable = 0;
/** @type {Set<string>} */
const seen = new Set();

for (const link of links) {
  const key = `${link.where}\u0000${link.href}`;
  if (seen.has(key)) continue;
  seen.add(key);

  let href = link.href.trim();
  if (SITE_HOST.test(href)) href = href.replace(SITE_HOST, "") || "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    external += 1;
    continue;
  }
  const label = `${link.where}: ${link.href}`;
  if (href === "") {
    ok(label, false, "an empty link goes nowhere");
    continue;
  }

  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const anchor = hashAt === -1 ? "" : href.slice(hashAt + 1);
  const path = safeDecode(beforeHash.split("?")[0]);

  // Same-page anchor.
  if (path === "") {
    if (!anchor || link.page === null) continue;
    checked += 1;
    const found = anchorOn(link.page, anchor);
    if (found === "unverifiable") anchorsUnverifiable += 1;
    else anchorsChecked += 1;
    ok(label, found !== "missing", `${link.page} has no element with id "${safeDecode(anchor)}"`);
    continue;
  }
  if (!path.startsWith("/")) {
    checked += 1;
    ok(label, false, "a relative link resolves against whatever page it lands on; write it site-absolute");
    continue;
  }

  checked += 1;
  const result = resolvePath(path);
  if (result.kind === "media") {
    media += 1;
    continue;
  }
  const via = result.hops.length > 0 ? ` (via ${[path, ...result.hops].join(" -> ")})` : "";
  if (result.kind === "missing") {
    ok(label, false, `nothing on the site answers ${result.path}${via}: a 404`);
    continue;
  }
  if (result.kind === "gone") {
    ok(label, false, `${result.path} answers 410 Gone${via}`);
    continue;
  }
  if (result.kind === "draft") {
    ok(
      label,
      !link.isPublic,
      `${result.path} is a draft or scheduled post${via}, so every reader of this public page gets a 404`,
    );
    continue;
  }
  if (result.hops.length > 0) {
    flags.push(`${label}\n        a redirect the site serves; link ${result.hops.at(-1)} directly`);
  }

  // The anchor is read on the page the link finally lands on; a hop's own hash wins over none.
  const landedHash = result.hops.at(-1)?.split("#")[1] ?? "";
  const finalAnchor = anchor || landedHash;
  if (finalAnchor && !link.pathOnly) {
    const target = result.path;
    const found = anchorOn(target, finalAnchor);
    if (found === "unverifiable") anchorsUnverifiable += 1;
    else anchorsChecked += 1;
    ok(label, found !== "missing", `${target} has no element with id "${safeDecode(finalAnchor)}"`);
    continue;
  }
  ok(label, true);
}

/* ---------------------------------------------------------------------------------------------------
 * Scope, so an empty sweep cannot read as a clean one.
 * ------------------------------------------------------------------------------------------------ */

const SCOPES = [
  "posts",
  "further_reading",
  "pages",
  "page twins",
  "about",
  "app",
  "sitemap",
  "llms.txt",
  "paper twins",
  "redirect targets",
];
for (const scope of SCOPES) {
  ok(`scope: ${scope} contributed links`, (perClass.get(scope) ?? 0) > 0, "0 links read, so this source was not examined");
}
ok("scope: the sitemap's STATIC_PATHS were located", sitemapPaths >= 5, `read ${sitemapPaths}`);
ok("scope: anchors were checked", anchorsChecked > 0, "0 anchors resolved, so the anchor check examined nothing");
ok("scope: posts were rendered", posts.length > 0, "content/posts produced no posts");
ok("scope: public/ was read", publicFiles.length > 0, "no static files found under public/");

for (const scope of SCOPES) console.log(`  ${String(perClass.get(scope) ?? 0).padStart(5)}  ${scope}`);
console.log(
  `\n  ${checked} internal link(s) checked, ${anchorsChecked} anchor(s) resolved, ` +
    `${anchorsUnverifiable} anchor(s) on generated ids not verifiable, ${media} /media link(s) in R2 ` +
    `not verifiable offline, ${external} external link(s) out of scope`,
);

if (flags.length > 0) {
  console.log(`\n  ${flags.length} link(s) go through a redirect:`);
  for (const flag of flags) console.log(`  FLAG  ${flag}`);
}

// Measured by running it; a floor well under the count, so a source that stops contributing is caught
// by its scope line above rather than hidden in the slack.
tally.floor("check:links", "checks", 400);

if (tally.failures > 0) {
  console.log(`\n  ${tally.failures} broken:`);
  for (const text of tally.failed) console.log(`  FAIL  ${text}`);
  console.log(`\n${tally.failures} FAILED of ${tally.checks} checks\n`);
  process.exit(1);
}
console.log(`\n${tally.checks} checks, 0 failures\n`);
