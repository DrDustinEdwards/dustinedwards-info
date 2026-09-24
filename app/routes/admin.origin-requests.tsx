import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { EmptyState, Panel } from "~/components/admin/panel";
// Constants from the shared module, never the `.server` one: on the client a `.server` import is
// stubbed out and every value from it arrives undefined.
import { CACHE_SENTENCE, TOP_N } from "~/lib/admin/origin-requests.mjs";
import { fetchTraffic } from "~/lib/admin/traffic.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.origin-requests";

/**
 * An edge HIT serves without the Worker running, so this counts origin requests: a floor under
 * readership, never a measure of it. The loader returns errors rather than throwing, because a
 * throw would replace the whole admin segment with an error boundary.
 */

export function meta() {
  return [{ title: "Origin requests · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const result = await timed(timings, "ae_fetch_traffic", () => fetchTraffic(getEnv(context)));
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ result });
}


function formatWindow(days: number) {
  return days === 1 ? "the last day" : `the last ${days} days`;
}

export default function AdminTraffic({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  const report = result.status === "live" ? result.data : null;
  const rows = report?.rows ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.originRequests), 0);
  const shown = rows.reduce((sum, r) => sum + r.originRequests, 0);
  const remainder = report ? Math.max(0, report.totalOriginRequests - shown) : 0;
  const sampling = rows.some((r) => r.originRequests !== r.rows);

  return (
    <Panel
      title="Origin requests"
      description="Requests that reached the Worker, by path. Written server-side, with no client identifier."
      result={result}
    >
      {result.status === "error" ? (
        <p className="panel-error" role="status">
          {result.message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No origin requests recorded in this window."
          hint="Either nothing reached the Worker, or every serve came from the cache."
        />
      ) : (
        <>
          <div className="origin-table-scroll">
            <table className="origin-table">
              <thead>
                <tr>
                  <th scope="col">Path</th>
                  <th scope="col">Origin requests</th>
                  <th scope="col">
                    <span className="sr-only">Relative size</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.path}>
                    <th scope="row">{row.path}</th>
                    <td className="origin-count">{row.originRequests.toLocaleString()}</td>
                    <td className="origin-bar-cell">
                      <span
                        className="origin-bar"
                        style={{ width: `${max > 0 ? (row.originRequests / max) * 100 : 0}%` }}
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* One string: React SSR splices comment nodes between adjacent text children. */}
          {/* A disclosure, not a `<caption>`, which screen readers announce before every row. */}
          <details className="admin-explain origin-explain">
            <summary>What these counts include, and what they miss</summary>
            <p>
              {`Origin requests over ${formatWindow(report?.windowDays ?? 0)}, ` +
                `sampling weighted. Analytics Engine samples under load, so each ` +
                `figure is the sum of the sampling interval rather than a row count. ` +
                (sampling
                  ? "Sampling is active in this window, so these are estimates. "
                  : "Sampling is not active at this volume, so these are exact counts; " +
                    "under heavier load they become estimates and this panel looks " +
                    "exactly the same. ") +
                CACHE_SENTENCE}
            </p>
          </details>
          <p className="muted origin-remainder">
            {report && report.pathsReturned > rows.length
              ? `Top ${Math.min(TOP_N, rows.length)} of ${report.pathsReturned} paths. ` +
                `The remaining ${report.pathsReturned - rows.length} account for ` +
                `${remainder.toLocaleString()} origin requests.`
              : `All ${rows.length} paths with activity in the window.`}
          </p>
        </>
      )}
    </Panel>
  );
}
