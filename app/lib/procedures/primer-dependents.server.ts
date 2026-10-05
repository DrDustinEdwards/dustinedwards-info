// The protocols that print a registry primer, or name a registry strain, carry its facts in their record (compile.mjs), so a
// change to one must reach them. A registry save and sync_registry call this after the primer's own row is written: each protocol that names
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

/** The record field each kind's items are named in. */
const NAMED_IN = { primer: ["$.primers"], strain: ["$.hostStrains", "$.organisms"] } as const;
export type NamedKind = keyof typeof NAMED_IN;

/** The slugs of the procedures whose stored record names one of these items (of these kinds), or any item of the kinds when `ids` is null. */
export async function procedureSlugsNaming(env: ProcedureEnv, ids: string[] | null, kinds: NamedKind[] = ["primer"]): Promise<string[]> {
  const wanted = ids === null ? null : new Set(ids);
  const slugs = new Set<string>();
  for (const kind of kinds) {
    for (const field of NAMED_IN[kind]) {
      // A list of items has the id inside each; the organism list is the ids themselves.
      const rows = await env.DB.prepare(
        `SELECT DISTINCT p.slug AS slug, CASE WHEN j.type = 'object' THEN json_extract(j.value, '$.id') ELSE j.value END AS item
         FROM procedures p, json_each(json_extract(p.record, ?1)) j`,
      )
        .bind(field)
        .all<{ slug: string; item: string }>();
      for (const row of rows.results ?? []) if (wanted === null || wanted.has(row.item)) slugs.add(row.slug);
    }
  }
  return [...slugs];
}

/** Recompiles and rewrites every protocol that names one of these items (null: every protocol that names any item of the kinds). */
export async function refreshProceduresNaming(env: ProcedureEnv, ids: string[] | null, kinds: NamedKind[] = ["primer"]): Promise<string[]> {
  const slugs = await procedureSlugsNaming(env, ids, kinds);
  for (const slug of slugs) {
    const file = await readFile(env, procedurePath(slug));
    if (!file) throw new Error(`the protocol ${slug} names a registry item but has no file (${procedurePath(slug)}), so it was not refreshed`);
    const compiled = await compile(env, slug, file.content);
    if (!compiled.ok) {
      throw new Error(
        `the protocol ${slug} no longer compiles with the registry as it now stands, so it was not refreshed: ${compiled.errors.join("; ")}`,
      );
    }
    await writeRow(env, compiled);
  }
  if (slugs.length > 0) await purgeProcedures(`registry refresh ${slugs.join(", ")}`);
  return slugs;
}
