import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { CV_FILES, cvSourcePath } from "~/lib/cv/parse.mjs";

import { putSource, stubSources, type SourceStub } from "./source-stub";
import { expectDrift, expectIdempotent, expectSynced, syncOf } from "./sync-harness";
import { seedPublications } from "./seed";

/* sync_cv and the cv-drift check: D1 converges to content/cv through the compile and write doors a CV save
 * uses (the repository is the source). Each case starts from an empty cv table and a repository
 * ahead of it. */

const FILES = import.meta.glob("../../content/cv/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const rawOf = (slug: string) => {
  const found = FILES[`../../content/cv/${slug}.md`];
  if (found === undefined) throw new Error(`no content/cv/${slug}.md`);
  return found;
};
const repository = () =>
  Object.fromEntries(CV_FILES.map(({ slug }) => [cvSourcePath(slug), rawOf(slug)]));

const ADDED = "Added Through Git Equipment Award";

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug, source_blob_sha FROM cv WHERE slug = ?1")
    .bind(slug)
    .first<{ slug: string; source_blob_sha: string }>();
const searchRows = async (needle?: string) =>
  (
    await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid = ?1 AND body LIKE ?2",
    )
      .bind(contentPageSearchUid("/cv"), `%${needle ?? ""}%`)
      .first<{ n: number }>()
  )?.n;
const { sync, driftCheck } = syncOf("sync_cv", "cv-drift");

let gh: SourceStub;

beforeAll(async () => {
  await seedPublications();
}, 300_000);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM cv").run();
  await env.DB.prepare("DELETE FROM search_docs WHERE doc_uid = ?1")
    .bind(contentPageSearchUid("/cv"))
    .run();
  gh = await stubSources(repository());
});

afterEach(async () => {
  await gh.restore();
});

describe("sync_cv and the cv-drift check", () => {
  it(
    "converges unrowed files, reports them as drift first, writes the search records, and is idempotent",
    { timeout: 300_000 },
    async () => {
      expect((await driftCheck())?.ok).toBe(false);

      await expectSynced(sync, {
        repaired: CV_FILES.length,
        removed: 0,
        expected: CV_FILES.length,
      });
      expect((await rowFor("grants"))?.source_blob_sha).toBe(await gitBlobSha(rawOf("grants")));
      expect(await searchRows()).toBeGreaterThan(0);
      expect((await driftCheck())?.ok).toBe(true);

      await expectIdempotent(sync);
    },
  );

  it(
    "re-compiles a file edited through git, and carries the edit to the search records",
    { timeout: 300_000 },
    async () => {
      expect((await sync()).ok).toBe(true);
      expect(await searchRows(ADDED)).toBe(0);

      // An edit committed outside the save path.
      const edited = rawOf("grants").replace(
        "entries:\n",
        `entries:\n  - year: 2026\n    amount: 99\n    title: ${ADDED}\n    areas: []\n    role: recipient\n`,
      );
      await putSource(cvSourcePath("grants"), edited);
      await expectDrift(driftCheck, { changed: 1 });

      await expectSynced(sync, { repaired: 1, removed: 0 });
      expect((await rowFor("grants"))?.source_blob_sha).toBe(await gitBlobSha(edited));
      expect(await searchRows(ADDED)).toBeGreaterThan(0);
    },
  );
});
