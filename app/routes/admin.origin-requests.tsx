import { EmptyState, Panel } from "~/components/admin/panel";
// Constants come from the SHARED module, never from the .server one. This
// component renders on the client too, where a .server import is stubbed out
// and every value from it arrives undefined: that shipped "Top NaN of 23
// paths" until check:admin-ui rendered the route and read the markup back.
import { CACHE_SENTENCE_PENDING_PROBE, TOP_N } from "~/lib/admin/origin-requests.mjs";
import { fetchTraffic } from "~/lib/admin/traffic.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.origin-requests";

/**
 * /admin/origin-requests, the first cockpit panel reading real data.
 *
 * WHAT THIS PANEL COUNTS, and why the wording is not decoration. Analytics
 * Engine is written from the Worker's response path, and `cache.enabled` means
 * an edge HIT can serve a reader without the Worker running. So this is a count
 * of ORIGIN REQUESTS: a floor under readership, never a measure of it. The
 * heading, the column and the caption all say so, and the words this panel must
 * not use are asserted by the gate rather than left to reviewer memory.
 *
 * NO CLIENT JAVASCRIPT. The admin plane is exempt from the progressive
 * enhancement law, but nothing here needs the exemption: it is a server
 * rendered table and one CSS width per bar.
 *
 * THE ERROR STATE IS THE ORDINARY STATE ON A DEV MACHINE. The read token is
 * optional by contract and local dev carries no secrets, so this route renders
 * its error every time it is opened outside production. That is why the loader
 * returns the error rather than throwing: a throw would take out the admin
 * route segment and replace the whole cockpit with an error boundary.
 */

export function meta() {
  return [{ title: "Origin requests · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { result: await fetchTraffic(getEnv(context)) };
}

/** en-dash-free, matching the formatting the rest of the site uses for dates. */
function formatWindow(days: number) {
  return days === 1 ? "the last day" : `the last ${days} days`;
}

export default function AdminTraffic({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  const report = result.status === "live" ? result.data : null;
  const rows = report?.rows ?? [];
  // The bar is proportional to the biggest row, not to the total, so the shape
  // of the distribution is readable when one path dominates.
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
        // Boring and visible. No colour carries the meaning on its own: it is a
        // sentence, and the panel chip beside the title already says error.
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
              {/* Assembled in JS for the same reason as the remainder line: one
                  text node, no spliced SSR comments to strip. */}
              <caption>
                {`Origin requests over ${formatWindow(report?.windowDays ?? 0)}, ` +
                  `sampling weighted. Analytics Engine samples under load, so each ` +
                  `figure is the sum of the sampling interval rather than a row count. ` +
                  (sampling
                    ? "Sampling is active in this window, so these are estimates. "
                    : "Sampling is not active at this volume, so these are exact. ") +
                  CACHE_SENTENCE_PENDING_PROBE}
              </caption>
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
                      {/*
                        The one inline style on this page, and it is the sanctioned
                        kind: a runtime numeric value no token could name. The
                        colour comes from the stylesheet.
                      */}
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
          {/*
            ONE STRING, not interpolated JSX children. React SSR splices
            <!-- --> between adjacent text nodes, so a sentence assembled from
            several expressions renders with comments through it and any check
            reading the markup has to strip them first. Building it in JS keeps
            it one text node.
          */}
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
