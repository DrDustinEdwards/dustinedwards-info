// The operator tool surface: the tool names, what each takes and returns, and the result shape every
// tool answers with. `GET /api/operator` serves the descriptors; check:destructive reads them.

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; detail?: unknown };

const TOOLS = [
  "list_posts",
  "get_post",
  "save_post",
  "delete_post",
  "sync_status",
  "sync_ask",
  "sync_media",
  "sync_posts",
  "sync_procedures",
  "sync_dictionary",
  "sync_pages",
  "sync_publications",
  "sync_llms",
  "sync_cv",
  "sync_cv_pdf",
  "sync_roster",
  "sync_phages",
  "sync_registry",
  "backup_media",
  "upload_media",
  "list_mentions",
  "decide_mention",
  "list_procedures",
  "get_procedure",
  "save_procedure",
  "list_publications",
  "get_publication",
  "refresh_citations",
  "list_pages",
  "get_page",
  "get_llms",
  "list_cv",
  "get_cv",
  "list_dictionary",
  "get_dictionary",
  "list_roster",
  "get_roster",
  "list_phages",
  "get_phage",
  "list_registry",
  "get_registry",
  "purge_zero_results",
] as const;

export type ToolName = (typeof TOOLS)[number];

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOLS as readonly string[]).includes(value);
}

export function toolNames(): readonly ToolName[] {
  return TOOLS;
}

// Keyed by `ToolName`, so a missing or extra descriptor is a typecheck failure.
export const TOOL_DESCRIPTORS: Readonly<
  Record<ToolName, { args: Record<string, string>; returns: string; policy?: string }>
> = {
  list_posts: {
    args: {},
    returns:
      "Every post row in D1, drafts included, with the head sha. `updated` " +
      "is the revision date the row carries.",
  },
  get_post: {
    args: { slug: "string" },
    returns: "The complete markdown file, the head sha, and operatorMayPublish.",
  },
  save_post: {
    args: {
      slug: "string",
      raw: "string, the complete markdown file including frontmatter",
      expectedHeadSha: "string, optional, for editor-style conflict detection",
      isNew: "boolean, optional, inferred from whether the file exists",
    },
    returns:
      "commitSha, and the gate's own message with field and line on rejection. A file identical to the " +
      "committed one commits nothing: unchanged is true and commitSha is the current head.",
    policy:
      "An operator may create, edit, unpublish and republish. It may NOT " +
      "perform a post's first transition to draft:false; that is reserved " +
      "to the human admin and is refused with 403 " +
      "first-publish-requires-admin.",
  },
  delete_post: {
    args: { slug: "string" },
    returns: "commitSha.",
    policy:
      "Deleting a post is reserved to the human admin and is refused with " +
      "403 delete-requires-admin. Unpublish instead (draft: true).",
  },
  sync_status: {
    args: {},
    returns: "Repository, D1 and search index counts, reported separately.",
  },
  sync_ask: {
    args: {},
    returns:
      "Uploads the full corpus to the Ask index and prunes strays. Idempotent. " +
      "expected, present, drift and a converged verdict, all read back after " +
      "the writes rather than taken from the upload's own counters.",
  },
  sync_media: {
    args: {},
    returns:
      "Rebuilds the media index from R2 and the asset manifest, through the " +
      "same derivation the admin button runs. Idempotent. A read-back " +
      "reconciliation: expected, present, missing and extra keys, and a " +
      "converged verdict.",
  },
  sync_posts: {
    args: {},
    returns:
      "Converges D1 to the repository's markdown: re-renders every post " +
      "whose file's blob sha differs from its row (or has no row), removes " +
      "rows whose file is gone, all through the same render door a save " +
      "uses. Idempotent. A read-back reconciliation: expected, present, and " +
      "a converged verdict.",
  },
  sync_procedures: {
    args: {},
    returns:
      "Converges D1 to the repository's content/procedures files: re-compiles " +
      "every procedure whose file's blob sha differs from its row (or has no " +
      "row), removes rows whose file is gone, all through the same compile " +
      "and write doors save_procedure uses. Refuses an empty file set, and " +
      "answers 422 naming any file the validator refuses after converging the " +
      "rest. Idempotent. A read-back reconciliation: expected, present, and a " +
      "converged verdict.",
  },
  sync_dictionary: {
    args: {},
    returns:
      "Converges D1 to the repository's content/dictionary files: re-compiles every entry whose file's blob sha " +
      "differs from its row (or has no row), removes rows whose file is gone, through the same compile and write " +
      "doors a dictionary save uses. Each write also re-derives the page the entry opens (its markdown twin and " +
      "search records) and purges the pages tag, because that page embeds the entry. A file whose path is not a " +
      "registered Software page, or whose clip is not in the repository, never makes a row. Refuses an empty file " +
      "set, and answers 422 naming any file the validator refuses after converging the rest. Idempotent. A " +
      "read-back reconciliation: expected, present, and a converged verdict.",
  },
  sync_pages: {
    args: {},
    returns:
      "Converges D1 to the repository's content/pages files: re-compiles every " +
      "page whose file's blob sha differs from its row (or has no row), removes " +
      "rows whose file is gone with their search records, through the same " +
      "compile and write doors a page save uses. A file whose path is not in " +
      "CONTENT_PAGE_PATHS (or About's own, CONTENT_PAGES_OWN_ROUTE) never makes a row. Refuses an empty file set, and " +
      "answers 422 naming any file the validator refuses after converging the " +
      "rest. Idempotent. A read-back reconciliation: expected, present, and a " +
      "converged verdict.",
  },
  sync_publications: {
    args: {},
    returns:
      "Converges D1 to the repository's content/publications files: re-compiles " +
      "every paper whose file's blob sha differs from its row (or has no row), " +
      "removes rows whose file is gone with their search record and citation row, " +
      "through the same compile and write doors a publication save uses. A " +
      "citation count that exists is never touched; a missing one is seeded from " +
      "the committed OpenAlex snapshot. Refuses an empty file set, and answers 422 " +
      "naming any file the validator refuses after converging the rest. " +
      "Idempotent. A read-back reconciliation: expected, present, and a converged " +
      "verdict.",
  },
  sync_llms: {
    args: {},
    returns:
      "Converges the settings row /llms.txt is served from to the repository's content/llms.txt, through " +
      "the same validator and write door an llms.txt save uses, and purges /llms.txt. Refuses a repository " +
      "with no llms.txt rather than deleting the row, and answers 422 naming the checks a file fails. " +
      "Idempotent. A read-back reconciliation: expected, present, and a converged verdict.",
  },
  sync_cv: {
    args: {},
    returns:
      "Converges D1 to the repository's content/cv files: re-compiles every CV file whose blob sha differs " +
      "from its row (or has no row), removes rows whose file is gone, then rewrites the CV's search records, " +
      "through the same compile and write doors a CV save uses. Refuses an empty file set, and answers 422 " +
      "naming any file the validator refuses after converging the rest. Idempotent. A read-back reconciliation: " +
      "expected, present, and a converged verdict.",
  },
  sync_cv_pdf: {
    args: {},
    returns:
      "Makes the stored CV PDF (one object in the OG bucket, served at /dustin-edwards-cv.pdf) the one for the CV D1 " +
      "holds now: renders it through Browser Run and replaces the object, then purges the cv tag, unless the stored " +
      "object already carries that CV's fingerprint, in which case it renders nothing. A render that fails is an " +
      "error and changes nothing stored. Run sync_cv first when cv-drift also fails. Idempotent. A read-back " +
      "reconciliation: expected, present, and a converged verdict.",
  },
  sync_roster: {
    args: {},
    returns:
      "Converges D1 to the repository's content/roster files: re-compiles every cohort whose file's blob sha " +
      "differs from its row (or has no row), removes rows whose file is gone, through the same compile and write " +
      "doors a roster save uses, then purges the pages that embed the roster. Refuses an empty file set, and " +
      "answers 422 naming any file the validator refuses after converging the rest. Idempotent. A read-back " +
      "reconciliation: expected, present, and a converged verdict.",
  },
  sync_phages: {
    args: {},
    returns:
      "Converges D1 to the repository's content/phages files: re-compiles every phage whose file's blob sha " +
      "differs from its row (or has no row), removes rows whose file is gone, through the same compile and write " +
      "doors a phage save uses, first re-deriving the page /research/phages (its table, twin and search records) from " +
      "the final set, then purges the pages tag. Refuses an empty file set, and answers 422 naming any file the " +
      "validator refuses after converging the rest. Idempotent. A read-back reconciliation: expected, present, and a " +
      "converged verdict.",
  },
  sync_registry: {
    args: {},
    returns:
      "Converges D1 to the repository's content/registry/<kind>/<id>.md files: re-compiles every item whose file's " +
      "blob sha differs from its row (or has no row), removes rows whose file is gone, through the same compile and " +
      "write doors a registry save uses, then purges the registry tag. Refuses an empty file set while rows exist, " +
      "rather than deleting every row; with no files and no rows there is nothing to do and it says so. Answers 422 " +
      "naming any file the validator refuses after converging the rest. Idempotent. A read-back reconciliation: " +
      "expected, present, and a converged verdict.",
  },
  list_mentions: {
    args: { status: "string, optional: unverified, pending, approved, rejected or failed" },
    returns:
      "Received webmentions, newest first, with id, source, target slug, status, " +
      "author, excerpt and the received, verified and decided timestamps. " +
      "Unfiltered when no status is given, which is what the moderation queue " +
      "shows.",
  },
  decide_mention: {
    args: {
      id: "number, the mention row id from list_mentions",
      decision: "string: approve, reject or delete",
    },
    returns:
      "changed, and the target slug when a row moved. Approving or rejecting " +
      "PURGES that post's cached page, so the change reaches readers on the " +
      "next fetch rather than within the ten minute shared-cache lifetime.",
    policy:
      "Approve and reject need write and are reversible. DELETE is refused " +
      "with 403 mention-delete-requires-admin: it removes the only copy of " +
      "what a stranger sent, and there is no repository behind this table. " +
      "Reject instead.",
  },
  list_procedures: {
    args: {},
    returns:
      "Every procedure row in D1 (protocols, recipes, computational procedures), drafts included: " +
      "slug, path, profile, title, draft (boolean), version, updated, the count of recorded gaps and, for a " +
      "protocol, biosafetyLevel (BSL-1, BSL-2 or MISSING until Dustin sets it), with the head sha and the " +
      "number of procedures.",
  },
  get_procedure: {
    args: { slug: "string" },
    returns:
      "The complete procedure file (raw), the head sha, the procedure as structured data (front matter, " +
      "sections, steps with their marks and flags), its recorded gaps, and any validation errors. The " +
      "format is docs/PROCEDURES.md.",
  },
  save_procedure: {
    args: {
      slug: "string",
      raw: "string, the complete procedure file including front matter",
      expectedHeadSha: "string, optional, the headSha get_procedure returned",
      isNew: "boolean, optional, inferred from whether the file exists",
    },
    returns:
      "commitSha, path, draft, gaps and unchanged (true when the file is identical to the committed one: " +
      "nothing is committed or rewritten and commitSha is the current head). The file is validated against its profile by the same code CI " +
      "runs, committed, and written to D1, so the page changes without a deploy. A file that fails is " +
      "refused with 422 and detail.errors, every message the validator gave.",
    policy:
      "An operator may edit, unpublish and republish a procedure. It may NOT publish one for the first " +
      "time (draft true to false, or a new procedure saved as published); that is refused with 403 " +
      "first-publish-requires-admin.",
  },
  list_publications: {
    args: {},
    returns:
      "Every publication row in D1, drafts included: slug, doi (null for a manuscript), stage (published or " +
      "submitted), type, title, year and draft (boolean), with the head sha and the number of publications. " +
      "A publication is written through Carrel (site-api), never through this surface, so there is no save tool.",
  },
  get_publication: {
    args: { slug: "string, the page slug (the DOI with every run of punctuation a hyphen)" },
    returns:
      "The complete publication file (raw), the head sha, draft, the compiled record when the file is valid, " +
      "and every validation error when it is not. The format is docs/PUBLICATIONS.md.",
  },
  refresh_citations: {
    args: { dois: "array of strings, optional: the DOIs to refresh; every published paper's when omitted" },
    returns:
      "refreshed (how many counts were replaced) and failures (doi, stage, detail for each count that could " +
      "not be read). A DOI that fails keeps the count it had. A partial failure is a 502 with the same " +
      "detail, so the caller sees it. The watchdog calls this weekly.",
  },
  list_pages: {
    args: {},
    returns:
      "Every Research, Teaching and Software prose page row in D1, drafts included: path, slug, title and " +
      "draft, with the count and the head sha. Pages are edited through Carrel, not here.",
  },
  get_page: {
    args: { path: "string, a registered page path such as /research/phages" },
    returns:
      "The complete page file (raw), the head sha, the page as structured data (front matter and body), " +
      "and any validation errors the file has now. The format is docs/PAGES.md. Read only: a page is " +
      "saved through Carrel.",
  },
  get_llms: {
    args: {},
    returns:
      "The complete content/llms.txt (raw) and its size, the head sha, any validation errors the file has " +
      "now, and whether the row /llms.txt is served from holds exactly this file. The format is " +
      "docs/LLMS.md. Read only: it is saved through Carrel, as the document llms.",
  },
  list_cv: {
    args: {},
    returns:
      "Every file of the CV in D1 (the profile, appointments, education, publications, grants, honors, talks, " +
      "courses, mentoring, service, development): slug, type and when D1 last wrote it, with the count and the " +
      "head sha. The CV is edited through Carrel, not here.",
  },
  get_cv: {
    args: { slug: "string, a CV file such as grants or profile" },
    returns:
      "The complete CV file (raw), the head sha, the file as structured data and any validation errors the " +
      "file has now. The format is docs/CV.md. Read only: a CV file is saved through Carrel.",
  },
  list_dictionary: {
    args: {},
    returns:
      "Every dictionary entry row in D1, drafts included: key, path (the Software page it opens), term and draft, " +
      "with the count and the head sha. Entries are edited through Carrel, not here.",
  },
  get_dictionary: {
    args: { key: "string, the entry's file name without .md, such as capsid" },
    returns:
      "The complete entry file (raw), the head sha, draft, the entry as the page reads it when the file is valid, " +
      "and every validation error when it is not. The format is docs/DICTIONARY.md. Read only: an entry is saved " +
      "through Carrel.",
  },
  list_roster: {
    args: {},
    returns:
      "Every Phage Discovery cohort row in D1, newest first: slug (the year), year, the photograph's path and the " +
      "count of names, with the count of cohorts and the head sha. Only what the public roster page already shows. " +
      "The roster is edited through Carrel, not here.",
  },
  get_roster: {
    args: { slug: "string, a cohort's file key: its four-digit year, such as 2025" },
    returns:
      "The cohort the committed file holds (year, photograph and names, the fields the public page shows), the " +
      "head sha, and any validation errors the file has now. The format is docs/ROSTER.md. Read only: a cohort " +
      "is saved through Carrel.",
  },
  list_phages: {
    args: {},
    returns:
      "Every phage row in D1, in the page's order (year, then name): slug, name, year, host, county, PhagesDB record, " +
      "genome-paper slug, former name and note, with the count and the head sha. Only what the public phage table " +
      "already shows. The table is edited through Carrel, not here.",
  },
  get_phage: {
    args: { slug: "string, a phage's file key: its name in lower case, such as acorn15" },
    returns:
      "The phage the committed file holds (the fields the public table shows), its raw file, the head sha, and any " +
      "validation errors the file has now. The format is docs/PHAGES.md. Read only: a phage is saved through Carrel.",
  },
  list_registry: {
    args: { kind: "string, optional: one registry kind, such as primer" },
    returns:
      "Every registry row in D1, in the site's order (kind, then name): kind, id, name, status and the kind's own " +
      "fields, with the count and the head sha. Drafts are included, marked by status. The registry is edited " +
      "through Carrel, not here (docs/REGISTRY.md).",
  },
  get_registry: {
    args: { slug: "string, an item's address <kind>/<id>, such as primer/m13-forward" },
    returns:
      "The item the committed file holds, its raw file, the head sha, the fields recorded as MISSING (what is " +
      "waiting for Dustin), and any validation errors the file has now. The format is docs/REGISTRY.md. Read only: " +
      "an item is saved through Carrel.",
  },
  purge_zero_results: {
    args: {},
    returns:
      "purged, the number of zero-result query rows removed: every row whose last_seen is older than " +
      "ZERO_RESULT_RETENTION_SECONDS. The watchdog calls this daily; there used to be an admin button for it.",
    policy:
      "Takes no argument that names a row, so there is nothing to target beyond the fixed retention " +
      "cutoff: a caller cannot choose what is removed. The rows have no derivation to rebuild them from, " +
      "which is why this is destructive rather than a sync, but there is no identity-based refusal to " +
      "document because every caller gets the same unconditional sweep.",
  },
  backup_media: {
    args: {},
    returns:
      "Copies every MEDIA object that has no byte-identical twin into " +
      "MEDIA_BACKUP. COPIES ONLY: it has no delete branch in either bucket, " +
      "and nothing is ever copied backup to media. Idempotent. A read-back " +
      "reconciliation: objects, twins, missing and mismatched, counted after " +
      "the writes rather than from the loop's own counters.",
  },
  upload_media: {
    args: {
      data: "string, optional, base64 bytes or a full data: URI. Either this or url.",
      url: "string, optional, an https URL the API fetches server-side. Either this or data.",
      type: "string, optional, the image MIME type. Defaults to the data: URI's " +
        "own type or the fetched response's Content-Type.",
      name: "string, optional, the filename to record as original_name. Defaults " +
        "to the URL's last path segment, or upload.<ext>.",
    },
    returns:
      "url and key, the same two the editor's upload returns, plus bytes, " +
      "width, height and `recorded`. The url is what goes in the markdown. " +
      "Idempotent: the key is a digest of the bytes, so the same image " +
      "uploaded twice is one object.",
    policy:
      "MEDIA is the irreplaceable bucket and there is no delete tool over " +
      "this token, so an object put here stays until an admin removes it. " +
      "Accepts only the raster image types in ALLOWED (SVG is refused: it " +
      "can carry script), refuses anything over " +
      "MAX_BYTES, and fetches only https URLs.",
  },
};
