// The watchdog's freshness, read off the home page's health tile.

import { HEALTH_POLL_INTERVAL_SECONDS } from "../../../app/lib/health/snapshot.mjs";
import { check, get, strip } from "./client.mjs";

/* Ship's poll also refreshes the snapshot, so this proves less just after a ship. */
export async function run() {
  const bust = `vl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { text, status } = await get(`/?watchdog=${bust}`);
  check("watchdog: the home page rendered for the freshness read", status === 200);

  const attr = /data-health-age="(\d+)"/.exec(strip(text))?.[1];
  check(
    "watchdog: the home page carries a health verdict rather than a placeholder",
    attr !== undefined,
    "no element on / carries data-health-age. The tile is in its `missing` state, " +
      "which means NOTHING has written the snapshot: not the watchdog, not ship, " +
      "Check the watchdog's cron and the APP_KV binding.",
  );

  const age = attr === undefined ? Number.NaN : Number(attr);
  check(
    "watchdog: the tile's age is a number this gate can compare",
    Number.isInteger(age) && age >= 0,
    `data-health-age is ${JSON.stringify(attr ?? null)}. A non-numeric age makes the ` +
      `comparison below vacuous.`,
  );

  /* Two: one flaps; three is when the tile already says stale. */
  const bound = 2 * HEALTH_POLL_INTERVAL_SECONDS;
  check(
    "watchdog: the live health verdict is under two poll intervals old",
    Number.isInteger(age) && age < bound,
    `the tile reports a verdict ${age} second(s) old against a bound of ${bound}s ` +
      `(two ${HEALTH_POLL_INTERVAL_SECONDS}s intervals). Nothing has polled /api/health ` +
      `recently, so the watchdog Worker is not firing. Check its Cron Trigger with ` +
      `\`npx wrangler deployments list -c wrangler.watchdog.jsonc\` and its logs; until it is ` +
      `fixed, only the external uptime monitors are watching.`,
  );

  console.log(
    `  watchdog: health verdict ${age}s old, bound ${bound}s ` +
      `(written ~${new Date(Date.now() - age * 1000).toISOString()})`,
  );
}
