// The protocols that print a registry primer carry its facts in their record (compile.mjs), so a change to a primer must
// reach them. A registry save and sync_registry call this after the primer's own row is written: each protocol that names
// a changed primer is recompiled from its file, which reads the primer again, and its row and search records are
// rewritten through the one write door a procedure save uses. Nothing here reads D1's primer row: the repository is the
// source (hard rule 18), so a primer edited through git and a primer saved through Carrel converge the same way.
//
// A protocol that no longer compiles with the new primer (the primer was deleted, or made a draft) stops the refresh and
// the error names it, so the registry never reports success over a protocol it left reading the old sequence.

import { purgeProcedures } from "~/lib/cache-purge.server";
import { readFile } from "~/lib/editor/github.server";

import { procedurePath } from "./parse.mjs";
import { compile, writeRow } from "./save.server";

type ProcedureEnv = Env & { GITHUB_TOKEN?: string };

/** The slugs of the procedures whose stored record names one of these primers, or any primer when `ids` is null. */
export async function procedureSlugsNaming(env: ProcedureEnv, ids: string[] | null): Promise<string[]> {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT p.slug AS slug, json_extract(j.value, '$.id') AS primer
     FROM procedures p, json_each(json_extract(p.record, '$.primers')) j`,
  ).all<{ slug: string; primer: string }>();
  const wanted = ids === null ? null : new Set(ids);
  return [...new Set((rows.results ?? []).filter((row) => wanted === null || wanted.has(row.primer)).map((row) => row.slug))];
}

/** Recompiles and rewrites every protocol that names one of these primers (null: every protocol that names any). */
export async function refreshProceduresNaming(env: ProcedureEnv, ids: string[] | null): Promise<string[]> {
  const slugs = await procedureSlugsNaming(env, ids);
  for (const slug of slugs) {
    const file = await readFile(env, procedurePath(slug));
    if (!file) throw new Error(`the protocol ${slug} names a registry primer but has no file (${procedurePath(slug)}), so it was not refreshed`);
    const compiled = await compile(env, slug, file.content);
    if (!compiled.ok) {
      throw new Error(
        `the protocol ${slug} no longer compiles with the registry as it now stands, so it was not refreshed: ${compiled.errors.join("; ")}`,
      );
    }
    await writeRow(env, compiled);
  }
  if (slugs.length > 0) await purgeProcedures(`registry primer refresh ${slugs.join(", ")}`);
  return slugs;
}
