#!/usr/bin/env node
/**
 * Prove the newest nightly D1 dump restores, end to end, from what the live site reports.
 *
 * 1. Read `backup` from the public /api/health and refuse unless `last_ok` is set and younger
 *    than MAX_AGE_HOURS (the dump runs nightly at 05:00 UTC on the watchdog).
 * 2. Derive that run's id the way d1-dump names it (`runIdFor`: the ISO time with `:` and `.`
 *    replaced), read its `_complete.json`, and download every key the marker lists from
 *    dustinedwards-backups with `wrangler r2 object get --remote`.
 * 3. Run `d1-dump drill --dir <dir> --backend sqlite` on the download. sqlite needs no database
 *    on the account; the drill's own checks decide pass or fail.
 *
 * Env: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for wrangler. Optional HEALTH_URL.
 * Run by .github/workflows/restore-drill.yml after the export drill, and by hand the same way.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  COMPLETE_MARKER,
  DEFAULT_PREFIX,
  runIdFor,
} from "@dustinedwards/d1-dump";

const BUCKET = "dustinedwards-backups";
const MAX_AGE_HOURS = 30;
const HEALTH_URL =
  process.env.HEALTH_URL ?? "https://dustinedwards.info/api/health";

/**
 * @param {{ last_ok?: string | null, age_hours?: number | null } | undefined} backup
 * @returns {string} the run's prefix in the bucket
 */
export function runPrefixFor(backup) {
  if (!backup?.last_ok)
    throw new Error(
      `/api/health reports no complete dump (backup: ${JSON.stringify(backup)}).`,
    );
  if (
    typeof backup.age_hours !== "number" ||
    backup.age_hours > MAX_AGE_HOURS
  ) {
    throw new Error(
      `The newest dump (${backup.last_ok}) is ${backup.age_hours} hours old, over ${MAX_AGE_HOURS}.`,
    );
  }
  const at = new Date(backup.last_ok);
  if (Number.isNaN(at.getTime()))
    throw new Error(`last_ok ${backup.last_ok} is not a time.`);
  return `${DEFAULT_PREFIX}${runIdFor(at)}/`;
}

/** @param {string} key @param {string} file */
function download(key, file) {
  mkdirSync(dirname(file), { recursive: true });
  execFileSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "get",
      `${BUCKET}/${key}`,
      "--file",
      file,
      "--remote",
    ],
    {
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
}

async function main() {
  const res = await fetch(HEALTH_URL, {
    headers: { accept: "application/json" },
  });
  const health = await res.json();
  const prefix = runPrefixFor(health.backup);
  console.log(
    `Newest complete dump: ${health.backup.last_ok}, ${health.backup.age_hours} hours old.`,
  );

  const dir = mkdtempSync(join(tmpdir(), "backup-drill-"));
  const markerFile = join(dir, prefix, COMPLETE_MARKER);
  download(`${prefix}${COMPLETE_MARKER}`, markerFile);
  const marker = JSON.parse(readFileSync(markerFile, "utf8"));
  if (marker.exported_at !== health.backup.last_ok) {
    throw new Error(
      `${prefix}${COMPLETE_MARKER} says ${marker.exported_at}, health says ${health.backup.last_ok}.`,
    );
  }
  const keys = /** @type {string[]} */ (marker.keys).filter(
    (key) => !key.endsWith(COMPLETE_MARKER),
  );
  for (const key of keys) {
    if (!key.startsWith(prefix))
      throw new Error(`The marker lists ${key}, outside ${prefix}.`);
    download(key, join(dir, key));
  }
  console.log(
    `Downloaded ${keys.length + 1} objects of ${prefix} (${marker.tables.length} tables).`,
  );

  execFileSync(
    "npx",
    ["d1-dump", "drill", "--dir", dir, "--backend", "sqlite"],
    { stdio: "inherit" },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
