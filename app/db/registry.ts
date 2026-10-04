// The registry table: read by the registry's pages and the operator API. Written only by writeRegistryRow in
// app/lib/registry/save.server.ts and by sync:content, from a compile (app/lib/registry/compile.mjs).
import { and, asc, eq } from "drizzle-orm";

import { itemFromRow, sortRegistry, type RegistryItem } from "~/lib/registry/compile.mjs";

import { getDb } from "./client";
import { registry } from "./schema";

/**
 * Every item, or one kind's, in the site's order. Drafts are the signed-in admin's alone, so a public read passes
 * `published: true`. An empty table is a valid answer: the registry has no records until a kind brings its own.
 */
export async function listRegistry(env: Env, options: { kind?: string; published?: boolean } = {}): Promise<RegistryItem[]> {
  const where = [
    ...(options.kind ? [eq(registry.kind, options.kind)] : []),
    ...(options.published ? [eq(registry.status, "published")] : []),
  ];
  const rows = await getDb(env)
    .select({ kind: registry.kind, id: registry.id, name: registry.name, status: registry.status, record: registry.record })
    .from(registry)
    .where(where.length > 0 ? and(...where) : undefined);
  return sortRegistry(rows.map(itemFromRow));
}

/** One item by its address, or null. */
export async function getRegistryItem(env: Env, kind: string, id: string): Promise<RegistryItem | null> {
  const row = await getDb(env)
    .select({ kind: registry.kind, id: registry.id, name: registry.name, status: registry.status, record: registry.record })
    .from(registry)
    .where(and(eq(registry.kind, kind), eq(registry.id, id)))
    .get();
  return row ? itemFromRow(row) : null;
}

/** For list_registry and Carrel's list: every row, with when D1 last wrote it. */
export async function listRegistryRows(env: Env) {
  const rows = await getDb(env)
    .select({
      kind: registry.kind,
      id: registry.id,
      name: registry.name,
      status: registry.status,
      record: registry.record,
      syncedAt: registry.syncedAt,
    })
    .from(registry)
    .orderBy(asc(registry.kind), asc(registry.name));
  return rows.map(({ syncedAt, ...row }) => ({ ...itemFromRow(row), syncedAt }));
}
