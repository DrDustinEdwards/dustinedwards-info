import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";

import phagesPage from "../../content/pages/research-phages.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { seedPages } from "./seed";

/* sync_phages and the phage-drift check: D1 converges to content/phages through the compile and write doors a
 * phage save uses (hard rule 18: the repository is the source), and the page the table is drawn into is re-derived
 * once, from the final set, before any row moves. Each case starts from an empty phages table and a repository
 * ahead of it. */

const PHAGE_FILES = import.meta.glob("../../content/phages/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const files = Object.fromEntries(Object.entries(PHAGE_FILES).map(([path, raw]) => [`content/phages/${path.split("/").pop()}`, raw]));
/* A genome announcement is a paper the repository holds, so the stub holds one for each phage that names one. */
const PAPERS = Object.fromEntries(
  Object.values(files).flatMap((raw) => {
    const slug = /^paper: (.+)$/m.exec(raw)?.[1];
    return slug ? [[`content/publications/${slug}.md`, "x"]] : [];
  }),
);
const PAGE_FILE = "content/pages/research-phages.md";
const PATH = "/research/phages";

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha FROM phages WHERE slug = ?1").bind(slug).first<{ slug: string; source_blob_sha: string }>();
const count = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM phages").first<{ n: number }>())?.n ?? -1;
const twin = async () => (await env.DB.prepare("SELECT markdown FROM pages WHERE path = ?1").bind(PATH).first<{ markdown: string }>())?.markdown ?? "";
const searchRows = async () =>
  (await env.DB.prepare("SELECT body FROM search_docs WHERE doc_uid = ?1").bind(contentPageSearchUid(PATH)).all<{ body: string }>()).results;
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "phage-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_phages", {});

let gh: GitHubStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM phages").run();
  await seedPages([PATH]);
  gh = stubGitHub({ ...files, ...PAPERS, [PAGE_FILE]: phagesPage });
  purge.mockClear();
});

afterEach(() => {
  gh.restore();
});

describe("sync_phages and the phage-drift check", () => {
  it("converges unrowed files, reports them as drift first, draws the page once, purges its tag, and is idempotent", { timeout: 300_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 80, removed: 0, expected: 80, present: 80, converged: true });
    expect(await count()).toBe(80);
    expect((await rowFor("acorn15"))?.source_blob_sha).toBe(await gitBlobSha(files["content/phages/acorn15.md"] ?? ""));
    expect((await searchRows()).some((r) => r.body.includes("Acorn15"))).toBe(true);
    expect(purge.mock.calls.flatMap(([o]) => o.tags)).toEqual(["content-pages"]);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles a phage edited through git, redraws the page's twin and search record, and removes a row whose file is gone", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    expect(await twin()).toContain("| [Acorn15](#acorn15) | 2017 | *M. smegmatis* mc²155 | Hood County |");

    // An edit committed outside the save tool, a new file, and a deletion.
    const edited = (files["content/phages/acorn15.md"] ?? "").replace("county: Hood County", "county: Parker County");
    gh.files.set("content/phages/acorn15.md", edited);
    gh.files.set("content/phages/zeta.md", "---\nname: Zeta\nyear: 2026\nhost: foliorum\ncounty: Erath County\nphagesdb: null\n---\n");
    gh.files.delete("content/phages/allene.md");
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 2, removed: 1, converged: true });
    expect(await count()).toBe(80);
    expect((await rowFor("acorn15"))?.source_blob_sha).toBe(await gitBlobSha(edited));
    expect(await rowFor("allene")).toBeNull();
    expect((await rowFor("zeta"))?.slug).toBe("zeta");

    // The page is drawn from the final set: the edit, the new phage and the deleted one's absence.
    const after = await twin();
    expect(after).toContain("| [Acorn15](#acorn15) | 2017 | *M. smegmatis* mc²155 | Parker County |");
    expect(after).toContain("| [Zeta](#zeta) | 2026 |");
    expect(after).not.toContain("[Allene](#allene)");
    expect((await searchRows()).some((r) => r.body.includes("Zeta"))).toBe(true);
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no phage: a fault, not a repository with none.
    for (const path of Object.keys(files)) gh.files.delete(path);
    gh.files.set("content/phages/README.txt", "not a phage");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await count()).toBe(80);
  });

  it("makes no row for a file the validator refuses, naming it, and converges the rest", { timeout: 300_000 }, async () => {
    gh.files.set("content/phages/stray.md", "---\nname: Stray\nyear: 2026\nhost: ecoli\ncounty: null\nphagesdb: null\nsample: soil\n---\n");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/phages/stray.md fails");
      expect(JSON.stringify(result.detail)).toContain("sample is not a phage field");
    }
    expect(await rowFor("stray")).toBeNull();
    expect(await count()).toBe(80);
  });

  it("stops before any row moves when the page cannot be drawn, so the next run retries it", { timeout: 300_000 }, async () => {
    gh.files.set(PAGE_FILE, phagesPage.replace(/^title: .*$/m, "title: "));
    const refused = await sync();
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused)).toMatch(/does not compile with these phages/);
    expect(await count()).toBe(0);
    expect((await driftCheck())?.ok).toBe(false);

    gh.files.set(PAGE_FILE, phagesPage);
    const retried = await sync();
    expect(retried.ok, JSON.stringify(retried)).toBe(true);
    expect(await count()).toBe(80);
  });
});
