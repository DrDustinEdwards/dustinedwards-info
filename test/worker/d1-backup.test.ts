import { describe, expect, it } from "vitest";
import { latestDump } from "@dustinedwards/d1-dump";

import { backupAge } from "~/lib/backup/age.server";
import { backupD1 } from "~/lib/backup/d1-backup.server";
import { runTool } from "~/lib/operator/api.server";
import { REQUIRED_TABLES } from "~/lib/backup/policy.mjs";
import { isD1BackupWindow, backupD1Daily } from "../../workers/watchdog";

import { testEnv } from "./test-env";

const backupEnv = () => testEnv as unknown as Parameters<typeof backupD1>[0];

async function runs(): Promise<string[]> {
  const listed = await testEnv.BACKUPS.list({ prefix: "backups/json/", delimiter: "/" });
  return listed.delimitedPrefixes;
}

describe("the nightly D1 dump", () => {
  it("writes a complete run holding every required table, and health reads its age", async () => {
    const result = await backupD1(backupEnv());
    expect(result.tables).toBeGreaterThanOrEqual(REQUIRED_TABLES.length);
    expect(result.kept).toBeGreaterThanOrEqual(1);
    expect(result.locked).toBe(0);

    const latest = await latestDump(testEnv.BACKUPS);
    expect(latest?.run_id).toBe(result.run_id);
    const marker = JSON.parse(await (await testEnv.BACKUPS.get(`${latest!.prefix}_complete.json`))!.text());
    const dumped = marker.tables.map((t: { name: string }) => t.name);
    for (const name of REQUIRED_TABLES) expect(dumped).toContain(name);

    const age = await backupAge(backupEnv());
    expect(age.last_ok).toBe(result.exported_at);
    expect(age.age_hours).toBeLessThan(1);
  });

  it("is reachable as the operator tool the watchdog calls", async () => {
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

  it("falls in one firing of the fifteen-minute cron a day, and raises what the tool refused", async () => {
    const day = Date.UTC(2026, 9, 11, 5, 0);
    expect(isD1BackupWindow(day)).toBe(true);
    expect(isD1BackupWindow(day + 14 * 60_000)).toBe(true);
    expect(isD1BackupWindow(day + 15 * 60_000)).toBe(false);
    expect(isD1BackupWindow(day + 24 * 60 * 60_000)).toBe(true);
    expect(isD1BackupWindow(Date.UTC(2026, 9, 11, 4, 0))).toBe(false);
    expect(isD1BackupWindow(Date.UTC(2026, 9, 11, 3, 0))).toBe(false);

    const calls: unknown[] = [];
    const site = (status: number, payload: unknown) =>
      ({
        SITE: {
          fetch: async (_url: string, init: RequestInit) => {
            calls.push(JSON.parse(String(init.body)));
            return new Response(JSON.stringify(payload), { status });
          },
        },
      }) as never;
    expect(await backupD1Daily(site(200, { data: {} }), "tok", day)).toBeNull();
    expect(calls).toEqual([{ tool: "backup_d1", args: {} }]);
    expect(await backupD1Daily(site(200, {}), "tok", day + 60 * 60_000)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(await backupD1Daily(site(500, { error: "the dump was left incomplete" }), "tok", day)).toContain("left incomplete");
    expect(await backupD1Daily(site(200, {}), "", day)).toContain("OPERATOR_TOKEN");
  });
});
