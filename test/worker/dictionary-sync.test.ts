import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";

import capsidEntry from "../../content/dictionary/capsid.md?raw";
import carrelEntry from "../../content/dictionary/carrel.md?raw";
import capsidPage from "../../content/pages/software-capsid.md?raw";
import carrelPage from "../../content/pages/software-carrel.md?raw";

import { putSource, removeSource, stubSources, type SourceStub } from "./source-stub";
import { seedPages } from "./seed";

/* sync_dictionary and the dictionary-drift check: D1 converges to content/dictionary through the compile and
 * write doors a dictionary save uses (the repository is the source), and each entry written
 * re-derives the page it opens. Each case starts from an empty dictionary table and a repository ahead of it. */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const ADDED = "An edit committed through git that reaches D1 only through the sync.";
const SENSE =
  "A private workspace for writing, in which drafts are composed, revised, and published.";

const rowFor = (key: string) =>
  env.DB.prepare("SELECT key, source_blob_sha FROM dictionary_entries WHERE key = ?1")
    .bind(key)
    .first<{ key: string; source_blob_sha: string }>();
const twinOf = async (path: string) =>
  (
    await env.DB.prepare("SELECT markdown FROM pages WHERE path = ?1")
      .bind(path)
      .first<{ markdown: string }>()
  )?.markdown ?? "";
const searchRows = async (path: string) =>
  (
    await env.DB.prepare("SELECT body FROM search_docs WHERE doc_uid = ?1")
      .bind(contentPageSearchUid(path))
      .all<{ body: string }>()
  ).results;
const driftCheck = async () =>
  (await runHealthChecks(env as never)).checks.find((c) => c.name === "dictionary-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_dictionary", {});

let gh: SourceStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM dictionary_entries").run();
  await seedPages();
  gh = await stubSources({
    "content/dictionary/capsid.md": capsidEntry,
    "content/dictionary/carrel.md": carrelEntry,
    "content/pages/software-capsid.md": capsidPage,
    "content/pages/software-carrel.md": carrelPage,
    "public/audio/capsid.mp3": "clip",
    "public/audio/carrel.mp3": "clip",
  });
});

afterEach(async () => {
  await gh.restore();
});

describe("sync_dictionary and the dictionary-drift check", () => {
  it(
    "converges unrowed files, reports them as drift first, and is idempotent",
    { timeout: 240_000 },
    async () => {
      expect((await driftCheck())?.ok).toBe(false);

      const first = await sync();
      expect(first.ok, JSON.stringify(first)).toBe(true);
      if (first.ok)
        expect(first.data).toMatchObject({
          repaired: 2,
          removed: 0,
          expected: 2,
          present: 2,
          converged: true,
        });
      expect((await rowFor("capsid"))?.source_blob_sha).toBe(await gitBlobSha(capsidEntry));
      // Each page the entries open carries its entry in its search record.
      expect((await searchRows("/software/capsid")).some((r) => r.body.includes("KAP-sid"))).toBe(
        true,
      );
      expect((await driftCheck())?.ok).toBe(true);

      const again = await sync();
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
    },
  );

  it(
    "re-compiles an entry edited through git, refreshes its page's twin and search record, and removes a row whose file is gone",
    { timeout: 240_000 },
    async () => {
      expect((await sync()).ok).toBe(true);
      expect(await twinOf("/software/carrel")).toContain(SENSE);

      // An edit committed outside the save tool, and a deletion.
      const edited = carrelEntry.replace(SENSE, ADDED);
      await putSource("content/dictionary/carrel.md", edited);
      await removeSource("content/dictionary/capsid.md");
      const drifted = await driftCheck();
      expect(drifted?.ok).toBe(false);
      expect(drifted?.detail).toContain("1 sha-changed");
      expect(drifted?.detail).toContain("1 row(s) with no file");

      const result = await sync();
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (result.ok)
        expect(result.data).toMatchObject({ repaired: 1, removed: 1, converged: true });
      expect((await rowFor("carrel"))?.source_blob_sha).toBe(await gitBlobSha(edited));
      expect(await rowFor("capsid")).toBeNull();

      // The page an entry opens is re-derived with it: the new sense in the twin and the record, and the page of a
      // deleted entry loses its lead.
      expect(await twinOf("/software/carrel")).toContain(`2. *software.* ${ADDED}`);
      expect((await searchRows("/software/carrel")).some((r) => r.body.includes(ADDED))).toBe(true);
      expect(await twinOf("/software/capsid")).not.toContain("Pronunciation audio");
      expect((await searchRows("/software/capsid")).some((r) => r.body.includes("KAP-sid"))).toBe(
        false,
      );
    },
  );
});
