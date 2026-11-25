/**
 * check:links. Every internal link the site publishes (content, app, machine files, redirect targets)
 * resolves to something the site serves, and its #anchor to a heading where one can be read. Offline.
 * A link through a 301 is flagged; a draft target from a public page, a 410 or a missing anchor fails.
 * The address book is scripts/lib/link-address-book.mjs, the links scripts/lib/link-sources.mjs.
 */

import { createTally } from "@dustinedwards/devkit/node";
import {
  SITE_HOST,
  anchorOn,
  posts,
  publicFiles,
  resolvePath,
  safeDecode,
} from "./lib/link-address-book.mjs";
import { links, perClass, sitemapPaths } from "./lib/link-sources.mjs";

console.log("\ncheck:links\n");

const tally = createTally({ print: false });
const { ok } = tally;

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
    ok(
      label,
      false,
      "a relative link resolves against whatever page it lands on; write it site-absolute",
    );
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
      `${result.path} is a draft page, or a draft or scheduled post${via}, so every reader of this public page gets a 404`,
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

/* Scope, so an empty sweep cannot read as a clean one. */

const SCOPES = [
  "posts",
  "further_reading",
  "pages",
  "page twins",
  "about",
  "app",
  "header menus",
  "sitemap",
  "llms.txt",
  "paper twins",
  "redirect targets",
];
for (const scope of SCOPES) {
  ok(
    `scope: ${scope} contributed links`,
    (perClass.get(scope) ?? 0) > 0,
    "0 links read, so this source was not examined",
  );
}
ok("scope: the sitemap's STATIC_PAGES were located", sitemapPaths >= 5, `read ${sitemapPaths}`);
ok(
  "scope: anchors were checked",
  anchorsChecked > 0,
  "0 anchors resolved, so the anchor check examined nothing",
);
ok("scope: posts were rendered", posts.length > 0, "content/posts produced no posts");
ok("scope: public/ was read", publicFiles.length > 0, "no static files found under public/");

for (const scope of SCOPES)
  console.log(`  ${String(perClass.get(scope) ?? 0).padStart(5)}  ${scope}`);
console.log(
  `\n  ${checked} internal link(s) checked, ${anchorsChecked} anchor(s) resolved, ` +
    `${anchorsUnverifiable} anchor(s) on generated ids not verifiable, ${media} /media link(s) in R2 ` +
    `not verifiable offline, ${external} external link(s) out of scope`,
);

if (flags.length > 0) {
  console.log(`\n  ${flags.length} link(s) go through a redirect:`);
  for (const flag of flags) console.log(`  FLAG  ${flag}`);
}

// Measured by running it in CI: 1477 checks. The slack is smaller than any source but the
// few that each carry their own scope line above, so a source that stops contributing is caught. The
// count moves with the content: lower it to a count a run printed, never by arithmetic.
tally.floor("check:links", "checks", 1450);

if (tally.failures > 0) {
  console.log(`\n  ${tally.failures} broken:`);
  for (const text of tally.failed) console.log(`  FAIL  ${text}`);
  console.log(`\n${tally.failures} FAILED of ${tally.checks} checks\n`);
  process.exit(1);
}
console.log(`\n${tally.checks} checks, 0 failures\n`);
