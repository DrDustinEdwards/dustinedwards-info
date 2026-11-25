// The file-derived kinds' convergence tools: procedures, dictionary, pages, CV, publications, llms, roster, phages, registry.

import { readFile } from "~/lib/source/store.server";
import {
  readLlmsSides,
  readCvSides,
  readDictionarySides,
  readPageSides,
  readProcedureSides,
  readPublicationSides,
  readPhageSides,
  readRegistrySides,
  readRosterSides,
} from "~/lib/health/checks.server";
import {
  purgeCv,
  purgeLlms,
  purgePages,
  purgePhages,
  purgeProcedures,
  purgePublications,
  purgeRegistry,
  purgeRoster,
} from "~/lib/cache-purge.server";
import { compileLlms, writeLlmsRow } from "~/lib/llms/save.server";
import { readCv } from "~/db/cv";
import { CV_DIR } from "~/lib/cv/parse.mjs";
import { cvPdfStamp } from "~/lib/cv/pdf-html.mjs";
import { ensureCvPdf, storedCvPdfFingerprint } from "~/lib/cv/pdf.server";
import {
  compile as compileCvFile,
  deleteCvRow,
  refreshCvSearch,
  writeCvRow,
} from "~/lib/cv/save.server";
import { DICTIONARY_DIR } from "~/lib/dictionary/parse.mjs";
import {
  compile as compileDictionaryFile,
  deleteRow as deleteDictionaryRow,
  writeRow as writeDictionaryRow,
} from "~/lib/dictionary/save.server";
import { PAGES_DIR } from "~/lib/pages/compile.mjs";
import {
  compile as compilePageFile,
  deletePageRow,
  writeRow as writePageRow,
} from "~/lib/pages/save.server";
import { PUBLICATIONS_DIR } from "~/lib/publications/parse.mjs";
import { listPhages } from "~/db/phages";
import { PHAGES_DIR, phageSlug, type Phage } from "~/lib/phages/compile.mjs";
import {
  compile as compilePhageFile,
  deletePhageRow,
  refreshPage as refreshPhagePage,
  writePhageRow,
} from "~/lib/phages/save.server";
import { REGISTRY_DIR } from "~/kb/registry/compile.mjs";
import { refreshProceduresNaming } from "~/kb/procedures/primer-dependents.server";
import { compile as compileRegistryFile } from "~/kb/registry/host.server";
import { deleteRegistryRow, writeRegistryRow } from "~/kb/registry/save.server";
import { ROSTER_DIR } from "~/lib/roster/compile.mjs";
import {
  compile as compileRosterFile,
  deleteRosterRow,
  writeRosterRow,
} from "~/lib/roster/save.server";
import {
  compilePublicationFor,
  deletePublicationRow,
  seedMissingCitations,
  writePublicationRow,
} from "~/lib/publications/save.server";
import { PROCEDURES_DIR } from "~/kb/procedures/parse.mjs";
import {
  compile as compileProcedureFile,
  deleteProcedureRow,
  writeRow as writeProcedureRow,
} from "~/kb/procedures/save.server";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";
import { convergeKind } from "./sync-converge.server";

/** Procedures: the compile and write doors save_procedure uses. */
export async function syncProcedures(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_procedures",
    dir: PROCEDURES_DIR,
    noun: "procedure",
    read: () => readProcedureSides(env),
    compile: (slug, raw) => compileProcedureFile(env, slug, raw),
    write: (compiled) => writeProcedureRow(env, compiled),
    remove: (row) => deleteProcedureRow(env, row),
    purge: purgeProcedures,
  });
}

/**
 * Dictionary entries: the compile and write doors a dictionary save uses, which also re-derive the one page
 * row each entry opens (its twin and its search records), and purge the pages tag, because the page embeds the
 * entry. An entry whose path is not a registered Software page, or whose clip is not in the repository, is
 * refused by the compile (the 422 names the file) and never makes a row.
 */
export async function syncDictionary(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_dictionary",
    dir: DICTIONARY_DIR,
    noun: "dictionary entry",
    read: () => readDictionarySides(env),
    compile: (key, raw) => compileDictionaryFile(env, key, raw),
    write: (compiled) => writeDictionaryRow(env, compiled),
    remove: (row) => deleteDictionaryRow(env, { key: row.slug, path: row.path }),
    purge: purgePages,
  });
}

/**
 * Pages: the compile and write doors a page save uses. A file whose path is not in CONTENT_PAGE_PATHS (or About's, CONTENT_PAGES_OWN_ROUTE) is
 * refused by the compile (the 422 names the file) and never makes a row.
 */
export async function syncPages(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_pages",
    dir: PAGES_DIR,
    noun: "page",
    read: () => readPageSides(env),
    compile: (slug, raw) => compilePageFile(env, slug, raw),
    write: (compiled) => writePageRow(env, compiled),
    remove: (row) => deletePageRow(env, row),
    purge: purgePages,
  });
}

/**
 * The CV: the compile and write doors a CV save uses, one row per file. The CV's search records depend on every
 * file, so they are rewritten once after the rows, in the step that also purges the CV's cache tag. A failure
 * there is thrown, not counted: a repair that left the search records behind must not report success.
 */
export async function syncCv(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_cv",
    dir: CV_DIR,
    noun: "CV file",
    read: () => readCvSides(env),
    compile: (slug, raw) => compileCvFile(env, slug, raw),
    write: (compiled) => writeCvRow(env, compiled),
    remove: (row) => deleteCvRow(env, row),
    purge: async (why) => {
      await refreshCvSearch(env);
      return purgeCv(why);
    },
  });
}

/**
 * Publications: the compile and write doors a publication save uses. Each written row is read back for
 * its twin's bytes, because the twin goes in as chunks and this is what proves they joined. A citation
 * count that exists is never touched; one that is missing is seeded from the committed snapshot.
 */
export async function syncPublications(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_publications",
    dir: PUBLICATIONS_DIR,
    noun: "publication",
    read: () => readPublicationSides(env),
    compile: (slug, raw) => compilePublicationFor(env, slug, raw),
    write: async (compiled) => {
      await writePublicationRow(env, compiled);
      const stored = await env.DB.prepare(
        "SELECT source_blob_sha, length(CAST(markdown AS BLOB)) AS twin_bytes FROM publications WHERE slug = ?1",
      )
        .bind(compiled.record.slug)
        .first<{ source_blob_sha: string; twin_bytes: number }>();
      const twinBytes = new TextEncoder().encode(compiled.twin).length;
      if (stored?.source_blob_sha !== compiled.sourceBlobSha || stored.twin_bytes !== twinBytes) {
        throw new Error(
          `sync_publications wrote "${compiled.record.slug}" but the row read back does not match its file ` +
            `(twin ${stored?.twin_bytes ?? "missing"} bytes, expected ${twinBytes}). Re-run sync_publications.`,
        );
      }
      await seedMissingCitations(env, [compiled.record.doi]);
    },
    remove: (row) => deletePublicationRow(env, row),
    purge: purgePublications,
  });
}

/**
 * llms.txt: the compile and write doors an llms.txt save uses, through the same loop as the kinds above,
 * with one file and one settings row. The write reads the row back. A repository with no llms.txt is
 * refused as an empty set; the row is never deleted.
 */
export async function syncLlms(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_llms",
    dir: "content",
    noun: "llms.txt",
    read: () => readLlmsSides(env),
    compile: (_slug, raw) => compileLlms(env, raw),
    write: (compiled) => writeLlmsRow(env, compiled.raw),
    remove: async () => {
      throw new Error(
        "sync_llms never removes the llms.txt row: a source without the file is refused first.",
      );
    },
    purge: purgeLlms,
  });
}

/**
 * The CV's PDF: renders it from the CV D1 holds now and replaces the one stored object, unless the stored object
 * already carries that CV's fingerprint (then it renders nothing). The same door a CV save's background render
 * uses (ensureCvPdf), then read back: `converged` is the stored fingerprint equalling the data's, derived here and
 * never asserted. A failed render is thrown, so the repair reports failure instead of success, and nothing
 * stored is changed by it.
 */
export async function syncCvPdf(env: OperatorEnv): Promise<ToolResult> {
  const outcome = await ensureCvPdf(env);
  const [stored, cv] = await Promise.all([storedCvPdfFingerprint(env), readCv(env)]);
  const present = stored === (await cvPdfStamp(cv)) ? 1 : 0;
  return {
    ok: true,
    data: {
      action: outcome.action,
      fingerprint: outcome.fingerprint,
      ...(outcome.action === "stored" ? { bytes: outcome.bytes, purged: outcome.purged } : {}),
      expected: 1,
      present,
      drift: 1 - present,
      converged: present === 1,
    },
  };
}

/**
 * The roster: the compile and write doors a roster save uses. A cohort is one row, written whole, and the purge
 * reaches both pages that embed it (purgeRoster).
 */
export async function syncRoster(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_roster",
    dir: ROSTER_DIR,
    noun: "cohort",
    read: () => readRosterSides(env),
    compile: (slug, raw) => compileRosterFile(env, slug, raw),
    write: (compiled) => writeRosterRow(env, compiled),
    remove: (row) => deleteRosterRow(env, row),
    purge: purgeRoster,
  });
}

/**
 * The phage table: the compile and write doors a phage save uses. The page /research/phages is compiled from the
 * rows, so before any row moves the page row is re-derived ONCE from the final set (this repository's files
 * where they compile, D1's row where one does not, minus the phages whose file is gone), and each phage row is
 * written after it. A failure of that refresh stops the repair with every phage still reading drifted, so the
 * next run retries it. The purge reaches the one page that embeds the table (purgePhages).
 */
export async function syncPhages(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_phages",
    dir: PHAGES_DIR,
    noun: "phage",
    read: () => readPhageSides(env),
    compile: (slug, raw) => compilePhageFile(env, slug, raw),
    write: (compiled) => writePhageRow(env, compiled),
    remove: (row) => deletePhageRow(env, row),
    purge: purgePhages,
    settle: async ({ files, drift }) => {
      const bySlug = new Map<string, Phage>(
        (await listPhages(env)).map((phage) => [phageSlug(phage.name), phage]),
      );
      const pathOf = new Map(files.map((f) => [f.slug, f.path]));
      for (const slug of [...drift.changed, ...drift.unrowed]) {
        const path = pathOf.get(slug);
        const file = path ? await readFile(env, path) : null;
        if (!file) continue;
        // A file that does not compile keeps whatever D1 holds for it; convergeKind then reports it as a 422.
        const compiled = await compilePhageFile(env, slug, file.content);
        if (compiled.ok) bySlug.set(slug, compiled.phage);
      }
      for (const slug of drift.unfiled) bySlug.delete(slug);
      await refreshPhagePage(env, [...bySlug.values()]);
    },
  });
}

/**
 * The registry: the compile and write doors a registry save uses. Nothing else is derived from a registry row, so
 * there is no settle step, and the purge is the registry's tag. It has no files until a kind brings records, so an
 * empty set with no rows is converged (emptyOk); an empty set with rows is refused like every other kind's.
 */
export async function syncRegistry(env: OperatorEnv): Promise<ToolResult> {
  const result = await convergeKind(env, {
    tool: "sync_registry",
    dir: REGISTRY_DIR,
    noun: "registry item",
    read: () => readRegistrySides(env),
    compile: (slug, raw) => compileRegistryFile(env, slug, raw),
    write: (compiled) => writeRegistryRow(env, compiled),
    remove: (row) => deleteRegistryRow(env, row),
    purge: purgeRegistry,
    emptyOk: true,
  });
  // The protocols that print a primer carry its facts in their record, so every one that names a primer is recompiled
  // from its file after the primers converge: a primer edited through git reaches them here, and a protocol left reading
  // an old sequence by a failed save is repaired by the same run.
  const refreshed = await refreshProceduresNaming(env, null, [
    "primer",
    "strain",
    "reagent",
    "equipment",
  ]);
  return result.ok
    ? { ok: true, data: { ...(result.data as object), protocolsRefreshed: refreshed.length } }
    : result;
}
