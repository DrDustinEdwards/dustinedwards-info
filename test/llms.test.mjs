import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { CONTENT_PAGE_PATHS as CONTENT_PAGES_ALL, draftContentPagePaths, publishedContentPagePaths } from "../app/lib/content-pages.mjs";
import { readPublishedPages } from "../scripts/lib/published-pages.mjs";
import {
  LLMS_MAX_BYTES,
  LLMS_REQUIRED_MENTIONS,
  listedPaperTwins,
  llmsChecks,
  llmsErrors,
  overAdvertisedTwins,
} from "../app/lib/llms/validate.mjs";
import { publishedProcedurePaths } from "../scripts/lib/procedure-paths.mjs";

/* The rules every llms.txt write runs (app/lib/llms/validate.mjs): check:machine-readable and the save.
 * Each case changes the real file by one thing, so a rule that stopped firing fails here instead of
 * letting an edit through. */

const file = readFileSync(new URL("../content/llms.txt", import.meta.url), "utf8");
const origin = (readFileSync(new URL("../app/lib/seo.ts", import.meta.url), "utf8").match(/SITE_ORIGIN = "([^"]+)"/) ?? [])[1] ?? "";
// A draft page answers 404, so llms.txt must not list it (publishedContentPagePaths).
const pagePaths = [...publishedContentPagePaths(readPublishedPages()), ...publishedProcedurePaths()];
/** Built from its code point, so this file carries no literal wide dash. */
const WIDE_DASH = String.fromCharCode(0x2014);

/** The Capsid list item: one page's line, which the cases below remove or change. */
const CAPSID = /^- \[Capsid\]\(https:\/\/dustinedwards\.info\/software\/capsid\).*\n/m;

const optionalPagePaths = draftContentPagePaths(readPublishedPages());
const judge = (/** @type {string} */ text, /** @type {Iterable<string> | undefined} */ twinUrls = undefined) =>
  llmsErrors(llmsChecks(text, { pagePaths, origin, findWideDashes, twinUrls, optionalPagePaths }));

/** The errors a changed file raises: asserts it was refused, and returns them joined. */
function refusal(/** @type {(text: string) => string} */ mutate) {
  const changed = mutate(file);
  assert.ok(changed !== file, "the mutation changed nothing, so it proves nothing");
  const errors = judge(changed);
  assert.notEqual(errors.length, 0, "the file was accepted after the change");
  return errors.join("\n");
}

await test("the committed llms.txt passes every rule", () => {
  assert.ok(origin.startsWith("https://"), "SITE_ORIGIN was not read, so the contact rule would be vacuous");
  assert.deepEqual(judge(file), []);
});

await test("the paper twins the file lists are exactly those a corpus that produces them accepts", () => {
  const listed = [...listedPaperTwins(file)];
  assert.ok(listed.length > 0);
  assert.deepEqual(judge(file, listed), []);
  assert.deepEqual(overAdvertisedTwins(file, listed.slice(1)), [listed[0]]);
  assert.match(judge(file, listed.slice(1)).join("\n"), /advertised with no paper/);
});

await test("an empty, short, long, CRLF or newline-less file is refused", () => {
  assert.match(refusal(() => ""), /not empty/);
  assert.match(refusal(() => "# dustinedwards.info\n"), /long enough/);
  assert.match(refusal((t) => `${t}${"x".repeat(LLMS_MAX_BYTES)}\n`), /at most/);
  assert.match(refusal((t) => t.replaceAll("\n", "\r\n")), /LF-only/);
  assert.match(refusal((t) => t.trimEnd()), /ends with a newline/);
  assert.match(refusal((t) => t.replace(/^# dustinedwards\.info/, "# Another title")), /H1 title/);
});

await test("a wide dash is refused, with its line", () => {
  assert.match(refusal((t) => t.replace("Research in retroviruses", `Research ${WIDE_DASH} in retroviruses`)), /line 3 U\+2014/);
});

await test("each URL pattern and header the file must document is required", () => {
  for (const mention of LLMS_REQUIRED_MENTIONS) {
    assert.ok(file.includes(mention), `the committed file does not document ${mention}`);
    assert.match(refusal((t) => t.replaceAll(mention, "[removed]")), /URL patterns and headers an agent acts on/);
  }
});

await test("a page the site has but the file does not list, and a listed page the site has not, are refused", () => {
  assert.match(file, CAPSID, "the committed file lists Capsid as a link, so the cases below change something real");
  assert.match(refusal((t) => t.replace(CAPSID, "")), /absent from content\/llms\.txt: \/software\/capsid/);
  assert.match(
    refusal((t) => t.replace(CAPSID, (line) => `${line}- [Nope](https://dustinedwards.info/software/not-a-page): x\n`)),
    /listed but not a page: \/software\/not-a-page/,
  );
});

await test("the llmstxt.org shape is required: a summary under the title, and absolute links", () => {
  assert.match(refusal((t) => t.replace(/^> .*\n\n/m, "")), /blockquote summary/);
  assert.match(
    refusal((t) => t.replace("](https://dustinedwards.info/software/capsid)", "](/software/capsid)")),
    /every markdown link in llms\.txt is absolute[\s\S]*\/software\/capsid/,
  );
  // A bare indented path, the old shape, is no longer a listing.
  assert.match(refusal((t) => t.replace(CAPSID, "  /software/capsid\n")), /absent from content\/llms\.txt: \/software\/capsid/);
});

await test("a contact URL that is not the site's origin is refused", () => {
  const inContact = /(## Contact\s*\n\s*\n- \[[^\]]*\]\()https?:\/\/[^\s)]+/;
  assert.match(file, inContact, "the Contact section is a list link, so the case below changes the real one");
  assert.match(refusal((t) => t.replace(inContact, "$1https://example.com")), /contact URL is SITE_ORIGIN/);
});

test("a draft page may be listed ahead of its publish, and need not be: the two changes land in either order", () => {
  const DRAFT = "/teaching/study-skills";
  const line = `- [Draft](https://dustinedwards.info${DRAFT}): a page not yet published\n`;
  const required = pagePaths.filter((p) => p !== DRAFT);
  const withLine = file.replace(CAPSID, (m) => `${m}${line}`);
  const check = (/** @type {string} */ text, /** @type {string[]} */ optional) =>
    llmsErrors(llmsChecks(text, { pagePaths: required, origin, findWideDashes, optionalPagePaths: optional }));
  // A draft: listed or not, the file passes.
  assert.deepEqual(check(withLine, [DRAFT]), []);
  assert.deepEqual(check(file.replace(new RegExp(`^.*\\]\\(https://dustinedwards\\.info${DRAFT}\\).*\\n`, "m"), ""), [DRAFT]), []);
  // Not a registered page at all: still stray.
  assert.equal(check(withLine.replaceAll(DRAFT, "/teaching/nowhere"), [DRAFT]).length, 1);
});

test("a line for any registered page is read as listing it, whatever its first segment", () => {
  // The rule reads list items by address; a page whose root it did not know would read as absent forever.
  const roots = [...new Set(CONTENT_PAGES_ALL.map((path) => path.split("/")[1]))];
  const lines = roots.map((root) => `- [Probe](https://dustinedwards.info/${root}): probe\n`).join("");
  const text = file.replace(CAPSID, (m) => `${m}${lines}`);
  const required = [...pagePaths, ...roots.map((root) => `/${root}`)];
  assert.deepEqual(llmsErrors(llmsChecks(text, { pagePaths: required, origin, findWideDashes })), []);
});
