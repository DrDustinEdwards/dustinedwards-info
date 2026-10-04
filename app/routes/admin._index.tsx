import { Form, data } from "react-router";

import { Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Disclosure } from "capsomer/react/disclosure";
import { Panel } from "capsomer/react/panel";
import { Row, RowList } from "capsomer/react/row-list";
import { Pill, Status } from "capsomer/react/status";
import { StatTile, StatTiles } from "capsomer/react/stat-tile";

import { PageHead } from "~/components/admin/page-head";
import { timed, timedLoader } from "~/lib/timing";
import { humanCheck, statusSentence } from "~/lib/admin/check-copy.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { syncStatus } from "~/lib/operator/api.server";
import { getEnv } from "~/lib/context";
import { askStatusContext } from "~/lib/search/ask.server";
import type { Route } from "./+types/admin._index";

export function meta() {
  return [{ title: "Overview · Admin" }, { name: "robots", content: "noindex" }];
}

/** Reads the same instruments as /api/health and the operator tool, so it cannot disagree with them. */
export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);

    const [health, stores] = await Promise.all([
      /* The same memoized Ask listing the layout's badge uses, so the page lists the index once, not twice. */
      timed(timings, "overview_health", () => runHealthChecks(env, { timings, askStatus: context.get(askStatusContext) })),
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
  const lag = stores.d1Posts === stores.artifactPosts;

  return (
    <div className="app-page">
      <PageHead title="Overview" lead={statusSentence(checks)} />

      {/* A banner, not an alert: a standing condition is not announced on every load. */}
      {worst && worstCopy ? (
        <Banner
          tone="crit"
          title={`${worstCopy.name} needs attention`}
          actions={
            worstCopy.repair ? (
              <Form method="post" action={worstCopy.repair.action}>
                <input type="hidden" name="intent" value={worstCopy.repair.intent} />
                <Button type="submit">{worstCopy.repair.label}</Button>
              </Form>
            ) : null
          }
        >
          {worstCopy.finding}
        </Banner>
      ) : null}

      <Panel title="Checks" count={checks.length} flush>
        <div className="cap-table-wrap" role="region" aria-label="Checks" tabIndex={0}>
          <table className="cap-table">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">What it found</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((check) => {
                const copy = humanCheck(check);
                return (
                  <tr key={check.name}>
                    <th scope="row">
                      {copy.name}
                      {/* Word, shape and colour: three channels, so it still reads under forced-colors. */}
                      <Status tone={check.ok ? "ok" : "crit"}>{check.ok ? "passing" : "failing"}</Status>
                    </th>
                    <td>{copy.finding}</td>
                    <td>
                      {copy.repair ? (
                        <Form method="post" action={copy.repair.action}>
                          <input type="hidden" name="intent" value={copy.repair.intent} />
                          <Button type="submit" size="sm" aria-label={`${copy.repair.label}: ${copy.name}`}>
                            {copy.repair.label}
                          </Button>
                        </Form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <StatTiles label="Content">
        <StatTile
          label="In the repository"
          figure={stores.artifactPosts}
          unit="posts"
          detail="posts written and committed"
        />
        <StatTile
          label="Live on the site"
          tone={lag ? "ok" : "warn"}
          figure={stores.d1Posts}
          unit="posts"
          word={lag ? undefined : "Out of step"}
          detail={`${stores.d1PubliclyVisible} of them public to readers`}
        />
      </StatTiles>

      <Disclosure summary="Everything else this page could show">
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
      </Disclosure>

      {/* No block is not evidence of health: `known: false` means unreadable, not empty. */}
      {stores.divergences.known && stores.divergences.entries.length > 0 ? (
        <Panel title="Changes the site did not pick up" count={stores.divergences.entries.length} flush>
          <RowList label="Changes the site did not pick up">
            {stores.divergences.entries.map((entry) => (
              <Row
                key={`${entry.slug}-${entry.commitSha}`}
                title={
                  <>
                    {entry.slug} <Pill variant="outline">{entry.commitSha.slice(0, 7)}</Pill>
                  </>
                }
                detail={entry.error}
                status={<Status tone="crit">not updated</Status>}
              />
            ))}
          </RowList>
        </Panel>
      ) : null}
    </div>
  );
}
