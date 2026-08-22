/**
 * Shared types for the admin cockpit data layer. Type-only module: it is
 * imported by both server sources and client components, so nothing here may
 * execute code or touch bindings.
 */

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

/**
 * What every panel receives from its data source. "stub" carries placeholder
 * data plus a note about what real integration is pending; "live" carries the
 * real thing once the source is wired.
 */
export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "stub"; data: T; note: string }
  | { status: "error"; data: null; message: string };

/**
 * A cockpit data source. Panels render a SourceResult and never care whether
 * it came from a stub or a real fetch, so wiring Cloudflare, Vercel, Sentry,
 * Recova, Foxing or Capsid later is a change to one fetch body.
 */
export interface AdminDataSource<T> {
  /** Stable id for caching and logging. */
  id: string;
  /** Human label shown in panel chrome. */
  label: string;
  /** Where live data will come from once wired. */
  provider: string;
  fetch(env: Env): Promise<SourceResult<T>>;
}

/** One card on the overview status board. */
export interface OverviewCard {
  id: string;
  label: string;
  value: string;
  hint: string;
  status: HealthStatus;
}

/**
 * One row of the origin-requests panel.
 *
 * ORIGIN REQUESTS, not reads. Analytics Engine is written from the Worker's
 * response path, and with the Workers cache on, an edge HIT can serve a reader
 * without the Worker running at all. The number is therefore a count of times
 * the origin was reached, which is a floor under readership rather than a
 * measure of it, and every label on this panel says so.
 *
 * `originRequests` is SAMPLING WEIGHTED: it is `SUM(_sample_interval)`, not a
 * row count. Analytics Engine samples under load and a raw count silently
 * undercounts once it does. `rows` carries the unweighted count purely as the
 * diagnostic that shows whether sampling is engaged yet.
 */
export interface TrafficRow {
  path: string;
  originRequests: number;
  rows: number;
}

/** What the origin-requests panel renders. */
export interface TrafficReport {
  windowDays: number;
  rows: TrafficRow[];
  /** Sum across every path in the window, so the top N can state its remainder. */
  totalOriginRequests: number;
  /** How many paths the query returned, before the display cap. */
  pathsReturned: number;
}

/** One admin-side control on the tools panel. */
export interface AdminTool {
  id: string;
  label: string;
  description: string;
  provider: string;
  ready: boolean;
}
