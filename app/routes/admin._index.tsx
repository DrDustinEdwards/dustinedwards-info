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
 * THE COCKPIT, REWIRED TO REAL INSTRUMENTS.
 *
 * EVERY NUMBER HERE IS A READ-BACK, NEVER A COPY. Rule 17. `runHealthChecks` is
 * the same function `/api/health` runs and `syncStatus` is the same function the
 * operator tool runs, so this page cannot disagree with the alert that wakes
 * Dustin at 2am: they are reading one instrument.
 *
 * The SENTENCES come from `check-copy.mjs`, which owns nouns and verbs only; the
 * NUMBERS are substituted from each verdict's own counts.
 *
 * The media index and the Ask index are not fetched again here. They are two of
 * the health checks, and reading them separately would be a second reading of the
 * same fact on one page, free to disagree with the first.
 *
 * NOTHING WAS INVENTED TO FILL SPACE. A reader cannot tell a measured card from a
 * decorated one at a glance, so there are no decorated ones.
 *
 * IT COSTS REAL I/O, stated rather than hidden, which is why the two run
 * concurrently and each carries its own mark.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);

  /*
   * CONCURRENT, because they share nothing: the health run touches AI Search, R2
   * and D1, `syncStatus` touches GitHub and D1, and neither reads the other's
   * result.
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
   * ONE READ OF THE CHECKS FEEDS THE SENTENCE, THE NOTICE AND THE TABLE. They were
   * two computations and they drifted, so the notice is rendered from `worst`, the
   * same element the sentence already described.
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
       * ONE NOTICE, AND ONLY WHEN SOMETHING IS WRONG. A standing condition is not
       * news, so this is a named region rather than a live one: a `role` would announce
       * it on every load to a reader who came to do something else.
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
           * THE ONE PRIMARY ON THIS PAGE, and only because a repair exists. It posts to
           * the route that ALREADY owns the intent; `/admin` has a loader and no action, and
           * this pass does not give it one.
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
       * TWO FIGURES: what the repository holds and what the site is serving. Those two
       * can disagree, and the disagreement is why this panel exists.
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
       * An EMPTY list is the normal answer, so this renders only when there is
       * something to say. `known: false` is a third state and is not an empty list: a
       * store that cannot be read must say so rather than report zero, which is why the
       * absence of this block is not evidence of health on its own.
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
