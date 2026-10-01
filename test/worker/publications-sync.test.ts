import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { publicationPath } from "~/lib/publications/parse.mjs";
import { paperSearchUid } from "~/lib/publications/search-inputs.mjs";

import godfather from "../../content/publications/10-1128-mra-00888-24.md?raw";
import classroom from "../../content/publications/10-3389-feduc-2023-1279921.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";

/* sync_publications and the publications-drift check: D1 converges to content/publications through the
 * compile and write doors a publication save uses (hard rule 18: the repository is the source). The
 * citation counts come from OpenAlex, so the sync seeds a missing row and never touches one that exists. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const SMALL = "10-1128-mra-00888-24";
const SMALL_DOI = "10.1128/mra.00888-24";
/** Its twin carries the PDF's full text, which passes D1's 100 KB statement limit: the chunked append. */
const BIG = "10-3389-feduc-2023-1279921";
const BIG_DOI = "10.3389/feduc.2023.1279921";
const pdf = (slug: string) => `public/research/publications/${slug}/dustin-edwards-${slug}.pdf`;

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha, length(CAST(markdown AS BLOB)) AS twin_bytes FROM publications WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; source_blob_sha: string; twin_bytes: number }>();
const citation = (doi: string) =>
  env.DB.prepare("SELECT count, fetched_at FROM publication_citations WHERE doi = ?1")
    .bind(doi)
    .first<{ count: number; fetched_at: string }>();
const searchRows = async (slug: string) =>
  (
    await env.DB.prepare("SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid = ?1")
      .bind(paperSearchUid(slug))
      .first<{ n: number }>()
  )?.n;
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "publications-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_publications", {});

let gh: GitHubStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM publications").run();
  await env.DB.prepare("DELETE FROM publication_citations").run();
  gh = stubGitHub({
    [publicationPath(SMALL)]: godfather,
    [publicationPath(BIG)]: classroom,
    [pdf(SMALL)]: "%PDF-1.4 fixture",
    [pdf(BIG)]: "%PDF-1.4 fixture",
  });
});

afterEach(() => {
  gh.restore();
});

describe("sync_publications and the publications-drift check", () => {
  it("converges unrowed files with a long twin joined whole, seeds the missing counts, and is idempotent", { timeout: 300_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 2, removed: 0, expected: 2, present: 2, converged: true });
    const big = await rowFor(BIG);
    expect(big?.source_blob_sha).toBe(await gitBlobSha(classroom));
    // More than one 100 KB statement could carry: the chunks were appended and the read-back matched them.
    expect(big?.twin_bytes).toBeGreaterThan(100_000);
    expect(await searchRows(SMALL)).toBeGreaterThan(0);
    expect((await citation(SMALL_DOI))?.count).toBe(0);
    expect((await citation(BIG_DOI))?.count).toBe(6);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles a file edited through git and keeps a citation count that already exists", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // A refresh has read newer counts than the committed snapshot holds.
    await env.DB.prepare("UPDATE publication_citations SET count = 4242, fetched_at = '2099-01-01' WHERE doi = ?1")
      .bind(SMALL_DOI)
      .run();

    const edited = godfather.replace(/^summary: .*$/m, 'summary: "A sentence committed through git, not through the save."');
    expect(edited).not.toBe(godfather);
    gh.files.set(publicationPath(SMALL), edited);
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 1, removed: 0, converged: true });
    expect((await rowFor(SMALL))?.source_blob_sha).toBe(await gitBlobSha(edited));
    const stored = await env.DB.prepare("SELECT record FROM publications WHERE slug = ?1").bind(SMALL).first<{ record: string }>();
    expect(stored?.record).toContain("A sentence committed through git");
    expect(await citation(SMALL_DOI)).toEqual({ count: 4242, fetched_at: "2099-01-01" });
  });

  it("removes the row, search record and citation row of a file that is gone, and only that one", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    gh.files.delete(publicationPath(SMALL));
    const drifted = await driftCheck();
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 0, removed: 1, converged: true });
    expect(await rowFor(SMALL)).toBeNull();
    expect(await searchRows(SMALL)).toBe(0);
    expect(await citation(SMALL_DOI)).toBeNull();
    expect(await rowFor(BIG)).not.toBeNull();
    expect(await searchRows(BIG)).toBeGreaterThan(0);
    expect(await citation(BIG_DOI)).not.toBeNull();
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no publication: a fault, not a repository with none.
    gh.files.delete(publicationPath(SMALL));
    gh.files.delete(publicationPath(BIG));
    gh.files.set("content/publications/README.txt", "not a publication");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor(SMALL)).not.toBeNull();
    expect(await rowFor(BIG)).not.toBeNull();
  });

  it("converges the rest and then FAILS NAMING a file the validator refuses", { timeout: 300_000 }, async () => {
    gh.files.set(publicationPath(SMALL), godfather.replace(/^type: .*$/m, 'type: "not-a-type"'));
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain(`${publicationPath(SMALL)} fails`);
    }
    expect(await rowFor(SMALL)).toBeNull();
    expect(await rowFor(BIG)).not.toBeNull();
  });
});
