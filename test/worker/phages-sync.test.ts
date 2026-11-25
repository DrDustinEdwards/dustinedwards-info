import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";

import phagesPage from "../../content/pages/research-phages.md?raw";
// The pages that state a phage fact by token: a phage write re-derives each of them (PHAGE_FACT_PAGES).
import researchPage from "../../content/pages/research.md?raw";
import bacteriophagesPage from "../../content/pages/research-bacteriophages.md?raw";
import scienceEducationPage from "../../content/pages/research-science-education.md?raw";

import { putSource, removeSource, stubSources, type SourceStub } from "./source-stub";
import { expectDrift, expectIdempotent, expectSynced, syncOf } from "./sync-harness";
import { seedPages } from "./seed";
import { purgedTagsOf, recordPurges } from "./route-helpers";

/* sync_phages and the phage-drift check: D1 converges to content/phages through the compile and write doors a
 * phage save uses (the repository is the source), and the page the table is drawn into is re-derived
 * once, from the final set, before any row moves. Each case starts from an empty phages table and a repository
 * ahead of it. */

const PHAGE_FILES = import.meta.glob("../../content/phages/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const files = Object.fromEntries(
  Object.entries(PHAGE_FILES).map(([path, raw]) => [
    `content/phages/${path.split("/").pop()}`,
    raw,
  ]),
);
/* A genome announcement is a paper the repository holds, so the stub holds one for each phage that names one. */
const PAPERS = Object.fromEntries(
  Object.values(files).flatMap((raw) => {
    const slug = /^paper: (.+)$/m.exec(raw)?.[1];
    return slug ? [[`content/publications/${slug}.md`, "x"]] : [];
  }),
);
const PAGE_FILE = "content/pages/research-phages.md";
const PATH = "/research/phages";

/* The save's purge goes to the Renderer over the loopback (cache-purge.server.ts), replaced here with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
recordPurges(purge);

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha FROM phages WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; source_blob_sha: string }>();
const count = async () =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM phages").first<{ n: number }>())?.n ?? -1;
const twin = async () =>
  (
    await env.DB.prepare("SELECT markdown FROM pages WHERE path = ?1")
      .bind(PATH)
      .first<{ markdown: string }>()
  )?.markdown ?? "";
const searchRows = async () =>
  (
    await env.DB.prepare("SELECT body FROM search_docs WHERE doc_uid = ?1")
      .bind(contentPageSearchUid(PATH))
      .all<{ body: string }>()
  ).results;
const { sync, driftCheck } = syncOf("sync_phages", "phage-drift");

let gh: SourceStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM phages").run();
  await seedPages([PATH]);
  gh = await stubSources({
    ...files,
    ...PAPERS,
    [PAGE_FILE]: phagesPage,
    "content/pages/research.md": researchPage,
    "content/pages/research-bacteriophages.md": bacteriophagesPage,
    "content/pages/research-science-education.md": scienceEducationPage,
  });
  purge.mockClear();
});

afterEach(async () => {
  await gh.restore();
});

describe("sync_phages and the phage-drift check", () => {
  it(
    "converges unrowed files, reports them as drift first, draws the page once, purges its tag, and is idempotent",
    { timeout: 300_000 },
    async () => {
      expect((await driftCheck())?.ok).toBe(false);

      await expectSynced(sync, { repaired: 75, removed: 0, expected: 75 });
      expect(await count()).toBe(75);
      expect((await rowFor("acorn15"))?.source_blob_sha).toBe(
        await gitBlobSha(files["content/phages/acorn15.md"] ?? ""),
      );
      expect((await searchRows()).some((r) => r.body.includes("Acorn15"))).toBe(true);
      expect(await purgedTagsOf(purge)).toEqual(["content-pages"]);
      expect((await driftCheck())?.ok).toBe(true);

      await expectIdempotent(sync);
    },
  );

  it(
    "re-compiles a phage edited through git, redraws the page's twin and search record, and removes a row whose file is gone",
    { timeout: 300_000 },
    async () => {
      expect((await sync()).ok).toBe(true);
      expect(await twin()).toContain("| Acorn15 | 2017 | *M. smegmatis* mc²155 | Hood County |");

      // An edit committed outside the save tool, a new file, and a deletion.
      const edited = (files["content/phages/acorn15.md"] ?? "").replace(
        "county: Hood County",
        "county: Parker County",
      );
      await putSource("content/phages/acorn15.md", edited);
      await putSource(
        "content/phages/zeta.md",
        "---\nname: Zeta\nyear: 2026\nhost: foliorum\ncounty: Erath County\nphagesdb: null\n---\n",
      );
      await removeSource("content/phages/allene.md");
      await expectDrift(driftCheck, { changed: 1, gone: 1 });

      await expectSynced(sync, { repaired: 2, removed: 1 });
      expect(await count()).toBe(75);
      expect((await rowFor("acorn15"))?.source_blob_sha).toBe(await gitBlobSha(edited));
      expect(await rowFor("allene")).toBeNull();
      expect((await rowFor("zeta"))?.slug).toBe("zeta");

      // The page is drawn from the final set: the edit, the new phage and the deleted one's absence.
      const after = await twin();
      expect(after).toContain("| Acorn15 | 2017 | *M. smegmatis* mc²155 | Parker County |");
      expect(after).toContain("| Zeta | 2026 |");
      expect(after).not.toContain("| Allene |");
      expect((await searchRows()).some((r) => r.body.includes("Zeta"))).toBe(true);
    },
  );

  it("REFUSES an empty file set instead of deleting every row", { timeout: 300_000 }, async () => {
    expect((await sync()).ok).toBe(true);
    // The directory lists, but holds no phage: a fault, not a repository with none.
    for (const path of Object.keys(files)) await removeSource(path);
    await putSource("content/phages/README.txt", "not a phage");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await count()).toBe(75);
  });

  it(
    "stops before any row moves when the page cannot be drawn, so the next run retries it",
    { timeout: 300_000 },
    async () => {
      await putSource(PAGE_FILE, phagesPage.replace(/^title: .*$/m, "title: "));
      const refused = await sync();
      expect(refused.ok).toBe(false);
      expect(JSON.stringify(refused)).toMatch(/does not compile with these phages/);
      expect(await count()).toBe(0);
      expect((await driftCheck())?.ok).toBe(false);

      await putSource(PAGE_FILE, phagesPage);
      const retried = await sync();
      expect(retried.ok, JSON.stringify(retried)).toBe(true);
      expect(await count()).toBe(75);
    },
  );
});
