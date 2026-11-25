/** check:links' link sources: every internal link the site publishes, collected with where it came from. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contentPageMarkdownBody, contentPageMarkdownPath } from "../../app/lib/content-pages.mjs";
import { unescapeHtml } from "@dustinedwards/site-runtime/html";
import { buildNav, menuLinks } from "../../app/lib/nav.ts";
import { EXPLICIT_ROWS, PROFILE_TARGET } from "../../app/lib/wordpress-redirects.mjs";
import { parseSource, ts } from "@dustinedwards/devkit/node/syntax";
import { walkFiles } from "@dustinedwards/devkit/node";
import {
  SITE_HOST,
  dictionaryEntryFor,
  isPublic,
  ownRoutePages,
  pages,
  posts,
  procedureRows,
  publicationRows,
  rel,
  root,
  stringsIn,
} from "./link-address-book.mjs";

/**
 * @typedef {{ where: string, href: string, page: string | null, isPublic: boolean,
 *   pathOnly?: boolean }} Link
 */

/** @type {Link[]} */
export const links = [];
/** @type {Map<string, number>} */
export const perClass = new Map();

/**
 * @param {string} group
 * @param {Link} link
 */
function add(group, link) {
  links.push(link);
  perClass.set(group, (perClass.get(group) ?? 0) + 1);
}

/** @param {string} html */
const hrefsIn = (html) =>
  [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => unescapeHtml(m[1] ?? ""));

/** @param {string} markdown */
const markdownLinks = (markdown) =>
  [...markdown.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);

for (const { file, post } of posts) {
  const page = `/writing/${post.slug}`;
  const pub = isPublic(post);
  for (const href of hrefsIn(post.html)) add("posts", { where: file, href, page, isPublic: pub });
  for (const item of post.furtherReading ?? []) {
    add("further_reading", {
      where: `${file} further_reading`,
      href: item.url,
      page,
      isPublic: pub,
    });
  }
}
for (const page of pages) {
  const where =
    page.path === "/cv"
      ? "content/cv/ (/cv)"
      : `content/pages/${page.path.slice(1).replaceAll("/", "-")}.md`;
  for (const href of hrefsIn(page.html))
    add("pages", { where, href, page: page.path, isPublic: true });
  for (const href of markdownLinks(contentPageMarkdownBody(page, dictionaryEntryFor(page.path)))) {
    add("page twins", {
      where: `${contentPageMarkdownPath(page.path)} (twin)`,
      href,
      page: page.path,
      isPublic: true,
    });
  }
}
for (const row of procedureRows) {
  const where = row.sourcePath;
  for (const href of hrefsIn(stringsIn(JSON.parse(row.record))))
    add("procedures", { where, href, page: row.path, isPublic: true });
  for (const href of markdownLinks(row.markdown)) {
    add("procedure twins", {
      where: `${row.path}.md (twin)`,
      href,
      page: row.path,
      isPublic: true,
    });
  }
}
for (const page of ownRoutePages) {
  const where = `content/pages/${page.path.slice(1).replaceAll("/", "-")}.md`;
  for (const href of hrefsIn(page.html))
    add("about", { where, href, page: page.path, isPublic: true });
}

// The app: route components, menus, footer and data, off the syntax tree.
const LINK_PROPS = new Set(["href", "to", "url"]);
const appFiles = walkFiles(join(root, "app"), {
  keep: (name) =>
    /\.(ts|tsx|mjs)$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith(".generated.ts"),
}).sort();

/** @param {ts.Node} n */
function literalText(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isJsxExpression(n) && n.expression) return literalText(n.expression);
  return null;
}

export let sitemapPaths = 0;
for (const file of appFiles) {
  const where = rel(file);
  // The menus hold links to pages not yet written, which liveMenu keeps out of the header; the
  // header's own links are read from buildNav() below, as they render.
  if (where === "app/lib/nav.ts") continue;
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
      // A footer link marked `page: true` renders only while its page is published (capsomer/family-footer,
      // siteLinks), so it may name a draft; every other link to a draft fails below.
      const whilePublished =
        ts.isPropertyAssignment(n) &&
        ts.isObjectLiteralExpression(n.parent) &&
        n.parent.properties.some(
          (p) =>
            ts.isPropertyAssignment(p) &&
            p.name.getText(sf) === "page" &&
            p.initializer.kind === ts.SyntaxKind.TrueKeyword,
        );
      add("app", { where, href: candidate, page: null, isPublic: !whilePublished });
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
      add("app", {
        where,
        href: n.templateSpans[0].literal.text,
        page: null,
        isPublic: true,
        pathOnly: true,
      });
    }

    // https://dustinedwards.info/... written out in any string.
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      for (const m of n.text.matchAll(
        /https?:\/\/(?:www\.)?dustinedwards\.info(?:\/[^\s"'`<>)]*)?/gi,
      )) {
        add("app", { where, href: m[0], page: null, isPublic: true });
      }
    }

    // The sitemap's static pages are their own list ({ path, title }), not link props. `as const` wraps the array.
    if (
      where === "app/lib/site-urls.server.ts" &&
      ts.isVariableDeclaration(n) &&
      n.name.getText(sf) === "STATIC_PAGES" &&
      n.initializer
    ) {
      const list = ts.isAsExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isArrayLiteralExpression(list)) {
        for (const element of list.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          for (const prop of element.properties) {
            if (!ts.isPropertyAssignment(prop) || prop.name.getText(sf) !== "path") continue;
            if (!ts.isStringLiteral(prop.initializer)) continue;
            const href = prop.initializer.text;
            sitemapPaths += 1;
            add("sitemap", { where: `${where} STATIC_PAGES`, href, page: null, isPublic: true });
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// The header: each item and every link its live panel renders.
for (const item of buildNav()) {
  for (const href of [item.to, ...menuLinks(item.menu)]) {
    add("header menus", {
      where: `app/lib/nav.ts ${item.label}`,
      href,
      page: null,
      isPublic: true,
    });
  }
}

// llms.txt names pages as markdown list links with absolute URLs, and paths in prose. A path written just
// before "301s" is documenting the redirect.
{
  const text = readFileSync(join(root, "content", "llms.txt"), "utf8");
  for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (!href || !(href.startsWith("/") || SITE_HOST.test(href)) || href.startsWith("//")) continue;
    add("llms.txt", { where: "content/llms.txt", href, page: null, isPublic: true });
  }
  const tokens = text.split(/\s+/);
  tokens.forEach((raw, i) => {
    const token = raw
      .replace(/^[("'`]+/, "")
      .replace(/[)"'`,;:]+$/, "")
      .replace(/\.$/, "");
    const internal = token.startsWith("/") ? token : SITE_HOST.test(token) ? token : null;
    if (!internal || internal.startsWith("//")) return;
    if (/[<{]/.test(internal)) return;
    if (tokens[i + 1] === "301s") return;
    add("llms.txt", { where: "content/llms.txt", href: internal, page: null, isPublic: true });
  });
}

for (const { slug, markdown: body } of publicationRows) {
  const name = `${slug}.md`;
  // The page and the PDF are frontmatter fields (`url:`, `pdf:`), the rest are markdown links.
  const fields = [...body.matchAll(/^(?:url|pdf):\s*"?(\/[^"\s]*)"?\s*$/gm)].map((m) => m[1]);
  for (const href of [...fields, ...markdownLinks(body)]) {
    add("paper twins", {
      where: `content/publications/${slug}.md (twin ${name})`,
      href,
      page: null,
      isPublic: true,
    });
  }
}

// The redirect map's targets: a 301 into a 404 is a broken link the gateway publishes.
for (const [from, to] of Object.entries(EXPLICIT_ROWS)) {
  add("redirect targets", {
    where: `app/lib/wordpress-redirects.mjs ${from}`,
    href: to,
    page: null,
    isPublic: true,
  });
}
add("redirect targets", {
  where: "app/lib/wordpress-redirects.mjs PROFILE_TARGET",
  href: PROFILE_TARGET,
  page: null,
  isPublic: true,
});
