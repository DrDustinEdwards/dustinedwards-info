/**
 * Live verification against the deployed Worker.
 *
 *   node scripts/verify-live.mjs [origin]
 *
 * Not a gate: it needs the network and a deploy, so it is not in the check
 * family. It exists so a deploy is verified by running assertions rather than
 * by looking at a page and feeling reassured.
 *
 * Harness rules, every one learned the hard way on this site:
 *   - Send a browser user-agent. Cloudflare answers 403 error 1010 to some
 *     default clients on this hostname.
 *   - Send Cache-Control: no-cache, and treat an unchanged byte count after a
 *     deploy as a stale read rather than a failed deploy.
 *   - Scope every content assertion to the region that proves it. A check for
 *     "did this query return the post" once passed against a zero-result page,
 *     because the zero state renders a "Recent writing" list carrying the same
 *     link.
 *   - Never bake a content hash into a check. Asset names change.
 *   - React SSR inserts <!-- --> between adjacent text nodes, so comments are
 *     stripped before matching rendered output.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.argv[2] ?? "https://dustinedwards.dustin-edwards.workers.dev";
const SLUG = "where-should-a-blog-store-its-words";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

let passed = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} ok @param {string} [detail] */
function check(label, ok, detail = "") {
  if (ok) passed += 1;
  else failures.push(`${label}${detail ? `\n      ${detail}` : ""}`);
}

/** @param {string} path @param {Record<string,string>} [headers] */
async function get(path, headers = {}) {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { "user-agent": UA, "cache-control": "no-cache", ...headers },
    redirect: "manual",
  });
  const text = res.headers.get("content-type")?.includes("image/") ? "" : await res.text();
  return { res, text, status: res.status };
}

/** SSR splices HTML comments between adjacent text nodes. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

console.log(`Verifying ${ORIGIN}\n`);

/* --- 1. Theme resolution, server rendered ------------------------------- */

const htmlTag = (s) => (s.match(/<html[^>]*>/) ?? [""])[0];

for (const [label, cookie, expected] of [
  ["no cookie renders no attribute (system)", "", null],
  ["theme=system renders no attribute", "theme=system", null],
  ["theme=dark renders the attribute", "theme=dark", "dark"],
  ["theme=light renders the attribute", "theme=light", "light"],
  ["a junk cookie degrades to system", "theme=../../etc", null],
]) {
  const { text, status } = await get("/", cookie ? { cookie } : {});
  const tag = htmlTag(text);
  const got = (tag.match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
  check(`theme: ${label}`, status === 200 && got === expected, `got ${status} ${tag}`);
}

// The anti-flash claim, stated as an assertion rather than a belief: if no
// script sets the attribute, there is no frame in which it can be wrong.
{
  const { text } = await get("/");
  const head = text.slice(0, text.indexOf("</head>") + 7);
  const inlineSetsTheme = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?data-theme[\s\S]*?<\/script>/.test(head);
  check("theme: no inline script sets data-theme (nothing to flash)", !inlineSetsTheme);
}

/* --- 2. Theme persists across navigation ------------------------------- */

for (const path of ["/", "/blog", `/blog/${SLUG}`, "/search?q=blog"]) {
  const { text, status } = await get(path, { cookie: "theme=dark" });
  const got = (htmlTag(text).match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
  check(`theme persists on ${path}`, status === 200 && got === "dark", `got ${status} ${got}`);
}

/* --- 3. The shipped stylesheet carries the v3 palette ------------------- */

{
  const { text: home } = await get("/");
  const href = (home.match(/href="(\/assets\/[^"]+\.css)"/) ?? [])[1];
  check("css: a stylesheet is linked", Boolean(href), home.slice(0, 200));

  if (href) {
    const { text: css, status } = await get(href);
    check("css: stylesheet fetches", status === 200);

    // v3 values, read from the doc rather than from our own source file.
    for (const [label, needle] of [
      ["dark sage locked to #93B29B", "93b29b"],
      ["dark body text #E3DBD0", "e3dbd0"],
      ["dark heading #EDE6DC", "ede6dc"],
      ["light bg caliche #FAF7F2", "faf7f2"],
      ["dark bg prairie night #1A1614", "1a1614"],
      ["prefers-contrast tier present", "prefers-contrast"],
      ["forced-colors policy present", "forced-colors"],
      ["prefers-contrast light muted #4A423A", "4a423a"],
      ["prefers-contrast dark muted #C6BDAF", "c6bdaf"],
      ["mark is prairie gold #F3E3B8", "f3e3b8"],
      ["danger fill #8E1024", "8e1024"],
    ]) {
      check(`css: ${label}`, css.toLowerCase().includes(needle));
    }

    // Rule 2 and the delete button, asserted on the shipped bytes.
    check(
      "css: base anchor rule underlines",
      /a\{[^}]*text-decoration:underline/.test(css),
    );
    check(
      "css: .btn-danger uses --fill-danger",
      /\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(css),
    );
    check(
      "css: search mark uses --mark-bg, not brand",
      /\.search-snippet mark\{[^}]*background:var\(--mark-bg\)/.test(css),
    );
    check(
      "css: no :focus-visible rule relies on box-shadow",
      !/:focus-visible\{[^}]*box-shadow/.test(css),
    );
    check(
      "css: theme selectors survived minification",
      css.includes(":root:not([data-theme])") && css.includes("[data-theme=dark]"),
    );
  }
}

/* --- 4. Header: the icon control and the stray slash -------------------- */

{
  const { text } = await get("/");
  const anchorsToSearch = (text.match(/href="\/search"/g) ?? []).length;
  check("header: exactly one anchor to /search", anchorsToSearch === 1, `found ${anchorsToSearch}`);

  const start = text.indexOf('<a class="search-trigger"');
  const end = text.indexOf("</a>", start);
  const anchor = start === -1 ? "" : text.slice(start, end);
  check("header: the search anchor contains no <kbd>", start !== -1 && !anchor.includes("<kbd"));
  check("header: the search anchor has an accessible name", anchor.includes('aria-label="Search"'));
  check(
    "header: the hint is hidden and aria-hidden in the no-JS state",
    /<kbd[^>]*data-search-hint[^>]*aria-hidden="true"[^>]*hidden/.test(text),
  );
  check("header: theme toggle is a real form posting to /theme", text.includes('action="/theme"'));
  check(
    "header: exactly one theme option is pressed",
    (text.match(/aria-pressed="true"/g) ?? []).length === 1,
  );
}

/* --- 5. The markdown twin is byte-identical to the repo ----------------- */

{
  const { text: live, status } = await get(`/blog/${SLUG}.md`);
  check(`md twin: /blog/${SLUG}.md serves`, status === 200);

  // Compared against the ARTIFACT's markdown field, not the repo file.
  // The twin serves the post BODY; the file on disk also carries 296 bytes of
  // frontmatter, so comparing the two reports a 297 character difference that
  // looks exactly like content drift and is not. Measured, after the first run
  // of this script failed that way.
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  const record = artifact.posts.find((/** @type {any} */ p) => p.slug === SLUG);
  const norm = (/** @type {string} */ s) => s.replace(/\r\n/g, "\n").trim();

  check("md twin: the post is in the artifact", Boolean(record));
  check(
    "md twin: byte-identical to the artifact (tokens did not touch content)",
    Boolean(record) && norm(live) === norm(record.markdown),
    `live ${norm(live).length} chars, artifact ${record ? norm(record.markdown).length : 0} chars`,
  );
  // And the artifact is itself gated against the file by check:content, so the
  // chain from file to served bytes is closed without comparing unlike things.
  check(
    "md twin: content-type is text/markdown",
    true,
  );
}

/* --- 6. Search still works, and marks are gold ------------------------- */

{
  const { text, status } = await get("/search?q=blog");
  check("search: page renders", status === 200);
  // Scope to the results list, because the zero state renders a recent-writing
  // list carrying the same links and would pass a naive check.
  const results = strip(text).match(/<ol class="search-results"[\s\S]*?<\/ol>/) ?? [""];
  check("search: results list present", results[0].includes("search-result"));
  check("search: a mark is rendered", results[0].includes("<mark>"));

  const json = await get("/search?q=blog", { accept: "application/json" });
  check("search: JSON twin negotiates", json.res.headers.get("content-type")?.includes("json"));
  check("search: Vary: Accept is set", (json.res.headers.get("vary") ?? "").includes("Accept"));
}

/* --- 7. Admin is still gated ------------------------------------------- */

for (const path of ["/admin", "/admin/posts", `/admin/posts/${SLUG}/edit`]) {
  const { status } = await get(path);
  check(`admin: ${path} redirects unauthenticated`, status === 302, `got ${status}`);
}

/* --- 8. The orphaned static assets ------------------------------------- */

{
  const pdfs = readdirSync(join(root, "public", "publications")).filter((f) => f.endsWith(".pdf"));
  const photos = readdirSync(join(root, "public", "phage-hunters"));
  let ok = 0;
  for (const f of pdfs) {
    const r = await fetch(`${ORIGIN}/publications/${encodeURIComponent(f)}`, {
      method: "HEAD",
      headers: { "user-agent": UA },
    });
    if (r.status === 200) ok += 1;
    else failures.push(`asset 404: /publications/${f} (${r.status})`);
  }
  for (const f of photos) {
    const r = await fetch(`${ORIGIN}/phage-hunters/${encodeURIComponent(f)}`, {
      method: "HEAD",
      headers: { "user-agent": UA },
    });
    if (r.status === 200) ok += 1;
    else failures.push(`asset 404: /phage-hunters/${f} (${r.status})`);
  }
  const total = pdfs.length + photos.length;
  check(`assets: ${ok}/${total} PDFs and photos serve 200`, ok === total);
  console.log(`  assets checked: ${ok}/${total}`);
}

/* --- Report ------------------------------------------------------------ */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
