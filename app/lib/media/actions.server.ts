import { mediaCounts, mediaRoleCounts } from "~/db";
import { rebuildMediaIndex } from "./rebuild.server";

// The rebuild on /admin/tools: the row count its confirmation shows, and the report of what the index holds after it.
// Every other media write is site-api's media library (app/lib/carrel/media-adapter.server.ts).

type Message = { message: string };

/** The row count the rebuild confirmation shows. */
export async function mediaRowTotal(env: Env) {
  const before = await mediaCounts(env);
  return before.reduce((sum, row) => sum + Number(row.n), 0);
}

/** Runs the rebuild the route has confirmed and reports what the index holds after it. */
export async function rebuildMedia(env: Env): Promise<Message> {
  const report = await rebuildMediaIndex(env);
  const after = await mediaCounts(env);
  const total = after.reduce((sum, row) => sum + Number(row.n), 0);
  const breakdown = after
    .map((row) => `${row.n} ${row.storage}/${row.kind}`)
    .sort()
    .join(", ");
  const roles = await mediaRoleCounts(env);
  const roleBreakdown = roles
    .map((row) => `${row.n} ${row.role}`)
    .sort()
    .join(", ");

  const parts = [
    `Rebuilt from ${report.scannedObjects} R2 object(s) and ${report.scannedFiles} static ` +
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
  parts.push("Alt text, captions and focal points were preserved");
  return { message: `${parts.join(". ")}.` };
}
