import { describe, expect, it } from "vitest";
import { latestDump } from "@dustinedwards/d1-dump";

import { backupD1, backupStatus } from "~/lib/backup/d1-backup.server";
import { runTool } from "~/lib/operator/api.server";
import { REQUIRED_TABLES } from "~/lib/backup/policy.mjs";

import { testEnv } from "./test-env";

const backupEnv = () => testEnv as unknown as Parameters<typeof backupD1>[0];

async function runs(): Promise<string[]> {
  const listed = await testEnv.BACKUPS.list({ prefix: "backups/json/", delimiter: "/" });
  return listed.delimitedPrefixes;
}

describe("the nightly D1 dump", () => {
  it("writes a complete run holding every required table", async () => {
    const result = await backupD1(backupEnv());
    expect(result.tables).toBeGreaterThanOrEqual(REQUIRED_TABLES.length);
    expect(result.kept).toBeGreaterThanOrEqual(1);
    expect(result.locked).toBe(0);

    const latest = await latestDump(testEnv.BACKUPS);
    expect(latest?.run_id).toBe(result.run_id);
    const marker = JSON.parse(
      await (await testEnv.BACKUPS.get(`${latest!.prefix}_complete.json`))!.text(),
    );
    const dumped = marker.tables.map((t: { name: string }) => t.name);
    for (const name of REQUIRED_TABLES) expect(dumped).toContain(name);
  });

  it("runs now as the backup job through the operator API's run_job", async () => {
    const out = await runTool(
      testEnv as never,
      { kind: "operator", id: "test" } as never,
      "run_job",
      { job: "backup" },
      { waitUntil: () => undefined, passThroughOnException: () => undefined } as never,
    );
    expect(out).toMatchObject({
      ok: true,
      data: { runs: [{ job: "backup", status: "ok", result: { tables: expect.any(Number) } }] },
    });
  });

  it("PLANTED: a credential table left in refuses the marker, so the run is never the restore point", async () => {
    const before = await latestDump(testEnv.BACKUPS);
    await testEnv.DB.exec(
      "CREATE TABLE planted_session (id integer PRIMARY KEY, token text NOT NULL)",
    );
    await testEnv.DB.exec("INSERT INTO planted_session (token) VALUES ('live-credential')");
    try {
      await expect(backupD1(backupEnv())).rejects.toThrow(/planted_session.*token/);
      const after = await latestDump(testEnv.BACKUPS);
      expect(after?.run_id).toBe(before?.run_id);
      // The incomplete run is kept as evidence: objects, no marker.
      const all = await runs();
      expect(all.length).toBeGreaterThan(1);
    } finally {
      await testEnv.DB.exec("DROP TABLE planted_session");
    }
  });
});

describe("the nightly files backup", () => {
  it("copies MEDIA and MEDIA_REVISIONS under files/ in BACKUPS, which /health then reports", async () => {
    await testEnv.MEDIA.put("files-case.png", "media bytes");
    await testEnv.MEDIA_REVISIONS.put(
      "replaced/2026-11-05T00:00:00.000Z/files-case.png",
      "earlier bytes",
    );

    const out = await runTool(
      testEnv as never,
      { kind: "operator", id: "test" } as never,
      "run_job",
      { job: "media-backup" },
      { waitUntil: () => undefined, passThroughOnException: () => undefined } as never,
    );
    expect(out).toMatchObject({
      ok: true,
      data: {
        runs: [
          {
            job: "media-backup",
            status: "ok",
            result: {
              files: [
                { name: "media", complete: true },
                { name: "revisions", complete: true },
              ],
            },
          },
        ],
      },
    });

    expect(await (await testEnv.BACKUPS.get("files/media/files-case.png"))!.text()).toBe(
      "media bytes",
    );
    expect(
      await (await testEnv.BACKUPS.get(
        "files/revisions/replaced/2026-11-05T00:00:00.000Z/files-case.png",
      ))!.text(),
    ).toBe("earlier bytes");
    const status = await backupStatus(testEnv);
    expect(status.files.media?.age_hours).not.toBeNull();
    expect(status.files.revisions?.age_hours).not.toBeNull();
  });
});
