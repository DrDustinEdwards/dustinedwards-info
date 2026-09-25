import { Form, data } from "react-router";

import { timed, timedLoader } from "~/lib/timing";
import { AdminAlert } from "~/components/admin/alert";
import { RowMenu } from "~/components/admin/row-menu";
import { humanCheck, statusSentence } from "~/lib/admin/check-copy.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { syncStatus } from "~/lib/operator/api.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin._index";

export function meta() {
  return [{ title: "Overview · Admin" }, { name: "robots", content: "noindex" }];
}

/** Reads the same instruments as /api/health and the operator tool, so it cannot disagree with them. */
export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);

    const [health, stores] = await Promise.all([
      timed(timings, "overview_health", () => runHealthChecks(env)),
      timed(timings, "overview_stores", () => syncStatus(env)),
    ]);

    return data({
      checks: health.checks,
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
  });
}

export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const { checks, stores } = loaderData;

  const failing = checks.filter((check) => !check.ok);
  const worst = failing[0];
  const worstCopy = worst ? humanCheck(worst) : null;

  const ordered = [...checks].sort((a, b) => Number(a.ok) - Number(b.ok));

  return (
    <>
      <div className="admin-page-head">
        <h1>Overview</h1>
        <p className="admin-page-status">{statusSentence(checks)}</p>
      </div>

      {/* A named region, not a live one: a `role` would announce a standing condition on every load. */}
      {worst && worstCopy ? (
        <AdminAlert
          tone="error"
          title={`${worstCopy.name} needs attention`}
          headingId="overview-worst"
          action={
            worstCopy.repair ? (
              <Form method="post" action={worstCopy.repair.action}>
                <input type="hidden" name="intent" value={worstCopy.repair.intent} />
                <button type="submit" className="btn">
                  {worstCopy.repair.label}
                </button>
              </Form>
            ) : null
          }
        >
          <p>{worstCopy.finding}</p>
        </AdminAlert>
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
                      {/* Word, color and border style: three channels, so it still reads under forced-colors. */}
                      <span className="status-pill" data-state={check.ok ? "published" : "draft"}>
                        {check.ok ? "passing" : "failing"}
                      </span>
                    </span>
                  </td>
                  <td className="admin-check-finding">{copy.finding}</td>
                  <td className="admin-check-actions">
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

      {/* No block is not evidence of health: `known: false` means unreadable, not empty. */}
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
