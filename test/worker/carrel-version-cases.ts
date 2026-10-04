import { describe, expect, it } from "vitest";

import { commitFiles } from "~/lib/editor/github.server";

import { versionOf, type GitHubStub } from "./github-stub";
import { testEnv } from "./test-env";

/* One definition of what Carrel's version of an item means, run for every file-backed kind: it is the blob sha of
 * the item's own file at head, so only a change to THAT item moves it (job_d0ed3f93a4d3). Each kind's test file
 * calls this with its own repository, id and a valid edit. The kinds differ in how they save, not in this. */

const PREFIX = "https://example.com/api/carrel/v1";

export function versionCases(options: {
  /** The kind, for the test names. */
  name: string;
  /** The contract id: `cv.grants`, `procedure.phage-dna-extraction`, `post-slug`. */
  id: string;
  /** The item's file in the stubbed repository. */
  file: string;
  /** A valid source that differs from the stored one. */
  edit: () => string | Promise<string>;
  gh: () => GitHubStub;
  get: (url: string) => Promise<Response>;
  send: (method: "PUT" | "POST", url: string, body: unknown) => Promise<Response>;
  timeout?: number;
}) {
  const { name, id, file, gh, get, send } = options;
  const timeout = options.timeout ?? 120_000;
  const read = async () => ((await (await get(`${PREFIX}/content/${id}`)).json()) as { version: string }).version;
  const save = async (source: string, expectedVersion: string, changeId: string) =>
    send("PUT", `${PREFIX}/content/${id}/draft`, { source, expectedVersion, changeId });
  /** A commit to a file that is not this item's: it moves the repository's head and nothing of the item's. */
  const commitElsewhere = () =>
    commitFiles(testEnv as never, {
      message: "Update an unrelated file",
      changes: [{ path: "content/unrelated-version-case.md", content: `unrelated ${Math.random()}\n` }],
    });

  describe(`${name}: its Carrel version is its own file's`, () => {
    it("is the blob sha of the item's file", { timeout }, async () => {
      expect(await read()).toBe(await versionOf(gh(), file));
    });

    it("does not change when something else is committed, and a save made before that still lands", { timeout }, async () => {
      const before = await read();
      const head = gh().calls.length;
      await commitElsewhere();
      expect(gh().calls.length).toBeGreaterThan(head);

      expect(await read()).toBe(before);

      const saved = await save(await options.edit(), before, `chg-${name}-elsewhere`);
      expect(saved.status, await saved.clone().text()).toBe(200);
    });

    it("changes when this item is committed, and the save answers the new version", { timeout }, async () => {
      const before = await read();
      const saved = await save(await options.edit(), before, `chg-${name}-self`);
      expect(saved.status, await saved.clone().text()).toBe(200);
      const answered = ((await saved.json()) as { version: string }).version;

      expect(answered).not.toBe(before);
      expect(answered).toBe(await versionOf(gh(), file));
      expect(await read()).toBe(answered);
    });

    it("REFUSES a save made from a version the item has since moved past, names the current one, commits nothing", { timeout }, async () => {
      const opened = await read();
      const first = await save(await options.edit(), opened, `chg-${name}-first`);
      expect(first.status, await first.clone().text()).toBe(200);
      const stored = gh().files.get(file);
      const commitsBefore = gh().calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length;

      const stale = await save(`${await options.edit()}\n`, opened, `chg-${name}-stale`);

      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({ error: "version-conflict", currentVersion: await versionOf(gh(), file) });
      expect(gh().files.get(file)).toBe(stored);
      expect(gh().calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length).toBe(commitsBefore);
    });
  });
}
