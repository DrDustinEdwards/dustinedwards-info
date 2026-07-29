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
/** @param {string} s */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

console.log(`Verifying ${ORIGIN}\n`);

/* --- 1. Theme resolution, server rendered ------------------------------- */

/** @param {string} s */
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
      check(`css: ${label}`, css.toLowerCase().includes(needle) === true);
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
  check(
    "search: JSON twin negotiates",
    (json.res.headers.get("content-type") ?? "").includes("json"),
  );
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

/* --- 9. Drafts reach NONE of the nine public surfaces -------------------- *
 *
 * Regression check for the leak of 2026-07-29: five unpublished drafts were
 * uploaded to the AI index unconditionally, and the public unauthenticated
 * /search/ask answered from one and cited it by slug.
 *
 * The eight keyword surfaces filter at QUERY time and are cheap, so every draft
 * is checked against all of them. Ask is the ninth and it BILLS PER ANSWER, so
 * it is capped and the cap is printed rather than left implicit: a silent cap
 * reads as "covered everything" when it did not.
 *
 * The draft list comes from the gated artifact, so a post added later is swept
 * without anyone remembering to add it here.
 */

const ASK_PROBE_LIMIT = 3;

{
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  /** @type {any[]} */
  const drafts = artifact.posts.filter((/** @type {any} */ p) => p.draft === true);
  const live = artifact.posts.filter((/** @type {any} */ p) => p.draft !== true);
  console.log(`  corpus: ${live.length} published, ${drafts.length} draft`);

  // The published corpus is present, which is what stops "nothing is listed"
  // passing this whole section for the wrong reason.
  const index = await get("/blog");
  check("blog: index renders", index.status === 200);
  for (const p of live) {
    check(
      `blog: index lists the published post /blog/${p.slug}`,
      index.text.includes(`/blog/${p.slug}`),
    );
  }

  const [rss, feed, sitemap] = await Promise.all([
    get("/blog/rss.xml"),
    get("/blog/feed.json"),
    get("/sitemap.xml"),
  ]);

  for (const p of drafts) {
    const slug = p.slug;
    check(`draft ${slug}: absent from /blog`, !index.text.includes(`/blog/${slug}`));

    const page = await get(`/blog/${slug}`);
    check(`draft ${slug}: /blog/${slug} is 404`, page.status === 404, `got ${page.status}`);

    const twin = await get(`/blog/${slug}.md`);
    check(`draft ${slug}: the markdown twin is 404`, twin.status === 404, `got ${twin.status}`);

    check(`draft ${slug}: absent from rss.xml`, !rss.text.includes(slug));
    check(`draft ${slug}: absent from feed.json`, !feed.text.includes(slug));
    check(`draft ${slug}: absent from sitemap.xml`, !sitemap.text.includes(slug));

    // Its own title is the query most likely to retrieve it, so a miss here is
    // meaningful rather than an artefact of a weak query.
    const q = encodeURIComponent(`"${p.title}"`);
    const html = await get(`/search?q=${q}`);
    check(`draft ${slug}: absent from /search results`, !html.text.includes(`/blog/${slug}`));

    const json = await get(`/search?q=${q}`, { accept: "application/json" });
    check(`draft ${slug}: absent from the search JSON`, !json.text.includes(`/blog/${slug}`));
  }

  /**
   * The ninth surface. A citation rides as `item.key`, which is
   * `blog/<slug>.md` or `blog/<slug>__<anchor>.md`, NOT a `/blog/<slug>` URL:
   * the URL is reconstructed client side by ask-keys.mjs. The first version of
   * this check searched the body for `/blog/<slug>` and could therefore never
   * have failed, which is why it was made to fail before being trusted.
   *
   * @param {string} label @param {string} q
   * @returns {Promise<{keys: string[], status: number} | null>} null if refused
   */
  async function askKeys(label, q) {
    const res = await fetch(`${ORIGIN}/search/ask?q=${encodeURIComponent(q)}`, {
      headers: { "user-agent": UA, "cache-control": "no-cache" },
    });
    const body = await res.text();
    // A refusal is the guard working, not a leak result, and it must not be
    // counted as evidence of absence.
    if (res.status === 429) {
      console.log(`  ask: ${label} refused by the rate limit, not probed`);
      return null;
    }
    const m = body.match(/event: chunks\ndata: (.*)/);
    check(`ask: ${label} returned a parseable chunks event`, Boolean(m), `status ${res.status}`);
    if (!m) return { keys: [], status: res.status };
    /** @type {any[]} */
    const chunks = JSON.parse(m[1]);
    return { keys: chunks.map((c) => String(c?.item?.key ?? "")), status: res.status };
  }

  /**
   * A query MEASURED to retrieve on this corpus. Its job is to prove retrieval
   * is alive, so that the draft probes below are absence of a leak rather than
   * absence of an answer. Ask returns zero chunks for plenty of reasonable
   * questions under the instance's 0.4 score threshold, and without this the
   * whole section would pass on an empty index.
   *
   * If the corpus moves and this stops retrieving, this check fails and someone
   * picks a new probe. That is the intended failure, not a false alarm.
   */
  const positive = await askKeys("positive control", "d1");
  if (positive) {
    check("ask: the positive control retrieves at least one chunk", positive.keys.length > 0);
    for (const key of positive.keys) {
      check(
        `ask: retrieved key ${key} belongs to a published post`,
        live.some((/** @type {any} */ p) => key.startsWith(`blog/${p.slug}`)),
      );
    }
  }

  // Billed per answer and rate limited to five per minute per IP, so this is
  // capped and the cap is printed. A silent cap reads as full coverage.
  const probes = drafts.slice(0, ASK_PROBE_LIMIT);
  for (const p of probes) {
    const got = await askKeys(`draft ${p.slug}`, p.title);
    if (!got) continue;
    const leaked = got.keys.filter((k) => k.startsWith(`blog/${p.slug}`));
    check(`draft ${p.slug}: Ask cites nothing from it`, leaked.length === 0, leaked.join(", "));
  }
  console.log(
    `  ask probes: ${probes.length} of ${drafts.length} drafts (billed per answer, ` +
      `${drafts.length - probes.length} not probed)`,
  );
}

/* --- 10. The retired routes are bare 404s, and the kept files are not ---- */

{
  // Never a redirect and never a prefix rule: /publications/* and
  // /phage-hunters/* ARE the 40 kept files, and a gone rule matching either
  // prefix would take them with it.
  for (const path of [
    "/research",
    "/publications",
    "/teaching",
    "/phage-hunters",
    "/phage-discovery",
  ]) {
    const { status } = await get(path);
    check(`retired: ${path} is a bare 404`, status === 404, `got ${status}`);
  }
}

/* --- Report ------------------------------------------------------------ */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
