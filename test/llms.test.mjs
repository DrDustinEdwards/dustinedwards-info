import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import {
  CONTENT_PAGE_PATHS as CONTENT_PAGES_ALL,
  draftContentPagePaths,
  publishedContentPagePaths,
} from "../app/lib/content-pages.mjs";
import { readPublishedPages } from "../scripts/lib/published-pages.mjs";
import {
  listedPaperTwins,
  llmsChecks,
  llmsErrors,
  overAdvertisedTwins,
} from "../app/lib/llms/validate.mjs";
import { publishedProcedurePaths } from "../scripts/lib/procedure-paths.mjs";
import { SITE_ORIGIN as origin } from "../app/lib/site-origin.mjs";

/* The rules every llms.txt write runs (app/lib/llms/validate.mjs): check:machine-readable and the save.
 * Each case changes the real file by one thing, so a rule that stopped firing fails here instead of
 * letting an edit through. */

const file = readFileSync(new URL("../content/llms.txt", import.meta.url), "utf8");
// A draft page answers 404, so llms.txt must not list it (publishedContentPagePaths).
const pagePaths = [
  ...publishedContentPagePaths(readPublishedPages()),
  ...publishedProcedurePaths(),
];
/** Built from its code point, so this file carries no literal wide dash. */

/** The Capsid list item: one page's line, which the cases below remove or change. */
const CAPSID = /^- \[Capsid\]\(https:\/\/dustinedwards\.info\/software\/capsid\).*\n/m;

const optionalPagePaths = draftContentPagePaths(readPublishedPages());
const judge = (/** @type {string} */ text, /** @type {Iterable<string> | undefined} */ twinUrls) =>
  llmsErrors(llmsChecks(text, { pagePaths, origin, findWideDashes, twinUrls, optionalPagePaths }));

/** The errors a changed file raises: asserts it was refused, and returns them joined. */
function refusal(/** @type {(text: string) => string} */ mutate) {
  const changed = mutate(file);
  assert.ok(changed !== file, "the mutation changed nothing, so it proves nothing");
  const errors = judge(changed);
  assert.notEqual(errors.length, 0, "the file was accepted after the change");
  return errors.join("\n");
}

await test("the paper twins the file lists are exactly those a corpus that produces them accepts", () => {
  const listed = [...listedPaperTwins(file)];
  assert.ok(listed.length > 0);
  assert.deepEqual(judge(file, listed), []);
  assert.deepEqual(overAdvertisedTwins(file, listed.slice(1)), [listed[0]]);
  assert.match(judge(file, listed.slice(1)).join("\n"), /advertised with no paper/);
});

await test("a page the site has but the file does not list, and a listed page the site has not, are refused", () => {
  assert.match(
    file,
    CAPSID,
    "the committed file lists Capsid as a link, so the cases below change something real",
  );
  assert.match(
    refusal((t) => t.replace(CAPSID, "")),
    /absent from content\/llms\.txt: \/software\/capsid/,
  );
  assert.match(
    refusal((t) =>
      t.replace(
        CAPSID,
        (line) => `${line}- [Nope](https://dustinedwards.info/software/not-a-page): x\n`,
      ),
    ),
    /listed but not a page: \/software\/not-a-page/,
  );
});

await test("a line for any registered page is read as listing it, whatever its first segment", () => {
  // The rule reads list items by address; a page whose root it did not know would read as absent forever.
  const roots = [...new Set(CONTENT_PAGES_ALL.map((path) => path.split("/")[1]))];
  const lines = roots
    .map((root) => `- [Probe](https://dustinedwards.info/${root}): probe\n`)
    .join("");
  const text = file.replace(CAPSID, (m) => `${m}${lines}`);
  const required = [...pagePaths, ...roots.map((root) => `/${root}`)];
  assert.deepEqual(
    llmsErrors(llmsChecks(text, { pagePaths: required, origin, findWideDashes })),
    [],
  );
});
