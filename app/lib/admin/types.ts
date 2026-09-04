/**
 * Shared types for the admin cockpit data layer. Type-only module: it is
 * imported by both server sources and client components, so nothing here may
 * execute code or touch bindings.
 */

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

/**
 * What a panel receives from a source that can fail.
 *
 * TWO ARMS SINCE 2026-08-25, and the third is what was removed. It was
 * `{ status: "stub"; data: T; note: string }`, and it existed so a panel could
 * render invented data while announcing that the real integration was pending.
 * Nothing renders invented data any more: the cockpit reads the health run and
 * `sync_status`, and the only remaining source, traffic, was already live or
 * error. An arm that says "this number is not real" is a licence to show a
 * number that is not real.
 *
 * `AdminDataSource` went with it. It was an interface with a `provider` field
 * naming Cloudflare, Vercel, Sentry, Recova, Foxing and Capsid, for a cockpit
 * watching one Worker: typing for a fleet that does not exist, which made the
 * page look designed rather than measured.
 */
export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "error"; data: null; message: string };

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

/**
 * Origin requests for the whole window, indexed by path, for the post list.
 *
 * `byPath` carries only paths that HAD activity. A slug missing from it means
 * one of two different things and the difference is why `complete` exists: with
 * `complete` true every path with activity is present, so a missing slug is a
 * measured zero; with it false the query's limit cut the result and a missing
 * slug is UNKNOWN. The column renders those two differently and must.
 *
 * The number is `SUM(_sample_interval)`, the same sampling-weighted aggregate
 * the origin-requests panel reports, and it is a FLOOR under readership rather
 * than a measure of it, for the reason `TrafficRow` states at length.
 */
export interface PostReadership {
  /** Days of history behind every count. */
  windowDays: number;
  /** Origin requests by path. Absent path means zero or unknown; see `complete`. */
  byPath: Record<string, number>;
  /** Distinct paths with activity in the window, from the total query. */
  pathsReturned: number;
  /** Whether `byPath` holds every path with activity, or the limit cut it. */
  complete: boolean;
}
