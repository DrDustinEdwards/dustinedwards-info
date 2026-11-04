// A reader that could write would turn a cache miss on the busiest page back into a health run.

import { HEALTH_SNAPSHOT_KEY, healthTile, type HealthTile } from "./snapshot.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

/**
 * A throw renders as `unreadable`, never as `missing`: the home page must render whatever KV is doing,
 * but a failed read is not the same fact as no snapshot having been written. It is logged.
 */
export async function readHealthTile(env: Env): Promise<HealthTile> {
  let stored: unknown;
  try {
    stored = await env.APP_KV.get(HEALTH_SNAPSHOT_KEY, "json");
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "health-snapshot-read-failed",
        detail: errorMessage(error),
      }),
    );
    return { state: "unreadable" };
  }
  return healthTile(stored, Date.now());
}
