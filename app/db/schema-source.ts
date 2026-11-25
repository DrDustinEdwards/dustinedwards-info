/** Tables derived from repository files (procedures, publications, pages, CV, dictionary, roster, phages, registry) and the source store. */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The columns every row derived from a repository file ends with: the file's path, the blob sha it was built from, and
 * when that file last changed here (a save, or a content sync that brought a new blob; a sync of the same blob keeps it,
 * scripts/sync-content.mjs). Carrel reads it as the item's updatedAt and re-reads a body only when it moves. A function,
 * so each table gets its own column builders.
 */
const sourceColumns = () => ({
  sourcePath: text("source_path").notNull().unique(),
  sourceBlobSha: text("source_blob_sha").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Procedures (drizzle/0019_procedures.sql, docs/PROCEDURES.md): derived from content/procedures/*.md by
 * app/kb/procedures/compile.mjs. `record` is the rendered procedure as JSON and `markdown` its twin.
 */
export const procedures = sqliteTable(
  "procedures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    path: text("path").notNull().unique(),
    profile: text("profile", { enum: ["protocol", "recipe", "computational"] }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    version: text("version"),
    updated: text("updated"),
    record: text("record").notNull(),
    markdown: text("markdown").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    check("procedures_profile_check", sql`${t.profile} in ('protocol', 'recipe', 'computational')`),
    check("procedures_status_check", sql`${t.status} in ('draft', 'published')`),
    index("procedures_status_idx").on(t.status, t.profile),
  ],
);

/**
 * Frozen versions (drizzle/0027_procedure_versions.sql): the rendered copy of every published procedure version, written
 * once and never changed. Unlike `procedures` this is not derived from the file: the triggers refuse an UPDATE or DELETE
 * of a sealed row. `record` is the ProcedureRecord JSON and `markdown` its twin, as the live row held them when frozen.
 */
export const procedureVersions = sqliteTable(
  "procedure_versions",
  {
    slug: text("slug").notNull(),
    version: text("version").notNull(),
    path: text("path").notNull(),
    profile: text("profile", { enum: ["protocol", "recipe", "computational"] }).notNull(),
    record: text("record").notNull(),
    markdown: text("markdown").notNull(),
    sourceBlobSha: text("source_blob_sha").notNull(),
    sealed: integer("sealed").notNull().default(0),
    frozenAt: integer("frozen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.slug, t.version] }),
    check(
      "procedure_versions_profile_check",
      sql`${t.profile} in ('protocol', 'recipe', 'computational')`,
    ),
    check("procedure_versions_sealed_check", sql`${t.sealed} in (0, 1)`),
  ],
);

/**
 * Publications (drizzle/0020_publications.sql, docs/PUBLICATIONS.md): derived from content/publications/*.md
 * by app/lib/publications/compile.mjs. `record` is the compiled publication as JSON, `csl` the raw
 * Crossref record and `markdown` the twin.
 */
export const publications = sqliteTable(
  "publications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    doiKey: text("doi_key"),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    stage: text("stage", { enum: ["published", "submitted"] }).notNull(),
    type: text("type", {
      enum: ["article", "review", "chapter", "abstract", "teaching-resource"],
    }).notNull(),
    title: text("title").notNull(),
    year: integer("year").notNull(),
    selected: integer("selected").notNull().default(0),
    record: text("record").notNull(),
    csl: text("csl"),
    markdown: text("markdown").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    check("publications_status_check", sql`${t.status} in ('draft', 'published')`),
    check("publications_stage_check", sql`${t.stage} in ('published', 'submitted')`),
    check(
      "publications_type_check",
      sql`${t.type} in ('article', 'review', 'chapter', 'abstract', 'teaching-resource')`,
    ),
    index("publications_status_idx").on(t.status, t.year),
    uniqueIndex("publications_doi_key_idx").on(t.doiKey),
  ],
);

/** The citation count a page shows, with no expiry (drizzle/0020_publications.sql). Keyed by the lower-cased DOI. */
export const publicationCitations = sqliteTable(
  "publication_citations",
  {
    doi: text("doi").primaryKey(),
    count: integer("count").notNull(),
    url: text("url"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [check("publication_citations_count_check", sql`${t.count} >= 0`)],
);

/**
 * Pages (drizzle/0021_pages.sql, docs/PAGES.md): the Research, Teaching and Software prose pages, derived
 * from content/pages/*.md by app/lib/pages/compile.mjs. `record` is the rendered page as JSON and
 * `markdown` its twin.
 */
export const pages = sqliteTable(
  "pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    path: text("path").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    record: text("record").notNull(),
    markdown: text("markdown").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    check("pages_status_check", sql`${t.status} in ('draft', 'published')`),
    index("pages_status_idx").on(t.status),
  ],
);

/** The CV: one row per file in content/cv/ (migration 0022, docs/CV.md). */
export const cv = sqliteTable(
  "cv",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    type: text("type", {
      enum: [
        "profile",
        "appointment",
        "education",
        "publication",
        "grant",
        "award",
        "talk",
        "course",
        "mentoring",
        "service",
        "development",
      ],
    }).notNull(),
    record: text("record").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    check(
      "cv_type_check",
      sql`${t.type} in ('profile', 'appointment', 'education', 'publication', 'grant', 'award', 'talk', 'course', 'mentoring', 'service', 'development')`,
    ),
  ],
);

/**
 * Dictionary entries (drizzle/0023_dictionary.sql, docs/DICTIONARY.md): the entry that opens a named Software
 * page, derived from content/dictionary/<key>.md by app/lib/dictionary/compile.mjs. `record` is the entry as
 * JSON.
 */
export const dictionaryEntries = sqliteTable(
  "dictionary_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    path: text("path").notNull().unique(),
    term: text("term").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    record: text("record").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    check("dictionary_entries_status_check", sql`${t.status} in ('draft', 'published')`),
    index("dictionary_entries_status_idx").on(t.status),
  ],
);

// The Phage Discovery cohorts (docs/ROSTER.md). Derived from content/roster/*.md, one row per cohort, written
// only by writeRosterRow (app/lib/roster/save.server.ts) and sync:content.
export const roster = sqliteTable("roster", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  year: integer("year").notNull().unique(),
  record: text("record").notNull(),
  ...sourceColumns(),
});

// The phages of the table on /research/phages (docs/PHAGES.md). Derived from content/phages/*.md, one row per
// phage, written only by writePhageRow (app/lib/phages/save.server.ts) and sync:content. The page is compiled
// from these rows, so a write re-derives the page's own row too.
export const phages = sqliteTable(
  "phages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    record: text("record").notNull(),
    ...sourceColumns(),
  },
  (t) => [index("phages_year_idx").on(t.year)],
);

// The lab registry: the primers, strains, reagents and equipment of docs/REGISTRY.md. Derived from
// content/registry/<kind>/<id>.md, one row per item, written only by writeRegistryRow
// (app/kb/registry/save.server.ts) and sync:content. The shared columns are what every kind has; `record` is the item
// as JSON, validated by its kind's own rules.
export const registry = sqliteTable(
  "registry",
  {
    kind: text("kind").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    record: text("record").notNull(),
    ...sourceColumns(),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.id] }),
    index("registry_kind_name_idx").on(t.kind, t.name),
    check("registry_status_check", sql`${t.status} in ('published', 'draft')`),
  ],
);

// repository path, `sha` its git blob sha, which is the version Carrel holds. Every version a file has had is a
// source_revisions row, `content` NULL for a delete. source_guard holds no row outside a write: a guard that fails
// its CHECK rolls the save's batch back.
export const sourceFiles = sqliteTable("source_files", {
  path: text("path").primaryKey(),
  content: text("content").notNull(),
  sha: text("sha").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sourceRevisions = sqliteTable(
  "source_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    path: text("path").notNull(),
    content: text("content"),
    sha: text("sha"),
    message: text("message").notNull(),
    author: text("author").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("source_revisions_path").on(t.path, t.id)],
);

export const sourceGuard = sqliteTable("source_guard", { ok: integer("ok").notNull() }, (t) => [
  check("source_guard_ok", sql`${t.ok} = 1`),
]);
