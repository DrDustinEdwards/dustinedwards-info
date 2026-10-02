// One door from a page file to everything derived from it: parse, validate, render, the markdown twin and
// the search input. build:content, sync:content and the adapter's page save all call compilePage, so
// a file CI passes is the file the save tool accepts and the page draws (docs/PAGES.md).

import matter from "gray-matter";

import { gitBlobSha } from "../content/hashes.mjs";
import {
  CONTENT_PAGE_PATHS,
  CONTENT_PAGE_SECTIONS,
  DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  contentPageFile,
  contentPageMarkdownBody,
  contentPageSearchInputs,
  markdownTableFacts,
} from "../content-pages.mjs";
import { pageInvariantErrors } from "./invariants.mjs";

export const PAGES_DIR = "content/pages";

/** The repository path of a page's file, from its file key (`research-phages`). */
export function pageSourcePath(/** @type {string} */ slug) {
  return `${PAGES_DIR}/${slug}.md`;
}

/** The file key of a registered path: `/research/phages` is `research-phages`. */
export function pageSlug(/** @type {string} */ path) {
  return contentPageFile(path).slice(0, -3);
}

/** The registered path a file key stands for, or undefined when no listed path has that key. */
export function pagePathForSlug(/** @type {string} */ slug) {
  return CONTENT_PAGE_PATHS.find((path) => pageSlug(path) === slug);
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
 * }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], page: CompiledPage, record: PageRecord, draft: boolean, markdown: string,
 *       searchInput: ReturnType<typeof contentPageSearchInputs>[number], sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compilePage({ slug, raw, pipeline, sourcePath, generated = false, entry }) {
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
  const page = {
    path: String(fm.path ?? ""),
    title: String(fm.title ?? ""),
    seoTitle: String(fm.seo_title ?? ""),
    description: String(fm.description ?? ""),
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
  const schema = pageSchema(fm, parsed.content, errors);
  if (errors.length > 0) return { ok: false, errors };

  let rendered;
  try {
    rendered = await pipeline.renderBody({
      file,
      body: parsed.content,
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
  const compiled = { ...page, html: rendered.html, markdown: parsed.content, toc: rendered.toc, ...schema };
  errors.push(...pageInvariantErrors(compiled));
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
