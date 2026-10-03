// One door from a page file to everything derived from it: parse, validate, render, the markdown twin and
// the search input. build:content, sync:content and the adapter's page save all call compilePage, so
// a file CI passes is the file the save tool accepts and the page draws (docs/PAGES.md).

import matter from "gray-matter";

import { gitBlobSha } from "../content/hashes.mjs";
import {
  CONTENT_PAGE_SECTIONS,
  DESCRIPTION_MAX,
  PAGE_FILE_PATHS,
  SEO_TITLE_MAX,
  contentPageFile,
  contentPageMarkdownBody,
  contentPageSearchInputs,
  markdownTableFacts,
} from "../content-pages.mjs";
import { IDENTITY } from "../identity.generated.mjs";
import { expandPhagePage, expandPhageTokens } from "../phages/compile.mjs";
import { pageInvariantErrors } from "./invariants.mjs";

export const PAGES_DIR = "content/pages";

/** The identity facts a page may state by token ({{identity.role}}): text, from the CV (app/lib/identity.mjs). */
export const IDENTITY_TOKEN_KEYS = /** @type {const} */ ([
  "name", "degree", "discipline", "disciplineLower", "rank", "role", "adminTitle", "jobTitle", "cvTitle", "department", "departmentSubject", "affiliation",
]);
const IDENTITY_TOKEN = /\{\{\s*identity\.([A-Za-z]+)\s*\}\}/g;

/**
 * Every token a page can carry, filled: the owner's identity from the CV, then the phage facts from the rows. A
 * title, a role or a headship a page states is read, never typed, so a CV change updates the page. A token that
 * names nothing is an error, never an empty string.
 *
 * @param {string} text
 * @param {import("../phages/compile.mjs").Phage[] | undefined} phages
 * @returns {{ ok: true, text: string } | { ok: false, errors: string[] }}
 */
export function expandPageTokens(text, phages) {
  /** @type {string[]} */
  const errors = [];
  const withIdentity = text.replace(IDENTITY_TOKEN, (whole, key) => {
    if (!(/** @type {readonly string[]} */ (IDENTITY_TOKEN_KEYS).includes(key))) {
      errors.push(`${whole} is not an identity fact (${IDENTITY_TOKEN_KEYS.join(", ")})`);
      return whole;
    }
    return String(/** @type {Record<string, unknown>} */ (IDENTITY)[key]);
  });
  if (errors.length > 0) return { ok: false, errors };
  return expandPhageTokens(withIdentity, phages);
}

/** The repository path of a page's file, from its file key (`research-phages`). */
export function pageSourcePath(/** @type {string} */ slug) {
  return `${PAGES_DIR}/${slug}.md`;
}

/** The file key of a registered path: `/research/phages` is `research-phages`. */
export function pageSlug(/** @type {string} */ path) {
  return contentPageFile(path).slice(0, -3);
}

/** The registered path a file key stands for, or undefined when no page file may have that key. */
export function pagePathForSlug(/** @type {string} */ slug) {
  return PAGE_FILE_PATHS.find((path) => pageSlug(path) === slug);
}

/** The schema.org types a page may declare; app/routes/content-page.tsx shapes a node for each. */
const SCHEMA_TYPES = ["SoftwareApplication", "SoftwareSourceCode", "WebSite", "WebPage", "Dataset"];

/**
 * @typedef {{
 *   schemaType?: string,
 *   productUrl?: string,
 *   codeRepository?: string,
 *   applicationCategory?: string,
 *   license?: string,
 *   programmingLanguage?: string,
 *   runtimePlatform?: string,
 *   spatialCoverage?: string,
 *   dataset?: { variableMeasured: string[], temporalCoverage: string | null, rows: number },
 * }} PageSchema
 *
 * @typedef {{ depth: number, id: string, text: string }} TocEntry
 *
 * The page as the routes, the search index and the gates read it. `markdown` is the body without front
 * matter; the twin a machine reads is built from it (contentPageMarkdownBody).
 * @typedef {{
 *   path: string, title: string, seoTitle: string, description: string, html: string,
 *   markdown: string, toc: TocEntry[],
 * } & PageSchema} CompiledPage
 *
 * What D1's `record` column holds: the page less its markdown, with its file key and draft flag.
 * @typedef {Omit<CompiledPage, "markdown"> & { slug: string, draft: boolean }} PageRecord
 */

/**
 * The structured-data facts a page's front matter states, each only when it is written there: the JSON-LD
 * says what the page holds and never fills a gap. A Dataset also carries what its first table says.
 *
 * @param {Record<string, unknown>} fm
 * @param {string} markdown
 * @param {string[]} errors
 * @returns {PageSchema}
 */
function pageSchema(fm, markdown, errors) {
  const text = (/** @type {unknown} */ value) => (value == null || value === "" ? "" : String(value));
  const schemaType = text(fm.schema_type);
  if (schemaType && !SCHEMA_TYPES.includes(schemaType)) {
    errors.push(`schema_type "${schemaType}" is not one of ${SCHEMA_TYPES.join(", ")}`);
  }
  const codeRepository = text(fm.code_repository);
  if (codeRepository && !["SoftwareApplication", "SoftwareSourceCode"].includes(schemaType)) {
    errors.push("code_repository is only stated for software (schema_type SoftwareApplication or SoftwareSourceCode)");
  }
  const dataset = schemaType === "Dataset" ? markdownTableFacts(markdown) : null;
  if (schemaType === "Dataset" && !dataset) {
    errors.push("schema_type is Dataset but the page has no markdown table for it to describe");
  }
  /** @type {Array<[Exclude<keyof PageSchema, "dataset">, string]>} */
  const fields = [
    ["schemaType", schemaType],
    ["productUrl", text(fm.product_url)],
    ["codeRepository", codeRepository],
    ["applicationCategory", text(fm.application_category)],
    ["license", text(fm.license)],
    ["programmingLanguage", text(fm.programming_language)],
    ["runtimePlatform", text(fm.runtime_platform)],
    ["spatialCoverage", text(fm.spatial_coverage)],
  ];
  /** @type {PageSchema} */
  const schema = dataset ? { dataset } : {};
  for (const [key, value] of fields) if (value !== "") schema[key] = value;
  return schema;
}

/**
 * The page's dictionary entry (docs/DICTIONARY.md), when it has a published one, leads its twin and its search
 * record, so `entry` is the caller's to give: the build reads it from content/dictionary, the Worker from D1.
 *
 * @param {{
 *   slug: string,
 *   raw: string,
 *   pipeline: { renderBody: (input: { file: string, body: string, resolveImage: (src: string) => Promise<never> }) => Promise<{ html: string, toc: TocEntry[], blockedUrls: Array<{ url: string }> }>,
 *               findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> },
 *   sourcePath?: string,
 *   generated?: boolean,
 *   entry?: import("../dictionary-entries.mjs").DictionaryEntry,
 *   phages?: import("../phages/compile.mjs").Phage[],
 * }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], page: CompiledPage, record: PageRecord, draft: boolean, markdown: string,
 *       searchInput: ReturnType<typeof contentPageSearchInputs>[number], sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compilePage({ slug, raw, pipeline, sourcePath, generated = false, entry, phages }) {
  const expectedPath = pagePathForSlug(slug);
  if (!expectedPath) {
    return {
      ok: false,
      errors: [
        `"${slug}" is not a registered page. A page's address is structure: add the path to CONTENT_PAGE_PATHS ` +
          "(app/lib/content-pages.mjs) in code, and a save can then write its file; a save cannot create a new path",
      ],
    };
  }
  const file = sourcePath ?? pageSourcePath(slug);
  /** @type {string[]} */
  const errors = (generated ? [] : pipeline.findWideDashes(raw)).map((hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`);

  let parsed;
  try {
    parsed = matter(raw);
  } catch (error) {
    return { ok: false, errors: [...errors, `the front matter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const fm = /** @type {Record<string, unknown>} */ (parsed.data);
  // A phage fact a page states (the count, the span, a genome's size) is read from the phage rows by a token,
  // never typed, so the title and description fill the same way the body does.
  /** @param {unknown} value @returns {string} */
  const filled = (value) => {
    const result = expandPageTokens(String(value ?? ""), phages);
    if (!result.ok) {
      errors.push(...result.errors);
      return String(value ?? "");
    }
    return result.text;
  };
  const page = {
    path: String(fm.path ?? ""),
    title: filled(fm.title),
    seoTitle: filled(fm.seo_title),
    description: filled(fm.description),
  };
  if (page.path !== expectedPath) {
    errors.push(
      `path is "${page.path}", but ${contentPageFile(expectedPath)} is the file for ${expectedPath}: every page ` +
        "must be listed in CONTENT_PAGE_PATHS (app/lib/content-pages.mjs) and its file must say so",
    );
  }
  for (const [field, value] of [["title", page.title], ["seo_title", page.seoTitle], ["description", page.description]]) {
    if (!value) errors.push(`${field} is required`);
  }
  if (page.seoTitle.length > SEO_TITLE_MAX) {
    errors.push(`seo_title is ${page.seoTitle.length} characters (at most ${SEO_TITLE_MAX}); Google would clip it`);
  }
  if (page.description.length > DESCRIPTION_MAX) {
    errors.push(`description is ${page.description.length} characters (at most ${DESCRIPTION_MAX}); Google would clip it`);
  }
  if (fm.draft !== undefined && typeof fm.draft !== "boolean") {
    errors.push(`draft is ${JSON.stringify(fm.draft)}; it is true or false`);
  }
  // The phage page's table and sections are drawn from the phage rows where the file's markers say
  // (docs/PHAGES.md), before anything reads the body, so its HTML, twin, dataset facts and search record all come
  // from one text. Every other page passes through unchanged.
  const drawn = expandPhagePage(page.path, parsed.content, phages);
  if (!drawn.ok) errors.push(...drawn.errors);
  const drawnBody = drawn.ok ? expandPageTokens(drawn.markdown, phages) : /** @type {const} */ ({ ok: true, text: parsed.content });
  if (!drawnBody.ok) errors.push(...drawnBody.errors);
  const body = drawnBody.ok ? drawnBody.text : parsed.content;
  const schema = pageSchema(fm, body, errors);
  if (errors.length > 0) return { ok: false, errors };

  let rendered;
  try {
    rendered = await pipeline.renderBody({
      file,
      body,
      resolveImage: async (src) => {
        throw new Error(`the page references an image ("${src}") and these pages have no image pipeline`);
      },
    });
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  if (rendered.blockedUrls.length > 0) {
    errors.push(`links the URL allowlist refused: ${rendered.blockedUrls.map((b) => b.url).join(", ")}`);
  }
  for (const section of CONTENT_PAGE_SECTIONS) {
    const [sectionPath, id] = section.split("#");
    if (sectionPath === page.path && !rendered.toc.some((heading) => heading.id === id)) {
      errors.push(`no heading has the id "${id}", which CONTENT_PAGE_SECTIONS (app/lib/content-pages.mjs) lists for the header menu`);
    }
  }

  /** @type {CompiledPage} */
  const compiled = { ...page, html: rendered.html, markdown: body, toc: rendered.toc, ...schema };
  errors.push(...pageInvariantErrors(compiled, { phages }));
  if (errors.length > 0) return { ok: false, errors };

  const draft = fm.draft === true;
  const { markdown: _body, ...rest } = compiled;
  const [searchInput] = contentPageSearchInputs([compiled], () => entry);
  if (!searchInput) throw new Error(`no search input was made for ${page.path}`);
  return {
    ok: true,
    errors: [],
    page: compiled,
    record: { slug, draft, ...rest },
    draft,
    markdown: contentPageMarkdownBody(compiled, entry),
    searchInput,
    sourcePath: file,
    sourceBlobSha: await gitBlobSha(raw),
  };
}
