// What a page must keep true because code, a redirect or a calculator depends on it. Each rule used to be a
// test that read content/pages/*.md in CI; a save through the operator API commits to the repository and
// the page is live before CI runs, so the rules live here, where compilePage runs them for the build, the
// sync, CI's tests and the page save alike (docs/PAGES.md). A message names the page and says what to restore.

import { PHAGES_PAGE_PATH, TABLE_MARKER, sortPhages } from "../phages/compile.mjs";
import { phagesDbUrl } from "../phage-table.mjs";
import { TOOLS, runTool, toolValues } from "../phage-tools.mjs";

/** @typedef {{ path: string, markdown: string, html: string }} InvariantPage */

/** Every calculator page's address, once. */
const CALCULATOR_PATHS = [...new Set(Object.values(TOOLS).map((tool) => tool.path))];

/**
 * Every step of a calculator result, numbered as the page numbers it, must be on the page, so a page
 * never states a worked example the calculator would not print.
 *
 * @param {string} markdown
 * @param {string} id
 * @param {Record<string, string>} values
 * @returns {string[]}
 */
function workedOnPage(markdown, id, values) {
  const result = runTool(id, values);
  if (!result.ok) return [`the ${id} calculator refuses its own worked example (${result.error}); the page cannot be checked against it`];
  /** @type {string[]} */
  const errors = [];
  for (const section of result.sections) {
    section.steps.forEach((step, i) => {
      if (!markdown.includes(`${i + 1}. ${step}\n`)) errors.push(`the page lacks step ${i + 1} the ${id} calculator prints: ${step}`);
    });
  }
  return errors;
}

/** The titer page's worked examples, and the example every other calculator page opens on. */
const WORKED = /** @type {Record<string, { runs: Array<[string, Record<string, string>]>, answers: (result: any) => string[] }>} */ ({
  "/research/tools/titer": {
    runs: [
      ["titer", { plaques: "111", volume: "10", dilution: "6" }],
      ["titer", { plaques: "6", volume: "3", dilution: "3" }],
    ],
    answers: (result) => [`The titer is ${result.sections[0].result}.`],
  },
  "/research/tools/dilution": {
    runs: [
      ["dilution", { start: "1.11e10", target: "1.11e6", transfer: "10", needed: "" }],
      ["dilution", { start: "3.0e9", target: "6e5", transfer: "10", needed: "" }],
    ],
    answers: () => [],
  },
  "/research/tools/webbed-plate": {
    runs: [
      ["webbed-plate", toolValues("webbed-plate")],
      ["flood", toolValues("flood")],
    ],
    answers: () => [],
  },
  "/research/tools/moi": { runs: [["moi", toolValues("moi")]], answers: () => ["The MOI is 0.4 pfu per cell."] },
  "/research/tools/eop": {
    runs: [["eop-counts", toolValues("eop-counts")]],
    answers: () => ["The EOP is 0.02, or 2% of the reference titer."],
  },
  "/research/tools/lysate-volume": {
    runs: [["lysate-volume", toolValues("lysate-volume")]],
    answers: () => ["The plan is 6 µl of lysate in 60 µl, 10 µl on each of 6 plates."],
  },
});

/** @param {InvariantPage} page */
function calculatorErrors({ path, markdown }) {
  const rule = WORKED[path];
  if (!rule) return [];
  /** @type {string[]} */
  const errors = [];
  for (const [id, values] of rule.runs) {
    errors.push(...workedOnPage(markdown, id, values));
    const result = runTool(id, values);
    if (result.ok) {
      for (const answer of rule.answers(result)) {
        if (!markdown.includes(answer)) errors.push(`the page lacks the calculator's answer: ${answer}`);
      }
    }
  }
  return errors;
}

/** The tools index and the FAQ link every calculator page, and the FAQ states the lysate-per-plate sum. */
/** @param {InvariantPage} page */
function calculatorLinkErrors({ path, markdown }) {
  /** @type {string[]} */
  const errors = [];
  if (path === "/research/tools" || path === "/teaching/virus-isolation/faq") {
    for (const target of CALCULATOR_PATHS) {
      if (!markdown.includes(`](${target})`)) errors.push(`the page lacks a link to the calculator at ${target}`);
    }
  }
  if (path === "/teaching/virus-isolation/faq") {
    const sum = "11,100 / 1.1 x 10^10 x 1,000 = 1.01 x 10^-3 µl of lysate per plate.";
    if (!markdown.includes(sum)) errors.push(`the page lacks the lysate-per-plate sum the protocol and the calculator agree on: ${sum}`);
  }
  return errors;
}

const text = (/** @type {string} */ cell) => cell.replace(/<[^>]+>/g, "").trim();
const hrefsOf = (/** @type {string} */ cell) => [...cell.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");

/** The first table in the served HTML, row by row, each cell's raw HTML. */
function servedRows(/** @type {string} */ html) {
  const table = /<table>([\s\S]*?)<\/table>/.exec(html)?.[1] ?? "";
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1] ?? ""),
  );
}

/**
 * The phage table and its sections, as drawn from the phage rows (docs/PHAGES.md): the table lists every phage in
 * the page's order with all six columns, a PhagesDB link for exactly the phages with a verified record, at that
 * record, and a heading per phage, which the old /discovery-of-{name} addresses redirect to. The generated text
 * satisfies most of this by construction; what these catch is the page's own prose getting in the way: a second
 * table ahead of the generated one, a heading that repeats a phage's, or a PhagesDB link written by hand.
 *
 * @param {InvariantPage} page
 * @param {import("../phages/compile.mjs").Phage[] | undefined} phages
 */
function phageTableErrors({ path, markdown, html }, phages) {
  if (path !== PHAGES_PAGE_PATH || !phages) return [];
  /** @type {string[]} */
  const errors = [];
  const names = sortPhages(phages).map((p) => p.name);
  const rows = servedRows(html);
  const listed = rows.map((cells) => text(cells[0] ?? ""));
  if (listed.join("\n") !== names.join("\n")) {
    errors.push(
      `the first table on the page lists ${listed.length} phage(s) and the phages table holds ${names.length}; the first table must be the drawn one ` +
        `(${TABLE_MARKER}). Missing: ${names.filter((n) => !listed.includes(n)).join(", ") || "none"}. ` +
        `Not in the phages table: ${listed.filter((n) => !names.includes(n)).join(", ") || "none"}`,
    );
  }
  const head = /<thead>([\s\S]*?)<\/thead>/.exec(html)?.[1] ?? "";
  const columns = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1] ?? ""));
  if (columns.join("|") !== "Phage|Year|Host|County|PhagesDB|Paper") {
    errors.push(`the table's columns are ${columns.join(", ")}; they must be Phage, Year, Host, County, PhagesDB, Paper`);
  }
  for (const cells of rows) {
    const name = text(cells[0] ?? "");
    if (cells.length !== 6) errors.push(`${name} has ${cells.length} columns; the table has six`);
    const record = phages.find((p) => p.name === name)?.phagesdb ?? null;
    const links = hrefsOf(cells[4] ?? "");
    const want = record ? [phagesDbUrl(record)] : [];
    if (links.join(" ") !== want.join(" ")) {
      errors.push(`${name} links ${links.join(", ") || "no PhagesDB record"}; it must link ${want.join(", ") || "none, as it has no verified record"}`);
    }
  }
  const verified = new Set(phages.flatMap((p) => (p.phagesdb ? [phagesDbUrl(p.phagesdb)] : [])));
  for (const href of [...html.matchAll(/href="(https:\/\/phagesdb\.org[^"]*)"/g)].map((m) => m[1] ?? "")) {
    if (!verified.has(href)) errors.push(`${href} is a PhagesDB link outside the verified records`);
  }
  for (const { name, phagesdb: record } of phages) {
    const parts = markdown.split(`\n### ${name}\n`);
    const section = parts[1]?.split("\n### ")[0] ?? "";
    if (parts.length > 2) errors.push(`${name} has ${parts.length - 1} ### sections; the page's own text repeats the heading the drawn section has`);
    else if (!section) errors.push(`${name} has no ### section; the old /discovery-of-${name.toLowerCase()} address redirects to its heading`);
    else if (section.includes("phagesdb.org") !== (record !== null)) {
      errors.push(`the ${name} section ${record !== null ? "must link" : "must not link"} PhagesDB, as the table does`);
    }
  }
  return errors;
}

/**
 * The named software pages: the explanation of the name comes after what the software does (Dustin,
 * 2026-09-29), the Capsid portal sentence stays, and the Carrel page names neither its address nor its
 * code repository (Dustin, 2026-09-28).
 *
 * @param {InvariantPage} page
 */
function softwareNameErrors({ path, markdown }) {
  /** @type {string[]} */
  const errors = [];
  if (["/software/capsid", "/software/enarratio", "/software/carrel"].includes(path)) {
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    if (!headings.includes("Why the name")) errors.push('the page has no "Why the name" section');
    else if (headings[0] === "Why the name") errors.push('the "Why the name" section belongs after what the software does, not first');
  }
  if (path === "/software/capsid" && !markdown.includes("Its dashboard, the Capsid Portal, is named for the portal protein")) {
    errors.push("the Capsid page lacks the sentence naming the Capsid Portal for the portal protein");
  }
  if (path === "/software/carrel") {
    if (markdown.includes("carrel.dustinedwards.info")) errors.push("the Carrel page names the app by its address; it names it nowhere");
    if (/github\.com\/DrDustinEdwards\/carrel/i.test(markdown)) {
      errors.push("the Carrel page links its code repository; the repository is public only for now, so a link would rot");
    }
  }
  return errors;
}

/** The least HTML About may render: below it the page is a blank one that still looks like a successful build. */
export const ABOUT_HTML_FLOOR = 200;

/**
 * About (check:content used to render it twice and hold it to this floor, and check:links held its links):
 * an empty or near-empty render is a valid row describing a blank page, which is the one failure here that
 * looks like success.
 *
 * @param {InvariantPage} page
 */
function aboutErrors({ path, html }) {
  if (path !== "/about" || html.length >= ABOUT_HTML_FLOOR) return [];
  return [`the page renders ${html.length} character(s) of HTML, floor ${ABOUT_HTML_FLOOR}; an empty About would ship as a blank page`];
}

/**
 * @param {InvariantPage} page
 * @param {{ phages?: import("../phages/compile.mjs").Phage[] }} [rows] the phage rows the page was drawn from
 * @returns {string[]}
 */
export function pageInvariantErrors(page, rows = {}) {
  return [
    ...calculatorErrors(page),
    ...calculatorLinkErrors(page),
    ...phageTableErrors(page, rows.phages),
    ...softwareNameErrors(page),
    ...aboutErrors(page),
  ];
}
