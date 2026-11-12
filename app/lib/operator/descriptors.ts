// The operator tool surface: the tool names, what each takes and returns, and the result shape every
// tool answers with. `GET /api/operator` serves the descriptors; check:destructive reads them.

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; detail?: unknown };

const TOOLS = [
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
  "backup_status",
  "run_job",
  "list_procedures",
  "get_procedure",
  "save_procedure",
  "refresh_citations",
  "check_publications",
  "list_registry",
  "get_registry",
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
      "Rebuilds the index of the site's own files from the OG bucket and the asset manifest, through the " +
      "same derivation the admin button runs. Idempotent. A read-back " +
      "reconciliation: expected, present, missing and extra keys, and a " +
      "converged verdict.",
  },
  sync_posts: {
    args: {},
    returns:
      "Converges D1 to the stored markdown: re-renders every post " +
      "whose file's blob sha differs from its row (or has no row), removes " +
      "rows whose file is gone, all through the same render door a save " +
      "uses. Idempotent. A read-back reconciliation: expected, present, and " +
      "a converged verdict.",
  },
  sync_procedures: {
    args: {},
    returns:
      "Converges D1 to the stored content/procedures files: re-compiles " +
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
      "Converges D1 to the stored content/dictionary files: re-compiles every entry whose file's blob sha " +
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
      "Converges D1 to the stored content/pages files: re-compiles every " +
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
      "Converges D1 to the stored content/publications files: re-compiles " +
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
      "Converges D1 to the stored content/cv files: re-compiles every CV file whose blob sha differs " +
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
      "Converges D1 to the stored content/roster files: re-compiles every cohort whose file's blob sha " +
      "differs from its row (or has no row), removes rows whose file is gone, through the same compile and write " +
      "doors a roster save uses, then purges the pages that embed the roster. Refuses an empty file set, and " +
      "answers 422 naming any file the validator refuses after converging the rest. Idempotent. A read-back " +
      "reconciliation: expected, present, and a converged verdict.",
  },
  sync_phages: {
    args: {},
    returns:
      "Converges D1 to the stored content/phages files: re-compiles every phage whose file's blob sha " +
      "differs from its row (or has no row), removes rows whose file is gone, through the same compile and write " +
      "doors a phage save uses, first re-deriving the page /research/phages (its table, twin and search records) from " +
      "the final set, then purges the pages tag. Refuses an empty file set, and answers 422 naming any file the " +
      "validator refuses after converging the rest. Idempotent. A read-back reconciliation: expected, present, and a " +
      "converged verdict.",
  },
  sync_registry: {
    args: {},
    returns:
      "Converges D1 to the stored content/registry/<kind>/<id>.md files: re-compiles every item whose file's " +
      "blob sha differs from its row (or has no row), removes rows whose file is gone, through the same compile and " +
      "write doors a registry save uses, then purges the registry tag. Refuses an empty file set while rows exist, " +
      "rather than deleting every row; with no files and no rows there is nothing to do and it says so. Answers 422 " +
      "naming any file the validator refuses after converging the rest. Idempotent. A read-back reconciliation: " +
      "expected, present, and a converged verdict.",
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
      "commitSha, path, draft, gaps and unchanged (true when the file is identical to the stored one: " +
      "nothing is written and commitSha is the current head). The file is validated against its profile by the same code CI " +
      "runs, stored, and written to D1, so the page changes without a deploy. A file that fails is " +
      "refused with 422 and detail.errors, every message the validator gave.",
    policy:
      "An operator may edit, unpublish and republish a procedure. It may NOT publish one for the first " +
      "time (draft true to false, or a new procedure saved as published); that is refused with 403 " +
      "first-publish-requires-admin.",
  },
  refresh_citations: {
    args: {
      dois: "array of strings, optional: the DOIs to refresh; every published paper's when omitted",
    },
    returns:
      "refreshed (how many counts were replaced) and failures (doi, stage, detail for each count that could " +
      "not be read). A DOI that fails keeps the count it had. A partial failure is a 502 with the same " +
      "detail, so the caller sees it. Capsid's watcher calls this weekly.",
  },
  check_publications: {
    args: {},
    returns:
      "Reads ORCID and Crossref and compares them with every publication row: notOnSite (DOIs the ORCID " +
      "record or a Crossref deposit naming the ORCID lists that no file carries, with title, year and " +
      "sources), nameMatches (Crossref works of the last 400 days under the owner's name and on no list, to " +
      "confirm by hand), notOnOrcid (published papers missing from the ORCID record), manuscripts (files " +
      "with no DOI yet) and failures. Writes nothing. A source that could not be read is a 502 whose detail " +
      "is the same report from the sources that answered. The site's check-publications cron job runs the same check daily.",
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
      "The item the stored file holds, its raw file, the head sha, the fields recorded as MISSING (what is " +
      "waiting for Dustin), and any validation errors the file has now. The format is docs/REGISTRY.md. Read only: " +
      "an item is saved through Carrel.",
  },
  backup_status: {
    args: {},
    returns:
      "The backup state now, uncached: the newest complete D1 dump's last_ok and age_hours, and each files " +
      "backup (media, revisions) under files with its own, and a warning when any is past 26 hours. The same " +
      "read as /health's backup field. Capsid Admin's backups read it for every site.",
  },
  run_job: {
    args: {
      job: "string: a job in CRON_JOBS (app/lib/cron-jobs.mjs), or",
      backup: "true: every backup job (backup, the D1 dump, and media-backup, the files) in turn",
    },
    returns:
      "Runs the site's scheduled job now, through the code its cron runs (app/lib/cron-run.server.ts, site-runtime's " +
      "runJobTool): recorded in cron_runs as the cron records it, so /health's cron check reads the run. Returns runs: " +
      "one { job, status: ok | skipped | failed, ms, result?, error? } per job. backup writes a new D1 dump run and prunes " +
      "runs outside retention; media-backup copies MEDIA and MEDIA_REVISIONS under files/ in BACKUPS; purge-zero-results " +
      "removes the zero-result rows past ZERO_RESULT_RETENTION_SECONDS; check-publications mails each new DOI once.",
    policy:
      "Runs only a job the cron already runs, unchanged: a caller names a job, never a row, an object or an argument " +
      "to it, so nothing can be targeted beyond what the schedule would do at its hour. The one job that removes rows " +
      "no derivation rebuilds, purge-zero-results, removes exactly what its daily run removes (the fixed retention " +
      "cutoff). Capsid Admin's back up now calls it with backup: true.",
  },
};
