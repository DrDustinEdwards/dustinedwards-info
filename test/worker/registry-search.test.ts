import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { deleteRegistryRow, writeRegistryRow } from "~/kb/registry/save.server";

import { seedRegistry } from "./seed";

/* A published registry item has its own search record (docs/REGISTRY.md), so a sequence search finds the primer's page as
 * well as the protocols that use it; a draft has none; and a removed item takes its record with it. */

const registryEnv = () => env as unknown as Parameters<typeof writeRegistryRow>[0];
const UID = "registry:primer/rev-3-ltr-forward";

async function compiledOf(id: string, status = "published") {
  await seedRegistry();
  const row = await env.DB.prepare("SELECT * FROM registry WHERE kind = 'primer' AND id = ?1").bind(id).first<{ name: string; record: string; source_path: string; source_blob_sha: string }>();
  if (!row) throw new Error(`no seeded row for ${id}`);
  const fields = JSON.parse(String(row.record)) as Record<string, unknown>;
  return {
    item: { kind: "primer", id, name: row.name, status, fields },
    record: row.record,
    sourcePath: row.source_path,
    sourceBlobSha: row.source_blob_sha,
  } as unknown as Parameters<typeof writeRegistryRow>[1];
}

const found = (query: string) =>
  env.DB.prepare("SELECT url, title FROM search_docs WHERE doc_uid LIKE 'registry:%' AND body LIKE ?1").bind(`%${query}%`).all<{ url: string; title: string }>();

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM registry").run();
  await env.DB.prepare("DELETE FROM search_docs WHERE doc_uid LIKE 'registry:%'").run();
});

describe("the registry's search records", () => {
  it("finds the primer's page by its sequence, either strand, and by its reference", async () => {
    await writeRegistryRow(registryEnv(), await compiledOf("rev-3-ltr-forward"));
    for (const query of ["CATACTGAGCCAATGGTT", "AACCATTGGCTCAGTATG", "DQ387450.1"]) {
      const { results } = await found(query);
      expect(results.map((r) => r.url), query).toEqual(["/research/lab/primers/rev-3-ltr-forward"]);
    }
  });

  it("has one record per item, rewritten (not added to) by a second save", async () => {
    await writeRegistryRow(registryEnv(), await compiledOf("rev-3-ltr-forward"));
    await writeRegistryRow(registryEnv(), await compiledOf("rev-3-ltr-forward"));
    const count = await env.DB.prepare("SELECT count(*) AS n FROM search_docs WHERE doc_uid = ?1").bind(UID).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("gives a draft no record, and a deleted item loses its own", async () => {
    await writeRegistryRow(registryEnv(), await compiledOf("rev-3-ltr-forward", "draft"));
    expect((await found("CATACTGAGCCAATGGTT")).results).toEqual([]);
    await writeRegistryRow(registryEnv(), await compiledOf("rev-3-ltr-forward"));
    expect((await found("CATACTGAGCCAATGGTT")).results).toHaveLength(1);
    await deleteRegistryRow(registryEnv(), { slug: "primer/rev-3-ltr-forward" });
    expect((await found("CATACTGAGCCAATGGTT")).results).toEqual([]);
  });
});
