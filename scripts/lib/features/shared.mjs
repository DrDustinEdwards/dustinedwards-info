// What every check:features section reads: the repo root, comment stripping, and the two page
// helpers the projects and playground sections both run. The entry script builds the context.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stripComments, stripTsxComments } from "../strip-comments.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * @typedef {object} FeaturesContext
 * @property {ReturnType<typeof import("../tally.mjs").createTally>} tally
 * @property {ReturnType<typeof import("../tally.mjs").createTally>["ok"]} ok
 * @property {any[]} features
 * @property {Map<string, string>} routeModules
 * @property {Set<string>} routes
 * @property {Map<string, string>} gates
 * @property {any[]} artifactRecords
 * @property {Map<string, string>} publishedTitles PUBLISHED only: a draft citation would link the live site to a 404.
 * @property {any} stack content/generated/stack.json
 */

export const normalizeEol = (/** @type {string} */ text) => text.replace(/\r\n/g, "\n");

/** @param {string} source */
export const stripped = (/** @type {string} */ source) =>
  stripComments(source, { preserveLines: true });

/**
 * A source file with its comments gone, by the parser for TSX: the tokenizer reads an apostrophe in
 * JSX text as a string opener and can keep every comment after it, which then satisfies a check.
 *
 * @param {string} file
 */
export const codeOf = (file) => {
  const source = normalizeEol(readFileSync(file, "utf8"));
  return file.endsWith(".tsx") ? stripTsxComments(source) : stripped(source);
};

/**
 * A page's search records against the list the page is built from, both ways: one document record,
 * a section record for every item, and no section record for an item the list no longer carries.
 *
 * @param {FeaturesContext} ctx
 * @param {string} docUid
 * @param {{ kind: string, page: string, item: string, list: string }} words for the labels
 * @param {Array<{ slug: string, anchor: string }>} items
 * @returns {any[]} the page's records
 */
export function pageRecordParity({ ok, artifactRecords }, docUid, { kind, page, item, list }, items) {
  const records = artifactRecords.filter((/** @type {any} */ r) => r.docUid === docUid);
  ok(`the artifact carries ${kind} page records`, records.length > 0, "none found. Run build:content.");
  ok(
    `the ${page} page has exactly one document record`,
    records.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
  );
  const recordAnchors = new Set(
    records
      .filter((/** @type {any} */ r) => r.anchor !== null)
      .map((/** @type {any} */ r) => String(r.anchor)),
  );
  for (const { slug, anchor } of items) {
    ok(
      `${slug} has a section record in the artifact`,
      recordAnchors.has(anchor),
      `no record anchored ${anchor}. The ${list} changed without a rebuild.`,
    );
  }
  const listed = new Set(items.map((i) => i.anchor));
  for (const anchor of recordAnchors) {
    ok(
      `artifact record ${anchor} corresponds to a ${item} in the ${list}`,
      listed.has(anchor),
      `the index describes a ${item} the ${list} no longer lists`,
    );
  }
  return records;
}

/**
 * A page reads its list from content/ and its anchors from the module the indexer uses, so neither
 * can be a second copy.
 *
 * @param {FeaturesContext["ok"]} ok
 * @param {string} source the route, comments stripped
 * @param {{ route: string, list: string, json: string, reads: RegExp, noun: string, anchorFn: string, anchorModule: RegExp }} page
 */
export function pageReadsItsList(ok, source, { route, list, json, reads, noun, anchorFn, anchorModule }) {
  ok(`the page imports the ${list} rather than restating it`, reads.test(source), `app/routes/${route} must read content/${json}`);
  ok(
    `the page derives ${noun} anchors from ${anchorFn}`,
    source.includes(`${anchorFn}(`) && anchorModule.test(source),
    "anchors must come from the module the indexer uses, or a record can cite a fragment nothing renders",
  );
}
