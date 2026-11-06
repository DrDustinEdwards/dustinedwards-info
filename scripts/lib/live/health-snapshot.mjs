// The health-snapshot cron job's freshness, read off the colophon's health tile.

import { HEALTH_POLL_INTERVAL_SECONDS } from "../../../app/lib/health/snapshot.mjs";
import { check, get, strip } from "./client.mjs";

/* The site's health-snapshot cron job is the snapshot's one writer, so the tile's age is the job's. */
export async function run() {
  const bust = `vl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { text, status } = await get(`/colophon?health-snapshot=${bust}`);
  check("health-snapshot: the colophon rendered for the freshness read", status === 200);

  const attr = /data-health-age="(\d+)"/.exec(strip(text))?.[1];
  check(
    "health-snapshot: the colophon carries a health verdict rather than a placeholder",
    attr !== undefined,
    "no element on /colophon carries data-health-age. The tile is in its `missing` state, " +
      "which means the health-snapshot job has never stored a verdict. " +
      "Check the site Worker's cron (/health's cron check names the job) and the APP_KV binding.",
  );

  const age = attr === undefined ? Number.NaN : Number(attr);
  check(
    "health-snapshot: the tile's age is a number this gate can compare",
    Number.isInteger(age) && age >= 0,
    `data-health-age is ${JSON.stringify(attr ?? null)}. A non-numeric age makes the ` +
      `comparison below vacuous.`,
  );

  /* Two: one flaps; three is when the tile already says stale. */
  const bound = 2 * HEALTH_POLL_INTERVAL_SECONDS;
  check(
    "health-snapshot: the live health verdict is under two poll intervals old",
    Number.isInteger(age) && age < bound,
    `the tile reports a verdict ${age} second(s) old against a bound of ${bound}s ` +
      `(two ${HEALTH_POLL_INTERVAL_SECONDS}s intervals). The health-snapshot job has not stored a ` +
      `verdict recently: /health's cron check names it, and the site Worker's logs carry its error.`,
  );

  console.log(
    `  health-snapshot: verdict ${age}s old, bound ${bound}s ` +
      `(written ~${new Date(Date.now() - age * 1000).toISOString()})`,
  );
}
