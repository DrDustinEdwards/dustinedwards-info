import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { CardGrid, Panel, StatCard } from "~/components/admin/panel";
import { runHealthChecks } from "~/lib/health/checks.server";
import { syncStatus } from "~/lib/operator/api.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin._index";

export function meta() {
  return [{ title: "Overview · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * THE COCKPIT, REWIRED TO REAL INSTRUMENTS. Ruled 2026-08-25.
 *
 * What stood here was a status board typed for a fleet: an `AdminDataSource`
 * interface with a `provider` field naming Cloudflare, Vercel, Sentry, Recova,
 * Foxing and Capsid, a `stubSource()` helper, and a `SourceResult` union whose
 * third arm meant "placeholder data, real integration pending". Under it: one
 * card, reading "Auth / Single admin", whose green dot was a CONSTANT. It would
 * have rendered the same green with the session store unreachable, because
 * nothing on the page checked anything.
 *
 * The audits called it a stub and proposed deleting the page. That was the
 * wrong half. The page was hollow in July because there was nothing real to
 * show; August built the real things, and this is their human-readable view.
 *
 * ## EVERY NUMBER HERE IS A READ-BACK, NEVER A COPY. Rule 17.
 *
 * `runHealthChecks` is the same function `/api/health` runs and the scheduled
 * workflow polls. `syncStatus` is the same function the `sync_status` operator
 * tool runs. Neither is reimplemented, neither is wrapped in an admin-side
 * calculation, and the sentences below are the verdicts' OWN `detail` strings,
 * which already carry their numbers. So this page cannot disagree with the
 * alert that wakes Dustin at 2am: they are reading one instrument.
 *
 * **The media index and the Ask index are not fetched again here.** They are
 * two of the four health checks, and calling `mediaIndexStatus` or
 * `askIndexStatus` a second time to render them separately would be a second
 * reading of the same fact on one page, free to disagree with the first.
 *
 * ## WHAT IS NOT SHOWN, AND WHY THAT IS THE RULE
 *
 * Nothing was invented to fill space. Deploy history, error rates, portfolio
 * sites and Capsid memory are absent because no instrument in this repo reports
 * them; the previous board rendered five such cards reading "unknown" with
 * hints ending in "pending", which is a roadmap wearing the costume of
 * instrumentation. A reader cannot tell a measured card from a decorated one at
 * a glance, so there are no decorated ones.
 *
 * ## IT COSTS REAL I/O, STATED RATHER THAN HIDDEN
 *
 * The health run lists the Ask index, lists R2 and reads D1; `syncStatus`
 * lists the repository's post directory and counts four stores. That is the price
 * of a page whose entire purpose is to be true at the moment it is read, and it
 * is why the two run CONCURRENTLY and why each carries its own `timed` mark: an
 * instrument only sees what it was threaded through, so the cost of this page
 * is readable off its own Server-Timing header rather than guessed at.
 *
 * This plane is never edge-cached and has one user.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);

  /*
   * CONCURRENT, because they share nothing. Serial, these two would add their
   * latencies for no reason: the health run touches AI Search, R2 and D1, and
   * `syncStatus` touches GitHub and D1, and neither reads the other's result.
   */
  const [health, stores] = await Promise.all([
    timed(timings, "overview_health", () => runHealthChecks(env)),
    timed(timings, "overview_stores", () => syncStatus(env)),
  ]);

  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({
    checks: health.checks,
    failed: health.failed.length,
    stores: {
      headSha: stores.headSha,
      artifactPosts: stores.artifactPosts,
      d1Posts: stores.d1Posts,
      d1PubliclyVisible: stores.d1PubliclyVisible,
      searchIndexDocs: stores.searchIndexDocs,
      askConfigured: stores.askConfigured,
      githubConfigured: stores.githubConfigured,
      divergences: stores.divergences,
    },
  });
}

export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const { checks, failed, stores } = loaderData;

  return (
    <>
      <Panel
        title="Health"
        description={
          failed === 0
            ? "Every check the scheduled poll runs, answered here at page load."
            : `${failed} of ${checks.length} checks are failing. This is the same run /api/health reports.`
        }
      >
        <CardGrid>
          {checks.map((check) => (
            <StatCard
              key={check.name}
              label={check.name}
              /*
                The VERDICT is the value and the check's own sentence is the
                hint. `detail` already carries the counts on both the passing
                and the failing path, so nothing here formats a number: a
                template string in this file would be the second owner rule 17
                is about, and it would be the copy that goes stale.
              */
              value={check.ok ? "ok" : "FAILING"}
              hint={check.detail}
              status={check.ok ? "ok" : "error"}
            />
          ))}
        </CardGrid>
      </Panel>

      <Panel
        title="Stores"
        description="The four stores sync_status reports, read through the same function the operator tool calls."
      >
        <CardGrid>
          <StatCard
            label="Artifact"
            value={String(stores.artifactPosts)}
            hint={`post files in the repository at ${stores.headSha.slice(0, 7)}`}
            status="ok"
          />
          <StatCard
            label="D1 posts"
            value={String(stores.d1Posts)}
            hint={`${stores.d1PubliclyVisible} publicly visible`}
            /*
              A DISAGREEMENT IS THE INTERESTING STATE. D1 is derived from the
              artifact, so these two are supposed to be equal and the card says
              so by going amber rather than by making the reader compare two
              numbers on two cards. `warn`, not `error`: the sync that repairs
              it runs at every ship, so a gap here is usually a window rather
              than a fault.
            */
            status={stores.d1Posts === stores.artifactPosts ? "ok" : "warn"}
          />
          <StatCard
            label="Search index"
            value={String(stores.searchIndexDocs)}
            hint="records in search_identity_docsize, the shadow table a COUNT cannot lie about"
            status="ok"
          />
          <StatCard
            label="Bindings"
            value={stores.askConfigured && stores.githubConfigured ? "configured" : "incomplete"}
            hint={`Ask ${stores.askConfigured ? "configured" : "NOT configured"}, GitHub ${
              stores.githubConfigured ? "configured" : "NOT configured"
            }`}
            status={stores.askConfigured && stores.githubConfigured ? "ok" : "error"}
          />
        </CardGrid>
      </Panel>

      {/*
        DIVERGENCES: commits that landed while D1 did not follow. An EMPTY list
        is the normal answer, so the panel renders only when there is something
        to say. `known: false` is a third state and is not an empty list: a
        store that cannot be read must say so rather than report zero, which is
        why the absence of this panel is not evidence of health on its own.
      */}
      {stores.divergences.known && stores.divergences.entries.length > 0 ? (
        <Panel
          title="Divergences"
          description="Commits that landed while D1 did not follow. Recorded in KV, because a record of a D1 failure kept in D1 is missing exactly when it matters."
        >
          <ul className="tool-list">
            {stores.divergences.entries.map((entry) => (
              <li key={`${entry.slug}-${entry.commitSha}`} className="tool-row">
                <div>
                  <p className="tool-row-label">
                    {entry.slug} <span className="chip">{entry.commitSha.slice(0, 7)}</span>
                  </p>
                  <p className="muted">{entry.error}</p>
                </div>
                <span className="chip chip-error">D1 not updated</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
