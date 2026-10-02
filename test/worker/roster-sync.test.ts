import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { cacheTags } from "~/lib/seo";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { rosterPath } from "~/lib/roster/compile.mjs";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { SYNTHETIC_COHORTS, cohortFile } from "./seed";

/* sync_roster and the roster-drift check: D1 converges to content/roster through the compile and write doors a
 * roster save uses (hard rule 18: the repository is the source). Each case starts from an empty roster table and
 * a repository ahead of it. Every name is a placeholder. */

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const [CURRENT, EARLIER] = SYNTHETIC_COHORTS;
const CURRENT_SLUG = String(CURRENT.year);
const EARLIER_SLUG = String(EARLIER.year);
const PHOTO_FILE = `public${CURRENT.photo.src}`;

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, year, source_blob_sha FROM roster WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; year: number; source_blob_sha: string }>();
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "roster-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_roster", {});

let gh: GitHubStub;
let current: string;
let earlier: string;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM roster").run();
  current = await cohortFile(CURRENT);
  earlier = await cohortFile(EARLIER);
  gh = stubGitHub({ [rosterPath(CURRENT_SLUG)]: current, [rosterPath(EARLIER_SLUG)]: earlier, [PHOTO_FILE]: "x" });
  purge.mockClear();
});

afterEach(() => {
  gh.restore();
});

describe("sync_roster and the roster-drift check", () => {
  it("converges unrowed files, reports them as drift first, purges the pages that embed the roster, and is idempotent", { timeout: 240_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 2, removed: 0, expected: 2, present: 2, converged: true });
    expect((await rowFor(CURRENT_SLUG))?.source_blob_sha).toBe(await gitBlobSha(current));
    expect((await rowFor(EARLIER_SLUG))?.year).toBe(EARLIER.year);
    expect((await driftCheck())?.ok).toBe(true);

    const tags = purge.mock.calls.flatMap(([options]) => options.tags);
    expect(tags).toContain("content-pages");
    expect(tags).toContain(cacheTags());

    purge.mockClear();
    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
    expect(purge).not.toHaveBeenCalled();
  });

  it("re-compiles a file edited through git, and removes the row of a file that is gone", { timeout: 240_000 }, async () => {
    expect((await sync()).ok).toBe(true);

    // An edit committed outside the save, and a deletion.
    const edited = await cohortFile({ ...CURRENT, researchers: [...CURRENT.researchers, "Example Person Eight"] });
    gh.files.set(rosterPath(CURRENT_SLUG), edited);
    gh.files.delete(rosterPath(EARLIER_SLUG));
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 1, removed: 1, converged: true });
    expect(await rowFor(EARLIER_SLUG)).toBeNull();
    expect((await rowFor(CURRENT_SLUG))?.source_blob_sha).toBe(await gitBlobSha(edited));
    const stored = await env.DB.prepare("SELECT record FROM roster WHERE slug = ?1").bind(CURRENT_SLUG).first<{ record: string }>();
    expect(JSON.parse(stored?.record ?? "{}").researchers).toContain("Example Person Eight");
  });

  it("REFUSES an empty file set instead of deleting every row", { timeout: 240_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no cohort: a fault, not a repository with none.
    gh.files.delete(rosterPath(CURRENT_SLUG));
    gh.files.delete(rosterPath(EARLIER_SLUG));
    gh.files.set("content/roster/README.txt", "not a cohort");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor(CURRENT_SLUG)).not.toBeNull();
    expect(await rowFor(EARLIER_SLUG)).not.toBeNull();
  });

  it("makes no row for a file the validator refuses, naming it, and converges the rest", { timeout: 240_000 }, async () => {
    gh.files.set("content/roster/notes.md", current);
    gh.files.set(rosterPath("2029"), (await cohortFile(CURRENT)).replace("year: 2031", "year: 2029\nemail: someone@example.com"));
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/roster/notes.md fails");
      expect(result.error).toContain("content/roster/2029.md fails");
      expect(JSON.stringify(result.detail)).toContain("is not a roster field");
    }
    expect(await rowFor("notes")).toBeNull();
    expect(await rowFor("2029")).toBeNull();
    expect(await rowFor(CURRENT_SLUG)).not.toBeNull();
    expect(await rowFor(EARLIER_SLUG)).not.toBeNull();
  });
});
