import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { CV_FILES, cvSourcePath } from "~/lib/cv/parse.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { seedPublications } from "./seed";

/* sync_cv and the cv-drift check: D1 converges to content/cv through the compile and write doors a CV save
 * uses (hard rule 18: the repository is the source). Each case starts from an empty cv table and a repository
 * ahead of it. */

const FILES = import.meta.glob("../../content/cv/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const rawOf = (slug: string) => {
  const found = FILES[`../../content/cv/${slug}.md`];
  if (found === undefined) throw new Error(`no content/cv/${slug}.md`);
  return found;
};
const repository = () => Object.fromEntries(CV_FILES.map(({ slug }) => [cvSourcePath(slug), rawOf(slug)]));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const ADDED = "Added Through Git Equipment Award";

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha FROM cv WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; source_blob_sha: string }>();
const searchRows = async (needle?: string) =>
  (
    await env.DB.prepare("SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid = ?1 AND body LIKE ?2")
      .bind(contentPageSearchUid("/cv"), `%${needle ?? ""}%`)
      .first<{ n: number }>()
  )?.n;
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "cv-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_cv", {});

let gh: GitHubStub;

beforeAll(async () => {
  await seedPublications();
}, 300_000);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM cv").run();
  await env.DB.prepare("DELETE FROM search_docs WHERE doc_uid = ?1").bind(contentPageSearchUid("/cv")).run();
  gh = stubGitHub(repository());
});

afterEach(() => {
  gh.restore();
});

describe("sync_cv and the cv-drift check", () => {
  it("converges unrowed files, reports them as drift first, writes the search records, and is idempotent", { timeout: 300_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) {
      expect(first.data).toMatchObject({ repaired: CV_FILES.length, removed: 0, expected: CV_FILES.length, present: CV_FILES.length, converged: true });
    }
    expect((await rowFor("grants"))?.source_blob_sha).toBe(await gitBlobSha(rawOf("grants")));
    expect(await searchRows()).toBeGreaterThan(0);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles a file edited through git, and carries the edit to the search records", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    expect(await searchRows(ADDED)).toBe(0);

    // An edit committed outside the save path.
    const edited = rawOf("grants").replace(
      "entries:\n",
      `entries:\n  - year: 2026\n    amount: 99\n    title: ${ADDED}\n    areas: []\n    role: recipient\n`,
    );
    gh.files.set(cvSourcePath("grants"), edited);
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 1, removed: 0, converged: true });
    expect((await rowFor("grants"))?.source_blob_sha).toBe(await gitBlobSha(edited));
    expect(await searchRows(ADDED)).toBeGreaterThan(0);
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no CV file: a fault, not a repository with none.
    for (const { slug } of CV_FILES) gh.files.delete(cvSourcePath(slug));
    gh.files.set("content/cv/README.txt", "not a CV file");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor("grants")).not.toBeNull();
    expect(await rowFor("profile")).not.toBeNull();
  });

  it("makes no row for a file the registry does not name, naming it, and converges the rest", { timeout: 300_000 }, async () => {
    gh.files.set("content/cv/not-a-cv-file.md", rawOf("grants"));
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/cv/not-a-cv-file.md fails");
      expect(JSON.stringify(result.detail)).toContain("not a CV file");
    }
    expect(await rowFor("not-a-cv-file")).toBeNull();
    expect(await rowFor("grants")).not.toBeNull();
  });
});
