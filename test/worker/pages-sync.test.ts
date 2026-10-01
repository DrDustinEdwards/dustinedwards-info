import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { pageSourcePath } from "~/lib/pages/compile.mjs";

import capsid from "../../content/pages/software-capsid.md?raw";
import foxhound from "../../content/pages/software-foxhound.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";

/* sync_pages and the pages-drift check: D1 converges to content/pages through the compile and write doors
 * a page save uses (hard rule 18: the repository is the source). Each case starts from an empty pages table
 * and a repository ahead of it. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const FOXHOUND = "software-foxhound";
const CAPSID = "software-capsid";
const ADDED = "This sentence was committed through git and reaches D1 only through the sync.";

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha FROM pages WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; source_blob_sha: string }>();
const searchRows = async (path: string) =>
  (
    await env.DB.prepare("SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid = ?1")
      .bind(contentPageSearchUid(path))
      .first<{ n: number }>()
  )?.n;
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "pages-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_pages", {});

let gh: GitHubStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM pages").run();
  gh = stubGitHub({ [pageSourcePath(FOXHOUND)]: foxhound, [pageSourcePath(CAPSID)]: capsid });
});

afterEach(() => {
  gh.restore();
});

describe("sync_pages and the pages-drift check", () => {
  it("converges unrowed files, reports them as drift first, and is idempotent", { timeout: 240_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 2, removed: 0, expected: 2, present: 2, converged: true });
    expect((await rowFor(FOXHOUND))?.source_blob_sha).toBe(await gitBlobSha(foxhound));
    expect(await searchRows("/software/foxhound")).toBeGreaterThan(0);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles a file edited through git, and removes the row and search records of a file that is gone", { timeout: 240_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    expect(await searchRows("/software/capsid")).toBeGreaterThan(0);

    // An edit committed outside the save tool, and a deletion.
    const edited = `${foxhound.trimEnd()}\n\n${ADDED}\n`;
    gh.files.set(pageSourcePath(FOXHOUND), edited);
    gh.files.delete(pageSourcePath(CAPSID));
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 1, removed: 1, converged: true });
    expect(await rowFor(CAPSID)).toBeNull();
    expect(await searchRows("/software/capsid")).toBe(0);
    expect((await rowFor(FOXHOUND))?.source_blob_sha).toBe(await gitBlobSha(edited));
    const stored = await env.DB.prepare("SELECT markdown FROM pages WHERE slug = ?1").bind(FOXHOUND).first<{ markdown: string }>();
    expect(stored?.markdown).toContain(ADDED);
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 240_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no page: a fault, not a repository with none.
    gh.files.delete(pageSourcePath(FOXHOUND));
    gh.files.delete(pageSourcePath(CAPSID));
    gh.files.set("content/pages/README.txt", "not a page");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor(FOXHOUND)).not.toBeNull();
    expect(await rowFor(CAPSID)).not.toBeNull();
  });

  it("makes no row for a file whose path is not registered, naming it, and converges the rest", { timeout: 240_000 }, async () => {
    gh.files.set("content/pages/not-a-registered-page.md", foxhound);
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/pages/not-a-registered-page.md fails");
      expect(JSON.stringify(result.detail)).toContain("not a registered page");
    }
    expect(await rowFor("not-a-registered-page")).toBeNull();
    expect(await rowFor(FOXHOUND)).not.toBeNull();
    expect(await rowFor(CAPSID)).not.toBeNull();
  });
});
