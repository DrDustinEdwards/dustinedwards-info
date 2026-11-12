import { siteAssetCounts, siteAssetRoleCounts } from "~/db";
import { rebuildSiteAssets } from "./rebuild.server";

// The rebuild of the site's own files on /admin/tools: the row count its confirmation shows, and the report of what the
// index holds after it. The library's files are site-api's media library's (app/lib/carrel/media-adapter.server.ts).

type Message = { message: string };

/** The row count the rebuild confirmation shows. */
export async function siteAssetTotal(env: Env) {
  const before = await siteAssetCounts(env);
  return before.reduce((sum, row) => sum + Number(row.n), 0);
}

/** Runs the rebuild the route has confirmed and reports what the index holds after it. */
export async function rebuildSiteAssetIndex(env: Env): Promise<Message> {
  const report = await rebuildSiteAssets(env);
  const after = await siteAssetCounts(env);
  const total = after.reduce((sum, row) => sum + Number(row.n), 0);
  const breakdown = after
    .map((row) => `${row.n} ${row.storage}/${row.kind}`)
    .sort()
    .join(", ");
  const roles = await siteAssetRoleCounts(env);
  const roleBreakdown = roles
    .map((row) => `${row.n} ${row.role}`)
    .sort()
    .join(", ");

  const parts = [
    `Rebuilt from ${report.scannedObjects} OG object(s) and ${report.scannedFiles} static ` +
      `file(s). The index now holds ${total} row(s): ${breakdown}`,
    `By role: ${roleBreakdown}`,
  ];
  if (report.removed > 0) {
    parts.push(`${report.removed} row(s) removed for sources that no longer exist`);
  }
  if (report.failures.length > 0) {
    parts.push(
      `${report.failures.length} could not be derived: ${report.failures.slice(0, 3).join("; ")}` +
        (report.failures.length > 3 ? ` and ${report.failures.length - 3} more` : ""),
    );
  }
  return { message: `${parts.join(". ")}.` };
}
