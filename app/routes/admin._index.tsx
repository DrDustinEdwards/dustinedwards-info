import { Form, data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { RowMenu } from "~/components/admin/row-menu";
import { humanCheck, statusSentence } from "~/lib/admin/check-copy.mjs";
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
 * tool runs. Neither is reimplemented and neither is wrapped in an admin-side
 * calculation, so this page cannot disagree with the alert that wakes Dustin at
 * 2am: they are reading one instrument.
 *
 * **The sentences are no longer the verdicts' own `detail` strings.** Ruling 54
 * moved the wording to `check-copy.mjs`, because a verdict's detail is written
 * for whoever has to repair the mechanism and names it in the source's terms:
 * "content drift 2: 2 sha-changed, 0 file(s) with no row". What did NOT move is
 * the numbers. `check-copy.mjs` owns nouns and verbs only and substitutes every
 * figure from the verdict's own `counts`, and where a check ships no counts its
 * `detail` is still what renders. Rule 17 holds: the instrument that measured a
 * value is still the only thing that states it.
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
  const { checks, stores } = loaderData;

  /*
   * ONE READ OF THE CHECKS FEEDS THE SENTENCE, THE NOTICE AND THE TABLE.
   *
   * Ruling 54 makes "the status sentence and the notice never disagree" a rule
   * because they were two computations and they drifted: the sentence read
   * "every check the scheduled poll runs, answered here at page load" while the
   * page under it showed a failing check. Both now come out of this array, and
   * the notice is rendered from `worst`, which is the same element the sentence
   * already described.
   */
  const failing = checks.filter((check) => !check.ok);
  const worst = failing[0];
  const worstCopy = worst ? humanCheck(worst) : null;

  /* Failing first. Otherwise the order the instruments happen to run in, which
     is an implementation detail of `runHealthChecks` and not a priority. */
  const ordered = [...checks].sort((a, b) => Number(a.ok) - Number(b.ok));

  return (
    <>
      <div className="admin-page-head">
        <h1>Overview</h1>
        <p className="admin-page-status">{statusSentence(checks)}</p>
      </div>

      {/*
        ONE NOTICE, AND ONLY WHEN SOMETHING IS WRONG. A standing condition is
        not news, so this is a named region rather than a live one: a `role`
        would announce it on every load to a reader who came here to do
        something else. The heading names it and the words carry the meaning,
        so rule 1 holds without the edge being asked to say anything alone.
      */}
      {worst && worstCopy ? (
        <section className="admin-notice" data-tone="error" aria-labelledby="overview-worst">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>
          <div className="admin-notice-body">
            <h2 id="overview-worst">{worstCopy.name} needs attention</h2>
            <p>{worstCopy.finding}</p>
          </div>
          {/*
            THE ONE PRIMARY ON THIS PAGE, and only because a repair exists.
            It posts to the route that ALREADY owns the intent: `/admin` has a
            loader and no action, and this pass does not give it one.
          */}
          {worstCopy.repair ? (
            <Form method="post" action={worstCopy.repair.action} className="admin-notice-action">
              <input type="hidden" name="intent" value={worstCopy.repair.intent} />
              <button type="submit" className="btn">
                {worstCopy.repair.label}
              </button>
            </Form>
          ) : null}
        </section>
      ) : null}

      <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Checks">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col" className="admin-check-name">Check</th>
              <th scope="col" className="admin-check-finding">What it found</th>
              <th scope="col" className="admin-check-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((check) => {
              const copy = humanCheck(check);
              return (
                <tr key={check.name}>
                  <td className="admin-check-name">
                    <span className="admin-check-title">
                      <strong>{copy.name}</strong>
                      {/* The word first, then colour, then border style: three
                          channels, so it still reads under forced-colors. */}
                      <span className="status-pill" data-state={check.ok ? "published" : "draft"}>
                        {check.ok ? "passing" : "failing"}
                      </span>
                    </span>
                  </td>
                  <td className="admin-check-finding">{copy.finding}</td>
                  <td className="admin-check-actions">
                    {/* A menu ONLY where a repair exists. An empty kebab on
                        every passing row is the empty-Maintenance defect. */}
                    {copy.repair ? (
                      <RowMenu label={`Actions for ${copy.name}`}>
                        <Form method="post" action={copy.repair.action}>
                          <input type="hidden" name="intent" value={copy.repair.intent} />
                          <button type="submit" className="row-menu-item" data-menu-item>
                            {copy.repair.label}
                          </button>
                        </Form>
                      </RowMenu>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        TWO FIGURES. What the repository holds and what the site is serving:
        those two can disagree, and the disagreement is why this panel exists.
        The search index and the bindings were two more cards of the same size,
        and neither has ever been the answer to a question anyone opened this
        page with, so they are one disclosure below.
      */}
      <h2 className="admin-section-head">Content</h2>
      <div className="admin-figures">
        <div className="admin-figure">
          <p className="admin-figure-label">In the repository</p>
          <p className="admin-figure-value">{stores.artifactPosts}</p>
          <p className="admin-figure-hint">posts written and committed</p>
        </div>
        <div
          className="admin-figure"
          data-status={stores.d1Posts === stores.artifactPosts ? undefined : "warn"}
        >
          <p className="admin-figure-label">Live on the site</p>
          <p className="admin-figure-value">{stores.d1Posts}</p>
          <p className="admin-figure-hint">
            {stores.d1PubliclyVisible} of them public to readers
          </p>
        </div>
      </div>

      <details className="admin-explain">
        <summary>Everything else this page could show</summary>
        <dl>
          <dt>Search records</dt>
          <dd>{stores.searchIndexDocs} entries.</dd>
          <dt>Connections</dt>
          <dd>
            {stores.askConfigured && stores.githubConfigured
              ? "Search and the repository are both configured."
              : `Search ${stores.askConfigured ? "is" : "is NOT"} configured, the repository ${
                  stores.githubConfigured ? "is" : "is NOT"
                }.`}
          </dd>
        </dl>
        <p>
          Both are read from the same function the operator tool calls. They sit
          here rather than at the top because neither has ever been the answer to
          a question this page was opened with.
        </p>
      </details>

      {/*
        DIVERGENCES: commits that landed while the site did not follow. An EMPTY
        list is the normal answer, so this renders only when there is something
        to say. `known: false` is a third state and is not an empty list: a
        store that cannot be read must say so rather than report zero, which is
        why the absence of this block is not evidence of health on its own.
      */}
      {stores.divergences.known && stores.divergences.entries.length > 0 ? (
        <>
          <h2 className="admin-section-head">Changes the site did not pick up</h2>
          <ul className="tool-list">
            {stores.divergences.entries.map((entry) => (
              <li key={`${entry.slug}-${entry.commitSha}`} className="tool-row">
                <div>
                  <p className="tool-row-label">
                    {entry.slug} <span className="chip">{entry.commitSha.slice(0, 7)}</span>
                  </p>
                  <p className="muted">{entry.error}</p>
                </div>
                <span className="chip chip-error">not updated</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
