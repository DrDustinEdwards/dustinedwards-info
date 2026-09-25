// The colophon's page records, its not-adopted status labels, and the CI claim those entries make.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { COLOPHON_ANCHORS, STATUS_LABEL } from "../../../app/lib/colophon-sections.mjs";
import { stripComments, stripTsxComments } from "../strip-comments.mjs";
import { normalizeEol, root } from "./shared.mjs";

/** @param {import("./shared.mjs").FeaturesContext} ctx */
export function checkColophon({ ok, artifactRecords, routes, stack }) {
  console.log("\n  page records for /colophon");

  const pageRecords = artifactRecords.filter(
    (/** @type {any} */ r) => r.type === "page",
  );
  const colophonRecords = pageRecords.filter(
    (/** @type {any} */ r) => r.docUid === "page:colophon",
  );

  // Fail closed: zero records would pass everything below.
  ok(
    "the artifact carries page records",
    pageRecords.length > 0,
    "no type='page' records. Run build:stack then build:content.",
  );
  ok(
    "the colophon has exactly one document record",
    colophonRecords.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
    `found ${colophonRecords.filter((/** @type {any} */ r) => r.anchor === null).length}`,
  );

  /* Every page record lives at a declared route; papers share one parameterized route. */
  const PAPER_ROUTE = "/publications/:slug";
  const paperRecords = pageRecords.filter((/** @type {any} */ r) =>
    String(r.uid).startsWith("paper:"),
  );
  const otherPageRecords = pageRecords.filter(
    (/** @type {any} */ r) => !String(r.uid).startsWith("paper:"),
  );

  ok(
    `the paper records are served by ${PAPER_ROUTE} (${paperRecords.length} record(s))`,
    paperRecords.length > 0 && routes.has(PAPER_ROUTE),
    paperRecords.length === 0
      ? "no paper records in the artifact, so this assertion read nothing"
      : `routes.ts declares no ${PAPER_ROUTE}`,
  );
  ok(
    `every paper record is under the paper route (${paperRecords.length} checked)`,
    paperRecords.every((/** @type {any} */ r) =>
      /^\/publications\/[a-z0-9-]+\/$/.test(String(r.url)),
    ),
    `a paper record whose URL is not /publications/<slug>/ is not served by ` +
      `${PAPER_ROUTE}: ` +
      paperRecords
        .filter((/** @type {any} */ r) => !/^\/publications\/[a-z0-9-]+\/$/.test(String(r.url)))
        .map((/** @type {any} */ r) => r.url)
        .join(", "),
  );

  for (const record of otherPageRecords) {
    const path = String(record.url).split("#")[0];
    ok(
      `page record ${record.uid} resolves to a declared route: ${path}`,
      routes.has(path),
      `routes.ts declares no ${path}`,
    );
  }

  /* Section anchors both ways: an unrendered anchor is a hit that scrolls nowhere. */
  const sectionRecords = colophonRecords.filter(
    (/** @type {any} */ r) => r.anchor !== null,
  );
  ok(
    "the colophon has section records, not just a document record",
    sectionRecords.length > 0,
    "section-grained records are the point; a document record alone loses every deep link",
  );
  for (const record of sectionRecords) {
    ok(
      `section record anchor is in the descriptor: ${record.anchor}`,
      COLOPHON_ANCHORS.includes(String(record.anchor)),
      `the descriptor declares ${COLOPHON_ANCHORS.join(", ")}`,
    );
  }
  const unrecorded = COLOPHON_ANCHORS.filter(
    (id) => !sectionRecords.some((/** @type {any} */ r) => r.anchor === id),
  );
  ok(
    "every descriptor section has a record",
    unrecorded.length === 0,
    `no record for ${unrecorded.join(", ")}. Regenerate the artifact.`,
  );

  /* The only `<h2 id=` is in `SectionHead`, so any literal id is a second list. */
  const pageSource = readFileSync(
    join(root, "app", "routes", "colophon.tsx"),
    "utf8",
  );
  const literalHeadings = [
    ...pageSource.matchAll(/<h2\s+id="([^"]+)"/g),
  ].map((m) => m[1]);
  ok(
    "colophon.tsx declares no literal section id",
    literalHeadings.length === 0,
    `found ${literalHeadings.join(", ")}. Those ids exist in the descriptor too, ` +
      `so they are a second list and will drift.`,
  );
  const rendered = [...pageSource.matchAll(/<SectionHead\s+id="([^"]+)"/g)].map(
    (m) => m[1],
  );
  ok(
    "the page renders one section per descriptor entry, in order",
    rendered.length === COLOPHON_ANCHORS.length &&
      rendered.every((id, i) => id === COLOPHON_ANCHORS[i]),
    `page renders [${rendered.join(", ")}], descriptor declares [${COLOPHON_ANCHORS.join(", ")}]`,
  );

  console.log(
    `     ${colophonRecords.length} colophon record(s), ${sectionRecords.length} section(s), ` +
      `${COLOPHON_ANCHORS.length} descriptor anchor(s), ${rendered.length} rendered`,
  );

  /* The index carries the page's label, never the raw enum, and no reader holds a copy. */

  console.log("\n  not-adopted status labels");

  const notAdopted = stack.notAdopted ?? [];

  // FAIL CLOSED before anything else, so "0 problems" cannot mean "0 entries".
  ok(
    "stack.json carries not-adopted entries",
    notAdopted.length > 0,
    "no entries, so every label assertion below would pass vacuously",
  );

  const usedStatuses = [...new Set(notAdopted.map((/** @type {any} */ n) => String(n.status)))];

  for (const status of usedStatuses) {
    ok(
      `status "${status}" has a label`,
      Boolean(STATUS_LABEL[status]),
      `STATUS_LABEL declares ${Object.keys(STATUS_LABEL).join(", ")}. ` +
        `Without a label the page and the index would disagree about what it is called.`,
    );
  }
  for (const status of Object.keys(STATUS_LABEL)) {
    ok(
      `label "${status}" is used by at least one entry`,
      usedStatuses.includes(status),
      `nothing in stack.json declares status "${status}"`,
    );
  }

  /* The artifact is what search matches, so it is read, not recomputed. */
  const notAdoptedRecord = colophonRecords.find(
    (/** @type {any} */ r) => r.anchor === "not-adopted",
  );
  ok(
    "the not-adopted section has a record",
    Boolean(notAdoptedRecord),
    "without it the two assertions below would examine nothing",
  );
  if (notAdoptedRecord) {
    const body = String(notAdoptedRecord.body);
    for (const status of usedStatuses) {
      const label = STATUS_LABEL[status];
      ok(
        `the index carries the label "(${label})" for status "${status}"`,
        body.includes(`(${label})`),
        `the not-adopted record body does not contain "(${label})". Regenerate the artifact.`,
      );
      // Parenthesised, so a reason sentence cannot fire this.
      ok(
        `the index does NOT carry the raw enum "(${status})"`,
        !body.includes(`(${status})`),
        `the record body still carries the raw enum, which is the exact defect ` +
          `this section exists for: the page renders "(${label})".`,
      );
    }
  }

  /* Comments stripped: both files name these values in prose. */

  const pageCode = stripTsxComments(normalizeEol(pageSource));
  for (const status of usedStatuses) {
    const label = STATUS_LABEL[status];
    ok(
      `colophon.tsx carries no literal status "${status}"`,
      !pageCode.includes(`"${status}"`) && !pageCode.includes(`'${status}'`),
      `the page must render through statusLabel(), not its own copy`,
    );
    ok(
      `colophon.tsx carries no literal label "${label}"`,
      !pageCode.includes(`"${label}"`) && !pageCode.includes(`>${label}<`),
      `the page must render through statusLabel(), not its own copy`,
    );
  }
  ok(
    "colophon.tsx renders the status through statusLabel()",
    /statusLabel\s*\(/.test(pageCode),
    "the page does not call statusLabel, so it is getting the word from somewhere else",
  );

  const descriptorCode = stripComments(
    readFileSync(join(root, "app", "lib", "colophon-sections.mjs"), "utf8"),
  );
  for (const status of usedStatuses) {
    const label = STATUS_LABEL[status];
    const occurrences = descriptorCode.split(`"${label}"`).length - 1;
    ok(
      `the descriptor declares label "${label}" exactly once`,
      occurrences === 1,
      `found ${occurrences}. One is the STATUS_LABEL map; a second is a restatement that will drift.`,
    );
  }

  /* While CI runs on main, no not-adopted entry may name continuous integration. */
  {
    const ciWorkflow = join(root, ".github", "workflows", "ci.yml");
    const ciRuns = existsSync(ciWorkflow);
    ok(
      "there is a CI workflow for the next assertion to be about",
      ciRuns,
      ".github/workflows/ci.yml is absent, so the CI claim below proved nothing. " +
        "If CI really is gone, this assertion and the colophon both need a decision.",
    );
    if (ciRuns) {
      /** @param {string} text */
      const namesCi = (text) =>
        /\bcontinuous integration\b/i.test(text) || /\bno CI\b/i.test(text) || /\bCI\b/.test(text);
      for (const entry of notAdopted) {
        const name = String(entry.name ?? "");
        const reason = String(entry.reason ?? "");
        ok(
          `not-adopted entry "${name}" does not call CI missing`,
          !namesCi(name) && !namesCi(reason),
          `ci.yml runs on every push to main and ship refuses a HEAD without a green ` +
            `run for its sha, so an entry under "What was not adopted" naming continuous ` +
            `integration is a false sentence on the page. Entry: ${JSON.stringify({ name, status: entry.status })}`,
        );
      }
    }
  }

  console.log(
    `     ${notAdopted.length} entr(ies), ${usedStatuses.length} distinct status(es), ` +
      `${Object.keys(STATUS_LABEL).length} label(s)`,
  );
}
