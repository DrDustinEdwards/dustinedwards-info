import { describe, expect, it } from "vitest";
import { latestDump } from "@dustinedwards/d1-dump";

import { backupD1 } from "~/lib/backup/d1-backup.server";
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
    const marker = JSON.parse(await (await testEnv.BACKUPS.get(`${latest!.prefix}_complete.json`))!.text());
    const dumped = marker.tables.map((t: { name: string }) => t.name);
    for (const name of REQUIRED_TABLES) expect(dumped).toContain(name);
  });

  it("is reachable as the operator tool", async () => {
    const out = await runTool(testEnv as never, { kind: "operator", id: "test" } as never, "backup_d1", {});
    expect(out).toMatchObject({ ok: true, data: { tables: expect.any(Number) } });
  });

  it("PLANTED: a credential table left in refuses the marker, so the run is never the restore point", async () => {
    const before = await latestDump(testEnv.BACKUPS);
    await testEnv.DB.exec("CREATE TABLE planted_session (id integer PRIMARY KEY, token text NOT NULL)");
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
