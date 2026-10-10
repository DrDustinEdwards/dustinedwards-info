import { getFrozenVersion } from "~/db/procedure-versions";
import { getProcedureByPath } from "~/db/procedures";
import { BASES } from "~/kb/bases.mjs";

import { resolveLineage } from "./lineage.mjs";
import type { ProcedureRecord } from "./render.mjs";

/**
 * A variant's parent as the page, the twin and the JSON-LD name it (P3): its published row for the title and address,
 * and the frozen copy of the version it was copied at. A parent that is a draft reads as unpublished: its name, no link.
 */
export async function lineageFor(env: Env, record: Pick<ProcedureRecord, "forkedFrom" | "profile">) {
  const from = record.forkedFrom;
  if (!from) return null;
  const root = BASES.find((b) => b.profile === record.profile)?.entryRoot ?? "/research/protocols/";
  const path = `${root}${from.slug}`;
  const row = await getProcedureByPath(env, path);
  const live = row && row.status === "published" ? { title: row.record.title, path: row.path } : null;
  const frozenRow = from.version ? await getFrozenVersion(env, path, from.version) : null;
  return resolveLineage(from, record.profile, { live, frozen: frozenRow ? { title: frozenRow.record.title } : null });
}
